import RedisService from '../redis';
import { RouteService } from './route.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

interface VendorPayoutCalculation {
  vendor_id: string;
  period_start: Date;
  period_end: Date;
  total_orders: number;
  total_sales: number;
  total_commission: number;
  total_tds: number;
  net_payout: number;
  orders: PayoutOrderDetail[];
  calculated_at: Date;
}

interface PayoutOrderDetail {
  order_id: string;
  order_date: Date;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  tds_amount: number;
  net_amount: number;
  transfer_id?: string;
  transfer_status?: string;
}

interface PayoutSchedule {
  id: string;
  vendor_id: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  next_payout_date: Date;
  minimum_payout_amount: number;
  active: boolean;
  created_at: Date;
}

interface PayoutReport {
  id: string;
  vendor_id: string;
  calculation_id: string;
  period_start: Date;
  period_end: Date;
  total_payout: number;
  report_type: 'summary' | 'detailed';
  file_path?: string;
  generated_at: Date;
}

export class PayoutService {
  private redisService: RedisService;
  private routeService: RouteService;
  private static instance: PayoutService;

  // Configuration
  private readonly DEFAULT_MIN_PAYOUT_AMOUNT = 100000; // ₹1000 in paise
  private readonly REPORTS_DIR = path.join(__dirname, '../../../reports/payouts');

  private constructor() {
    this.redisService = new RedisService();
    this.routeService = RouteService.getInstance();
    this.ensureReportsDirectory();
  }

  static getInstance(): PayoutService {
    if (!PayoutService.instance) {
      PayoutService.instance = new PayoutService();
    }
    return PayoutService.instance;
  }

