import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Cart } from "@/models/cart.entity"
import { Product } from "@/models/product.entity"

@Entity("cart_item")
export class CartItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  cartId!: string

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cartId" })
  cart!: Cart

  @Column()
  productId!: string

  @ManyToOne(() => Product)
  @JoinColumn({ name: "productId" })
  product!: Product

  @Column("int")
  quantity!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
