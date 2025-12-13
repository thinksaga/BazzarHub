import { AppDataSource } from "../config/database.config"
import { Category } from "../models/category.entity"

export class CategoryService {
  private categoryRepository = AppDataSource.getTreeRepository(Category)

  async findAll() {
    return this.categoryRepository.findTrees()
  }

  async findOne(id: string) {
    return this.categoryRepository.findOne({ where: { id } })
  }

  async create(data: Partial<Category>) {
    const category = this.categoryRepository.create(data)
    if (data.parent) {
      const parent = await this.categoryRepository.findOne({ where: { id: data.parent.id } })
      if (parent) {
        category.parent = parent
      }
    }
    return this.categoryRepository.save(category)
  }

  async update(id: string, data: Partial<Category>) {
    const category = await this.findOne(id)
    if (!category) throw new Error("Category not found")
    
    Object.assign(category, data)
    return this.categoryRepository.save(category)
  }

  async delete(id: string) {
    return this.categoryRepository.delete(id)
  }
}
