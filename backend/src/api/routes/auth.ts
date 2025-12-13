import { Router, Request, Response } from "express"
import { AuthService } from "../../services/auth.service"
import { authMiddleware } from "../../middleware/auth.middleware"

const router = Router()
const authService = new AuthService()

router.post("/register", async (req: Request, res: Response) => {
  try {
    const user = await authService.register(req.body)
    res.status(201).json(user)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

router.post("/login", async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body.email, req.body.password)
    res.json(result)
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const user = await authService.getProfile(req.user.id)
    res.json(user)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
