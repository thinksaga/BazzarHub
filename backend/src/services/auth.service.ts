import { AppDataSource } from "../config/database.config"
import { User, UserRole } from "../models/user.entity"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

export class AuthService {
  private userRepository = AppDataSource.getRepository(User)
  private readonly JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

  async register(data: Partial<User>) {
    const existingUser = await this.userRepository.findOne({ where: { email: data.email } })
    if (existingUser) {
      throw new Error("User already exists")
    }

    const hashedPassword = await bcrypt.hash(data.password!, 10)
    const user = this.userRepository.create({
      ...data,
      password: hashedPassword,
      role: data.role || UserRole.CUSTOMER
    })

    await this.userRepository.save(user)
    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({ 
      where: { email },
      select: ["id", "email", "password", "role", "firstName", "lastName"] 
    })

    if (!user) {
      throw new Error("Invalid credentials")
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new Error("Invalid credentials")
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      this.JWT_SECRET,
      { expiresIn: "24h" }
    )

    const { password: _, ...userWithoutPassword } = user
    return { user: userWithoutPassword, token }
  }

  async getProfile(userId: string) {
    return this.userRepository.findOne({ where: { id: userId } })
  }
}
