# MercurJS Multivendor Marketplace

This docker-compose setup provides a complete environment for running MercurJS multivendor marketplace with Redis integration for session management, caching, and real-time notifications.

## 🚀 Features

### Redis Integration
- **Session Management**: Persistent user sessions with Redis
- **Cart Persistence**: Shopping cart data stored in Redis
- **API Response Caching**: Intelligent caching for products, categories, and vendors
- **Real-time Notifications**: Pub/Sub system for order updates and vendor notifications
- **Cache Invalidation**: Smart cache invalidation strategies for data consistency

## 📊 Redis Integration

### Session Management
- User sessions are stored in Redis with configurable TTL
- Automatic session cleanup and management
- Session data includes user info, cart state, and preferences

### API Caching
- **Product Caching**: Product details cached for 1 hour
- **Category Tree**: Category hierarchy cached for 1 hour  
- **Vendor Data**: Vendor information cached for 1 hour
- **API Responses**: General API responses cached for 5 minutes

### Cache Invalidation Strategies
- **Product Updates**: Invalidates product cache and related category/vendor caches
- **Inventory Changes**: Updates product cache when stock levels change
- **Order Events**: Short-term caching for order-related data
- **Bulk Operations**: Namespace-based cache clearing for maintenance

### Real-time Notifications
- **Order Notifications**: Real-time order status updates
- **Vendor Alerts**: New orders, status changes, and inventory alerts
- **Admin Notifications**: User registrations, payment issues, vendor applications
- **Pub/Sub Channels**: Dedicated channels for different event types

### Example API Endpoints
```
GET  /api/redis/products/:id     - Get cached product
POST /api/redis/orders           - Create order with notifications
PUT  /api/redis/products/:id     - Update product (triggers invalidation)
POST /api/redis/auth/login       - Create user session
POST /api/redis/cart/:id/items   - Add items to cart
GET  /api/redis/cart/:id         - Get cart from Redis
```

### Cache Management
```
POST /admin/cache/clear                    - Clear all cache
POST /admin/cache/invalidate/product/:id   - Invalidate product cache
POST /admin/cache/invalidate/vendor/:id    - Invalidate vendor cache
POST /admin/cache/invalidate/category/:id  - Invalidate category cache
```

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