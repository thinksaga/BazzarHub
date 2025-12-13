import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum PayoutType {
  ORDER = 'order',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

@Entity('vendor_payouts')
@Index(['vendor_id', 'status'])
@Index(['order_id'])
@Index(['transfer_id'])
@Index(['created_at'])
export class VendorPayout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  @Index()
  vendor_id!: string;

  @Column({ type: 'varchar', nullable: true })
  order_id?: string;

  @Column({ type: 'varchar', nullable: true })
  payment_id?: string;

  @Column({
    type: 'enum',
    enum: PayoutType,
    default: PayoutType.ORDER,
  })
  payout_type!: PayoutType;

  // Amount Details (in paise/cents)
  @Column({ type: 'bigint' })
  gross_amount!: number; // Total order amount

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commission_percentage!: number; // Commission rate applied

  @Column({ type: 'bigint' })
  commission_amount!: number; // Commission deducted

  @Column({ type: 'bigint', nullable: true })
  platform_fee?: number; // Additional platform fees

  @Column({ type: 'bigint', nullable: true })
  tax_amount?: number; // GST on commission

  @Column({ type: 'bigint' })
  net_payout!: number; // Amount transferred to vendor

  // Currency
  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  // Razorpay Route Details
  @Column({ type: 'varchar', length: 100, nullable: true })
  transfer_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_account_id?: string;

  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.PENDING,
  })
  status!: PayoutStatus;

  // Retry Mechanism
  @Column({ type: 'int', default: 0 })
  retry_count!: number;

  @Column({ type: 'int', default: 5 })
  max_retries!: number;

  @Column({ type: 'timestamp', nullable: true })
  next_retry_at?: Date;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ type: 'json', nullable: true })
  error_details?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };

  // Transfer Details
  @Column({ type: 'timestamp', nullable: true })
  initiated_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  processed_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  failed_at?: Date;

  // Notification Status
  @Column({ type: 'boolean', default: false })
  vendor_notified!: boolean;

  @Column({ type: 'boolean', default: false })
  admin_notified!: boolean;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  initiated_by?: string;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    customer_id?: string;
    product_ids?: string[];
    order_total?: number;
    refund_id?: string;
    adjustment_reason?: string;
  };

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
