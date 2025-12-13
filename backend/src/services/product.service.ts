import { AppDataSource } from "../config/database.config"
import { Product } from "../models/product.entity"
import { Repository } from "typeorm"

export class ProductService {
  private productRepository: Repository<Product>

  constructor() {
    this.productRepository = AppDataSource.getRepository(Product)
  }

  async create(data: Partial<Product>): Promise<Product> {
    const product = this.productRepository.create(data)
    return await this.productRepository.save(product)
  }

  async findAll(query: any = {}): Promise<Product[]> {
    return await this.productRepository.find({ where: query })
  }

  async findOne(id: string): Promise<Product | null> {
    return await this.productRepository.findOne({ where: { id } })
  }

  async update(id: string, data: Partial<Product>): Promise<Product | null> {
    await this.productRepository.update(id, data)
    return await this.findOne(id)
  }

  async delete(id: string): Promise<void> {
    await this.productRepository.delete(id)
  }
}
