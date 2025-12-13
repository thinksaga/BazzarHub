import { Router, Request, Response } from "express"
import { VendorPayoutService } from "../../services/vendor-payout.service"
import { authMiddleware } from "../../middleware/auth.middleware"

const router = Router()
const payoutService = new VendorPayoutService()

router.get("/summary", authMiddleware, async (req: Request, res: Response) => {
  try {
    const vendorId = (req as any).user.id
    const summary = await payoutService.getSummary(vendorId)
    res.json(summary)
  } catch (error) {
    console.error("Fetch payout summary error:", error)
    res.status(500).json({ error: "Failed to fetch payout summary" })
  }
})

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const vendorId = (req as any).user.id
    const payouts = await payoutService.findByVendor(vendorId)
    // Convert amounts to INR
    const formattedPayouts = payouts.map(p => ({
      ...p,
      net_payout: Number(p.net_payout) / 100,
      gross_amount: Number(p.gross_amount) / 100,
      commission_amount: Number(p.commission_amount) / 100
    }))
    res.json(formattedPayouts)
  } catch (error) {
    console.error("Fetch payouts error:", error)
    res.status(500).json({ error: "Failed to fetch payouts" })
  }
})

export default router
