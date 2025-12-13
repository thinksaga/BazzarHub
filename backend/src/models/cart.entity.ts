import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn } from "typeorm"
import { User } from "@/models/user.entity"
import { CartItem } from "@/models/cart-item.entity"

@Entity("cart")
export class Cart {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ nullable: true })
  userId!: string

  @OneToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: true })
  items!: CartItem[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
