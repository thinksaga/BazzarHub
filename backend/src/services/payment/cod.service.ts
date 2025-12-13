import RedisService from '../redis';
import { v4 as uuidv4 } from 'uuid';

interface CODAvailabilityCheck {
  available: boolean;
  reason?: string;
  max_cod_value?: number;
  delivery_charges?: number;
}

interface CODRemittance {
  id: string;
  order_id: string;
  vendor_id: string;
  amount: number;
  logistics_partner: string;
  awb_number?: string;
  remittance_date: Date;
  remittance_ref: string;
  status: 'pending' | 'verified' | 'mismatched' | 'completed';
  verification_notes?: string;
  created_at: Date;
}

interface CustomerRiskProfile {
  customer_id: string;
  total_orders: number;
  successful_cod_orders: number;
  failed_cod_orders: number;
  return_rate: number;
  risk_score: number; // 0-100 (higher is riskier)
  risk_level: 'low' | 'medium' | 'high';
}

export class CODService {
  private redisService: RedisService;
  private static instance: CODService;

  // COD configuration
  private readonly COD_SERVICEABLE_PINCODES: Set<string> = new Set();
  private readonly MAX_COD_VALUE_NEW_CUSTOMER = 200000; // ₹2000 in paise
  private readonly MAX_COD_VALUE_TRUSTED_CUSTOMER = 1000000; // ₹10000 in paise
  private readonly MIN_ORDERS_FOR_HIGH_VALUE = 3;
  private readonly COD_CHARGES_PERCENTAGE = 2; // 2% COD handling charges

  private constructor() {
    this.redisService = new RedisService();
    this.loadServiceablePincodes();
  }

  static getInstance(): CODService {
    if (!CODService.instance) {
      CODService.instance = new CODService();
    }
    return CODService.instance;
  }

  /**
   * Validate COD availability for customer and order
   * Implements risk scoring and limits
   */
  async validateCODAvailability(
    pincode: string,
    orderValue: number,
    customerId: string
  ): Promise<CODAvailabilityCheck> {
    try {
      // Check 1: Pincode serviceability
      if (!await this.isPincodeServiceable(pincode)) {
        return {
          available: false,
          reason: `COD not available for pincode ${pincode}`,
        };
      }

      // Check 2: Get customer risk profile
      const riskProfile = await this.getCustomerRiskProfile(customerId);

      // Check 3: Risk-based limits
      if (riskProfile.risk_level === 'high') {
        return {
          available: false,
          reason: 'COD not available due to high risk profile',
        };
      }

      // Check 4: Order value limits based on customer history
      const maxCODValue = this.getMaxCODValue(riskProfile);

      if (orderValue > maxCODValue) {
        return {
          available: false,
          reason: `Order value (₹${orderValue / 100}) exceeds COD limit (₹${maxCODValue / 100})`,
          max_cod_value: maxCODValue,
        };
      }

      // Check 5: Calculate COD charges
      const codCharges = Math.floor((orderValue * this.COD_CHARGES_PERCENTAGE) / 100);

      return {
        available: true,
        max_cod_value: maxCODValue,
        delivery_charges: codCharges,
      };
    } catch (error: any) {
      console.error('[COD Service] Error validating availability:', error);
      return {
        available: false,
        reason: 'Unable to verify COD availability',
      };
    }
  }

