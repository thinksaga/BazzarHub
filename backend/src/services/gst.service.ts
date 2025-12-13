import RedisService from './redis';
import { v4 as uuidv4 } from 'uuid';

interface GSTCalculation {
  product_id: string;
  hsn_code: string;
  gst_rate: number;
  buyer_state: string;
  seller_state: string;
  tax_type: 'cgst_sgst' | 'igst';
  base_price: number; // in paise
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_tax: number;
  total_price: number;
  calculated_at: Date;
}

interface GSTINValidation {
  valid: boolean;
  gstin: string;
  format_valid: boolean;
  checksum_valid: boolean;
  state_code?: string;
  error?: string;
}

interface HSNMapping {
  category: string;
  hsn_code: string;
  description: string;
  standard_rate: number; // GST rate in percentage
}

interface GSTRate {
  hsn_code: string;
  gst_rate: number;
  cess_rate: number;
  category_name: string;
  effective_from: Date;
}

export class GSTService {
  private redisService: RedisService;
  private static instance: GSTService;

  // GST state codes mapping
  private readonly STATE_CODES: { [key: string]: string } = {
    'andaman_nicobar': '35',
    'andhra_pradesh': '28',
    'arunachal_pradesh': '12',
    'assam': '18',
    'bihar': '10',
    'chandigarh': '04',
    'chhattisgarh': '22',
    'dadra_nagar_haveli': '26',
    'daman_diu': '25',
    'delhi': '07',
    'goa': '30',
    'gujarat': '24',
    'haryana': '06',
    'himachal_pradesh': '02',
    'jharkhand': '20',
    'karnataka': '29',
    'kerala': '32',
    'ladakh': '37',
    'lakshadweep': '31',
    'madhya_pradesh': '23',
    'maharashtra': '27',
    'manipur': '14',
    'meghalaya': '17',
    'mizoram': '15',
    'nagaland': '13',
    'odisha': '21',
    'puducherry': '34',
    'punjab': '03',
    'rajasthan': '08',
    'sikkim': '11',
    'tamil_nadu': '33',
    'telangana': '36',
    'tripura': '16',
    'uttar_pradesh': '09',
    'uttarakhand': '05',
    'west_bengal': '19',
  };

  // HSN code mappings (sample - extend as needed)
  private readonly HSN_MAPPINGS: HSNMapping[] = [
    { category: 'electronics', hsn_code: '8517', description: 'Mobile phones', standard_rate: 12 },
    { category: 'electronics', hsn_code: '8471', description: 'Computers', standard_rate: 12 },
    { category: 'clothing', hsn_code: '6204', description: 'Women\'s clothing', standard_rate: 5 },
    { category: 'clothing', hsn_code: '6203', description: 'Men\'s clothing', standard_rate: 5 },
    { category: 'food', hsn_code: '1905', description: 'Biscuits', standard_rate: 5 },
    { category: 'food', hsn_code: '2009', description: 'Fruit juices', standard_rate: 5 },
    { category: 'books', hsn_code: '4901', description: 'Books', standard_rate: 0 },
    { category: 'cosmetics', hsn_code: '3304', description: 'Beauty products', standard_rate: 18 },
    { category: 'furniture', hsn_code: '9403', description: 'Furniture', standard_rate: 12 },
    { category: 'home_appliances', hsn_code: '8516', description: 'Heaters/Coolers', standard_rate: 18 },
  ];

  private constructor() {
    this.redisService = new RedisService();
    this.initializeGSTRates();
  }

  static getInstance(): GSTService {
    if (!GSTService.instance) {
      GSTService.instance = new GSTService();
    }
    return GSTService.instance;
  }

