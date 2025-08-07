import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase, Restaurant } from '../lib/supabase.js';
import { CrawlOptions, CrawlResult } from '../types/index.js';
import { parse } from 'date-fns';

const BASE_URL = 'https://www.fehd.gov.hk/english/licensing/ecsvread_food2.html';
const RECORDS_PER_PAGE = 20;
const PREVIEW_LIMIT = 1000;
const TOTAL_RECORDS = 12545;

export class RestaurantCrawler {
  private async fetchPage(pageNumber: number): Promise<string> {
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch page ${pageNumber}: ${error}`);
    }
  }

  private parseRestaurant(row: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): Partial<Restaurant> | null {
    try {
      // FEHD table has columns: Row# | Shopsign | District | Address | Licence/Permit Number (Valid till) | Licence/Permit Type
      const cells = row.find('td');
      
      if (cells.length < 6) return null;
      
      // Skip the first cell (row number)
      const name = $(cells[1]).text().trim();
      const district = $(cells[2]).text().trim();
      const address = $(cells[3]).text().trim();
      const licenceInfo = $(cells[4]).text().trim(); // Contains both licence number and expiry date
      const licenceType = $(cells[5]).text().trim();
      
      // Skip if no name
      if (!name) return null;
      
      // Parse licence number and expiry date from combined field
      // Format: "22 98 803448 (27-09-2025)"
      let licenceNo = '';
      let validTil: string | null = null;
      
      if (licenceInfo) {
        // Extract licence number (everything before the parenthesis)
        const licenceMatch = licenceInfo.match(/^([^(]+)/);
        if (licenceMatch) {
          licenceNo = licenceMatch[1].trim().replace(/\s+/g, ''); // Remove spaces from licence number
        }
        
        // Extract expiry date from parentheses
        const dateMatch = licenceInfo.match(/\(([^)]+)\)/);
        if (dateMatch) {
          const expiryDateText = dateMatch[1];
          try {
            // FEHD format is DD-MM-YYYY
            const parsed = parse(expiryDateText, 'dd-MM-yyyy', new Date());
            if (!isNaN(parsed.getTime())) {
              validTil = parsed.toISOString().split('T')[0];
            }
          } catch {
            validTil = null;
          }
        }
      }
      
      // Skip if no licence number
      if (!licenceNo) return null;

      return {
        name,
        district: district || null,
        address: address || null,
        licence_no: licenceNo,
        licence_type: licenceType || 'General Restaurant Licence',
        valid_til: validTil,
      };
    } catch (error) {
      console.error('Error parsing restaurant row:', error);
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

    console.log(`Starting crawl: ${pagesToCrawl} pages from page ${actualStartPage}`);

    for (let page = actualStartPage; page < actualStartPage + pagesToCrawl; page++) {
      try {
        console.log(`Fetching page ${page}...`);
        const html = await this.fetchPage(page);
        const $ = cheerio.load(html);
        
        // Find the main table with restaurant data
        // FEHD uses a table with class or within a specific div
        let rows = $('table tr').toArray();
        
        // Skip header row(s)
        rows = rows.filter((row) => {
          const firstCell = $(row).find('td').first().text().trim();
          // Skip if it's a header or empty row or just a number (row number)
          return firstCell && 
                 !firstCell.includes('Shopsign') && 
                 !firstCell.includes('Company Name') && 
                 !firstCell.match(/^\d+$/); // Skip if it's just a number
        });

        console.log(`Found ${rows.length} rows on page ${page}`);

        if (rows.length === 0) {
          // No more data, we've reached the end
          console.log(`No data found on page ${page}, stopping crawl`);
          break;
        }

        for (const row of rows) {
          try {
            const restaurant = this.parseRestaurant($(row), $);
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
            console.error('Error processing restaurant:', error);
            result.errors++;
          }
        }

        if (!full && result.totalRecords >= PREVIEW_LIMIT) {
          break;
        }

        // Be nice to the server - wait 1 second between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error on page ${page}:`, error);
        result.errors++;
        // Continue with next page even if one fails
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

    return result;
  }
}