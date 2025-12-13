import { AppDataSource } from "../config/database.config"
import { VendorPayout } from "../models/vendor-payout.model"
import { Repository } from "typeorm"

export class VendorPayoutService {
  private payoutRepository: Repository<VendorPayout>

  constructor() {
    this.payoutRepository = AppDataSource.getRepository(VendorPayout)
  }

  async findByVendor(vendorId: string): Promise<VendorPayout[]> {
    return await this.payoutRepository.find({
      where: { vendor_id: vendorId },
      order: { created_at: "DESC" }
    })
  }

  async getSummary(vendorId: string) {
    const payouts = await this.findByVendor(vendorId)
    
    const totalEarnings = payouts
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.net_payout), 0) / 100

    const pendingPayouts = payouts
      .filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + Number(p.net_payout), 0) / 100

    return {
      totalEarnings,
      pendingPayouts,
      payoutCount: payouts.length,
      recentPayouts: payouts.slice(0, 5).map(p => ({
        ...p,
        net_payout: Number(p.net_payout) / 100,
        gross_amount: Number(p.gross_amount) / 100,
        commission_amount: Number(p.commission_amount) / 100
      }))
    }
  }

  async findAll(limit: number = 50): Promise<VendorPayout[]> {
    return await this.payoutRepository.find({
      order: { created_at: "DESC" },
      take: limit,
      relations: ["vendor", "vendor.user"]
    })
  }

  async getAdminStats() {
    const result = await this.payoutRepository
      .createQueryBuilder("payout")
      .select("SUM(CASE WHEN status = 'completed' THEN net_payout ELSE 0 END)", "total_paid")
      .addSelect("SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN net_payout ELSE 0 END)", "pending_amount")
      .addSelect("COUNT(*)", "total_transactions")
      .getRawOne();

    return {
      totalPaid: Number(result.total_paid || 0) / 100,
      pendingAmount: Number(result.pending_amount || 0) / 100,
      totalTransactions: Number(result.total_transactions || 0)
    };
  }
}
