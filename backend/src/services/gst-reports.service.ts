import RedisService from './redis';
import InvoiceService from './invoice.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

interface GSTR1Record {
  invoice_number: string;
  invoice_date: Date;
  customer_name: string;
  customer_gstin?: string;
  invoice_value: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  net_gst: number;
  invoice_type: 'regular' | 'debit_note' | 'credit_note';
}

interface GSTR1Report {
  id: string;
  vendor_id: string;
  month: number;
  year: number;
  b2b_invoices: GSTR1Record[];
  b2c_large_invoices: GSTR1Record[];
  b2c_small_invoices: GSTR1Record[];
  total_b2b_value: number;
  total_b2b_tax: number;
  total_b2c_value: number;
  total_b2c_tax: number;
  generated_at: Date;
}

interface GSTR3BRecord {
  description: string;
  amount: number;
}

interface GSTR3BReport {
  id: string;
  vendor_id: string;
  month: number;
  year: number;
  outward_supplies: number;
  inward_supplies: number;
  input_tax_credit: number;
  tax_payable: number;
  net_payment: number;
  generated_at: Date;
}

export class GSTReportsService {
  private redisService: RedisService;
  private invoiceService: InvoiceService;
  private static instance: GSTReportsService;

  private readonly REPORTS_DIR = path.join(__dirname, '../../reports/gst');

  // Thresholds
  private readonly B2B_THRESHOLD = 250000; // ₹2500
  private readonly B2C_LARGE_THRESHOLD = 250000; // ₹2500

  private constructor() {
    this.redisService = new RedisService();
    this.invoiceService = InvoiceService.getInstance();
    this.ensureReportsDirectory();
  }

  static getInstance(): GSTReportsService {
    if (!GSTReportsService.instance) {
      GSTReportsService.instance = new GSTReportsService();
    }
    return GSTReportsService.instance;
  }

