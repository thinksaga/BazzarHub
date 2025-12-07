import express from "express"
import RedisService from "./services/redis"
import CacheMiddleware from "./middlewares/cache"
import NotificationService from "./services/notifications"
import CacheInvalidationService from "./services/cache-invalidation"
import redisExamplesRouter from "./api/redis-examples"

// Initialize services
const redisService = new RedisService()
const cacheMiddleware = new CacheMiddleware(redisService)
const notificationService = new NotificationService(redisService)
const cacheInvalidationService = new CacheInvalidationService(redisService)

// Connect to Redis on startup
redisService.connect().catch(console.error)

// Initialize Express app
const app = express()
app.use(express.json())

// Add caching middleware to specific routes
app.use("/api/products", cacheMiddleware.productCache())
app.use("/api/categories", cacheMiddleware.categoryTreeCache())
app.use("/api/vendors", cacheMiddleware.vendorCache())

// Add Redis example routes
app.use("/api/redis", redisExamplesRouter)

// Health check endpoint with Redis status
app.get("/health", async (req: express.Request, res: express.Response) => {
  const redisHealth = await redisService.ping()
  res.json({
    status: "ok",
    services: {
      redis: redisHealth ? "healthy" : "unhealthy",
      database: "checking...", // Would need database health check
    },
    timestamp: new Date().toISOString()
  })
})

// Cache management endpoints (for admin use)
app.post("/admin/cache/clear", async (req: express.Request, res: express.Response) => {
  try {
    await cacheInvalidationService.invalidateAll()
    res.json({ message: "Cache cleared successfully" })
  } catch (error) {
    res.status(500).json({ error: "Failed to clear cache" })
  }
})

app.post("/admin/cache/invalidate/:type/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { type, id } = req.params
    await cacheInvalidationService.invalidateEntity(type, id)
    res.json({ message: `Cache invalidated for ${type}:${id}` })
  } catch (error) {
    res.status(500).json({ error: "Failed to invalidate cache" })
  }
})

// Export services for use in other parts of the application
export {
  redisService,
  cacheMiddleware,
  notificationService,
  cacheInvalidationService
}

// Start the server
const PORT = process.env.PORT || 3001

app.listen(PORT, async () => {
  const redisConnected = await redisService.ping()
  console.log(`🚀 MercurJS Backend (Redis Demo) running on port ${PORT}`)
  console.log(`📊 Redis connected: ${redisConnected ? 'Yes' : 'No'}`)
  console.log(`💾 Cache middleware: Active`)
  console.log(`📢 Notifications: Active`)
  console.log(`🔧 Redis examples: http://localhost:${PORT}/api/redis`)
})