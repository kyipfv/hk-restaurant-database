import { RestaurantCrawler } from '../services/crawler.js';
import dotenv from 'dotenv';

dotenv.config();

async function initialCrawl(): Promise<void> {
  const crawler = new RestaurantCrawler();
  
  try {
    const result = await crawler.crawl({ full: false });
    
    process.stdout.write(`Initial crawl (preview) completed:\n`);
    process.stdout.write(`- Total records: ${result.totalRecords}\n`);
    process.stdout.write(`- New records: ${result.newRecords}\n`);
    process.stdout.write(`- Updated records: ${result.updatedRecords}\n`);
    process.stdout.write(`- Errors: ${result.errors}\n`);
    
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Crawl failed: ${error}\n`);
    process.exit(1);
  }
}

initialCrawl();