  /**
   * Generate GSTR-1 (Outward Supplies Report)
   * Categories: B2B (with GSTIN), B2C Large (>250k), B2C Small (consolidated)
   */
  async generateGSTR1(vendorId: string, month: number, year: number): Promise<GSTR1Report> {
    try {
      console.log('[GST Reports Service] Generating GSTR-1 for vendor:', {
        vendor_id: vendorId,
        month,
        year,
      });

      // Get all invoices for vendor in the period
      const invoices = await this.invoiceService.getVendorInvoices(vendorId);

      const filtered = invoices.filter(inv => {
        const date = new Date(inv.invoice_date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });

      const b2bInvoices: GSTR1Record[] = [];
      const b2cLargeInvoices: GSTR1Record[] = [];
      let b2cSmallTotal = 0;
      let b2cSmallTax = 0;

      for (const invoice of filtered) {
        const record: GSTR1Record = {
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          customer_name: invoice.customer_name,
          customer_gstin: invoice.customer_gstin,
          invoice_value: invoice.gross_total,
          taxable_value: invoice.taxable_value,
          cgst: invoice.cgst_total || 0,
          sgst: invoice.sgst_total || 0,
          igst: invoice.igst_total,
          net_gst: (invoice.cgst_total || 0) + (invoice.sgst_total || 0) + invoice.igst_total,
          invoice_type: 'regular',
        };

        // Categorize
        if (invoice.customer_gstin) {
          // B2B invoice
          b2bInvoices.push(record);
        } else if (invoice.gross_total > this.B2C_LARGE_THRESHOLD) {
          // B2C Large
          b2cLargeInvoices.push(record);
        } else {
          // B2C Small - consolidated
          b2cSmallTotal += invoice.gross_total;
          b2cSmallTax += record.net_gst;
        }
      }

      // Create B2C small consolidated record
      if (b2cSmallTotal > 0) {
        b2cLargeInvoices.push({
          invoice_number: `B2C_SMALL_${month}_${year}`,
          invoice_date: new Date(year, month - 1, 1),
          customer_name: 'B2C Small Customers (Consolidated)',
          invoice_value: b2cSmallTotal,
          taxable_value: b2cSmallTotal - b2cSmallTax,
          cgst: 0,
          sgst: 0,
          igst: b2cSmallTax,
          net_gst: b2cSmallTax,
          invoice_type: 'regular',
        });
      }

      const totalB2BValue = b2bInvoices.reduce((sum, inv) => sum + inv.invoice_value, 0);
      const totalB2BTax = b2bInvoices.reduce((sum, inv) => sum + inv.net_gst, 0);
      const totalB2CValue = b2cLargeInvoices.reduce((sum, inv) => sum + inv.invoice_value, 0);
      const totalB2CTax = b2cLargeInvoices.reduce((sum, inv) => sum + inv.net_gst, 0);

      const report: GSTR1Report = {
        id: uuidv4(),
        vendor_id: vendorId,
        month,
        year,
        b2b_invoices: b2bInvoices,
        b2c_large_invoices: b2cLargeInvoices,
        b2c_small_invoices: [],
        total_b2b_value: totalB2BValue,
        total_b2b_tax: totalB2BTax,
        total_b2c_value: totalB2CValue,
        total_b2c_tax: totalB2CTax,
        generated_at: new Date(),
      };

      // Save report
      await this.saveGSTR1Report(report);

      // Generate JSON for GSTN portal
      const jsonPath = await this.generateGSTR1JSON(report);
      console.log('[GST Reports Service] GSTR-1 generated:', {
        report_id: report.id,
        b2b_count: b2bInvoices.length,
        b2c_count: b2cLargeInvoices.length,
        json_file: jsonPath,
      });

      return report;

    } catch (error: any) {
      console.error('[GST Reports Service] Error generating GSTR-1:', error);
      throw new Error(`GSTR-1 generation failed: ${error.message}`);
    }
  }

  /**
   * Generate GSTR-3B (Summary Return)
   * Contains outward supplies, ITC, and net tax payable
   */
  async generateGSTR3B(vendorId: string, month: number, year: number): Promise<GSTR3BReport> {
    try {
      console.log('[GST Reports Service] Generating GSTR-3B for vendor:', {
        vendor_id: vendorId,
        month,
        year,
      });

      // Get GSTR-1 data
      const gstr1 = await this.getGSTR1Report(vendorId, month, year);
      if (!gstr1) {
        throw new Error('GSTR-1 report not found');
      }

      const outwardSupplies = gstr1.total_b2b_value + gstr1.total_b2c_value;
      const outwardTax = gstr1.total_b2b_tax + gstr1.total_b2c_tax;

      // Get ITC (Input Tax Credit) - in production, fetch from purchase invoices
      const itcAmount = 0; // Calculate from vendor's purchase invoices

      // Calculate net payable
      const netPayable = outwardTax - itcAmount;

      const report: GSTR3BReport = {
        id: uuidv4(),
        vendor_id: vendorId,
        month,
        year,
        outward_supplies: outwardSupplies,
        inward_supplies: 0,
        input_tax_credit: itcAmount,
        tax_payable: netPayable,
        net_payment: netPayable > 0 ? netPayable : 0,
        generated_at: new Date(),
      };

      // Save report
      await this.saveGSTR3BReport(report);

      console.log('[GST Reports Service] GSTR-3B generated:', {
        report_id: report.id,
        tax_payable: report.tax_payable,
      });

      return report;

    } catch (error: any) {
      console.error('[GST Reports Service] Error generating GSTR-3B:', error);
      throw new Error(`GSTR-3B generation failed: ${error.message}`);
    }
  }

  /**
   * Get saved GSTR-1 report
   */
  async getGSTR1Report(vendorId: string, month: number, year: number): Promise<GSTR1Report | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `gstr1:${vendorId}:${year}-${month}`;

      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data);
      }

      return null;

    } catch (error) {
      console.error('[GST Reports Service] Error retrieving GSTR-1:', error);
      return null;
    }
  }

  /**
   * Get saved GSTR-3B report
   */
  async getGSTR3BReport(vendorId: string, month: number, year: number): Promise<GSTR3BReport | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `gstr3b:${vendorId}:${year}-${month}`;

      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data);
      }

      return null;

    } catch (error) {
      console.error('[GST Reports Service] Error retrieving GSTR-3B:', error);
      return null;
    }
  }

  /**
   * Download GST report as CSV/TXT
   */
  async downloadGSTReport(
    vendorId: string,
    reportType: 'gstr1' | 'gstr3b',
    month: number,
    year: number
  ): Promise<{ file_path: string; file_name: string }> {
    try {
      console.log('[GST Reports Service] Downloading GST report:', {
        report_type: reportType,
        vendor_id: vendorId,
        month,
        year,
      });

      let content = '';
      let fileName = '';

      if (reportType === 'gstr1') {
        const report = await this.getGSTR1Report(vendorId, month, year);
        if (!report) {
          throw new Error('GSTR-1 report not found');
        }

        fileName = `GSTR1_${vendorId}_${year}_${month}.csv`;
        content = this.generateGSTR1CSV(report);
      } else {
        const report = await this.getGSTR3BReport(vendorId, month, year);
        if (!report) {
          throw new Error('GSTR-3B report not found');
        }

        fileName = `GSTR3B_${vendorId}_${year}_${month}.csv`;
        content = this.generateGSTR3BCSV(report);
      }

      // Write to file
      const filePath = path.join(this.REPORTS_DIR, fileName);
      fs.writeFileSync(filePath, content, 'utf8');

      console.log('[GST Reports Service] Report downloaded:', filePath);

      return { file_path: filePath, file_name: fileName };

    } catch (error: any) {
      console.error('[GST Reports Service] Error downloading report:', error);
      throw new Error(`Report download failed: ${error.message}`);
    }
  }

  /**
   * Get GST compliance summary for vendor across multiple months
   */
  async getAnnualGSTSummary(vendorId: string, year: number): Promise<any> {
    try {
      const summary = {
        vendor_id: vendorId,
        fiscal_year: `${year}-${year + 1}`,
        months: [] as any[],
        annual_total: {
          outward_supplies: 0,
          total_tax: 0,
          itc_claimed: 0,
          net_payable: 0,
        },
      };

      // Iterate through fiscal year (Apr to Mar)
      for (let m = 1; m <= 12; m++) {
        const month = m >= 4 ? m : m + 12;
        const fiscalMonth = m >= 4 ? m - 3 : m + 9; // Adjusted for fiscal year

        const gstr3b = await this.getGSTR3BReport(vendorId, month, year + (m < 4 ? 1 : 0));

        if (gstr3b) {
          summary.months.push({
            month: fiscalMonth,
            outward_supplies: gstr3b.outward_supplies,
            tax_payable: gstr3b.tax_payable,
          });

          summary.annual_total.outward_supplies += gstr3b.outward_supplies;
          summary.annual_total.total_tax += gstr3b.tax_payable;
        }
      }

      return summary;

    } catch (error) {
      console.error('[GST Reports Service] Error getting annual summary:', error);
      return null;
    }
  }

  // Private helper methods

  private generateGSTR1JSON(report: GSTR1Report): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const gstr1JSON = {
          version: '1.0',
          hash: 'NA',
          taxpayerdetails: {
            gstin: 'TO_BE_FILLED',
            period: `${String(report.month).padStart(2, '0')}${report.year}`,
          },
          supplydetails: {
            outward_sply: {
              b2b: report.b2b_invoices.map(inv => ({
                inv_no: inv.invoice_number,
                inv_dt: inv.invoice_date.toISOString().split('T')[0],
                val: (inv.invoice_value / 100).toFixed(2),
                itms: [
                  {
                    num: 1,
                    itm_det: {
                      gst_val: (inv.taxable_value / 100).toFixed(2),
                      gst_amt: (inv.net_gst / 100).toFixed(2),
                    },
                  },
                ],
                buyer_details: {
                  gstin: inv.customer_gstin || '',
                  legal_name: inv.customer_name,
                },
              })),
              b2c: report.b2c_large_invoices.map(inv => ({
                inv_no: inv.invoice_number,
                inv_dt: inv.invoice_date.toISOString().split('T')[0],
                val: (inv.invoice_value / 100).toFixed(2),
              })),
            },
          },
        };

        const fileName = `GSTR1_${report.vendor_id}_${report.year}_${report.month}.json`;
        const filePath = path.join(this.REPORTS_DIR, fileName);

        fs.writeFileSync(filePath, JSON.stringify(gstr1JSON, null, 2), 'utf8');

        console.log('[GST Reports Service] GSTR-1 JSON generated:', filePath);
        resolve(filePath);

      } catch (error) {
        reject(error);
      }
    });
  }

  private generateGSTR1CSV(report: GSTR1Report): string {
    let csv = 'Invoice Type,Invoice Number,Invoice Date,Customer Name,Customer GSTIN,Taxable Value,CGST,SGST,IGST,Total Tax,Invoice Total\n';

    // B2B invoices
    for (const inv of report.b2b_invoices) {
      csv += `B2B,${inv.invoice_number},${inv.invoice_date.toLocaleDateString()},${inv.customer_name},${inv.customer_gstin},${(inv.taxable_value / 100).toFixed(2)},${(inv.cgst / 100).toFixed(2)},${(inv.sgst / 100).toFixed(2)},${(inv.igst / 100).toFixed(2)},${(inv.net_gst / 100).toFixed(2)},${(inv.invoice_value / 100).toFixed(2)}\n`;
    }

    // B2C invoices
    for (const inv of report.b2c_large_invoices) {
      csv += `B2C,${inv.invoice_number},${inv.invoice_date.toLocaleDateString()},${inv.customer_name},,${(inv.taxable_value / 100).toFixed(2)},${(inv.cgst / 100).toFixed(2)},${(inv.sgst / 100).toFixed(2)},${(inv.igst / 100).toFixed(2)},${(inv.net_gst / 100).toFixed(2)},${(inv.invoice_value / 100).toFixed(2)}\n`;
    }

    // Summary
    csv += '\nSUMMARY\n';
    csv += `Total B2B Value,,${(report.total_b2b_value / 100).toFixed(2)}\n`;
    csv += `Total B2B Tax,,${(report.total_b2b_tax / 100).toFixed(2)}\n`;
    csv += `Total B2C Value,,${(report.total_b2c_value / 100).toFixed(2)}\n`;
    csv += `Total B2C Tax,,${(report.total_b2c_tax / 100).toFixed(2)}\n`;

    return csv;
  }

  private generateGSTR3BCSV(report: GSTR3BReport): string {
    let csv = 'Field,Amount (₹)\n';
    csv += `Outward Supplies,${(report.outward_supplies / 100).toFixed(2)}\n`;
    csv += `Input Tax Credit,${(report.input_tax_credit / 100).toFixed(2)}\n`;
    csv += `Tax Payable,${(report.tax_payable / 100).toFixed(2)}\n`;
    csv += `Net Payment,${(report.net_payment / 100).toFixed(2)}\n`;

    return csv;
  }

  private async saveGSTR1Report(report: GSTR1Report): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `gstr1:${report.vendor_id}:${report.year}-${report.month}`;
      await redis.set(key, JSON.stringify(report), 'EX', 86400 * 365);
    } catch (error) {
      console.error('[GST Reports Service] Error saving GSTR-1:', error);
    }
  }

  private async saveGSTR3BReport(report: GSTR3BReport): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `gstr3b:${report.vendor_id}:${report.year}-${report.month}`;
      await redis.set(key, JSON.stringify(report), 'EX', 86400 * 365);
    } catch (error) {
      console.error('[GST Reports Service] Error saving GSTR-3B:', error);
    }
  }

  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
    }
  }
}

export default GSTReportsService;
