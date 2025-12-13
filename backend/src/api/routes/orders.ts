import { Router, Request, Response } from "express"
import { OrderService } from "../../services/order.service"
import { authMiddleware } from "../../middleware/auth.middleware"

const router = Router()
const orderService = new OrderService()

router.post("/", async (req: Request, res: Response) => {
  try {
    const order = await orderService.create(req.body)
    res.status(201).json(order)
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" })
  }
})

router.get("/vendor", authMiddleware, async (req: Request, res: Response) => {
  try {
    const vendorId = (req as any).user.id
    const orders = await orderService.findByVendor(vendorId)
    res.json(orders)
  } catch (error) {
    console.error("Fetch vendor orders error:", error)
    res.status(500).json({ error: "Failed to fetch vendor orders" })
  }
})

router.put("/items/:itemId/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const vendorId = (req as any).user.id
    const { status } = req.body
    const { itemId } = req.params

    const updatedItem = await orderService.updateItemStatus(itemId, status, vendorId)
    
    if (!updatedItem) {
      return res.status(404).json({ error: "Item not found or unauthorized" })
    }

    res.json(updatedItem)
  } catch (error) {
    console.error("Update item status error:", error)
    res.status(500).json({ error: "Failed to update item status" })
  }
})

router.get("/", async (req: Request, res: Response) => {
  try {
    const orders = await orderService.findAll(req.query)
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const order = await orderService.findOne(req.params.id)
    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order" })
  }
})

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const order = await orderService.update(req.params.id, req.body)
    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: "Failed to update order" })
  }
})

export default router
