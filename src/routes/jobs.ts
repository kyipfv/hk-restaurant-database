import { FastifyInstance } from 'fastify';
import { RestaurantCrawler } from '../services/crawler.js';
import { supabase } from '../lib/supabase.js';

export async function jobRoutes(fastify: FastifyInstance): Promise<void> {
  const crawler = new RestaurantCrawler();

  fastify.post<{ Querystring: { full?: string } }>('/jobs/crawl', async (request, reply) => {
    try {
      const full = request.query.full === 'true';

      const { data: statusData } = await supabase
        .from('system')
        .select('value')
        .eq('key', 'status')
        .single();

      const currentStatus = statusData?.value;

      if (currentStatus === 'seeded' && !full) {
        return reply.status(400).send({ 
          error: 'Database already seeded. Use weekly cron job for updates.' 
        });
      }

      const result = await crawler.crawl({ full });

      return reply.send({
        success: true,
        result,
        status: full ? 'seeded' : 'preview_done'
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Crawl failed' 
      });
    }
  });

  fastify.get('/jobs/status', async (_request, reply) => {
    try {
      const { data } = await supabase
        .from('system')
        .select('value, updated_at')
        .eq('key', 'status')
        .single();

      return reply.send({
        status: data?.value || 'not_started',
        lastUpdated: data?.updated_at
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to get status' 
      });
    }
  });
}