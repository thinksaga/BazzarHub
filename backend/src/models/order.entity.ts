import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./user.entity"

@Entity("order")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  customerId!: string

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: "customerId" })
  customer!: User

  @Column("decimal", { precision: 10, scale: 2 })
  totalAmount!: number

  @Column({ default: "INR" })
  currency!: string

  @Column({ default: "pending" })
  status!: string

  @Column("jsonb", { nullable: true })
  shippingAddress!: Record<string, any>

  @Column("jsonb", { nullable: true })
  billingAddress!: Record<string, any>

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
