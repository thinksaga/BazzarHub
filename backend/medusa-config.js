const { loadEnv } = require("@medusajs/medusa/dist/commands/utils/env-loader")

loadEnv(process.env.NODE_ENV || "development", process.cwd())

module.exports = {
  projectConfig: {
    redis_url: process.env.REDIS_URL || "redis://localhost:6379",
    database_url: process.env.DATABASE_URL,
    database_type: "postgres",
    store_cors: process.env.STORE_CORS || "http://localhost:8000",
    admin_cors: process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001",
    database_extra: {
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    },
    redis_options: {
      connectionName: "medusa-cache",
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      reconnectOnError: (err) => {
        console.warn("Redis reconnect on error", err)
        return err.message.includes("READONLY")
      },
    },
  },
  plugins: [
    {
      resolve: "medusa-fulfillment-manual",
    },
    {
      resolve: "medusa-payment-manual",
    },
    {
      resolve: "medusa-payment-stripe",
      options: {
        api_key: process.env.STRIPE_API_KEY,
        webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
      },
    },
  ],
}