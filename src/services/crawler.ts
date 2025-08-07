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
    // Direct URL approach - the FEHD site can be accessed directly with parameters
    const url = `${BASE_URL}?page=${pageNumber}&subType=All%20Licensed%20General%20Restaurants&licenseType=General%20Restaurant%20Licence&lang=en-us`;
    
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

  private parseRestaurant(row: cheerio.Cheerio<any>): Partial<Restaurant> | null {
    const $ = cheerio.load(row.html() || '');
    const cells = $('td').toArray();

    if (cells.length < 6) return null;

    const name = $(cells[0]).text().trim();
    const district = $(cells[1]).text().trim();
    const address = $(cells[2]).text().trim();
    const licenceNo = $(cells[3]).text().trim();
    const licenceType = $(cells[4]).text().trim();
    const validTilText = $(cells[5]).text().trim();

    if (!name || !licenceNo) return null;

    let validTil: string | null = null;
    if (validTilText) {
      try {
        const parsed = parse(validTilText, 'dd/MM/yyyy', new Date());
        if (!isNaN(parsed.getTime())) {
          validTil = parsed.toISOString().split('T')[0];
        }
      } catch {
        validTil = null;
      }
    }

    return {
      name,
      district: district || null,
      address: address || null,
      licence_no: licenceNo,
      licence_type: licenceType || 'General Restaurant Licence',
      valid_til: validTil,
    };
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
      pagesToCrawl = Math.ceil(PREVIEW_LIMIT / RECORDS_PER_PAGE);
    } else {
      if (currentStatus === 'preview_done') {
        actualStartPage = Math.ceil(PREVIEW_LIMIT / RECORDS_PER_PAGE) + 1;
        pagesToCrawl = Math.ceil(TOTAL_RECORDS / RECORDS_PER_PAGE) - actualStartPage + 1;
      } else {
        pagesToCrawl = Math.ceil(TOTAL_RECORDS / RECORDS_PER_PAGE);
      }
    }

    for (let page = actualStartPage; page < actualStartPage + pagesToCrawl; page++) {
      try {
        const html = await this.fetchPage(page);
        const $ = cheerio.load(html);
        
        // Debug: Log if we got HTML
        if (!html || html.length < 100) {
          throw new Error('No HTML content received');
        }
        
        // Look for table rows - FEHD site has data in table format
        // Skip header row (index 0)
        const rows = $('tr').toArray().slice(1);

        for (const row of rows) {
          try {
            const restaurant = this.parseRestaurant($(row));
            if (restaurant) {
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

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        result.errors++;
      }
    }

    await supabase.from('restaurants').update({ new_flag: false }).lt('first_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const newStatus = full ? 'seeded' : 'preview_done';
    await supabase.from('system').upsert({
      key: 'status',
      value: newStatus,
      updated_at: new Date().toISOString(),
    });

    return result;
  }
}