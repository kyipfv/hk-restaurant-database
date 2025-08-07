import { supabase, Restaurant } from '../lib/supabase.js';
import { RestaurantQuery } from '../types/index.js';

export class RestaurantService {
  async getRestaurants(query: RestaurantQuery): Promise<{ restaurants: Restaurant[]; total: number }> {
    const { district, search, sort, limit = 100, offset = 0 } = query;

    let supabaseQuery = supabase
      .from('restaurants')
      .select('*', { count: 'exact' });

    if (district) {
      supabaseQuery = supabaseQuery.eq('district', district);
    }

    if (search) {
      supabaseQuery = supabaseQuery.ilike('name', `%${search}%`);
    }

    if (sort === 'valid_til') {
      supabaseQuery = supabaseQuery.order('valid_til', { ascending: false, nullsFirst: false });
    } else {
      supabaseQuery = supabaseQuery.order('new_flag', { ascending: false })
        .order('first_seen', { ascending: false });
    }

    supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);

    const { data, error, count } = await supabaseQuery;

    if (error) {
      throw new Error(`Failed to fetch restaurants: ${error.message}`);
    }

    return {
      restaurants: data || [],
      total: count || 0,
    };
  }

  async getDistricts(): Promise<string[]> {
    const { data, error } = await supabase
      .from('restaurants')
      .select('district')
      .not('district', 'is', null)
      .order('district');

    if (error) {
      throw new Error(`Failed to fetch districts: ${error.message}`);
    }

    const uniqueDistricts = [...new Set(data?.map((r) => r.district).filter(Boolean))];
    return uniqueDistricts;
  }
}