  /**
   * Calculate vendor payouts for a given period
   * Aggregates all orders, commissions, and TDS
   */
  async calculateVendorPayouts(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<VendorPayoutCalculation> {
    try {
      console.log('[Payout Service] Calculating payouts for vendor:', vendorId, periodStart, periodEnd);

      const redis = this.redisService.getClient();
      
      // Get all transfers for vendor in period
      const transfers = await this.getVendorTransfersInPeriod(vendorId, periodStart, periodEnd);

      let totalSales = 0;
      let totalCommission = 0;
      let totalTDS = 0;
      const orders: PayoutOrderDetail[] = [];

      for (const transfer of transfers) {
        // Get order details
        const orderKey = `order:${transfer.order_id}`;
        const orderData = await redis.get(orderKey);

        if (orderData) {
          const order = JSON.parse(orderData);

          const orderDetail: PayoutOrderDetail = {
            order_id: order.id,
            order_date: new Date(order.created_at),
            order_amount: order.amount,
            commission_rate: transfer.commission_rate,
            commission_amount: transfer.commission_amount,
            tds_amount: transfer.tds_amount,
            net_amount: transfer.amount,
            transfer_id: transfer.id,
            transfer_status: transfer.status,
          };

          orders.push(orderDetail);

          // Only count processed/completed transfers
          if (transfer.status === 'processed' || transfer.status === 'completed') {
            totalSales += order.amount;
            totalCommission += transfer.commission_amount;
            totalTDS += transfer.tds_amount;
          }
        }
      }

      const netPayout = totalSales - totalCommission - totalTDS;

      const calculation: VendorPayoutCalculation = {
        vendor_id: vendorId,
        period_start: periodStart,
        period_end: periodEnd,
        total_orders: orders.length,
        total_sales: totalSales,
        total_commission: totalCommission,
        total_tds: totalTDS,
        net_payout: netPayout,
        orders,
        calculated_at: new Date(),
      };

      // Save calculation
      await this.savePayoutCalculation(calculation);

      console.log('[Payout Service] Calculation complete:', {
        vendor_id: vendorId,
        total_orders: calculation.total_orders,
        net_payout: calculation.net_payout,
      });

      return calculation;

    } catch (error: any) {
      console.error('[Payout Service] Error calculating payouts:', error);
      throw new Error(`Failed to calculate payouts: ${error.message}`);
    }
  }

  /**
   * Schedule automatic payouts for vendor
   * Supports daily, weekly, biweekly, monthly frequencies
   */
  async schedulePayouts(
    vendorId: string,
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly',
    minimumAmount?: number
  ): Promise<PayoutSchedule> {
    try {
      const schedule: PayoutSchedule = {
        id: uuidv4(),
        vendor_id: vendorId,
        frequency,
        next_payout_date: this.calculateNextPayoutDate(frequency),
        minimum_payout_amount: minimumAmount || this.DEFAULT_MIN_PAYOUT_AMOUNT,
        active: true,
        created_at: new Date(),
      };

      // Save schedule
      const redis = this.redisService.getClient();
      await redis.set(`payout:schedule:${schedule.id}`, JSON.stringify(schedule));
      await redis.set(`payout:schedule:vendor:${vendorId}`, JSON.stringify(schedule));

      console.log('[Payout Service] Schedule created:', schedule.id, frequency);

      return schedule;

    } catch (error: any) {
      console.error('[Payout Service] Error scheduling payouts:', error);
      throw new Error(`Failed to schedule payouts: ${error.message}`);
    }
  }

  /**
   * Process scheduled payouts (called by cron job)
   * Checks all active schedules and processes due payouts
   */
  async processScheduledPayouts(): Promise<void> {
    try {
      console.log('[Payout Service] Processing scheduled payouts...');

      const redis = this.redisService.getClient();
      const scheduleKeys = await redis.keys('payout:schedule:vendor:*');

      let processedCount = 0;
      let skippedCount = 0;

      for (const key of scheduleKeys) {
        const scheduleData = await redis.get(key);
        if (!scheduleData) continue;

        const schedule = JSON.parse(scheduleData) as PayoutSchedule;

        // Check if schedule is active and due
        if (!schedule.active) {
          skippedCount++;
          continue;
        }

        const now = new Date();
        const nextPayoutDate = new Date(schedule.next_payout_date);

        if (now >= nextPayoutDate) {
          // Process payout for this vendor
          await this.processVendorPayout(schedule);
          processedCount++;

          // Update next payout date
          schedule.next_payout_date = this.calculateNextPayoutDate(schedule.frequency, nextPayoutDate);
          await redis.set(key, JSON.stringify(schedule));
        } else {
          skippedCount++;
        }
      }

      console.log('[Payout Service] Scheduled payouts processed:', {
        processed: processedCount,
        skipped: skippedCount,
      });

    } catch (error: any) {
      console.error('[Payout Service] Error processing scheduled payouts:', error);
    }
  }

  /**
   * Generate payout report for vendor
   * Creates PDF with order details and commission breakdown
   */
  async generatePayoutReport(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
    reportType: 'summary' | 'detailed' = 'detailed'
  ): Promise<PayoutReport> {
    try {
      console.log('[Payout Service] Generating report for vendor:', vendorId);

      // Calculate payouts
      const calculation = await this.calculateVendorPayouts(vendorId, periodStart, periodEnd);

      // Generate Report
      const fileName = `payout_${vendorId}_${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}.txt`;
      const filePath = path.join(this.REPORTS_DIR, fileName);

      await this.generatePDF(calculation, filePath, reportType);

      const report: PayoutReport = {
        id: uuidv4(),
        vendor_id: vendorId,
        calculation_id: `calc_${Date.now()}`,
        period_start: periodStart,
        period_end: periodEnd,
        total_payout: calculation.net_payout,
        report_type: reportType,
        file_path: filePath,
        generated_at: new Date(),
      };

      // Save report metadata
      await this.savePayoutReport(report);

      console.log('[Payout Service] Report generated:', report.id);

      return report;

    } catch (error: any) {
      console.error('[Payout Service] Error generating report:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  /**
   * Get pending payouts for vendor
   */
  async getPendingPayouts(vendorId: string): Promise<any[]> {
    try {
      const redis = this.redisService.getClient();
      const payoutKeys = await redis.keys(`payout:cod:*`);

      const pendingPayouts = [];

      for (const key of payoutKeys) {
        const payoutData = await redis.get(key);
        if (payoutData) {
          const payout = JSON.parse(payoutData);
          if (payout.vendor_id === vendorId && payout.status === 'pending') {
            pendingPayouts.push(payout);
          }
        }
      }

      return pendingPayouts;

    } catch (error) {
      console.error('[Payout Service] Error fetching pending payouts:', error);
      return [];
    }
  }

  /**
   * Get payout history for vendor
   */
  async getPayoutHistory(
    vendorId: string,
    limit: number = 50
  ): Promise<VendorPayoutCalculation[]> {
    try {
      const redis = this.redisService.getClient();
      const calculationKeys = await redis.keys(`payout:calculation:vendor:${vendorId}:*`);

      const calculations: VendorPayoutCalculation[] = [];

      for (const key of calculationKeys) {
        const data = await redis.get(key);
        if (data) {
          calculations.push(JSON.parse(data));
        }
      }

      // Sort by calculated_at descending
      calculations.sort((a, b) => 
        new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime()
      );

      return calculations.slice(0, limit);

    } catch (error) {
      console.error('[Payout Service] Error fetching history:', error);
      return [];
    }
  }

  // Private helper methods

  private async getVendorTransfersInPeriod(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<any[]> {
    const redis = this.redisService.getClient();
    const transferKeys = await redis.keys(`transfer:vendor:${vendorId}:*`);

    const transfers = [];

    for (const key of transferKeys) {
      const data = await redis.get(key);
      if (data) {
        const transfer = JSON.parse(data);
        const createdAt = new Date(transfer.created_at);

        if (createdAt >= periodStart && createdAt <= periodEnd) {
          transfers.push(transfer);
        }
      }
    }

    return transfers;
  }

  private calculateNextPayoutDate(
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly',
    fromDate?: Date
  ): Date {
    const baseDate = fromDate || new Date();
    const nextDate = new Date(baseDate);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }

    return nextDate;
  }

  private async processVendorPayout(schedule: PayoutSchedule): Promise<void> {
    try {
      console.log('[Payout Service] Processing payout for vendor:', schedule.vendor_id);

      // Calculate period based on frequency
      const periodEnd = new Date();
      const periodStart = this.calculatePeriodStart(schedule.frequency, periodEnd);

      // Calculate payouts
      const calculation = await this.calculateVendorPayouts(
        schedule.vendor_id,
        periodStart,
        periodEnd
      );

      // Check minimum amount
      if (calculation.net_payout < schedule.minimum_payout_amount) {
        console.log('[Payout Service] Payout below minimum, skipping:', {
          net_payout: calculation.net_payout,
          minimum: schedule.minimum_payout_amount,
        });
        return;
      }

      // Generate report
      await this.generatePayoutReport(
        schedule.vendor_id,
        periodStart,
        periodEnd,
        'detailed'
      );

      console.log('[Payout Service] Payout processed successfully');

    } catch (error) {
      console.error('[Payout Service] Error processing vendor payout:', error);
    }
  }

  private calculatePeriodStart(
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly',
    periodEnd: Date
  ): Date {
    const startDate = new Date(periodEnd);

    switch (frequency) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'biweekly':
        startDate.setDate(startDate.getDate() - 14);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    return startDate;
  }

  private async generatePDF(
    calculation: VendorPayoutCalculation,
    filePath: string,
    reportType: 'summary' | 'detailed'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Generate text-based report
        let report = '';
        
        // Header
        report += '===============================================\n';
        report += '         VENDOR PAYOUT REPORT\n';
        report += '===============================================\n\n';

        // Period
        report += `Period: ${calculation.period_start.toLocaleDateString()} to ${calculation.period_end.toLocaleDateString()}\n`;
        report += `Vendor ID: ${calculation.vendor_id}\n`;
        report += `Generated: ${calculation.calculated_at.toLocaleString()}\n\n`;

        // Summary
        report += '-----------------------------------------------\n';
        report += 'SUMMARY\n';
        report += '-----------------------------------------------\n';
        report += `Total Orders: ${calculation.total_orders}\n`;
        report += `Total Sales: ₹${(calculation.total_sales / 100).toFixed(2)}\n`;
        report += `Commission: ₹${(calculation.total_commission / 100).toFixed(2)}\n`;
        report += `TDS: ₹${(calculation.total_tds / 100).toFixed(2)}\n`;
        report += `-----------------------------------------------\n`;
        report += `NET PAYOUT: ₹${(calculation.net_payout / 100).toFixed(2)}\n`;
        report += `-----------------------------------------------\n\n`;

        // Detailed orders (if detailed report)
        if (reportType === 'detailed' && calculation.orders.length > 0) {
          report += '-----------------------------------------------\n';
          report += 'ORDER DETAILS\n';
          report += '-----------------------------------------------\n\n';

          calculation.orders.forEach((order, index) => {
            report += `${index + 1}. Order ID: ${order.order_id}\n`;
            report += `   Date: ${order.order_date.toLocaleDateString()}\n`;
            report += `   Amount: ₹${(order.order_amount / 100).toFixed(2)}\n`;
            report += `   Commission (${order.commission_rate}%): ₹${(order.commission_amount / 100).toFixed(2)}\n`;
            report += `   TDS: ₹${(order.tds_amount / 100).toFixed(2)}\n`;
            report += `   Net: ₹${(order.net_amount / 100).toFixed(2)}\n`;
            report += `   Transfer Status: ${order.transfer_status || 'N/A'}\n\n`;
          });
        }

        // Footer
        report += '===============================================\n';
        report += 'This is a system generated report.\n';
        report += '===============================================\n';

        // Write to file
        fs.writeFileSync(filePath, report, 'utf8');
        
        resolve();

      } catch (error) {
        reject(error);
      }
    });
  }

  private async savePayoutCalculation(calculation: VendorPayoutCalculation): Promise<void> {
    const redis = this.redisService.getClient();
    const calculationId = `calc_${Date.now()}_${calculation.vendor_id}`;
    
    await redis.set(
      `payout:calculation:vendor:${calculation.vendor_id}:${calculationId}`,
      JSON.stringify(calculation),
      'EX',
      86400 * 365 // Keep for 1 year
    );
  }

  private async savePayoutReport(report: PayoutReport): Promise<void> {
    const redis = this.redisService.getClient();
    
    await redis.set(
      `payout:report:${report.id}`,
      JSON.stringify(report),
      'EX',
      86400 * 365 // Keep for 1 year
    );
  }

  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
    }
  }
}

export default PayoutService;
