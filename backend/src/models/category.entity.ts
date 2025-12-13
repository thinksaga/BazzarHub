import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Tree, TreeChildren, TreeParent } from "typeorm"

@Entity("category")
@Tree("closure-table")
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  name!: string

  @Column({ unique: true })
  slug!: string

  @Column({ nullable: true })
  description!: string

  @Column({ nullable: true })
  image!: string

  @TreeChildren()
  children!: Category[]

  @TreeParent()
  parent!: Category

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
