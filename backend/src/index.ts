import express from "express"
import cors from "cors"
import RedisService from "./services/redis"
import CacheMiddleware from "./middlewares/cache"
import NotificationService from "./services/notifications"
import CacheInvalidationService from "./services/cache-invalidation"
import redisExamplesRouter from "./api/redis-examples"
import searchRouter from "./api/search.routes"
import advancedSearchRouter from "./api/advanced-search.routes"
import paymentRouter from "./api/payment.routes"
import vendorPayoutRouter from "./api/vendor-payout.routes"
import payoutsRouter from "./api/routes/payouts"
import productsRouter from "./api/routes/products"
import ordersRouter from "./api/routes/orders"
import authRouter from "./api/routes/auth"
import categoriesRouter from "./api/routes/categories"
import cartRouter from "./api/routes/cart"
import reviewsRouter from "./api/routes/reviews"
import vendorsRouter from "./api/routes/vendors"
import vendorOnboardingRouter from "./api/routes/vendor-onboarding"
import adminFinanceRouter from "./api/routes/admin/finance"
import adminGstRouter from "./api/routes/admin/gst"
import { getElasticsearchService } from "./services/elasticsearch/elasticsearch.service"
import { getSearchAnalyticsService } from "./services/elasticsearch/search-analytics.service"
import { AppDataSource } from "./config/database.config"

// Initialize services
const redisService = new RedisService()
const cacheMiddleware = new CacheMiddleware(redisService)
const notificationService = new NotificationService(redisService)
const cacheInvalidationService = new CacheInvalidationService(redisService)
const elasticsearchService = getElasticsearchService()
const searchAnalyticsService = getSearchAnalyticsService(redisService)

// Connect to Redis on startup
redisService.connect().catch(console.error)

// Initialize Elasticsearch on startup
elasticsearchService.initialize().catch(console.error)

// Initialize Search Analytics on startup
searchAnalyticsService.initialize().catch(console.error)

// Initialize Database
AppDataSource.initialize()
  .then(() => console.log("📦 Database connected"))
  .catch((error) => console.error("❌ Database connection failed:", error))

// Initialize Express app
const app = express()
app.use(cors())
app.use(express.json())

// Add caching middleware to specific routes
app.use("/api/products", cacheMiddleware.productCache())
app.use("/api/products", productsRouter)

// Add auth routes
app.use("/api/auth", authRouter)

// Add order routes
app.use("/api/orders", ordersRouter)

// Add category routes
app.use("/api/categories", cacheMiddleware.categoryTreeCache(), categoriesRouter)

// Add vendor routes
app.use("/api/vendors", cacheMiddleware.vendorCache(), vendorsRouter)

// Add vendor onboarding routes
app.use("/api/vendor/onboarding", vendorOnboardingRouter)

// Add cart routes
app.use("/api/cart", cartRouter)

// Add review routes
app.use("/api/reviews", reviewsRouter)

// Add Redis example routes
app.use("/api/redis", redisExamplesRouter)

// Add search routes
app.use("/api/search", searchRouter)

// Add advanced search routes
app.use("/api/advanced-search", advancedSearchRouter)

// Add payment routes
app.use("/api/payment", paymentRouter)

// Add vendor payout routes
app.use("/api/vendor", vendorPayoutRouter)

// Add payout history routes
app.use("/api/payouts", payoutsRouter)

// Add admin finance routes
app.use("/api/admin/finance", adminFinanceRouter)

// Add admin GST routes
app.use("/api/admin/gst", adminGstRouter)

// Health check endpoint with Redis and Elasticsearch status
app.get("/health", async (req: express.Request, res: express.Response) => {
  const redisHealth = await redisService.ping()
  const elasticsearchHealth = await elasticsearchService.healthCheck()
  res.json({
    status: "ok",
    services: {
      redis: redisHealth ? "healthy" : "unhealthy",
      elasticsearch: elasticsearchHealth ? "healthy" : "unhealthy",
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
  cacheInvalidationService,
  elasticsearchService
}

// Start the server
const PORT = process.env.PORT || 3001

app.listen(PORT, async () => {
  const redisConnected = await redisService.ping()
  const elasticsearchConnected = await elasticsearchService.healthCheck()
  console.log(`🚀 MercurJS Backend running on port ${PORT}`)
  console.log(`📊 Redis connected: ${redisConnected ? 'Yes' : 'No'}`)
  console.log(`� Elasticsearch connected: ${elasticsearchConnected ? 'Yes' : 'No'}`)
  console.log(` Cache middleware: Active`)
  console.log(`📢 Notifications: Active`)
  console.log(`🔧 Redis examples: http://localhost:${PORT}/api/redis`)
  console.log(`🔎 Search API: http://localhost:${PORT}/api/search`)
  console.log(`🔍 Advanced Search: http://localhost:${PORT}/api/advanced-search`)
  console.log(`💳 Payment API: http://localhost:${PORT}/api/payment`)
  console.log(`💰 Vendor Payout API: http://localhost:${PORT}/api/vendor`)
})