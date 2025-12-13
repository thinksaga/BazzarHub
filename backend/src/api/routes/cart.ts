import { Router, Request, Response } from "express"
import { CartService } from "../../services/cart.service"
import { authMiddleware } from "../../middleware/auth.middleware"

const router = Router()
const cartService = new CartService()

router.use(authMiddleware)

router.get("/", async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const cart = await cartService.getCart(req.user.id)
    res.json(cart)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cart" })
  }
})

router.post("/items", async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body
    // @ts-ignore
    const cart = await cartService.addToCart(req.user.id, productId, quantity || 1)
    res.json(cart)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.put("/items/:id", async (req: Request, res: Response) => {
  try {
    const { quantity } = req.body
    // @ts-ignore
    const cart = await cartService.updateItemQuantity(req.user.id, req.params.id, quantity)
    res.json(cart)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.delete("/items/:id", async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const cart = await cartService.removeFromCart(req.user.id, req.params.id)
    res.json(cart)
  } catch (error) {
    res.status(500).json({ error: "Failed to remove item" })
  }
})

export default router
