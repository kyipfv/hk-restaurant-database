import axios from 'axios';
import type { Restaurant, RestaurantResponse, DistrictResponse } from '../types';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

export const restaurantApi = {
  async getRestaurants(params: {
    district?: string;
    search?: string;
    sort?: 'valid_til' | 'newest';
    limit?: number;
    offset?: number;
  }): Promise<RestaurantResponse> {
    const { data } = await axios.get<RestaurantResponse>(`${API_BASE}/api/restaurants`, {
      params,
    });
    return data;
  },

  async getDistricts(): Promise<string[]> {
    const { data } = await axios.get<DistrictResponse>(`${API_BASE}/api/districts`);
    return data.districts;
  },
};