  /**
   * Record COD remittance from logistics partner
   * Tracks COD collection and reconciliation
   */
  async recordCODRemittance(
    orderId: string,
    vendorId: string,
    amount: number,
    logisticsPartner: string,
    awbNumber?: string
  ): Promise<CODRemittance> {
    try {
      // Generate remittance reference
      const remittanceRef = `COD_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Get order amount for verification
      const orderAmount = await this.getOrderAmount(orderId);

      // Create remittance record
      const remittance: CODRemittance = {
        id: uuidv4(),
        order_id: orderId,
        vendor_id: vendorId,
        amount,
        logistics_partner: logisticsPartner,
        awb_number: awbNumber,
        remittance_date: new Date(),
        remittance_ref: remittanceRef,
        status: orderAmount === amount ? 'verified' : 'mismatched',
        verification_notes: orderAmount !== amount 
          ? `Amount mismatch: Expected ₹${orderAmount / 100}, Received ₹${amount / 100}`
          : undefined,
        created_at: new Date(),
      };

      // Save remittance
      await this.saveRemittance(remittance);

      // If verified, create payout entry for vendor
      if (remittance.status === 'verified') {
        await this.createVendorCODPayout(remittance);
      }

      // Log event
      await this.logCODEvent('remittance_recorded', {
        remittance_id: remittance.id,
        order_id: orderId,
        vendor_id: vendorId,
        amount,
        status: remittance.status,
      });

      console.log('[COD Service] Remittance recorded:', remittance.id);

      return remittance;
    } catch (error: any) {
      console.error('[COD Service] Error recording remittance:', error);
      throw new Error(`Failed to record remittance: ${error.message}`);
    }
  }

  /**
   * Get customer risk profile
   * Used for COD eligibility decisions
   */
  async getCustomerRiskProfile(customerId: string): Promise<CustomerRiskProfile> {
    try {
      const redis = this.redisService.getClient();
      const key = `customer:risk:${customerId}`;
      const cached = await redis.get(key);

      if (cached) {
        return JSON.parse(cached) as CustomerRiskProfile;
      }

      // Calculate risk profile
      const profile = await this.calculateRiskProfile(customerId);

      // Cache for 24 hours
      await redis.set(key, JSON.stringify(profile), 'EX', 86400);

      return profile;
    } catch (error) {
      console.error('[COD Service] Error fetching risk profile:', error);
      
      // Return default profile for new customers
      return {
        customer_id: customerId,
        total_orders: 0,
        successful_cod_orders: 0,
        failed_cod_orders: 0,
        return_rate: 0,
        risk_score: 50,
        risk_level: 'medium',
      };
    }
  }

  /**
   * Update customer risk profile after order completion
   */
  async updateCustomerRiskProfile(
    customerId: string,
    orderCompleted: boolean,
    wasReturned: boolean = false
  ): Promise<void> {
    try {
      const profile = await this.getCustomerRiskProfile(customerId);

      // Update counts
      profile.total_orders += 1;
      
      if (orderCompleted) {
        profile.successful_cod_orders += 1;
      } else {
        profile.failed_cod_orders += 1;
      }

      if (wasReturned) {
        profile.return_rate = ((profile.return_rate * (profile.total_orders - 1)) + 1) / profile.total_orders;
      }

      // Recalculate risk score
      profile.risk_score = this.calculateRiskScore(profile);
      profile.risk_level = this.getRiskLevel(profile.risk_score);

      // Save updated profile
      const redis = this.redisService.getClient();
      const key = `customer:risk:${customerId}`;
      await redis.set(key, JSON.stringify(profile), 'EX', 86400);

      console.log('[COD Service] Risk profile updated:', customerId, profile.risk_level);
    } catch (error) {
      console.error('[COD Service] Error updating risk profile:', error);
    }
  }

  /**
   * Get COD statistics for analytics
   */
  async getCODStatistics(vendorId?: string): Promise<any> {
    try {
      const redis = this.redisService.getClient();
      
      // Get all remittances
      const pattern = vendorId ? `cod:remittance:vendor:${vendorId}:*` : 'cod:remittance:*';
      const keys = await redis.keys(pattern);

      let totalRemittances = 0;
      let totalAmount = 0;
      let verifiedCount = 0;
      let mismatchedCount = 0;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const remittance = JSON.parse(data) as CODRemittance;
          totalRemittances++;
          totalAmount += remittance.amount;
          
          if (remittance.status === 'verified') {
            verifiedCount++;
          } else if (remittance.status === 'mismatched') {
            mismatchedCount++;
          }
        }
      }

      return {
        total_remittances: totalRemittances,
        total_amount: totalAmount,
        verified_count: verifiedCount,
        mismatched_count: mismatchedCount,
        verification_rate: totalRemittances > 0 ? (verifiedCount / totalRemittances) * 100 : 0,
      };
    } catch (error) {
      console.error('[COD Service] Error fetching statistics:', error);
      return {
        total_remittances: 0,
        total_amount: 0,
        verified_count: 0,
        mismatched_count: 0,
        verification_rate: 0,
      };
    }
  }

  // Private helper methods

  private async loadServiceablePincodes(): Promise<void> {
    // In production, load from database or external service
    // For now, adding common metro city pincodes
    const metroPincodes = [
      // Mumbai
      '400001', '400002', '400003', '400051', '400092',
      // Delhi
      '110001', '110002', '110003', '110051', '110092',
      // Bangalore
      '560001', '560002', '560003', '560051', '560092',
      // Hyderabad
      '500001', '500002', '500003', '500051', '500092',
      // Chennai
      '600001', '600002', '600003', '600051', '600092',
      // Kolkata
      '700001', '700002', '700003', '700051', '700092',
    ];

    metroPincodes.forEach(pincode => this.COD_SERVICEABLE_PINCODES.add(pincode));
  }

  private async isPincodeServiceable(pincode: string): Promise<boolean> {
    // Check in-memory set
    if (this.COD_SERVICEABLE_PINCODES.has(pincode)) {
      return true;
    }

    // Check Redis cache
    const redis = this.redisService.getClient();
    const cached = await redis.get(`pincode:serviceable:${pincode}`);
    
    if (cached === 'true') {
      return true;
    }

    // In production, call external pincode API here
    // For now, accept all 6-digit pincodes
    const isServiceable = /^\d{6}$/.test(pincode);

    // Cache result for 7 days
    if (isServiceable) {
      await redis.set(`pincode:serviceable:${pincode}`, 'true', 'EX', 86400 * 7);
    }

    return isServiceable;
  }

  private getMaxCODValue(riskProfile: CustomerRiskProfile): number {
    // New customers or high risk
    if (riskProfile.total_orders < this.MIN_ORDERS_FOR_HIGH_VALUE || riskProfile.risk_level === 'high') {
      return this.MAX_COD_VALUE_NEW_CUSTOMER;
    }

    // Trusted customers
    if (riskProfile.risk_level === 'low' && riskProfile.successful_cod_orders >= this.MIN_ORDERS_FOR_HIGH_VALUE) {
      return this.MAX_COD_VALUE_TRUSTED_CUSTOMER;
    }

    // Medium risk
    return Math.floor((this.MAX_COD_VALUE_NEW_CUSTOMER + this.MAX_COD_VALUE_TRUSTED_CUSTOMER) / 2);
  }

  private async calculateRiskProfile(customerId: string): Promise<CustomerRiskProfile> {
    // In production, fetch from order history database
    // For now, return default profile
    return {
      customer_id: customerId,
      total_orders: 0,
      successful_cod_orders: 0,
      failed_cod_orders: 0,
      return_rate: 0,
      risk_score: 50,
      risk_level: 'medium',
    };
  }

  private calculateRiskScore(profile: CustomerRiskProfile): number {
    let score = 50; // Start with medium risk

    // Reduce risk for successful orders
    if (profile.successful_cod_orders > 0) {
      score -= Math.min(30, profile.successful_cod_orders * 5);
    }

    // Increase risk for failed orders
    if (profile.failed_cod_orders > 0) {
      score += Math.min(40, profile.failed_cod_orders * 10);
    }

    // Increase risk for returns
    score += Math.floor(profile.return_rate * 20);

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore < 30) return 'low';
    if (riskScore < 70) return 'medium';
    return 'high';
  }

  private async getOrderAmount(orderId: string): Promise<number> {
    try {
      const redis = this.redisService.getClient();
      const orderKey = `order:${orderId}`;
      const orderData = await redis.get(orderKey);

      if (orderData) {
        const order = JSON.parse(orderData);
        return order.amount;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  private async saveRemittance(remittance: CODRemittance): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Save by remittance ID
    await redis.set(`cod:remittance:${remittance.id}`, JSON.stringify(remittance));
    
    // Index by order ID
    await redis.set(`cod:remittance:order:${remittance.order_id}`, JSON.stringify(remittance));
    
    // Index by vendor ID
    await redis.set(`cod:remittance:vendor:${remittance.vendor_id}:${remittance.id}`, JSON.stringify(remittance));
  }

  private async createVendorCODPayout(remittance: CODRemittance): Promise<void> {
    try {
      // Create payout entry for vendor
      const payout = {
        id: uuidv4(),
        vendor_id: remittance.vendor_id,
        order_id: remittance.order_id,
        payout_type: 'cod_remittance',
        amount: remittance.amount,
        remittance_id: remittance.id,
        status: 'pending',
        created_at: new Date(),
      };

      const redis = this.redisService.getClient();
      await redis.set(`payout:cod:${payout.id}`, JSON.stringify(payout));

      console.log('[COD Service] Payout created for remittance:', remittance.id);
    } catch (error) {
      console.error('[COD Service] Error creating payout:', error);
    }
  }

  private async logCODEvent(event: string, data: any): Promise<void> {
    const redis = this.redisService.getClient();
    const log = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    
    const logKey = `cod:log:${Date.now()}:${uuidv4()}`;
    await redis.set(logKey, JSON.stringify(log), 'EX', 86400 * 30); // Keep for 30 days
  }
}

export default CODService;
