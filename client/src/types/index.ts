export interface Restaurant {
  id: number;
  name: string;
  district: string | null;
  address: string | null;
  licence_no: string;
  licence_type: string | null;
  valid_til: string | null;
  first_seen: string;
  new_flag: boolean;
}

export interface RestaurantResponse {
  restaurants: Restaurant[];
  total: number;
}

export interface DistrictResponse {
  districts: string[];
}