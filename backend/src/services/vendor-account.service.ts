import { AppDataSource } from "../config/database.config"
import { VendorAccount, VendorAccountStatus } from "../models/vendor-account.model"

export class VendorAccountService {
  private vendorAccountRepository = AppDataSource.getRepository(VendorAccount)

  async findAll(query: any = {}) {
    return this.vendorAccountRepository.find({
      where: query,
      relations: ["user"],
      order: {
        created_at: "DESC"
      }
    })
  }

  async findOne(id: string) {
    return this.vendorAccountRepository.findOne({ 
      where: { id },
      relations: ["user"]
    })
  }

  async create(data: Partial<VendorAccount>) {
    const vendorAccount = this.vendorAccountRepository.create(data)
    return this.vendorAccountRepository.save(vendorAccount)
  }

  async update(id: string, data: Partial<VendorAccount>) {
    await this.vendorAccountRepository.update(id, data)
    return this.findOne(id)
  }

  async updateStatus(id: string, status: VendorAccountStatus) {
    await this.vendorAccountRepository.update(id, { status })
    return this.findOne(id)
  }

  async findByUserId(userId: string) {
    return this.vendorAccountRepository.findOne({
      where: { vendor_id: userId },
      relations: ["user"]
    })
  }
}
