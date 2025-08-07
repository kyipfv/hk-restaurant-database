import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase, Restaurant } from '../lib/supabase.js';
import { CrawlOptions, CrawlResult } from '../types/index.js';
import { parse } from 'date-fns';

// The FEHD site loads data dynamically, we need to call their data endpoint directly
const DATA_URL = 'https://www.fehd.gov.hk/english/licensing/text/LP_Restaurants_EN.XML';
const RECORDS_PER_PAGE = 50; // We'll process in batches
const PREVIEW_LIMIT = 1000;
const TOTAL_RECORDS = 12545;

export class RestaurantCrawler {
  private async fetchAllData(): Promise<string> {
    try {
      // FEHD provides an XML file with all restaurant data
      const response = await axios.get(DATA_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/xml, text/xml, */*',
        },
        timeout: 60000, // Longer timeout for large file
      });
      
      return response.data;
    } catch (error) {
      // If XML fails, try the CSV endpoint
      try {
        const csvUrl = 'https://www.fehd.gov.hk/english/licensing/LP_Restaurants_EN.csv';
        const response = await axios.get(csvUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/csv, */*',
          },
          timeout: 60000,
        });
        return response.data;
      } catch (csvError) {
        throw new Error(`Failed to fetch data: ${error}`);
      }
    }
  }

  private parseXMLData(xmlData: string): Array<Partial<Restaurant>> {
    const restaurants: Array<Partial<Restaurant>> = [];
    const $ = cheerio.load(xmlData, { xmlMode: true });
    
    // Look for restaurant entries in XML
    $('Restaurant, RESTAURANT, restaurant').each((i, elem) => {
      const $elem = $(elem);
      
      const restaurant: Partial<Restaurant> = {
        name: $elem.find('NAME, Name, name').text().trim() || 
              $elem.find('SHOP_SIGN, ShopSign, shopsign').text().trim(),
        district: $elem.find('DISTRICT, District, district').text().trim() || null,
        address: $elem.find('ADDRESS, Address, address').text().trim() || null,
        licence_no: $elem.find('LICENCE_NO, LicenceNo, licence_no, LICENSE_NO').text().trim().replace(/\s+/g, ''),
        licence_type: $elem.find('TYPE, Type, type').text().trim() || 'General Restaurant Licence',
        valid_til: this.parseDate($elem.find('EXPIRY, Expiry, expiry, VALID_TIL, ValidTil').text().trim()),
      };
      
      if (restaurant.name && restaurant.licence_no) {
        restaurants.push(restaurant);
      }
    });

    // If no restaurants found with that structure, try CSV parsing
    if (restaurants.length === 0) {
      return this.parseCSVData(xmlData);
    }
    
    return restaurants;
  }

  private parseCSVData(csvData: string): Array<Partial<Restaurant>> {
    const restaurants: Array<Partial<Restaurant>> = [];
    const lines = csvData.split('\n');
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV - handle quoted fields
      const fields = this.parseCSVLine(line);
      
      if (fields.length >= 5) {
        const restaurant: Partial<Restaurant> = {
          name: fields[0] || fields[1], // Sometimes name is in different position
          district: fields[1] || fields[2] || null,
          address: fields[2] || fields[3] || null,
          licence_no: (fields[3] || fields[4] || '').replace(/\s+/g, ''),
          licence_type: fields[4] || fields[5] || 'General Restaurant Licence',
          valid_til: this.parseDate(fields[5] || fields[6] || ''),
        };
        
        if (restaurant.name && restaurant.licence_no) {
          restaurants.push(restaurant);
        }
      }
    }
    
    return restaurants;
  }

  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private parseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    
    // Remove parentheses if present
    dateStr = dateStr.replace(/[()]/g, '').trim();
    
    // Try different date formats
    const formats = ['dd-MM-yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
    
    for (const format of formats) {
      try {
        const parsed = parse(dateStr, format, new Date());
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {
        // Try next format
      }
    }
    
    return null;
  }

  private async upsertRestaurant(restaurant: Partial<Restaurant>): Promise<{ isNew: boolean }> {
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id')
      .or(`licence_no.eq.${restaurant.licence_no},and(name.eq.${restaurant.name},address.eq.${restaurant.address})`)
      .single();

    if (existing) {
      await supabase
        .from('restaurants')
        .update({
          ...restaurant,
          new_flag: false,
        })
        .eq('id', existing.id);
      return { isNew: false };
    } else {
      const now = new Date().toISOString();
      await supabase.from('restaurants').insert({
        ...restaurant,
        first_seen: now,
        new_flag: true,
      });
      return { isNew: true };
    }
  }

  async crawl(options: CrawlOptions = {}): Promise<CrawlResult> {
    const { full = false } = options;
    const result: CrawlResult = {
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errors: 0,
    };

    try {
      console.log('Fetching restaurant data from FEHD...');
      const data = await this.fetchAllData();
      console.log(`Received ${data.length} bytes of data`);
      
      const restaurants = this.parseXMLData(data);
      console.log(`Parsed ${restaurants.length} restaurants`);
      
      if (restaurants.length === 0) {
        throw new Error('No restaurants found in data');
      }
      
      // Process restaurants
      const limit = full ? restaurants.length : Math.min(PREVIEW_LIMIT, restaurants.length);
      
      for (let i = 0; i < limit; i++) {
        try {
          const restaurant = restaurants[i];
          if (restaurant && restaurant.licence_no) {
            const { isNew } = await this.upsertRestaurant(restaurant);
            result.totalRecords++;
            if (isNew) {
              result.newRecords++;
            } else {
              result.updatedRecords++;
            }
          }
        } catch (error) {
          console.error('Error processing restaurant:', error);
          result.errors++;
        }
      }
      
      // Update old restaurants to not be "new" anymore (30 days old)
      await supabase
        .from('restaurants')
        .update({ new_flag: false })
        .lt('first_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Update system status
      const newStatus = full ? 'seeded' : 'preview_done';
      await supabase.from('system').upsert({
        key: 'status',
        value: newStatus,
        updated_at: new Date().toISOString(),
      });
      
      console.log(`Crawl completed: ${result.totalRecords} total, ${result.newRecords} new, ${result.updatedRecords} updated, ${result.errors} errors`);
      
    } catch (error) {
      console.error('Crawl failed:', error);
      throw error;
    }

    return result;
  }
}