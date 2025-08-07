import axios from 'axios';
import { supabase, Restaurant } from '../lib/supabase.js';
import { CrawlOptions, CrawlResult } from '../types/index.js';
import { parse } from 'date-fns';

// FEHD uses a JSON API endpoint for the actual data
const BASE_URL = 'https://www.fehd.gov.hk/english/licensing/getData2.php';
const RECORDS_PER_PAGE = 50; // FEHD returns 50 records per page
const PREVIEW_LIMIT = 1000;
const TOTAL_RECORDS = 12545;

interface FEHDRestaurant {
  companyName: string;
  district: string;
  address: string;
  licenseNo: string;
  licenseType: string;
  expiryDate: string; // Format: DD-MM-YYYY
}

export class RestaurantCrawler {
  private async fetchPage(pageNumber: number): Promise<FEHDRestaurant[]> {
    const params = new URLSearchParams({
      page: pageNumber.toString(),
      subType: 'All Licensed General Restaurants',
      licenseType: 'General Restaurant Licence',
      lang: 'en-us'
    });
    
    const url = `${BASE_URL}?${params.toString()}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.fehd.gov.hk/english/licensing/ecsvread_food2.html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 30000,
      });

      // FEHD returns JSON data
      if (response.data && Array.isArray(response.data)) {
        return response.data as FEHDRestaurant[];
      }
      
      return [];
    } catch (error) {
      throw new Error(`Failed to fetch page ${pageNumber}: ${error}`);
    }
  }

  private parseRestaurant(data: FEHDRestaurant): Partial<Restaurant> | null {
    try {
      // Parse date from DD-MM-YYYY to YYYY-MM-DD
      let validTil: string | null = null;
      if (data.expiryDate) {
        try {
          const parsed = parse(data.expiryDate, 'dd-MM-yyyy', new Date());
          if (!isNaN(parsed.getTime())) {
            validTil = parsed.toISOString().split('T')[0];
          }
        } catch {
          validTil = null;
        }
      }

      return {
        name: data.companyName || '',
        district: data.district || null,
        address: data.address || null,
        licence_no: data.licenseNo || '',
        licence_type: data.licenseType || 'General Restaurant Licence',
        valid_til: validTil,
      };
    } catch (error) {
      return null;
    }
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
    const { full = false, startPage = 1 } = options;
    const result: CrawlResult = {
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errors: 0,
    };

    const { data: statusData } = await supabase
      .from('system')
      .select('value')
      .eq('key', 'status')
      .single();

    const currentStatus = statusData?.value;

    let pagesToCrawl: number;
    let actualStartPage = startPage;

    if (!full) {
      // Preview mode: first 1000 records
      pagesToCrawl = Math.ceil(PREVIEW_LIMIT / RECORDS_PER_PAGE);
    } else {
      if (currentStatus === 'preview_done') {
        // Continue from where preview left off
        actualStartPage = Math.ceil(PREVIEW_LIMIT / RECORDS_PER_PAGE) + 1;
        pagesToCrawl = Math.ceil(TOTAL_RECORDS / RECORDS_PER_PAGE) - actualStartPage + 1;
      } else {
        // Full crawl from beginning
        pagesToCrawl = Math.ceil(TOTAL_RECORDS / RECORDS_PER_PAGE);
      }
    }

    for (let page = actualStartPage; page < actualStartPage + pagesToCrawl; page++) {
      try {
        const restaurants = await this.fetchPage(page);
        
        if (!restaurants || restaurants.length === 0) {
          // No more data, stop crawling
          break;
        }

        for (const restaurantData of restaurants) {
          try {
            const restaurant = this.parseRestaurant(restaurantData);
            if (restaurant && restaurant.licence_no) {
              const { isNew } = await this.upsertRestaurant(restaurant);
              result.totalRecords++;
              if (isNew) {
                result.newRecords++;
              } else {
                result.updatedRecords++;
              }

              if (!full && result.totalRecords >= PREVIEW_LIMIT) {
                break;
              }
            }
          } catch (error) {
            result.errors++;
          }
        }

        if (!full && result.totalRecords >= PREVIEW_LIMIT) {
          break;
        }

        // Be nice to the server
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        result.errors++;
        // Log but continue with next page
        console.error(`Error on page ${page}:`, error);
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

    return result;
  }
}