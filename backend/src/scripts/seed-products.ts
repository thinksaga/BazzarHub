import { AppDataSource } from "../config/database.config"
import { Product } from "../models/product.entity"

async function seed() {
  try {
    await AppDataSource.initialize()
    console.log("📦 Database connected")

    const productRepository = AppDataSource.getRepository(Product)

    // Check if products already exist
    const count = await productRepository.count()
    if (count > 0) {
      console.log("⚠️ Products already exist, skipping seed")
      process.exit(0)
    }

    const products = [
      {
        title: "Wireless Headphones",
        description: "High-quality wireless headphones with noise cancellation.",
        price: 2499,
        currency: "INR",
        category: "Electronics",
        inventory: 50,
        images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80"],
        vendorId: "vendor_1",
        isActive: true
      },
      {
        title: "Cotton T-Shirt",
        description: "Comfortable 100% cotton t-shirt available in multiple sizes.",
        price: 399,
        currency: "INR",
        category: "Clothing",
        inventory: 100,
        images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80"],
        vendorId: "vendor_2",
        isActive: true
      },
      {
        title: "Coffee Maker",
        description: "Brew the perfect cup of coffee every morning.",
        price: 1799,
        currency: "INR",
        category: "Home & Kitchen",
        inventory: 30,
        images: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&q=80"],
        vendorId: "vendor_1",
        isActive: true
      },
      {
        title: "Yoga Mat",
        description: "Non-slip yoga mat for your daily practice.",
        price: 599,
        currency: "INR",
        category: "Fitness",
        inventory: 75,
        images: ["https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&q=80"],
        vendorId: "vendor_3",
        isActive: true
      }
    ]

    for (const productData of products) {
      const product = productRepository.create(productData)
      await productRepository.save(product)
      console.log(`Created product: ${product.title}`)
    }

    console.log("✅ Seeding complete")
    process.exit(0)
  } catch (error) {
    console.error("❌ Seeding failed:", error)
    process.exit(1)
  }
}

seed()
