import RedisService from './redis';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

interface TDSCalculation {
  id: string;
  vendor_id: string;
  payout_amount: number;
  vendor_pan?: string;
  has_pan: boolean;
  tds_rate: number; // 1% with PAN, 5% without PAN
  tds_amount: number;
  net_payout: number;
  transaction_date: Date;
  reference_number: string;
}

interface Form16A {
  certificate_number: string;
  financial_year: string;
  vendor_name: string;
  vendor_pan: string;
  vendor_address: string;
  vendor_phone: string;
  deductor_name: string;
  deductor_gstin: string;
  deductor_address: string;
  total_amount: number;
  total_tds: number;
  period: string;
  issue_date: Date;
  quarterly_tds_records: TDSCalculation[];
}

interface QuarterlyTDSReport {
  id: string;
  vendor_id: string;
  quarter: number; // 1-4
  year: number;
  total_payouts: number;
  total_tds: number;
  tds_records: TDSCalculation[];
  generated_at: Date;
}

interface TDSCertificate {
  id: string;
  vendor_id: string;
  certificate_number: string;
  form_16a_data: Form16A;
  file_path: string;
  generated_at: Date;
}

export class TDSService {
  private redisService: RedisService;
  private static instance: TDSService;

  // TDS configuration
  private readonly TDS_RATE_WITH_PAN = 1; // 1% (Section 194O)
  private readonly TDS_RATE_WITHOUT_PAN = 5; // 5% (Section 194O)
  private readonly TDS_THRESHOLD = 50000; // ₹500 (minimum for TDS)
  private readonly REPORTS_DIR = path.join(__dirname, '../../reports/tds');

  private constructor() {
    this.redisService = new RedisService();
    this.ensureReportsDirectory();
  }

  static getInstance(): TDSService {
    if (!TDSService.instance) {
      TDSService.instance = new TDSService();
    }
    return TDSService.instance;
  }

  /**
   * Calculate TDS for vendor payout
   * Section 194O: TDS on E-commerce Supply of Goods and Services
   * Rate: 1% with PAN, 5% without PAN
   */
  async calculateTDS(vendorId: string, payoutAmount: number): Promise<TDSCalculation> {
    try {
      console.log('[TDS Service] Calculating TDS for vendor:', {
        vendor_id: vendorId,
        payout_amount: payoutAmount,
      });

      // Check if below threshold
      if (payoutAmount < this.TDS_THRESHOLD) {
        console.log('[TDS Service] Payout below TDS threshold');
        return {
          id: uuidv4(),
          vendor_id: vendorId,
          payout_amount: payoutAmount,
          has_pan: false,
          tds_rate: 0,
          tds_amount: 0,
          net_payout: payoutAmount,
          transaction_date: new Date(),
          reference_number: `TDS_${Date.now()}`,
        };
      }

      // Get vendor PAN
      const vendorData = await this.getVendorData(vendorId);
      const hasPAN = !!vendorData?.pan;
      const tdsRate = hasPAN ? this.TDS_RATE_WITH_PAN : this.TDS_RATE_WITHOUT_PAN;

      // Calculate TDS
      const tdsAmount = Math.floor((payoutAmount * tdsRate) / 100);
      const netPayout = payoutAmount - tdsAmount;

      const calculation: TDSCalculation = {
        id: uuidv4(),
        vendor_id: vendorId,
        payout_amount: payoutAmount,
        vendor_pan: vendorData?.pan,
        has_pan: hasPAN,
        tds_rate: tdsRate,
        tds_amount: tdsAmount,
        net_payout: netPayout,
        transaction_date: new Date(),
        reference_number: `TDS_${Date.now()}_${vendorId}`,
      };

      // Save calculation
      await this.saveTDSCalculation(calculation);

      console.log('[TDS Service] TDS calculated:', {
        vendor_id: vendorId,
        tds_rate: tdsRate,
        tds_amount: tdsAmount,
        net_payout: netPayout,
      });

      return calculation;

    } catch (error: any) {
      console.error('[TDS Service] Error calculating TDS:', error);
      throw new Error(`TDS calculation failed: ${error.message}`);
    }
  }

