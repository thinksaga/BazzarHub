import { Product } from '@medusajs/medusa';
import { EntityManager } from 'typeorm';
import { ElasticsearchService, ProductDocument } from './elasticsearch.service';

export class IndexingService {
  private elasticsearchService: ElasticsearchService;

  constructor(elasticsearchService: ElasticsearchService) {
    this.elasticsearchService = elasticsearchService;
  }

  /**
   * Transform MedusaJS Product to Elasticsearch ProductDocument
   */
  private transformProduct(product: Product): ProductDocument {
    // Extract first variant price (simplified)
    const price = product.variants?.[0]?.prices?.[0]?.amount || 0;
    
    // Extract inventory quantity (simplified)
    const inventoryQuantity = product.variants?.reduce(
      (sum, variant) => sum + (variant.inventory_quantity || 0),
      0
    ) || 0;

    // Extract images
    const images = product.images?.map((img) => img.url) || [];

    // Extract tags
    const tags = product.tags?.map((tag) => tag.value) || [];

    // Build attributes from metadata
    const attributes: Record<string, any> = {
      ...(product.metadata || {}),
    };

    // Extract delivery options from metadata
    const deliveryOptions: string[] = [];
    if (product.metadata?.cod_available) deliveryOptions.push('cod');
    if (product.metadata?.express_delivery) deliveryOptions.push('express');
    deliveryOptions.push('standard'); // Always available

    // Determine availability status
    let availability = 'out_of_stock';
    if (inventoryQuantity > 0) {
      availability = 'in_stock';
    } else if (product.metadata?.pre_order) {
      availability = 'pre_order';
    }

    return {
      id: product.id,
      title: product.title,
      description: product.description || '',
      category_id: product.collection_id || '',
      category_name: product.collection?.title || '',
      price: price / 100, // Convert cents to dollars
      vendor_id: product.profile_id || '',
      vendor_name: product.profile?.metadata?.store_name as string || '',
      vendor_verified: product.profile?.metadata?.verified as boolean || false,
      vendor_rating: product.profile?.metadata?.rating as number || 0,
      sku: product.variants?.[0]?.sku || '',
      brand: product.metadata?.brand as string || '',
      attributes,
      tags,
      status: product.status,
      is_featured: product.metadata?.featured as boolean || false,
      availability,
      delivery_options: deliveryOptions,
      inventory_quantity: inventoryQuantity,
      images,
      created_at: product.created_at,
      updated_at: product.updated_at,
    };
  }

  /**
   * Index a single product after creation
   */
  async indexProduct(product: Product): Promise<void> {
    try {
      const document = this.transformProduct(product);
      await this.elasticsearchService.indexProduct(document);
      console.log(`[IndexingService] Product ${product.id} indexed`);
    } catch (error) {
      console.error(`[IndexingService] Failed to index product ${product.id}:`, error);
      throw error;
    }
  }

  /**
   * Update product in index
   */
  async updateProduct(product: Product): Promise<void> {
    try {
      const document = this.transformProduct(product);
      await this.elasticsearchService.indexProduct(document); // Index API handles updates
      console.log(`[IndexingService] Product ${product.id} updated`);
    } catch (error) {
      console.error(`[IndexingService] Failed to update product ${product.id}:`, error);
      throw error;
    }
  }

  /**
   * Delete product from index
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.elasticsearchService.deleteProduct(productId);
      console.log(`[IndexingService] Product ${productId} deleted`);
    } catch (error) {
      console.error(`[IndexingService] Failed to delete product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk index products (for initial migration)
   */
  async bulkIndexProducts(products: Product[]): Promise<void> {
    try {
      const documents = products.map((product) => this.transformProduct(product));
      await this.elasticsearchService.bulkIndexProducts(documents);
      console.log(`[IndexingService] Bulk indexed ${products.length} products`);
    } catch (error) {
      console.error(`[IndexingService] Bulk indexing failed:`, error);
      throw error;
    }
  }

  /**
   * Reindex all products from database
   */
  async reindexAll(entityManager: EntityManager): Promise<void> {
    console.log('[IndexingService] Starting full reindex...');

    try {
      // Clear existing index
      await this.elasticsearchService.clearIndex();

      // Fetch all products with relations
      const batchSize = 100;
      let offset = 0;
      let totalIndexed = 0;

      while (true) {
        const products = await entityManager
          .getRepository(Product)
          .createQueryBuilder('product')
          .leftJoinAndSelect('product.variants', 'variants')
          .leftJoinAndSelect('variants.prices', 'prices')
          .leftJoinAndSelect('product.images', 'images')
          .leftJoinAndSelect('product.tags', 'tags')
          .leftJoinAndSelect('product.collection', 'collection')
          .leftJoinAndSelect('product.profile', 'profile')
          .skip(offset)
          .take(batchSize)
          .getMany();

        if (products.length === 0) {
          break;
        }

        await this.bulkIndexProducts(products);
        totalIndexed += products.length;
        offset += batchSize;

        console.log(`[IndexingService] Progress: ${totalIndexed} products indexed`);
      }

      console.log(`[IndexingService] Reindex completed: ${totalIndexed} products`);
    } catch (error) {
      console.error('[IndexingService] Reindex failed:', error);
      throw error;
    }
  }
}

// Singleton instance
let indexingService: IndexingService | null = null;

export function getIndexingService(elasticsearchService: ElasticsearchService): IndexingService {
  if (!indexingService) {
    indexingService = new IndexingService(elasticsearchService);
  }
  return indexingService;
}
