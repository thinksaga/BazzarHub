import { Router, Request, Response } from "express"
import { OrderService } from "../../services/order.service"

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
