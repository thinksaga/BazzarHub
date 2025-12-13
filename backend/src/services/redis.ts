import Redis from "ioredis"
import { MedusaError } from "@medusajs/utils"

class RedisService {
  private client: Redis
  private subscriber: Redis
  private publisher: Redis
  private isConnected: boolean = false

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"

    // Main client for caching and general operations
    this.client = new Redis(redisUrl, {
      connectionName: "medusa-cache",
      enableReadyCheck: false,
      lazyConnect: true,
      reconnectOnError: (err: Error) => {
        console.warn("Redis reconnect on error", err)
        return err.message.includes("READONLY")
      },
    })

    // Separate clients for pub/sub to avoid blocking
    this.subscriber = new Redis(redisUrl, {
      connectionName: "medusa-subscriber",
      lazyConnect: true,
    })

    this.publisher = new Redis(redisUrl, {
      connectionName: "medusa-publisher",
      lazyConnect: true,
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.client.on("connect", () => {
      console.log("Redis client connected")
      this.isConnected = true
    })

    this.client.on("error", (err: Error) => {
      console.error("Redis client error:", err)
      this.isConnected = false
    })

    this.client.on("ready", () => {
      console.log("Redis client ready")
    })

    this.subscriber.on("connect", () => {
      console.log("Redis subscriber connected")
    })

    this.publisher.on("connect", () => {
      console.log("Redis publisher connected")
    })
  }

  // Get client instance for advanced operations
  getClient(): Redis {
    return this.client
  }

  getSubscriber(): Redis {
    return this.subscriber
  }

  getPublisher(): Redis {
    return this.publisher
  }

  // Connection management
  async connect() {
    if (!this.isConnected) {
      await this.client.connect()
      await this.subscriber.connect()
      await this.publisher.connect()
    }
  }

  async disconnect() {
    await this.client.disconnect()
    await this.subscriber.disconnect()
    await this.publisher.disconnect()
    this.isConnected = false
  }

  // Basic cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value)
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue)
      } else {
        await this.client.set(key, serializedValue)
      }
    } catch (error) {
      console.error("Redis set error:", error)
      throw new MedusaError(MedusaError.Types.DB_ERROR, "Failed to cache data")
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error("Redis get error:", error)
      return null
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key)
      return result > 0
    } catch (error) {
      console.error("Redis delete error:", error)
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key)
      return result > 0
    } catch (error) {
      console.error("Redis exists error:", error)
      return false
    }
  }

  // Session management
  async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    const key = `session:${sessionId}`
    await this.set(key, data, ttl)
  }

  async getSession(sessionId: string): Promise<any> {
    const key = `session:${sessionId}`
    return await this.get(key)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`
    return await this.delete(key)
  }

  // Cart persistence
  async setCart(cartId: string, cartData: any, ttl: number = 604800): Promise<void> {
    const key = `cart:${cartId}`
    await this.set(key, cartData, ttl)
  }

  async getCart(cartId: string): Promise<any> {
    const key = `cart:${cartId}`
    return await this.get(key)
  }

  async deleteCart(cartId: string): Promise<boolean> {
    const key = `cart:${cartId}`
    return await this.delete(key)
  }

  // API response caching
  async setApiCache(endpoint: string, params: any, data: any, ttl: number = 300): Promise<void> {
    const key = `api:${endpoint}:${JSON.stringify(params)}`
    await this.set(key, data, ttl)
  }

  async getApiCache(endpoint: string, params: any): Promise<any> {
    const key = `api:${endpoint}:${JSON.stringify(params)}`
    return await this.get(key)
  }

  // Product caching
  async setProductCache(productId: string, productData: any, ttl: number = 3600): Promise<void> {
    const key = `product:${productId}`
    await this.set(key, productData, ttl)
  }

  async getProductCache(productId: string): Promise<any> {
    const key = `product:${productId}`
    return await this.get(key)
  }

  async invalidateProductCache(productId: string): Promise<boolean> {
    const key = `product:${productId}`
    return await this.delete(key)
  }

  // Category caching
  async setCategoryTreeCache(categoryData: any, ttl: number = 3600): Promise<void> {
    const key = "categories:tree"
    await this.set(key, categoryData, ttl)
  }

  async getCategoryTreeCache(): Promise<any> {
    const key = "categories:tree"
    return await this.get(key)
  }

  async invalidateCategoryCache(): Promise<boolean> {
    const key = "categories:tree"
    return await this.delete(key)
  }

  // Vendor caching
  async setVendorCache(vendorId: string, vendorData: any, ttl: number = 3600): Promise<void> {
    const key = `vendor:${vendorId}`
    await this.set(key, vendorData, ttl)
  }

  async getVendorCache(vendorId: string): Promise<any> {
    const key = `vendor:${vendorId}`
    return await this.get(key)
  }

  async invalidateVendorCache(vendorId: string): Promise<boolean> {
    const key = `vendor:${vendorId}`
    return await this.delete(key)
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<number> {
    try {
      const serializedMessage = JSON.stringify(message)
      return await this.publisher.publish(channel, serializedMessage)
    } catch (error) {
      console.error("Redis publish error:", error)
      return 0
    }
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel)
      this.subscriber.on("message", (ch: string, message: string) => {
        if (ch === channel) {
          try {
            const parsedMessage = JSON.parse(message)
            callback(parsedMessage)
          } catch (error) {
            console.error("Error parsing pub/sub message:", error)
          }
        }
      })
    } catch (error) {
      console.error("Redis subscribe error:", error)
      throw new MedusaError(MedusaError.Types.DB_ERROR, "Failed to subscribe to channel")
    }
  }

  // Order notifications
  async publishOrderNotification(orderId: string, type: string, data: any): Promise<number> {
    const channel = `orders:${type}`
    const message = {
      orderId,
      type,
      data,
      timestamp: new Date().toISOString(),
    }
    return await this.publish(channel, message)
  }

  async subscribeToOrderNotifications(vendorId: string, callback: (message: any) => void): Promise<void> {
    const channel = `orders:vendor:${vendorId}`
    await this.subscribe(channel, callback)
  }

  // Cache invalidation patterns
  async invalidateProductRelatedCache(productId: string): Promise<void> {
    const keys = [
      `product:${productId}`,
      "categories:tree", // Invalidate category tree as product categories might change
    ]

    // Also invalidate any cached API responses that might contain this product
    const apiKeys = await this.client.keys(`api:*:*${productId}*`)
    keys.push(...apiKeys)

    if (keys.length > 0) {
      await this.client.del(...keys)
    }
  }

  async invalidateVendorRelatedCache(vendorId: string): Promise<void> {
    const keys = [
      `vendor:${vendorId}`,
    ]

    // Invalidate vendor's products cache
    const productKeys = await this.client.keys(`product:vendor:${vendorId}:*`)
    keys.push(...productKeys)

    // Invalidate API caches that might contain vendor data
    const apiKeys = await this.client.keys(`api:*:*${vendorId}*`)
    keys.push(...apiKeys)

    if (keys.length > 0) {
      await this.client.del(...keys)
    }
  }

  // Bulk operations
  async setMultiple(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const pipeline = this.client.pipeline()

    for (const { key, value, ttl } of keyValuePairs) {
      const serializedValue = JSON.stringify(value)
      if (ttl) {
        pipeline.setex(key, ttl, serializedValue)
      } else {
        pipeline.set(key, serializedValue)
      }
    }

    await pipeline.exec()
  }

  async getMultiple(keys: string[]): Promise<any[]> {
    try {
      const values = await this.client.mget(...keys)
      return values.map((value: string | null) => value ? JSON.parse(value) : null)
    } catch (error) {
      console.error("Redis mget error:", error)
      return []
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping()
      return result === "PONG"
    } catch (error) {
      console.error("Redis ping error:", error)
      return false
    }
  }
}

export default RedisService