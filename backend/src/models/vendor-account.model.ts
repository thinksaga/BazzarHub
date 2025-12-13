import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum VendorAccountStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum AccountType {
  SAVINGS = 'savings',
  CURRENT = 'current',
}

@Entity('vendor_accounts')
@Index(['vendor_id'], { unique: true })
@Index(['razorpay_account_id'])
export class VendorAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  vendor_id!: string;

  // Bank Account Details
  @Column({ type: 'varchar', length: 50 })
  account_number!: string;

  @Column({ type: 'varchar', length: 11 })
  ifsc_code!: string;

  @Column({ type: 'varchar', length: 255 })
  account_holder_name!: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    default: AccountType.SAVINGS,
  })
  account_type!: AccountType;

  // KYC Documents
  @Column({ type: 'varchar', length: 10 })
  pan!: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin?: string;

  // Business Details
  @Column({ type: 'varchar', length: 255, nullable: true })
  business_name?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  business_type?: string; // individual, partnership, company, etc.

  @Column({ type: 'text', nullable: true })
  business_address?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contact_phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email?: string;

  // Razorpay Route Details
  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  razorpay_account_id?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  razorpay_fund_account_id?: string;

  @Column({
    type: 'enum',
    enum: VendorAccountStatus,
    default: VendorAccountStatus.PENDING,
  })
  status!: VendorAccountStatus;

  // Commission Settings
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10.0 })
  commission_percentage!: number; // Marketplace commission (e.g., 10%)

  @Column({ type: 'boolean', default: true })
  auto_payout_enabled!: boolean;

  // KYC Document URLs
  @Column({ type: 'json', nullable: true })
  documents?: {
    pan_card?: string;
    gst_certificate?: string;
    cancelled_cheque?: string;
    business_proof?: string;
  };

  // Verification Details
  @Column({ type: 'text', nullable: true })
  verification_notes?: string;

  @Column({ type: 'timestamp', nullable: true })
  verified_at?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verified_by?: string;

  @Column({ type: 'text', nullable: true })
  rejection_reason?: string;

  // Bank Verification
  @Column({ type: 'boolean', default: false })
  bank_verified!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank_verification_id?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
