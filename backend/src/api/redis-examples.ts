import express from "express"
import { redisService, notificationService, cacheInvalidationService } from "../index"

const router = express.Router()

// Example: Get product with caching
router.get("/products/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params

    // Check cache first (this will be handled by middleware, but showing manual example)
    const cachedProduct = await redisService.getProductCache(id)
    if (cachedProduct) {
      return res.json({ ...cachedProduct, cached: true })
    }

    // Simulate fetching from database
    const product = {
      id,
      name: `Product ${id}`,
      price: 29.99,
      vendor_id: "vendor_123",
      category_id: "category_456",
      stock: 100,
      created_at: new Date().toISOString()
    }

    // Cache the product
    await redisService.setProductCache(id, product)

    res.json({ ...product, cached: false })
  } catch (error) {
    console.error("Error fetching product:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Example: Create order with notifications
router.post("/orders", async (req: express.Request, res: express.Response) => {
  try {
    const orderData = req.body

    // Simulate order creation
    const order = {
      id: `order_${Date.now()}`,
      ...orderData,
      status: "pending",
      created_at: new Date().toISOString()
    }

    // Send notifications
    await notificationService.notifyOrderCreated(order.id, order)

    // Notify vendor if specified
    if (order.vendor_id) {
      await notificationService.notifyVendorNewOrder(order.vendor_id, order.id, order)
    }

    // Invalidate relevant caches
    await cacheInvalidationService.invalidateOrder(order.id)

    res.json(order)
  } catch (error) {
    console.error("Error creating order:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Example: Update product (triggers cache invalidation)
router.put("/products/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params
    const updateData = req.body

    // Simulate product update
    const updatedProduct = {
      id,
      ...updateData,
      updated_at: new Date().toISOString()
    }

    // Invalidate product cache
    await cacheInvalidationService.invalidateProduct(id, updateData.vendor_id)

    // Check for inventory changes
    if (updateData.stock !== undefined) {
      if (updateData.stock === 0) {
        await notificationService.notifyProductOutOfStock(id, updatedProduct)
      } else if (updateData.stock < 10) {
        await notificationService.notifyProductLowStock(id, updateData.stock, 10, updatedProduct)
      }
    }

    res.json(updatedProduct)
  } catch (error) {
    console.error("Error updating product:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Example: Session management
router.post("/auth/login", async (req: express.Request, res: express.Response) => {
  try {
    const { userId, userData } = req.body

    // Create session
    const sessionId = `session_${userId}_${Date.now()}`
    await redisService.setSession(sessionId, {
      userId,
      userData,
      loginTime: new Date().toISOString()
    })

    res.json({
      sessionId,
      user: userData,
      message: "Login successful"
    })
  } catch (error) {
    console.error("Error during login:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Example: Cart management
router.post("/cart/:cartId/items", async (req: express.Request, res: express.Response) => {
  try {
    const { cartId } = req.params
    const { productId, quantity } = req.body

    // Get existing cart
    let cart = await redisService.getCart(cartId) || {
      id: cartId,
      items: [],
      created_at: new Date().toISOString()
    }

    // Add item to cart
    const existingItemIndex = cart.items.findIndex((item: any) => item.productId === productId)
    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += quantity
    } else {
      cart.items.push({ productId, quantity })
    }

    cart.updated_at = new Date().toISOString()

    // Save cart
    await redisService.setCart(cartId, cart)

    res.json(cart)
  } catch (error) {
    console.error("Error adding item to cart:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Example: Get cart
router.get("/cart/:cartId", async (req: express.Request, res: express.Response) => {
  try {
    const { cartId } = req.params
    const cart = await redisService.getCart(cartId)

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" })
    }

    res.json(cart)
  } catch (error) {
    console.error("Error fetching cart:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Example: Subscribe to vendor notifications (WebSocket alternative)
router.post("/vendors/:vendorId/subscribe", async (req: express.Request, res: express.Response) => {
  try {
    const { vendorId } = req.params

    // In a real implementation, this would establish a WebSocket connection
    // For now, we'll just acknowledge the subscription
    await notificationService.subscribeToVendorOrders(vendorId, (message) => {
      console.log(`Vendor ${vendorId} received notification:`, message)
      // In a real app, this would send the message via WebSocket
    })

    res.json({ message: `Subscribed to notifications for vendor ${vendorId}` })
  } catch (error) {
    console.error("Error subscribing to notifications:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router