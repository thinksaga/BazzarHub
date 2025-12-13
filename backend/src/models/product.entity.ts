import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Review } from "./review.entity"

@Entity("product")
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  vendorId!: string

  @Column()
  title!: string

  @Column("text")
  description!: string

  @Column("decimal", { precision: 10, scale: 2 })
  price!: number

  @Column({ default: "INR" })
  currency!: string

  @Column()
  category!: string

  @Column("int", { default: 0 })
  inventory!: number

  @Column("simple-array", { nullable: true })
  images!: string[]

  @Column("jsonb", { nullable: true })
  attributes!: Record<string, any>

  @Column({ default: true })
  isActive!: boolean

  @OneToMany(() => Review, (review) => review.product)
  reviews!: Review[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
