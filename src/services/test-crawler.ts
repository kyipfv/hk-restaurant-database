import { supabase, Restaurant } from '../lib/supabase.js';
import { CrawlResult } from '../types/index.js';

export class TestCrawler {
  async crawl(): Promise<CrawlResult> {
    const result: CrawlResult = {
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errors: 0,
    };

    // Sample test data to verify database connection works
    const testRestaurants = [
      {
        name: 'Maxim\'s Palace',
        district: 'Central',
        address: '2/F, City Hall, Central, Hong Kong',
        licence_no: 'TEST-001',
        licence_type: 'General Restaurant Licence',
        valid_til: '2025-12-31',
      },
      {
        name: 'Tsui Wah Restaurant',
        district: 'Causeway Bay',
        address: '15-19 Percival Street, Causeway Bay',
        licence_no: 'TEST-002',
        licence_type: 'General Restaurant Licence',
        valid_til: '2025-11-30',
      },
      {
        name: 'Din Tai Fung',
        district: 'Tsim Sha Tsui',
        address: 'Shop 130, 3/F, Silvercord, 30 Canton Road, TST',
        licence_no: 'TEST-003',
        licence_type: 'General Restaurant Licence',
        valid_til: '2025-10-31',
      },
      {
        name: 'Cafe de Coral',
        district: 'Wan Chai',
        address: '89 Hennessy Road, Wan Chai',
        licence_no: 'TEST-004',
        licence_type: 'General Restaurant Licence',
        valid_til: '2025-09-30',
      },
      {
        name: 'Tai Hing Roast Restaurant',
        district: 'Mong Kok',
        address: '55 Dundas Street, Mong Kok',
        licence_no: 'TEST-005',
        licence_type: 'General Restaurant Licence',
        valid_til: '2025-08-31',
      }
    ];

    for (const restaurant of testRestaurants) {
      try {
        const { data: existing } = await supabase
          .from('restaurants')
          .select('id')
          .eq('licence_no', restaurant.licence_no)
          .single();

        if (existing) {
          await supabase
            .from('restaurants')
            .update(restaurant)
            .eq('id', existing.id);
          result.updatedRecords++;
        } else {
          await supabase
            .from('restaurants')
            .insert({
              ...restaurant,
              first_seen: new Date().toISOString(),
              new_flag: true,
            });
          result.newRecords++;
        }
        result.totalRecords++;
      } catch (error) {
        result.errors++;
      }
    }

    // Update system status
    await supabase.from('system').upsert({
      key: 'status',
      value: 'test_data_loaded',
      updated_at: new Date().toISOString(),
    });

    return result;
  }
}