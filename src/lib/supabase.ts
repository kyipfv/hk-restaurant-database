import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Restaurant {
  id?: number;
  name: string;
  district: string | null;
  address: string | null;
  licence_no: string;
  licence_type: string | null;
  valid_til: string | null;
  first_seen?: string;
  new_flag?: boolean;
}

export interface SystemStatus {
  id?: number;
  key: string;
  value: string;
  updated_at?: string;
}