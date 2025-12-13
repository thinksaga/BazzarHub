import { AppDataSource } from "../config/database.config"
import { Product } from "../models/product.entity"
import { User } from "../models/user.entity"
import { Repository } from "typeorm"
import { ElasticsearchService, ProductDocument } from "./elasticsearch/elasticsearch.service"

export class ProductService {
  private productRepository: Repository<Product>
  private userRepository: Repository<User>
  private elasticsearchService: ElasticsearchService

  constructor() {
    this.productRepository = AppDataSource.getRepository(Product)
    this.userRepository = AppDataSource.getRepository(User)
    this.elasticsearchService = new ElasticsearchService()
  }

  async create(data: Partial<Product>): Promise<Product> {
    const product = this.productRepository.create(data)
    const savedProduct = await this.productRepository.save(product)
    await this.indexProduct(savedProduct)
    return savedProduct
  }

  async findAll(query: any = {}): Promise<Product[]> {
    return await this.productRepository.find({ where: query })
  }

  async findOne(id: string): Promise<Product | null> {
    return await this.productRepository.findOne({ where: { id } })
  }

  async update(id: string, data: Partial<Product>): Promise<Product | null> {
    await this.productRepository.update(id, data)
    const updatedProduct = await this.findOne(id)
    if (updatedProduct) {
      await this.indexProduct(updatedProduct)
    }
    return updatedProduct
  }

  async delete(id: string): Promise<void> {
    await this.productRepository.delete(id)
    try {
      await this.elasticsearchService.deleteProduct(id)
    } catch (error) {
      console.error(`Failed to delete product ${id} from Elasticsearch:`, error)
    }
  }

  private async indexProduct(product: Product): Promise<void> {
    try {
      const vendor = await this.userRepository.findOne({ where: { id: product.vendorId } })
      const vendorName = vendor ? `${vendor.firstName} ${vendor.lastName}` : "Unknown Vendor"

      const doc: ProductDocument = {
        id: product.id,
        title: product.title,
        description: product.description,
        category_id: product.category, // Using category name as ID for now
        category_name: product.category,
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
        vendor_id: product.vendorId,
        vendor_name: vendorName,
        vendor_verified: false, // TODO: Check verification status
        vendor_rating: 0, // TODO: Implement rating
        sku: product.id, // Using ID as SKU for now
        brand: "Generic", // TODO: Add brand to Product entity
        attributes: product.attributes || {},
        tags: [],
        status: product.isActive ? "active" : "inactive",
        is_featured: false,
        availability: product.inventory > 0 ? "in_stock" : "out_of_stock",
        delivery_options: ["standard"],
        inventory_quantity: product.inventory,
        images: product.images || [],
        created_at: product.createdAt,
        updated_at: product.updatedAt
      }

      await this.elasticsearchService.indexProduct(doc)
    } catch (error) {
      console.error(`Failed to index product ${product.id}:`, error)
    }
  }
}