  /**
   * Generate quarterly TDS report
   * Used for income tax filing and compliance
   */
  async generateQuarterlyTDSReport(
    vendorId: string,
    quarter: number,
    year: number
  ): Promise<QuarterlyTDSReport> {
    try {
      console.log('[TDS Service] Generating quarterly TDS report:', {
        vendor_id: vendorId,
        quarter,
        year,
      });

      if (quarter < 1 || quarter > 4) {
        throw new Error('Invalid quarter (must be 1-4)');
      }

      // Get all TDS records for the quarter
      const records = await this.getTDSRecordsForQuarter(vendorId, quarter, year);

      const totalPayouts = records.reduce((sum, r) => sum + r.payout_amount, 0);
      const totalTDS = records.reduce((sum, r) => sum + r.tds_amount, 0);

      const report: QuarterlyTDSReport = {
        id: uuidv4(),
        vendor_id: vendorId,
        quarter,
        year,
        total_payouts: totalPayouts,
        total_tds: totalTDS,
        tds_records: records,
        generated_at: new Date(),
      };

      // Save report
      await this.saveQuarterlyReport(report);

      console.log('[TDS Service] Quarterly TDS report generated:', {
        report_id: report.id,
        total_tds: report.total_tds,
      });

      return report;

    } catch (error: any) {
      console.error('[TDS Service] Error generating quarterly report:', error);
      throw new Error(`Quarterly TDS report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate TDS certificate (Form 16A)
   * Issued to vendor for income tax purposes
   */
  async generateForm16A(
    vendorId: string,
    quarter: number,
    year: number
  ): Promise<TDSCertificate> {
    try {
      console.log('[TDS Service] Generating Form 16A for vendor:', vendorId);

      // Get quarterly report
      const quarterlyReport = await this.getQuarterlyReport(vendorId, quarter, year);
      if (!quarterlyReport) {
        throw new Error('Quarterly TDS report not found');
      }

      // Get vendor data
      const vendorData = await this.getVendorData(vendorId);
      if (!vendorData) {
        throw new Error('Vendor not found');
      }

      // Get deductor (marketplace) data
      const deductorData = await this.getDeductorData();

      const fiscalYear = this.calculateFiscalYear(year);
      const certificateNumber = `16A_${vendorId}_${year}_Q${quarter}`;

      const form16a: Form16A = {
        certificate_number: certificateNumber,
        financial_year: fiscalYear,
        vendor_name: vendorData.name,
        vendor_pan: vendorData.pan,
        vendor_address: vendorData.address,
        vendor_phone: vendorData.phone,
        deductor_name: deductorData.name,
        deductor_gstin: deductorData.gstin,
        deductor_address: deductorData.address,
        total_amount: quarterlyReport.total_payouts,
        total_tds: quarterlyReport.total_tds,
        period: this.getQuarterPeriod(quarter, year),
        issue_date: new Date(),
        quarterly_tds_records: quarterlyReport.tds_records,
      };

      // Generate certificate PDF
      const filePath = await this.generateForm16APDF(form16a);

      const certificate: TDSCertificate = {
        id: uuidv4(),
        vendor_id: vendorId,
        certificate_number: certificateNumber,
        form_16a_data: form16a,
        file_path: filePath,
        generated_at: new Date(),
      };

      // Save certificate
      await this.saveCertificate(certificate);

      console.log('[TDS Service] Form 16A generated:', {
        certificate_id: certificate.id,
        certificate_number: certificateNumber,
        total_tds: form16a.total_tds,
      });

      return certificate;

    } catch (error: any) {
      console.error('[TDS Service] Error generating Form 16A:', error);
      throw new Error(`Form 16A generation failed: ${error.message}`);
    }
  }

  /**
   * Get all TDS records for vendor
   */
  async getVendorTDSRecords(
    vendorId: string,
    year: number,
    limit: number = 100
  ): Promise<TDSCalculation[]> {
    try {
      const redis = this.redisService.getClient();
      const keys = await redis.keys(`tds:calc:${vendorId}:${year}:*`);

      const records: TDSCalculation[] = [];

      for (const key of keys.slice(0, limit)) {
        const data = await redis.get(key);
        if (data) {
          records.push(JSON.parse(data));
        }
      }

      return records;

    } catch (error) {
      console.error('[TDS Service] Error getting TDS records:', error);
      return [];
    }
  }

  /**
   * Get TDS summary for financial year
   */
  async getAnnualTDSSummary(vendorId: string, year: number): Promise<any> {
    try {
      const summary = {
        vendor_id: vendorId,
        financial_year: this.calculateFiscalYear(year),
        quarters: [] as any[],
        annual_total: {
          total_payouts: 0,
          total_tds: 0,
        },
      };

      for (let q = 1; q <= 4; q++) {
        const report = await this.getQuarterlyReport(vendorId, q, year);

        if (report) {
          summary.quarters.push({
            quarter: q,
            period: this.getQuarterPeriod(q, year),
            total_payouts: report.total_payouts,
            total_tds: report.total_tds,
          });

          summary.annual_total.total_payouts += report.total_payouts;
          summary.annual_total.total_tds += report.total_tds;
        }
      }

      return summary;

    } catch (error) {
      console.error('[TDS Service] Error getting annual summary:', error);
      return null;
    }
  }

  /**
   * Download TDS report as CSV
   */
  async downloadTDSReport(
    vendorId: string,
    quarter: number,
    year: number
  ): Promise<{ file_path: string; file_name: string }> {
    try {
      const report = await this.getQuarterlyReport(vendorId, quarter, year);
      if (!report) {
        throw new Error('TDS report not found');
      }

      const fileName = `TDS_Report_${vendorId}_${year}_Q${quarter}.csv`;
      let csv = 'Transaction Date,Payout Amount (₹),TDS Rate (%),TDS Amount (₹),Net Payout (₹),Reference Number\n';

      for (const record of report.tds_records) {
        csv += `${record.transaction_date.toLocaleDateString()},${(record.payout_amount / 100).toFixed(2)},${record.tds_rate},${(record.tds_amount / 100).toFixed(2)},${(record.net_payout / 100).toFixed(2)},${record.reference_number}\n`;
      }

      csv += '\nSUMMARY\n';
      csv += `Total Payouts,${(report.total_payouts / 100).toFixed(2)}\n`;
      csv += `Total TDS,${(report.total_tds / 100).toFixed(2)}\n`;

      const filePath = path.join(this.REPORTS_DIR, fileName);
      fs.writeFileSync(filePath, csv, 'utf8');

      return { file_path: filePath, file_name: fileName };

    } catch (error: any) {
      console.error('[TDS Service] Error downloading report:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getVendorData(vendorId: string): Promise<any> {
    try {
      const redis = this.redisService.getClient();
      const data = await redis.get(`vendor:${vendorId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[TDS Service] Error getting vendor data:', error);
      return null;
    }
  }

  private async getDeductorData(): Promise<any> {
    // In production, fetch from marketplace settings
    return {
      name: 'BazaarHub',
      gstin: '07AABCT1234A1Z0', // Example GSTIN
      address: 'Mumbai, India',
    };
  }

  private async getTDSRecordsForQuarter(
    vendorId: string,
    quarter: number,
    year: number
  ): Promise<TDSCalculation[]> {
    try {
      const { startMonth, endMonth } = this.getQuarterMonths(quarter);
      const records = await this.getVendorTDSRecords(vendorId, year);

      return records.filter(r => {
        const month = r.transaction_date.getMonth() + 1;
        return month >= startMonth && month <= endMonth;
      });

    } catch (error) {
      console.error('[TDS Service] Error getting quarterly TDS records:', error);
      return [];
    }
  }

  private async saveTDSCalculation(calculation: TDSCalculation): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const year = calculation.transaction_date.getFullYear();
      const key = `tds:calc:${calculation.vendor_id}:${year}:${calculation.id}`;
      await redis.set(key, JSON.stringify(calculation), 'EX', 86400 * 365);
    } catch (error) {
      console.error('[TDS Service] Error saving TDS calculation:', error);
    }
  }

