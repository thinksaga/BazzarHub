import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./user.entity"
import { Product } from "./product.entity"

@Entity("review")
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User

  @Column()
  productId!: string

  @ManyToOne(() => Product)
  @JoinColumn({ name: "productId" })
  product!: Product

  @Column("int")
  rating!: number

  @Column("text", { nullable: true })
  comment!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
