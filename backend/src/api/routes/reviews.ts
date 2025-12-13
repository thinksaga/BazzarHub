import { Router, Request, Response } from "express"
import { ReviewService } from "../../services/review.service"
import { authMiddleware } from "../../middleware/auth.middleware"

const router = Router()
const reviewService = new ReviewService()

router.get("/product/:productId", async (req: Request, res: Response) => {
  try {
    const reviews = await reviewService.getProductReviews(req.params.productId)
    res.json(reviews)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reviews" })
  }
})

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { productId, rating, comment } = req.body
    // @ts-ignore
    const review = await reviewService.addReview(req.user.id, productId, rating, comment)
    res.status(201).json(review)
  } catch (error) {
    res.status(500).json({ error: "Failed to add review" })
  }
})

export default router
