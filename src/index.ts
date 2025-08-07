import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { restaurantRoutes } from './routes/restaurants.js';
import { jobRoutes } from './routes/jobs.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    if (process.env.NODE_ENV === 'production') {
      fastify.register(import('@fastify/static'), {
        root: path.join(__dirname, '..', 'client', 'dist'),
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