  private async saveQuarterlyReport(report: QuarterlyTDSReport): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `tds:quarterly:${report.vendor_id}:${report.year}_Q${report.quarter}`;
      await redis.set(key, JSON.stringify(report), 'EX', 86400 * 365);
    } catch (error) {
      console.error('[TDS Service] Error saving quarterly report:', error);
    }
  }

  private async getQuarterlyReport(
    vendorId: string,
    quarter: number,
    year: number
  ): Promise<QuarterlyTDSReport | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `tds:quarterly:${vendorId}:${year}_Q${quarter}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[TDS Service] Error getting quarterly report:', error);
      return null;
    }
  }

  private async saveCertificate(certificate: TDSCertificate): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `tds:cert:${certificate.vendor_id}:${certificate.certificate_number}`;
      await redis.set(key, JSON.stringify(certificate), 'EX', 86400 * 365);
    } catch (error) {
      console.error('[TDS Service] Error saving certificate:', error);
    }
  }

  private getQuarterMonths(quarter: number): { startMonth: number; endMonth: number } {
    switch (quarter) {
      case 1:
        return { startMonth: 4, endMonth: 6 }; // Apr-Jun
      case 2:
        return { startMonth: 7, endMonth: 9 }; // Jul-Sep
      case 3:
        return { startMonth: 10, endMonth: 12 }; // Oct-Dec
      case 4:
        return { startMonth: 1, endMonth: 3 }; // Jan-Mar
      default:
        throw new Error('Invalid quarter');
    }
  }

  private getQuarterPeriod(quarter: number, year: number): string {
    const months = this.getQuarterMonths(quarter);
    const startYear = quarter === 4 ? year + 1 : year;
    const endYear = quarter === 4 ? year + 1 : year;

    const startMonth = new Date(startYear, months.startMonth - 1, 1).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    const endMonth = new Date(endYear, months.endMonth - 1, 30).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });

    return `${startMonth} - ${endMonth}`;
  }

  private calculateFiscalYear(year: number): string {
    return `${year}-${year + 1}`;
  }

  private async generateForm16APDF(form16a: Form16A): Promise<string> {
    try {
      let content = '';

      content += 'FORM 16A\n';
      content += 'TDS CERTIFICATE - SECTION 194O\n';
      content += '====================================\n\n';

      content += `Certificate Number: ${form16a.certificate_number}\n`;
      content += `Financial Year: ${form16a.financial_year}\n`;
      content += `Period: ${form16a.period}\n`;
      content += `Issue Date: ${form16a.issue_date.toLocaleDateString()}\n\n`;

      content += '---- VENDOR DETAILS ----\n';
      content += `Name: ${form16a.vendor_name}\n`;
      content += `PAN: ${form16a.vendor_pan}\n`;
      content += `Address: ${form16a.vendor_address}\n`;
      content += `Phone: ${form16a.vendor_phone}\n\n`;

      content += '---- DEDUCTOR DETAILS ----\n';
      content += `Name: ${form16a.deductor_name}\n`;
      content += `GSTIN: ${form16a.deductor_gstin}\n`;
      content += `Address: ${form16a.deductor_address}\n\n`;

      content += '---- TDS DETAILS ----\n';
      content += `Total Amount: ₹${(form16a.total_amount / 100).toFixed(2)}\n`;
      content += `TDS Rate: 1% (Section 194O)\n`;
      content += `Total TDS: ₹${(form16a.total_tds / 100).toFixed(2)}\n\n`;

      content += 'Certified on ' + new Date().toLocaleDateString() + '\n';

      const fileName = `Form_16A_${form16a.certificate_number}.txt`;
      const filePath = path.join(this.REPORTS_DIR, fileName);

      fs.writeFileSync(filePath, content, 'utf8');

      return filePath;

    } catch (error: any) {
      console.error('[TDS Service] Error generating Form 16A PDF:', error);
      throw error;
    }
  }

  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
    }
  }
}

export default TDSService;
