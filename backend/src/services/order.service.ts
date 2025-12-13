import { AppDataSource } from "../config/database.config"
import { Order } from "../models/order.entity"
import { OrderItem } from "../models/order-item.entity"
import { Repository } from "typeorm"

export class OrderService {
  private orderRepository: Repository<Order>
  private orderItemRepository: Repository<OrderItem>

  constructor() {
    this.orderRepository = AppDataSource.getRepository(Order)
    this.orderItemRepository = AppDataSource.getRepository(OrderItem)
  }

  async create(data: Partial<Order>): Promise<Order> {
    const order = this.orderRepository.create(data)
    return await this.orderRepository.save(order)
  }

  async findAll(query: any = {}): Promise<Order[]> {
    return await this.orderRepository.find({ 
      where: query,
      relations: ["items", "items.product"]
    })
  }

  async findOne(id: string): Promise<Order | null> {
    return await this.orderRepository.findOne({ 
      where: { id },
      relations: ["items", "items.product", "customer"]
    })
  }

  async findByVendor(vendorId: string): Promise<Order[]> {
    // Find all order items belonging to this vendor
    const items = await this.orderItemRepository.find({
      where: { vendorId },
      relations: ["order", "product", "order.customer"]
    })

    // Group items by order
    const ordersMap = new Map<string, Order>()
    
    for (const item of items) {
      if (!ordersMap.has(item.orderId)) {
        // Clone the order to avoid mutating the original reference if needed
        // and filter items to only show this vendor's items
        const order = { ...item.order } as Order
        order.items = [item]
        ordersMap.set(item.orderId, order)
      } else {
        const order = ordersMap.get(item.orderId)!
        order.items.push(item)
      }
    }

    return Array.from(ordersMap.values())
  }

  async update(id: string, data: Partial<Order>): Promise<Order | null> {
    await this.orderRepository.update(id, data)
    return await this.findOne(id)
  }

  async updateItemStatus(itemId: string, status: string, vendorId: string): Promise<OrderItem | null> {
    const item = await this.orderItemRepository.findOne({ where: { id: itemId, vendorId } })
    if (!item) return null

    item.status = status
    return await this.orderItemRepository.save(item)
  }

  async delete(id: string): Promise<void> {
    await this.orderRepository.delete(id)
  }
}
