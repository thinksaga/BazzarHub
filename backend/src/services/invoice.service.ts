import RedisService from './redis';
import GSTService from './gst.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

interface InvoiceLineItem {
  order_item_id: string;
  product_id: string;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit_price: number;
  taxable_value: number;
  gst_rate: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount: number;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_date: Date;
  order_id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_gstin: string;
  vendor_address: string;
  vendor_phone: string;
  vendor_email: string;
  customer_id: string;
  customer_name: string;
  customer_gstin?: string;
  customer_address: string;
  shipping_address: string;
  line_items: InvoiceLineItem[];
  taxable_value: number;
  cgst_total?: number;
  sgst_total?: number;
  igst_total: number;
  gross_total: number;
  notes?: string;
  terms_conditions?: string;
  bank_details?: {
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    beneficiary_name: string;
  };
  created_at: Date;
  status: 'draft' | 'generated' | 'sent';
  file_path?: string;
  pdf_url?: string;
}

interface InvoiceSequence {
  vendor_id: string;
  fiscal_year: string;
  current_sequence: number;
  updated_at: Date;
}

export class InvoiceService {
  private redisService: RedisService;
  private gstService: GSTService;
  private static instance: InvoiceService;

  private readonly INVOICES_DIR = path.join(__dirname, '../../reports/invoices');

  private constructor() {
    this.redisService = new RedisService();
    this.gstService = GSTService.getInstance();
    this.ensureInvoicesDirectory();
  }

