import { FastifyInstance } from 'fastify';
import { TestCrawler } from '../services/test-crawler.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function testRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/test/load-sample-data', async (_request, reply) => {
    try {
      const crawler = new TestCrawler();
      const result = await crawler.crawl();

      return reply.send({
        success: true,
        message: 'Sample data loaded successfully',
        result
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to load sample data' 
      });
    }
  });

  // Test what FEHD actually returns
  fastify.get('/test/check-fehd', async (_request, reply) => {
    try {
      const url = 'https://www.fehd.gov.hk/english/licensing/ecsvread_food2.html?page=1&subType=All%20Licensed%20General%20Restaurants&licenseType=General%20Restaurant%20Licence&lang=en-us';
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      
      // Find all tables
      const tables = $('table');
      const tableInfo = tables.map((i, table) => {
        const rows = $(table).find('tr');
        const firstRow = rows.first();
        const firstRowCells = firstRow.find('td, th');
        const secondRow = rows.eq(1);
        const secondRowCells = secondRow.find('td');
        
        return {
          tableIndex: i,
          totalRows: rows.length,
          firstRowCellCount: firstRowCells.length,
          firstRowTexts: firstRowCells.map((_j, cell) => $(cell).text().trim()).get(),
          secondRowCellCount: secondRowCells.length,
          secondRowTexts: secondRowCells.map((_j, cell) => $(cell).text().trim()).get(),
          hasDataRows: rows.length > 1
        };
      }).get();

      // Try to find restaurant data
      let restaurantData: any = null;
      tables.each((i, table) => {
        const rows = $(table).find('tr');
        rows.each((j, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 5) {
            const cellTexts = cells.map((_k, cell) => $(cell).text().trim()).get();
            // Look for something that looks like restaurant data
            if (cellTexts.some(text => text && text.includes('Restaurant')) || 
                cellTexts.some(text => text && text.match(/\d{2}\s+\d{2}\s+\d{6}/))) {
              restaurantData = {
                foundAtTable: i,
                foundAtRow: j,
                cellCount: cells.length,
                cellTexts: cellTexts.slice(0, 10) // First 10 cells
              };
              return false; // Break out of loop
            }
          }
          return true;
        });
        if (restaurantData) return false;
        return true;
      });

      return reply.send({
        url,
        htmlLength: response.data.length,
        tableCount: tables.length,
        tableInfo,
        restaurantData,
        htmlSnippet: response.data.substring(0, 500),
        containsRestaurantWord: response.data.includes('Restaurant'),
        containsLicenceWord: response.data.includes('Licence')
      });
    } catch (error: any) {
      return reply.status(500).send({ 
        error: error.message,
        stack: error.stack
      });
    }
  });
}