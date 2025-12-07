import { Request, Response, NextFunction } from "express"
import RedisService from "../services/redis"

interface CacheOptions {
  ttl?: number
  keyGenerator?: (req: Request) => string
  skipCache?: (req: Request) => boolean
}

class CacheMiddleware {
  private redisService: RedisService

  constructor(redisService: RedisService) {
    this.redisService = redisService
  }

  cache = (options: CacheOptions = {}) => {
    const {
      ttl = 300, // 5 minutes default
      keyGenerator = this.defaultKeyGenerator,
      skipCache = () => false
    } = options

    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip caching for non-GET requests or when explicitly disabled
      if (req.method !== "GET" || skipCache(req)) {
        return next()
      }

      const cacheKey = keyGenerator(req)

      try {
        // Try to get cached response
        const cachedData = await this.redisService.getApiCache(req.path, req.query)

        if (cachedData) {
          // Return cached response
          res.set("X-Cache", "HIT")
          return res.json(cachedData)
        }

        // Cache miss - intercept the response
        res.set("X-Cache", "MISS")

        // Store the original json method
        const originalJson = res.json

        // Override json method to cache the response
        res.json = (data: any) => {
          // Cache the response asynchronously (don't block response)
          this.redisService.setApiCache(req.path, req.query, data, ttl).catch(err => {
            console.error("Failed to cache API response:", err)
          })

          // Call original json method
          return originalJson.call(res, data)
        }

        next()
      } catch (error) {
        console.error("Cache middleware error:", error)
        // Continue without caching on error
        next()
      }
    }
  }

  private defaultKeyGenerator = (req: Request): string => {
    // Generate cache key based on path and query parameters
    const queryString = Object.keys(req.query).length > 0
      ? `?${new URLSearchParams(req.query as any).toString()}`
      : ""
    return `${req.path}${queryString}`
  }

  // Product-specific caching middleware
  productCache = (ttl: number = 3600) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET") {
        return next()
      }

      const productId = req.params.id || req.params.productId
      if (!productId) {
        return next()
      }

      try {
        const cachedProduct = await this.redisService.getProductCache(productId)
        if (cachedProduct) {
          res.set("X-Cache", "HIT")
          return res.json(cachedProduct)
        }

        res.set("X-Cache", "MISS")

        const originalJson = res.json
        res.json = (data: any) => {
          if (data && !data.error) {
            this.redisService.setProductCache(productId, data, ttl).catch(err => {
              console.error("Failed to cache product:", err)
            })
          }
          return originalJson.call(res, data)
        }

        next()
      } catch (error) {
        console.error("Product cache middleware error:", error)
        next()
      }
    }
  }

  // Category tree caching middleware
  categoryTreeCache = (ttl: number = 3600) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET") {
        return next()
      }

      try {
        const cachedTree = await this.redisService.getCategoryTreeCache()
        if (cachedTree) {
          res.set("X-Cache", "HIT")
          return res.json(cachedTree)
        }

        res.set("X-Cache", "MISS")

        const originalJson = res.json
        res.json = (data: any) => {
          if (data && !data.error) {
            this.redisService.setCategoryTreeCache(data, ttl).catch(err => {
              console.error("Failed to cache category tree:", err)
            })
          }
          return originalJson.call(res, data)
        }

        next()
      } catch (error) {
        console.error("Category tree cache middleware error:", error)
        next()
      }
    }
  }

  // Vendor caching middleware
  vendorCache = (ttl: number = 3600) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET") {
        return next()
      }

      const vendorId = req.params.id || req.params.vendorId
      if (!vendorId) {
        return next()
      }

      try {
        const cachedVendor = await this.redisService.getVendorCache(vendorId)
        if (cachedVendor) {
          res.set("X-Cache", "HIT")
          return res.json(cachedVendor)
        }

        res.set("X-Cache", "MISS")

        const originalJson = res.json
        res.json = (data: any) => {
          if (data && !data.error) {
            this.redisService.setVendorCache(vendorId, data, ttl).catch(err => {
              console.error("Failed to cache vendor:", err)
            })
          }
          return originalJson.call(res, data)
        }

        next()
      } catch (error) {
        console.error("Vendor cache middleware error:", error)
        next()
      }
    }
  }

  // Cache invalidation helpers
  async invalidateProductCache(productId: string): Promise<void> {
    await this.redisService.invalidateProductCache(productId)
  }

  async invalidateVendorCache(vendorId: string): Promise<void> {
    await this.redisService.invalidateVendorCache(vendorId)
  }

  async invalidateCategoryCache(): Promise<void> {
    await this.redisService.invalidateCategoryCache()
  }

  // Clear all cache (useful for development/testing)
  async clearAllCache(): Promise<void> {
    // This is a simple implementation - in production you might want more selective clearing
    console.warn("Clearing all Redis cache")
    // Note: This would require implementing a clearAll method in RedisService
  }
}

export default CacheMiddleware