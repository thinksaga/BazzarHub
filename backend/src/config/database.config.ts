import { DataSource } from "typeorm"
import { Product } from "@/models/product.entity"
import { Order } from "@/models/order.entity"
import { VendorAccount } from "@/models/vendor-account.model"
import { VendorPayout } from "@/models/vendor-payout.model"
import { User } from "@/models/user.entity"
import { Category } from "@/models/category.entity"
import { Cart } from "@/models/cart.entity"
import { CartItem } from "@/models/cart-item.entity"
import { Review } from "@/models/review.entity"

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "mercurjs_user",
  password: process.env.DB_PASSWORD || "mercurjs_password",
  database: process.env.DB_NAME || "mercurjs",
  synchronize: true, // Set to false in production
  logging: false,
  entities: [
    Product, 
    Order, 
    VendorAccount, 
    VendorPayout,
    User,
    Category,
    Cart,
    CartItem,
    Review
  ],
  subscribers: [],
  migrations: [],
})
