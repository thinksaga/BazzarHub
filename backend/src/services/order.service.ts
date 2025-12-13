import { AppDataSource } from "../config/database.config"
import { Order } from "../models/order.entity"
import { Repository } from "typeorm"

export class OrderService {
  private orderRepository: Repository<Order>

  constructor() {
    this.orderRepository = AppDataSource.getRepository(Order)
  }

  async create(data: Partial<Order>): Promise<Order> {
    const order = this.orderRepository.create(data)
    return await this.orderRepository.save(order)
  }

  async findAll(query: any = {}): Promise<Order[]> {
    return await this.orderRepository.find({ where: query })
  }

  async findOne(id: string): Promise<Order | null> {
    return await this.orderRepository.findOne({ where: { id } })
  }

  async update(id: string, data: Partial<Order>): Promise<Order | null> {
    await this.orderRepository.update(id, data)
    return await this.findOne(id)
  }

  async delete(id: string): Promise<void> {
    await this.orderRepository.delete(id)
  }
}
