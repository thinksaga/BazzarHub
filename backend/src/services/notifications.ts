import RedisService from "./redis"

class NotificationService {
  private redisService: RedisService

  constructor(redisService: RedisService) {
    this.redisService = redisService
  }

  // Order notifications
  async notifyOrderCreated(orderId: string, orderData: any): Promise<number> {
    return await this.redisService.publishOrderNotification(orderId, "created", orderData)
  }

  async notifyOrderUpdated(orderId: string, orderData: any): Promise<number> {
    return await this.redisService.publishOrderNotification(orderId, "updated", orderData)
  }

  async notifyOrderCancelled(orderId: string, orderData: any): Promise<number> {
    return await this.redisService.publishOrderNotification(orderId, "cancelled", orderData)
  }

  async notifyOrderShipped(orderId: string, orderData: any): Promise<number> {
    return await this.redisService.publishOrderNotification(orderId, "shipped", orderData)
  }

  async notifyOrderDelivered(orderId: string, orderData: any): Promise<number> {
    return await this.redisService.publishOrderNotification(orderId, "delivered", orderData)
  }

  // Vendor-specific notifications
  async notifyVendorNewOrder(vendorId: string, orderId: string, orderData: any): Promise<number> {
    const channel = `orders:vendor:${vendorId}`
    const message = {
      type: "new_order",
      orderId,
      orderData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  async notifyVendorOrderStatusUpdate(vendorId: string, orderId: string, status: string, orderData: any): Promise<number> {
    const channel = `orders:vendor:${vendorId}`
    const message = {
      type: "order_status_update",
      orderId,
      status,
      orderData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  // Product notifications
  async notifyProductOutOfStock(productId: string, productData: any): Promise<number> {
    const channel = "products:inventory"
    const message = {
      type: "out_of_stock",
      productId,
      productData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  async notifyProductLowStock(productId: string, currentStock: number, threshold: number, productData: any): Promise<number> {
    const channel = "products:inventory"
    const message = {
      type: "low_stock",
      productId,
      currentStock,
      threshold,
      productData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  // Subscribe to notifications
  async subscribeToVendorOrders(vendorId: string, callback: (message: any) => void): Promise<void> {
    await this.redisService.subscribeToOrderNotifications(vendorId, callback)
  }

  async subscribeToInventoryAlerts(callback: (message: any) => void): Promise<void> {
    const channel = "products:inventory"
    await this.redisService.subscribe(channel, callback)
  }

  async subscribeToOrderEvents(callback: (message: any) => void): Promise<void> {
    const channel = "orders:*"
    await this.redisService.subscribe(channel, callback)
  }

  // Admin notifications
  async notifyAdminNewUser(userData: any): Promise<number> {
    const channel = "admin:users"
    const message = {
      type: "new_user",
      userData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  async notifyAdminNewVendor(vendorData: any): Promise<number> {
    const channel = "admin:vendors"
    const message = {
      type: "new_vendor",
      vendorData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  async notifyAdminPaymentIssue(orderId: string, paymentData: any): Promise<number> {
    const channel = "admin:payments"
    const message = {
      type: "payment_issue",
      orderId,
      paymentData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  // Real-time dashboard updates
  async publishDashboardMetrics(metrics: any): Promise<number> {
    const channel = "dashboard:metrics"
    const message = {
      metrics,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }

  async publishSalesUpdate(salesData: any): Promise<number> {
    const channel = "dashboard:sales"
    const message = {
      salesData,
      timestamp: new Date().toISOString(),
    }
    return await this.redisService.publish(channel, message)
  }
}

export default NotificationService