  /**
   * Calculate GST for a product based on states
   * Handles both CGST+SGST (same state) and IGST (different states)
   */
  async calculateGST(
    productId: string,
    basePrice: number,
    buyerState: string,
    sellerState: string
  ): Promise<GSTCalculation> {
    try {
      console.log('[GST Service] Calculating GST:', {
        product_id: productId,
        base_price: basePrice,
        buyer_state: buyerState,
        seller_state: sellerState,
      });

      // Get HSN code for product
      const hsnCode = await this.getHSNCodeForProduct(productId);
      if (!hsnCode) {
        throw new Error(`HSN code not found for product ${productId}`);
      }

      // Get GST rate
      const gstRate = await this.getGSTRate(hsnCode);
      if (!gstRate) {
        throw new Error(`GST rate not found for HSN code ${hsnCode}`);
      }

      // Determine tax type
      const isSameState = this.normalizeName(buyerState) === this.normalizeName(sellerState);
      const taxType = isSameState ? 'cgst_sgst' : 'igst';

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let totalTax = 0;

      if (taxType === 'cgst_sgst') {
        // Same state: CGST + SGST, each is half of GST rate
        const halfRate = gstRate.gst_rate / 2;
        cgstAmount = Math.floor((basePrice * halfRate) / 100);
        sgstAmount = Math.floor((basePrice * halfRate) / 100);
        totalTax = cgstAmount + sgstAmount;
      } else {
        // Different state: IGST
        igstAmount = Math.floor((basePrice * gstRate.gst_rate) / 100);
        totalTax = igstAmount;
      }

      const calculation: GSTCalculation = {
        product_id: productId,
        hsn_code: hsnCode,
        gst_rate: gstRate.gst_rate,
        buyer_state: buyerState,
        seller_state: sellerState,
        tax_type: taxType,
        base_price: basePrice,
        cgst_amount: cgstAmount || undefined,
        sgst_amount: sgstAmount || undefined,
        igst_amount: igstAmount || undefined,
        total_tax: totalTax,
        total_price: basePrice + totalTax,
        calculated_at: new Date(),
      };

      // Cache calculation
      await this.cacheGSTCalculation(calculation);

      console.log('[GST Service] GST calculated successfully:', {
        tax_type: taxType,
        total_tax: totalTax,
        total_price: calculation.total_price,
      });

      return calculation;

    } catch (error: any) {
      console.error('[GST Service] Error calculating GST:', error);
      throw new Error(`GST calculation failed: ${error.message}`);
    }
  }

