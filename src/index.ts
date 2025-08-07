import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { restaurantRoutes } from './routes/restaurants.js';
import { jobRoutes } from './routes/jobs.js';
import { testRoutes } from './routes/test.js';
import * as path from 'path';

dotenv.config();

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'development',
});

async function start(): Promise<void> {
  try {
    await fastify.register(cors, {
      origin: true,
    });

    await fastify.register(restaurantRoutes);
    await fastify.register(jobRoutes);
    await fastify.register(testRoutes);

    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    if (process.env.NODE_ENV === 'production') {
      const staticPlugin = await import('@fastify/static');
      fastify.register(staticPlugin.default, {
        root: path.join(process.cwd(), 'client', 'dist'),
        prefix: '/',
      });

      fastify.setNotFoundHandler((req, reply) => {
        if (!req.url.startsWith('/api') && !req.url.startsWith('/jobs')) {
          reply.sendFile('index.html');
        } else {
          reply.status(404).send({ error: 'Not found' });
        }
      });
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

    await fastify.listen({ port, host });

    if (process.env.NODE_ENV !== 'production') {
      fastify.log.info(`Server listening at http://localhost:${port}`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();