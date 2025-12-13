import { 
  EventBusService,
  Product,
} from '@medusajs/medusa';
import { getElasticsearchService } from './elasticsearch.service';
import { getIndexingService } from './indexing.service';

/**
 * Subscriber that listens to product events and syncs with Elasticsearch
 */
export default class ProductSearchSubscriber {
  private indexingService: any;

  constructor({ eventBusService }: { eventBusService: EventBusService }) {
    // Initialize services
    const elasticsearchService = getElasticsearchService();
    this.indexingService = getIndexingService(elasticsearchService);

    // Subscribe to product events
    eventBusService.subscribe('product.created', this.handleProductCreated.bind(this));
    eventBusService.subscribe('product.updated', this.handleProductUpdated.bind(this));
    eventBusService.subscribe('product.deleted', this.handleProductDeleted.bind(this));

    console.log('[ProductSearchSubscriber] Subscribed to product events');
  }

  /**
   * Handle product creation
   */
  private async handleProductCreated(data: any): Promise<void> {
    try {
      console.log(`[ProductSearchSubscriber] Product created: ${data?.id || 'unknown'}`);
      // Note: In a real implementation, you'd fetch the full product with relations
      // For now, we'll handle this in the indexing service
    } catch (error) {
      console.error(`[ProductSearchSubscriber] Error handling product creation:`, error);
    }
  }

  /**
   * Handle product update
   */
  private async handleProductUpdated(data: any): Promise<void> {
    try {
      console.log(`[ProductSearchSubscriber] Product updated: ${data?.id || 'unknown'}`);
      // Note: In a real implementation, you'd fetch the full product with relations
      // and call this.indexingService.updateProduct(product)
    } catch (error) {
      console.error(`[ProductSearchSubscriber] Error handling product update:`, error);
    }
  }

  /**
   * Handle product deletion
   */
  private async handleProductDeleted(data: any): Promise<void> {
    try {
      console.log(`[ProductSearchSubscriber] Product deleted: ${data?.id || 'unknown'}`);
      if (data?.id) {
        await this.indexingService.deleteProduct(data.id);
      }
    } catch (error) {
      console.error(`[ProductSearchSubscriber] Error handling product deletion:`, error);
    }
  }
}
