import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Order } from "./order.entity"

export enum UserRole {
  CUSTOMER = "customer",
  VENDOR = "vendor",
  ADMIN = "admin"
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ unique: true })
  email!: string

  @Column({ select: false })
  password!: string

  @Column()
  firstName!: string

  @Column()
  lastName!: string

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.CUSTOMER
  })
  role!: UserRole

  @Column({ nullable: true })
  phone!: string

  @OneToMany(() => Order, (order) => order.customer)
  orders!: Order[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
