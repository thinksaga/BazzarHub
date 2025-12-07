import RedisService from "./redis"

interface CacheInvalidationRule {
  pattern: string
  ttl?: number
  dependencies?: string[]
}

class CacheInvalidationService {
  private redisService: RedisService
  private rules: Map<string, CacheInvalidationRule> = new Map()

  constructor(redisService: RedisService) {
    this.redisService = redisService
    this.setupDefaultRules()
  }

  private setupDefaultRules(): void {
    // Product-related invalidation rules
    this.rules.set("product:update", {
      pattern: "product:{productId}",
      dependencies: ["categories:tree", "api:products:*", "api:search:*"],
    })

    this.rules.set("product:delete", {
      pattern: "product:{productId}",
      dependencies: ["categories:tree", "api:products:*", "api:search:*", "vendor:{vendorId}"],
    })

    this.rules.set("product:create", {
      pattern: "categories:tree",
      dependencies: ["api:categories:*", "api:products:*"],
    })

    // Category-related invalidation rules
    this.rules.set("category:update", {
      pattern: "categories:tree",
      dependencies: ["api:categories:*", "api:products:*"],
    })

    this.rules.set("category:delete", {
      pattern: "categories:tree",
      dependencies: ["api:categories:*", "api:products:*"],
    })

    // Vendor-related invalidation rules
    this.rules.set("vendor:update", {
      pattern: "vendor:{vendorId}",
      dependencies: ["api:vendors:*", "api:products:*"],
    })

    this.rules.set("vendor:delete", {
      pattern: "vendor:{vendorId}",
      dependencies: ["api:vendors:*", "api:products:*"],
    })

    // Inventory-related invalidation rules
    this.rules.set("inventory:update", {
      pattern: "product:{productId}",
      dependencies: ["api:products:*", "api:search:*"],
    })

    // Order-related invalidation rules (less aggressive)
    this.rules.set("order:create", {
      pattern: "api:orders:*",
      ttl: 60, // Short TTL for order caches
    })

    this.rules.set("order:update", {
      pattern: "api:orders:*",
      ttl: 60,
    })
  }

  // Invalidate cache based on event type and parameters
  async invalidate(eventType: string, params: Record<string, any> = {}): Promise<void> {
    const rule = this.rules.get(eventType)
    if (!rule) {
      console.warn(`No cache invalidation rule found for event: ${eventType}`)
      return
    }

    try {
      // Replace placeholders in pattern
      const pattern = this.replacePlaceholders(rule.pattern, params)

      // Delete the main cache entry
      await this.redisService.delete(pattern)

      // Invalidate dependencies
      if (rule.dependencies) {
        for (const dependency of rule.dependencies) {
          const depPattern = this.replacePlaceholders(dependency, params)

          if (depPattern.includes("*")) {
            // Handle wildcard patterns
            await this.invalidateWildcardPattern(depPattern)
          } else {
            await this.redisService.delete(depPattern)
          }
        }
      }

      console.log(`Cache invalidated for event: ${eventType}`, { pattern, params })
    } catch (error) {
      console.error(`Failed to invalidate cache for event ${eventType}:`, error)
    }
  }

  // Invalidate wildcard patterns
  private async invalidateWildcardPattern(pattern: string): Promise<void> {
    try {
      // Use Redis SCAN to find keys matching the pattern
      const client = this.redisService.getClient()
      let cursor = "0"
      const keysToDelete: string[] = []

      do {
        const result = await client.scan(cursor, "MATCH", pattern, "COUNT", 100)
        cursor = result[0]
        keysToDelete.push(...result[1])
      } while (cursor !== "0")

      if (keysToDelete.length > 0) {
        await client.del(...keysToDelete)
        console.log(`Invalidated ${keysToDelete.length} cache keys matching pattern: ${pattern}`)
      }
    } catch (error) {
      console.error(`Failed to invalidate wildcard pattern ${pattern}:`, error)
    }
  }

  // Replace placeholders in patterns
  private replacePlaceholders(pattern: string, params: Record<string, any>): string {
    let result = pattern
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`{${key}}`, "g"), String(value))
    }
    return result
  }

  // Bulk invalidation for maintenance
  async invalidateAll(): Promise<void> {
    console.warn("Performing full cache invalidation")
    try {
      const client = this.redisService.getClient()
      await client.flushdb()
      console.log("All cache cleared")
    } catch (error) {
      console.error("Failed to clear all cache:", error)
      throw error
    }
  }

  // Invalidate by namespace (e.g., all product caches)
  async invalidateNamespace(namespace: string): Promise<void> {
    const pattern = `${namespace}:*`
    await this.invalidateWildcardPattern(pattern)
  }

  // Add custom invalidation rule
  addRule(eventType: string, rule: CacheInvalidationRule): void {
    this.rules.set(eventType, rule)
  }

  // Remove invalidation rule
  removeRule(eventType: string): boolean {
    return this.rules.delete(eventType)
  }

  // Get all rules (for debugging)
  getRules(): Map<string, CacheInvalidationRule> {
    return new Map(this.rules)
  }

  // Smart invalidation based on entity relationships
  async invalidateEntity(entityType: string, entityId: string, relatedEntities?: Record<string, any>): Promise<void> {
    const params = { [`${entityType}Id`]: entityId, ...relatedEntities }

    // Invalidate the specific entity
    await this.invalidate(`${entityType}:update`, params)

    // Invalidate related entities if provided
    if (relatedEntities) {
      for (const [relatedType, relatedId] of Object.entries(relatedEntities)) {
        if (relatedId && typeof relatedId === "string") {
          await this.invalidate(`${relatedType}:update`, { [`${relatedType}Id`]: relatedId })
        }
      }
    }
  }

  // Product-specific invalidation with vendor relationship
  async invalidateProduct(productId: string, vendorId?: string): Promise<void> {
    await this.invalidateEntity("product", productId, vendorId ? { vendor: vendorId } : undefined)
  }

  // Vendor-specific invalidation with product relationships
  async invalidateVendor(vendorId: string): Promise<void> {
    await this.invalidateEntity("vendor", vendorId)

    // Also invalidate all vendor's products
    await this.invalidateNamespace(`product:vendor:${vendorId}`)
  }

  // Category-specific invalidation
  async invalidateCategory(categoryId: string): Promise<void> {
    await this.invalidateEntity("category", categoryId)
  }

  // Order-specific invalidation (less aggressive)
  async invalidateOrder(orderId: string): Promise<void> {
    await this.invalidate("order:update", { orderId })
  }

  // Inventory-specific invalidation
  async invalidateInventory(productId: string): Promise<void> {
    await this.invalidate("inventory:update", { productId })
  }
}

export default CacheInvalidationService