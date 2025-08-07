export interface CrawlOptions {
  full?: boolean;
  startPage?: number;
}

export interface CrawlResult {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  errors: number;
}

export interface RestaurantQuery {
  district?: string;
  search?: string;
  sort?: 'valid_til' | 'newest';
  limit?: number;
  offset?: number;
}