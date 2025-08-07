import { FastifyInstance } from 'fastify';
import axios from 'axios';

export async function debugRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/debug/fehd-test', async (_request, reply) => {
    try {
      // Test what FEHD actually returns
      const params = new URLSearchParams({
        page: '1',
        subType: 'All Licensed General Restaurants',
        licenseType: 'General Restaurant Licence',
        lang: 'en-us'
      });
      
      const url = `https://www.fehd.gov.hk/english/licensing/getData2.php?${params.toString()}`;
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.fehd.gov.hk/english/licensing/ecsvread_food2.html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      return reply.send({
        url: url,
        status: response.status,
        headers: response.headers,
        dataType: typeof response.data,
        dataLength: JSON.stringify(response.data).length,
        isArray: Array.isArray(response.data),
        sampleData: response.data ? 
          (Array.isArray(response.data) ? response.data.slice(0, 2) : response.data) : 
          'No data',
        rawData: response.data
      });
    } catch (error: any) {
      return reply.status(500).send({ 
        error: error.message,
        code: error.code,
        response: error.response?.data
      });
    }
  });

  // Test the HTML page to see what we actually get
  fastify.get('/debug/fehd-html', async (_request, reply) => {
    try {
      const url = 'https://www.fehd.gov.hk/english/licensing/ecsvread_food2.html?page=1&subType=All%20Licensed%20General%20Restaurants&licenseType=General%20Restaurant%20Licence&lang=en-us';
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        timeout: 10000,
      });

      // Look for table data in HTML
      const hasTable = response.data.includes('<table');
      const hasTbody = response.data.includes('<tbody');
      const hasTr = response.data.includes('<tr');
      
      // Extract first 500 chars after finding table
      let tableSnippet = 'No table found';
      if (hasTable) {
        const tableIndex = response.data.indexOf('<table');
        tableSnippet = response.data.substring(tableIndex, tableIndex + 1000);
      }

      return reply.send({
        url: url,
        hasTable,
        hasTbody,
        hasTr,
        htmlLength: response.data.length,
        tableSnippet,
        first2000Chars: response.data.substring(0, 2000)
      });
    } catch (error: any) {
      return reply.status(500).send({ 
        error: error.message 
      });
    }
  });
}