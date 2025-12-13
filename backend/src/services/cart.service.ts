import { AppDataSource } from "../config/database.config"
import { Cart } from "../models/cart.entity"
import { CartItem } from "../models/cart-item.entity"
import { Product } from "../models/product.entity"

export class CartService {
  private cartRepository = AppDataSource.getRepository(Cart)
  private cartItemRepository = AppDataSource.getRepository(CartItem)
  private productRepository = AppDataSource.getRepository(Product)

  async getCart(userId: string) {
    let cart = await this.cartRepository.findOne({
      where: { userId },
      relations: ["items", "items.product"]
    })

    if (!cart) {
      cart = this.cartRepository.create({ userId, items: [] })
      await this.cartRepository.save(cart)
    }

    return cart
  }

  async addToCart(userId: string, productId: string, quantity: number) {
    const cart = await this.getCart(userId)
    const product = await this.productRepository.findOne({ where: { id: productId } })

    if (!product) throw new Error("Product not found")

    let cartItem = await this.cartItemRepository.findOne({
      where: { cartId: cart.id, productId }
    })

    if (cartItem) {
      cartItem.quantity += quantity
    } else {
      cartItem = this.cartItemRepository.create({
        cart,
        product,
        quantity
      })
    }

    await this.cartItemRepository.save(cartItem)
    return this.getCart(userId)
  }

  async removeFromCart(userId: string, itemId: string) {
    const cart = await this.getCart(userId)
    await this.cartItemRepository.delete({ id: itemId, cartId: cart.id })
    return this.getCart(userId)
  }

  async clearCart(userId: string) {
    const cart = await this.getCart(userId)
    await this.cartItemRepository.delete({ cartId: cart.id })
    return this.getCart(userId)
  }
}
