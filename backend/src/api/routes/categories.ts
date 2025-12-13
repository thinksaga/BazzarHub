import { Router, Request, Response } from "express"
import { CategoryService } from "../../services/category.service"

const router = Router()
const categoryService = new CategoryService()

router.get("/", async (req: Request, res: Response) => {
  try {
    const categories = await categoryService.findAll()
    res.json(categories)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" })
  }
})

router.post("/", async (req: Request, res: Response) => {
  try {
    const category = await categoryService.create(req.body)
    res.status(201).json(category)
  } catch (error) {
    res.status(500).json({ error: "Failed to create category" })
  }
})

export default router
