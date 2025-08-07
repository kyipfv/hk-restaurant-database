import { FastifyInstance } from 'fastify';
import { RestaurantService } from '../services/restaurant.js';
import { RestaurantQuery } from '../types/index.js';

export async function restaurantRoutes(fastify: FastifyInstance): Promise<void> {
  const restaurantService = new RestaurantService();

  fastify.get<{ Querystring: RestaurantQuery }>('/api/restaurants', async (request, reply) => {
    try {
      const result = await restaurantService.getRestaurants(request.query);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  fastify.get('/api/districts', async (_request, reply) => {
    try {
      const districts = await restaurantService.getDistricts();
      return reply.send({ districts });
    } catch (error) {
      return reply.status(500).send({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });
}