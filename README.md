# MercurJS Multivendor Marketplace

This docker-compose setup provides a complete environment for running MercurJS multivendor marketplace with all necessary services.

## Services

- **PostgreSQL 15**: Database with persistent storage
- **Redis 7.x**: Session storage and caching
- **Elasticsearch 8.x**: Product search functionality
- **MercurJS Backend**: Node.js/TypeScript API server
- **Storefront**: Next.js frontend application
- **Vendor Panel**: Vendor management interface
- **Nginx**: Reverse proxy for routing requests

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available for containers

## Quick Start

1. Clone or setup your MercurJS project in the respective directories:
   - `./backend/` - MercurJS backend code
   - `./storefront/` - Next.js storefront code
   - `./vendor-panel/` - Vendor panel code

2. Update the `.env` file with your configuration:
   - Change default passwords
   - Set JWT secret
   - Adjust URLs if needed

3. Start all services:
   ```bash
   # For development (creates .env.local if needed)
   ./build-dev.js

   # For production
   ./build-prod.js
   ```

4. Access the applications:
   - Storefront: http://localhost
   - Vendor Panel: http://localhost/vendor/
   - API: http://localhost/api/
   - Direct backend: http://localhost:3001
   - PostgreSQL: localhost:5434
   - Redis: localhost:6381
   - Elasticsearch: localhost:9201

## Health Checks

All services include health checks that ensure proper startup order and service availability.

## Data Persistence

Data is persisted in named Docker volumes:
- `postgres_data`: PostgreSQL database
- `redis_data`: Redis data
- `es_data`: Elasticsearch data

## Environment Variables

Configure application settings in the `.env` file. Key variables include:
- Database credentials
- JWT secret
- API endpoints
- Service URLs

## Development

For development, you may want to:
- Mount source code volumes for hot reloading
- Use development-specific Dockerfiles
- Adjust health check intervals

## Troubleshooting

- Check service logs: `docker-compose logs [service_name]`
- Verify health: `docker-compose ps`
- Restart services: `docker-compose restart [service_name]`

## Security Notes

- Change default passwords in production
- Use strong JWT secrets
- Consider SSL/TLS configuration for Nginx
- Review and restrict exposed ports as needed