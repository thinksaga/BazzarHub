import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Order } from "./order.entity"
import { Product } from "./product.entity"

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  orderId!: string

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: "orderId" })
  order!: Order

  @Column()
  productId!: string

  @ManyToOne(() => Product)
  @JoinColumn({ name: "productId" })
  product!: Product

  @Column()
  vendorId!: string

  @Column("int")
  quantity!: number

  @Column("decimal", { precision: 10, scale: 2 })
  price!: number

  @Column({ default: "pending" })
  status!: string // pending, shipped, delivered, cancelled, returned

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
