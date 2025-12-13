import { Router, Request, Response } from "express"
import { GSTReportsService } from "../../../services/gst-reports.service"

const router = Router()
const gstReportsService = GSTReportsService.getInstance()

router.post("/gstr1", async (req: Request, res: Response) => {
  try {
    const { vendorId, month, year } = req.body
    if (!vendorId || !month || !year) {
      return res.status(400).json({ error: "Missing required fields" })
    }
    const report = await gstReportsService.generateGSTR1(vendorId, Number(month), Number(year))
    res.json(report)
  } catch (error) {
    console.error("Generate GSTR-1 error:", error)
    res.status(500).json({ error: "Failed to generate GSTR-1 report" })
  }
})

router.post("/gstr3b", async (req: Request, res: Response) => {
  try {
    const { vendorId, month, year } = req.body
    if (!vendorId || !month || !year) {
      return res.status(400).json({ error: "Missing required fields" })
    }
    const report = await gstReportsService.generateGSTR3B(vendorId, Number(month), Number(year))
    res.json(report)
  } catch (error) {
    console.error("Generate GSTR-3B error:", error)
    res.status(500).json({ error: "Failed to generate GSTR-3B report" })
  }
})

export default router
