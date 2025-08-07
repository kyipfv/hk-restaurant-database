import { FastifyInstance } from 'fastify';
import { TestCrawler } from '../services/test-crawler.js';

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
}