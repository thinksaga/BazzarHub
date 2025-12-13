import { Router, Request, Response } from "express"
import { ProductService } from "../../services/product.service"
import { authMiddleware } from "../../middleware/auth.middleware"

const router = Router()
const productService = new ProductService()

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const product = await productService.create(req.body)
    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" })
  }
})

router.get("/", async (req: Request, res: Response) => {
  try {
    const products = await productService.findAll(req.query)
    res.json(products)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" })
  }
})

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const product = await productService.findOne(req.params.id)
    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" })
  }
})

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const product = await productService.update(req.params.id, req.body)
    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" })
  }
})

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await productService.delete(req.params.id)
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" })
  }
})

export default router
