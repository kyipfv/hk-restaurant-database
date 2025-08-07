import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

async function runWeeklyCrawl(): Promise<void> {
  try {
    const { data: statusData } = await supabase
      .from('system')
      .select('value')
      .eq('key', 'status')
      .single();

    if (statusData?.value !== 'seeded') {
      process.stdout.write('System not seeded yet. Skipping cron job.\n');
      process.exit(0);
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    const response = await axios.post(`${backendUrl}/jobs/crawl`, null, {
      timeout: 600000,
    });

    process.stdout.write(`Weekly crawl completed: ${JSON.stringify(response.data)}\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Weekly crawl failed: ${error}\n`);
    process.exit(1);
  }
}

runWeeklyCrawl();