import { Router, Request, Response } from "express"
import { VendorAccountService } from "../../services/vendor-account.service"
import { VendorAccountStatus } from "../../models/vendor-account.model"

const router = Router()
const vendorAccountService = new VendorAccountService()

router.get("/", async (req: Request, res: Response) => {
  try {
    const vendors = await vendorAccountService.findAll(req.query)
    res.json(vendors)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vendors" })
  }
})

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const vendor = await vendorAccountService.findOne(req.params.id)
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" })
    }
    res.json(vendor)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vendor" })
  }
})

router.post("/", async (req: Request, res: Response) => {
  try {
    const vendor = await vendorAccountService.create(req.body)
    res.status(201).json(vendor)
  } catch (error) {
    res.status(500).json({ error: "Failed to create vendor" })
  }
})

router.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    if (!Object.values(VendorAccountStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }
    const vendor = await vendorAccountService.updateStatus(req.params.id, status)
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" })
    }
    res.json(vendor)
  } catch (error) {
    res.status(500).json({ error: "Failed to update vendor status" })
  }
})

export default router