  /**
   * Validate GSTIN format and checksum
   * GSTIN format: 2 digits (state code) + 10 digits (PAN) + 1 digit (entity) + 1 digit (check digit)
   */
  validateGSTIN(gstin: string): GSTINValidation {
    try {
      const result: GSTINValidation = {
        valid: false,
        gstin: gstin.toUpperCase(),
        format_valid: false,
        checksum_valid: false,
      };

      // Format validation (15 alphanumeric)
      if (!/^[0-9A-Z]{15}$/.test(result.gstin)) {
        result.error = 'GSTIN must be 15 characters (numbers and uppercase letters only)';
        return result;
      }

      result.format_valid = true;

      // Extract state code
      const stateCode = result.gstin.substring(0, 2);
      result.state_code = stateCode;

      // Verify state code is valid (01-37)
      const stateNum = parseInt(stateCode);
      if (stateNum < 1 || stateNum > 37) {
        result.error = `Invalid state code: ${stateCode}`;
        return result;
      }

      // Checksum validation using Verhoeff algorithm
      result.checksum_valid = this.verifyGSTINChecksum(result.gstin);
      if (!result.checksum_valid) {
        result.error = 'GSTIN checksum validation failed';
        return result;
      }

      result.valid = result.format_valid && result.checksum_valid;

      console.log('[GST Service] GSTIN validated:', {
        gstin: result.gstin,
        valid: result.valid,
        state_code: result.state_code,
      });

      return result;

    } catch (error: any) {
      console.error('[GST Service] Error validating GSTIN:', error);
      return {
        valid: false,
        gstin,
        format_valid: false,
        checksum_valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Get HSN code for product
   */
  async getHSNCodeForProduct(productId: string): Promise<string | null> {
    try {
      const redis = this.redisService.getClient();
      
      // Check cache first
      const cached = await redis.get(`product:hsn:${productId}`);
      if (cached) {
        return cached;
      }

      // In production, fetch from product database
      // For now, return null (should be set during product creation)
      return null;

    } catch (error) {
      console.error('[GST Service] Error getting HSN code:', error);
      return null;
    }
  }

  /**
   * Get HSN code by product category
   */
  async getHSNCodeByCategory(category: string): Promise<HSNMapping | null> {
    try {
      const normalized = this.normalizeName(category);
      
      const mapping = this.HSN_MAPPINGS.find(
        m => this.normalizeName(m.category) === normalized
      );

      if (!mapping) {
        console.warn('[GST Service] HSN mapping not found for category:', category);
        return null;
      }

      return mapping;

    } catch (error) {
      console.error('[GST Service] Error getting HSN by category:', error);
      return null;
    }
  }

  /**
   * Get all HSN mappings
   */
  getAllHSNMappings(): HSNMapping[] {
    return this.HSN_MAPPINGS;
  }

  /**
   * Set HSN code for product
   */
  async setProductHSNCode(productId: string, hsnCode: string): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      
      // Validate HSN code format (4-6 digits)
      if (!/^\d{4,8}$/.test(hsnCode)) {
        throw new Error('Invalid HSN code format');
      }

      await redis.set(`product:hsn:${productId}`, hsnCode, 'EX', 86400 * 365);

      console.log('[GST Service] HSN code set for product:', productId, hsnCode);

    } catch (error: any) {
      console.error('[GST Service] Error setting HSN code:', error);
      throw error;
    }
  }

  /**
   * Get GST rate for HSN code
   */
  async getGSTRate(hsnCode: string): Promise<GSTRate | null> {
    try {
      const redis = this.redisService.getClient();

      // Check cache
      const cached = await redis.get(`gst:rate:${hsnCode}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // In production, fetch from gst_rates table
      // For demo, return from hardcoded list
      const rate = await this.getGSTRateFromDatabase(hsnCode);

      if (rate) {
        await redis.set(`gst:rate:${hsnCode}`, JSON.stringify(rate), 'EX', 86400 * 365);
      }

      return rate;

    } catch (error) {
      console.error('[GST Service] Error getting GST rate:', error);
      return null;
    }
  }

  /**
   * Get GST rates for a vendor/state
   * Used for reporting
   */
  async getGSTRatesForState(state: string): Promise<GSTRate[]> {
    try {
      const redis = this.redisService.getClient();
      const cacheKey = `gst:rates:state:${this.normalizeName(state)}`;

      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // In production, fetch from database
      const rates: GSTRate[] = [];

      // Cache for 7 days
      if (rates.length > 0) {
        await redis.set(cacheKey, JSON.stringify(rates), 'EX', 86400 * 7);
      }

      return rates;

    } catch (error) {
      console.error('[GST Service] Error getting GST rates for state:', error);
      return [];
    }
  }

  /**
   * Calculate HST (Harmonized Sales Tax - for registered businesses)
   * In India context, this is typically GST on GST (composition scheme)
   */
  async calculateCompositionGST(
    basePrice: number,
    gstRate: number
  ): Promise<{ base_price: number; gst_amount: number; total_price: number }> {
    const gstAmount = Math.floor((basePrice * gstRate) / 100);
    return {
      base_price: basePrice,
      gst_amount: gstAmount,
      total_price: basePrice + gstAmount,
    };
  }

  /**
   * Bulk calculate GST for line items
   */
  async calculateGSTBatch(
    items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      buyer_state: string;
      seller_state: string;
    }>
  ): Promise<GSTCalculation[]> {
    try {
      const results: GSTCalculation[] = [];

      for (const item of items) {
        const totalPrice = item.quantity * item.unit_price;
        const calculation = await this.calculateGST(
          item.product_id,
          totalPrice,
          item.buyer_state,
          item.seller_state
        );
        results.push(calculation);
      }

      return results;

    } catch (error: any) {
      console.error('[GST Service] Error in batch GST calculation:', error);
      throw error;
    }
  }

  /**
   * Get GST compliance summary for vendor
   */
  async getVendorGSTSummary(vendorId: string, month: number, year: number): Promise<any> {
    try {
      const redis = this.redisService.getClient();
      const key = `gst:summary:vendor:${vendorId}:${year}-${month}`;

      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate from invoices
      const summary = {
        vendor_id: vendorId,
        month,
        year,
        total_b2b_invoices: 0,
        total_b2c_invoices: 0,
        total_taxable_value: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_igst: 0,
        total_tax: 0,
        total_gross: 0,
      };

      // Cache for 30 days
      await redis.set(key, JSON.stringify(summary), 'EX', 86400 * 30);

      return summary;

    } catch (error) {
      console.error('[GST Service] Error getting GST summary:', error);
      return null;
    }
  }

  // Private helper methods

  private verifyGSTINChecksum(gstin: string): boolean {
    try {
      // Verhoeff algorithm for GSTIN checksum
      const d = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
      ];

      const p = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 6, 2, 7, 9, 3, 1, 4, 0],
        [8, 9, 2, 7, 5, 4, 3, 6, 0, 1],
        [9, 4, 7, 5, 8, 3, 3, 2, 1, 6],
        [4, 3, 5, 8, 9, 6, 3, 7, 1, 2],
        [3, 6, 8, 9, 4, 1, 3, 5, 2, 7],
        [6, 1, 9, 4, 3, 2, 3, 8, 7, 5],
      ];

      let checkDigit = 0;
      const numString = gstin.substring(0, 14); // Exclude check digit

      for (let i = 0; i < numString.length; i++) {
        const digit = parseInt(numString[i]);
        checkDigit = d[checkDigit][p[(i + 1) % 8][digit]];
      }

      // Calculate expected check digit
      const expectedCheckDigit = (10 - checkDigit) % 10;
      const actualCheckDigit = parseInt(gstin[14]);

      return expectedCheckDigit === actualCheckDigit;

    } catch (error) {
      console.error('[GST Service] Error verifying checksum:', error);
      return false;
    }
  }

  private normalizeName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  private async cacheGSTCalculation(calculation: GSTCalculation): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `gst:calc:${calculation.product_id}:${Date.now()}`;
      await redis.set(key, JSON.stringify(calculation), 'EX', 86400); // Keep for 24 hours
    } catch (error) {
      console.error('[GST Service] Error caching GST calculation:', error);
    }
  }

  private async initializeGSTRates(): Promise<void> {
    try {
      // Initialize common GST rates in cache
      const rates: { [key: string]: number } = {
        '1905': 5,  // Biscuits
        '2009': 5,  // Fruit juices
        '4901': 0,  // Books
        '3304': 18, // Beauty products
        '6203': 5,  // Men's clothing
        '6204': 5,  // Women's clothing
        '8471': 12, // Computers
        '8516': 18, // Heaters/Coolers
        '8517': 12, // Mobile phones
        '9403': 12, // Furniture
      };

      const redis = this.redisService.getClient();
      for (const [hsnCode, rate] of Object.entries(rates)) {
        const gstRate: GSTRate = {
          hsn_code: hsnCode,
          gst_rate: rate,
          cess_rate: 0,
          category_name: 'Standard',
          effective_from: new Date('2020-01-01'),
        };

        await redis.set(`gst:rate:${hsnCode}`, JSON.stringify(gstRate), 'EX', 86400 * 365);
      }

      console.log('[GST Service] GST rates initialized');
    } catch (error) {
      console.error('[GST Service] Error initializing GST rates:', error);
    }
  }

  private async getGSTRateFromDatabase(hsnCode: string): Promise<GSTRate | null> {
    // This would query the database in production
    const rateMap: { [key: string]: number } = {
      '1905': 5,
      '2009': 5,
      '4901': 0,
      '3304': 18,
      '6203': 5,
      '6204': 5,
      '8471': 12,
      '8516': 18,
      '8517': 12,
      '9403': 12,
    };

    const rate = rateMap[hsnCode];
    if (rate !== undefined) {
      return {
        hsn_code: hsnCode,
        gst_rate: rate,
        cess_rate: 0,
        category_name: 'Standard',
        effective_from: new Date('2020-01-01'),
      };
    }

    return null;
  }
}

export default GSTService;
