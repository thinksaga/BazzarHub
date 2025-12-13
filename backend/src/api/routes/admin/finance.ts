import { Router, Request, Response } from "express"
import { VendorPayoutService } from "../../../services/vendor-payout.service"

const router = Router()
const payoutService = new VendorPayoutService()

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await payoutService.getAdminStats()
    res.json(stats)
  } catch (error) {
    console.error("Fetch admin finance stats error:", error)
    res.status(500).json({ error: "Failed to fetch finance stats" })
  }
})

router.get("/payouts", async (req: Request, res: Response) => {
  try {
    const payouts = await payoutService.findAll()
    // Format amounts
    const formattedPayouts = payouts.map(p => ({
      ...p,
      net_payout: Number(p.net_payout) / 100,
      gross_amount: Number(p.gross_amount) / 100,
      commission_amount: Number(p.commission_amount) / 100
    }))
    res.json(formattedPayouts)
  } catch (error) {
    console.error("Fetch admin payouts error:", error)
    res.status(500).json({ error: "Failed to fetch payouts" })
  }
})

export default router