  static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService();
    }
    return InvoiceService.instance;
  }

  /**
   * Generate invoice for order
   * Creates unique invoice number, calculates GST, and stores invoice data
   */
  async generateInvoice(orderId: string): Promise<InvoiceData> {
    try {
      console.log('[Invoice Service] Generating invoice for order:', orderId);

      const redis = this.redisService.getClient();

      // Fetch order details (in production, from database)
      const orderData = await redis.get(`order:${orderId}`);
      if (!orderData) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const order = JSON.parse(orderData);

      // Fetch vendor details
      const vendorData = await redis.get(`vendor:${order.vendor_id}`);
      const vendor = vendorData ? JSON.parse(vendorData) : null;

      if (!vendor) {
        throw new Error(`Vendor not found: ${order.vendor_id}`);
      }

      // Validate vendor GSTIN
      const gstinValidation = this.gstService.validateGSTIN(vendor.gstin);
      if (!gstinValidation.valid) {
        throw new Error(`Invalid vendor GSTIN: ${gstinValidation.error}`);
      }

      // Fetch customer details
      const customerData = await redis.get(`customer:${order.customer_id}`);
      const customer = customerData ? JSON.parse(customerData) : null;

      if (!customer) {
        throw new Error(`Customer not found: ${order.customer_id}`);
      }

      // Calculate fiscal year
      const now = new Date();
      const fiscalYear = this.calculateFiscalYear(now);

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(vendor.id, fiscalYear);

      // Process line items with GST
      const lineItems: InvoiceLineItem[] = [];
      let totalTaxableValue = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalIGST = 0;

      for (const item of order.items || []) {
        // Calculate GST
        const gstCalculation = await this.gstService.calculateGST(
          item.product_id,
          item.quantity * item.unit_price,
          customer.state,
          vendor.state
        );

        const lineItem: InvoiceLineItem = {
          order_item_id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          hsn_code: gstCalculation.hsn_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          taxable_value: gstCalculation.base_price,
          gst_rate: gstCalculation.gst_rate,
          cgst_amount: gstCalculation.cgst_amount,
          sgst_amount: gstCalculation.sgst_amount,
          igst_amount: gstCalculation.igst_amount,
          total_amount: gstCalculation.total_price,
        };

        lineItems.push(lineItem);

        totalTaxableValue += lineItem.taxable_value;
        if (gstCalculation.cgst_amount) totalCGST += gstCalculation.cgst_amount;
        if (gstCalculation.sgst_amount) totalSGST += gstCalculation.sgst_amount;
        if (gstCalculation.igst_amount) totalIGST += gstCalculation.igst_amount;
      }

      const grossTotal = totalTaxableValue + totalCGST + totalSGST + totalIGST;

      // Create invoice data
      const invoice: InvoiceData = {
        id: uuidv4(),
        invoice_number: invoiceNumber,
        invoice_date: now,
        order_id: orderId,
        vendor_id: vendor.id,
        vendor_name: vendor.business_name || vendor.name,
        vendor_gstin: vendor.gstin,
        vendor_address: vendor.address,
        vendor_phone: vendor.phone,
        vendor_email: vendor.email,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_gstin: customer.gstin,
        customer_address: customer.address,
        shipping_address: order.shipping_address,
        line_items: lineItems,
        taxable_value: totalTaxableValue,
        cgst_total: totalCGST > 0 ? totalCGST : undefined,
        sgst_total: totalSGST > 0 ? totalSGST : undefined,
        igst_total: totalIGST,
        gross_total: grossTotal,
        bank_details: vendor.bank_details,
        notes: `Thank you for your purchase. This is a computer generated invoice.`,
        created_at: now,
        status: 'generated',
      };

      // Store invoice
      await this.saveInvoice(invoice);

      // Generate PDF
      const pdfPath = await this.generateInvoicePDF(invoice);
      invoice.file_path = pdfPath;
      invoice.pdf_url = `/invoices/${path.basename(pdfPath)}`;

      // Update invoice with file path
      await this.saveInvoice(invoice);

      console.log('[Invoice Service] Invoice generated successfully:', {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        gross_total: invoice.gross_total,
      });

      return invoice;

    } catch (error: any) {
      console.error('[Invoice Service] Error generating invoice:', error);
      throw new Error(`Invoice generation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve invoice by order ID
   */
  async getInvoiceByOrderId(orderId: string): Promise<InvoiceData | null> {
    try {
      const redis = this.redisService.getClient();
      const invoiceData = await redis.get(`invoice:order:${orderId}`);

      if (invoiceData) {
        return JSON.parse(invoiceData);
      }

      return null;

    } catch (error) {
      console.error('[Invoice Service] Error retrieving invoice:', error);
      return null;
    }
  }

  /**
   * Retrieve invoice by invoice number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<InvoiceData | null> {
    try {
      const redis = this.redisService.getClient();
      const invoiceData = await redis.get(`invoice:number:${invoiceNumber}`);

      if (invoiceData) {
        return JSON.parse(invoiceData);
      }

      return null;

    } catch (error) {
      console.error('[Invoice Service] Error retrieving invoice:', error);
      return null;
    }
  }

  /**
   * Get all invoices for vendor
   */
  async getVendorInvoices(vendorId: string, limit: number = 100): Promise<InvoiceData[]> {
    try {
      const redis = this.redisService.getClient();
      const keys = await redis.keys(`invoice:vendor:${vendorId}:*`);

      const invoices: InvoiceData[] = [];

      for (const key of keys.slice(0, limit)) {
        const data = await redis.get(key);
        if (data) {
          invoices.push(JSON.parse(data));
        }
      }

      return invoices;

    } catch (error) {
      console.error('[Invoice Service] Error getting vendor invoices:', error);
      return [];
    }
  }

  /**
   * Send invoice email to customer
   * CC to vendor
   */
  async sendInvoiceEmail(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[Invoice Service] Sending invoice email for order:', orderId);

      // Get invoice
      const invoice = await this.getInvoiceByOrderId(orderId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // In production, use email service (SendGrid, AWS SES, etc.)
      // For now, just log
      console.log('[Invoice Service] Invoice email would be sent to:', {
        customer_email: invoice.customer_id, // In production, get actual email
        vendor_email: invoice.vendor_email,
        invoice_number: invoice.invoice_number,
        attachment: invoice.file_path,
      });

      // Update invoice status
      invoice.status = 'sent';
      await this.saveInvoice(invoice);

      return {
        success: true,
        message: `Invoice ${invoice.invoice_number} sent successfully`,
      };

    } catch (error: any) {
      console.error('[Invoice Service] Error sending invoice email:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Bulk generate invoices for multiple orders
   */
  async generateInvoicesBatch(orderIds: string[]): Promise<InvoiceData[]> {
    try {
      const invoices: InvoiceData[] = [];

      for (const orderId of orderIds) {
        try {
          const invoice = await this.generateInvoice(orderId);
          invoices.push(invoice);
        } catch (error) {
          console.error(`Failed to generate invoice for order ${orderId}:`, error);
        }
      }

      return invoices;

    } catch (error: any) {
      console.error('[Invoice Service] Error in batch invoice generation:', error);
      throw error;
    }
  }

  /**
   * Get invoice statistics for vendor
   */
  async getInvoiceStatistics(vendorId: string, month: number, year: number): Promise<any> {
    try {
      const redis = this.redisService.getClient();
      const key = `invoice:stats:vendor:${vendorId}:${year}-${month}`;

      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      const invoices = await this.getVendorInvoices(vendorId);

      // Filter by month/year
      const filtered = invoices.filter(inv => {
        const date = new Date(inv.invoice_date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });

      const stats = {
        total_invoices: filtered.length,
        total_taxable_value: filtered.reduce((sum, inv) => sum + inv.taxable_value, 0),
        total_cgst: filtered.reduce((sum, inv) => sum + (inv.cgst_total || 0), 0),
        total_sgst: filtered.reduce((sum, inv) => sum + (inv.sgst_total || 0), 0),
        total_igst: filtered.reduce((sum, inv) => sum + inv.igst_total, 0),
        total_gross: filtered.reduce((sum, inv) => sum + inv.gross_total, 0),
      };

      // Cache for 7 days
      await redis.set(key, JSON.stringify(stats), 'EX', 86400 * 7);

      return stats;

    } catch (error) {
      console.error('[Invoice Service] Error getting invoice statistics:', error);
      return null;
    }
  }

  // Private helper methods

  private async generateInvoiceNumber(vendorId: string, fiscalYear: string): Promise<string> {
    try {
      const redis = this.redisService.getClient();
      const sequenceKey = `invoice:sequence:${vendorId}:${fiscalYear}`;

      // Get current sequence
      let sequence = await redis.incr(sequenceKey);

      // Set expiry on first access
      const ttl = await redis.ttl(sequenceKey);
      if (ttl === -1) {
        // No expiry set, set to end of fiscal year
        const endOfFY = this.getEndOfFiscalYear(fiscalYear);
        const secondsLeft = Math.floor((endOfFY.getTime() - Date.now()) / 1000);
        await redis.expire(sequenceKey, Math.max(secondsLeft, 1));
      }

      // Format: VENDOR_ID/FY/SEQUENCE
      // Example: VENDOR123/2024-25/00001
      return `${vendorId}/${fiscalYear}/${String(sequence).padStart(5, '0')}`;

    } catch (error: any) {
      console.error('[Invoice Service] Error generating invoice number:', error);
      throw error;
    }
  }

  private calculateFiscalYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // India fiscal year: Apr 1 to Mar 31
    if (month >= 4) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  private getEndOfFiscalYear(fiscalYear: string): Date {
    const endYear = parseInt(fiscalYear.split('-')[1]);
    return new Date(endYear, 2, 31, 23, 59, 59); // March 31
  }

  private async generateInvoicePDF(invoice: InvoiceData): Promise<string> {
    try {
      // Generate text-based invoice
      let content = '';

      content += '==========================================\n';
      content += '            TAX INVOICE\n';
      content += '==========================================\n\n';

      content += `Invoice Number: ${invoice.invoice_number}\n`;
      content += `Invoice Date: ${invoice.invoice_date.toLocaleDateString()}\n`;
      content += `Order ID: ${invoice.order_id}\n\n`;

      // Seller details
      content += '------ SELLER DETAILS ------\n';
      content += `Name: ${invoice.vendor_name}\n`;
      content += `GSTIN: ${invoice.vendor_gstin}\n`;
      content += `Address: ${invoice.vendor_address}\n`;
      content += `Phone: ${invoice.vendor_phone}\n`;
      content += `Email: ${invoice.vendor_email}\n\n`;

      // Buyer details
      content += '------ BUYER DETAILS ------\n';
      content += `Name: ${invoice.customer_name}\n`;
      if (invoice.customer_gstin) {
        content += `GSTIN: ${invoice.customer_gstin}\n`;
      }
      content += `Address: ${invoice.customer_address}\n`;
      content += `Shipping Address: ${invoice.shipping_address}\n\n`;

      // Line items
      content += '------ LINE ITEMS ------\n';
      content += 'Item | HSN | Qty | Unit Price | Taxable Value | GST Rate | GST Amt | Total\n';
      content += '-----------------------------------\n';

      for (const item of invoice.line_items) {
        const gstAmount = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        content += `${item.product_name} | ${item.hsn_code} | ${item.quantity} | ${(item.unit_price / 100).toFixed(2)} | ${(item.taxable_value / 100).toFixed(2)} | ${item.gst_rate}% | ${(gstAmount / 100).toFixed(2)} | ${(item.total_amount / 100).toFixed(2)}\n`;
      }

      content += '\n------ SUMMARY ------\n';
      content += `Taxable Value: ₹${(invoice.taxable_value / 100).toFixed(2)}\n`;
      if (invoice.cgst_total) {
        content += `CGST (Central): ₹${(invoice.cgst_total / 100).toFixed(2)}\n`;
      }
      if (invoice.sgst_total) {
        content += `SGST (State): ₹${(invoice.sgst_total / 100).toFixed(2)}\n`;
      }
      if (invoice.igst_total > 0) {
        content += `IGST (Integrated): ₹${(invoice.igst_total / 100).toFixed(2)}\n`;
      }
      content += `GROSS TOTAL: ₹${(invoice.gross_total / 100).toFixed(2)}\n\n`;

      // Bank details
      if (invoice.bank_details) {
        content += '------ PAYMENT DETAILS ------\n';
        content += `Bank Name: ${invoice.bank_details.bank_name}\n`;
        content += `Account: ${invoice.bank_details.account_number}\n`;
        content += `IFSC: ${invoice.bank_details.ifsc_code}\n`;
        content += `Beneficiary: ${invoice.bank_details.beneficiary_name}\n\n`;
      }

      content += '------ NOTES ------\n';
      content += `${invoice.notes}\n`;

      content += '\n==========================================\n';

      // Write to file
      const fileName = `${invoice.invoice_number.replace(/\//g, '_')}.txt`;
      const filePath = path.join(this.INVOICES_DIR, fileName);

      fs.writeFileSync(filePath, content, 'utf8');

      console.log('[Invoice Service] Invoice PDF generated:', filePath);

      return filePath;

    } catch (error: any) {
      console.error('[Invoice Service] Error generating PDF:', error);
      throw error;
    }
  }

  private async saveInvoice(invoice: InvoiceData): Promise<void> {
    try {
      const redis = this.redisService.getClient();

      // Save by ID
      await redis.set(`invoice:${invoice.id}`, JSON.stringify(invoice));

      // Index by order ID
      await redis.set(`invoice:order:${invoice.order_id}`, JSON.stringify(invoice));

      // Index by invoice number
      await redis.set(`invoice:number:${invoice.invoice_number}`, JSON.stringify(invoice));

      // Index by vendor
      await redis.set(
        `invoice:vendor:${invoice.vendor_id}:${invoice.id}`,
        JSON.stringify(invoice)
      );

    } catch (error) {
      console.error('[Invoice Service] Error saving invoice:', error);
    }
  }

  private ensureInvoicesDirectory(): void {
    if (!fs.existsSync(this.INVOICES_DIR)) {
      fs.mkdirSync(this.INVOICES_DIR, { recursive: true });
    }
  }
}

export default InvoiceService;
