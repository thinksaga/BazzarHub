import { Client } from '@elastic/elasticsearch';
import { Logger } from '@medusajs/medusa';

export interface ProductDocument {
  id: string;
  title: string;
  description: string;
  category_id: string;
  category_name: string;
  price: number;
  vendor_id: string;
  vendor_name: string;
  vendor_verified: boolean;
  vendor_rating: number;
  sku: string;
  brand: string;
  attributes: Record<string, any>;
  tags: string[];
  status: string;
  is_featured: boolean;
  availability: string;
  delivery_options: string[];
  inventory_quantity: number;
  images: string[];
  created_at: Date;
  updated_at: Date;
}

export interface SearchQuery {
  query?: string;
  category_id?: string;
  vendor_id?: string;
  price_min?: number;
  price_max?: number;
  tags?: string[];
  attributes?: Record<string, string | number | boolean>;
  status?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface SearchResult {
  hits: ProductDocument[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export class ElasticsearchService {
  private client: Client;
  private logger: Logger;
  private readonly INDEX_NAME = 'products';

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
      auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
        ? {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD,
          }
        : undefined,
      maxRetries: 5,
      requestTimeout: 60000,
      sniffOnStart: false,
    });

    this.logger = {
      info: (msg: string) => console.log(`[Elasticsearch] ${msg}`),
      error: (msg: string) => console.error(`[Elasticsearch] ${msg}`),
      warn: (msg: string) => console.warn(`[Elasticsearch] ${msg}`),
      debug: (msg: string) => console.debug(`[Elasticsearch] ${msg}`),
    } as Logger;
  }

  /**
   * Initialize Elasticsearch index with proper mappings
   */
  async initialize(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.INDEX_NAME,
      });

      if (!indexExists) {
        await this.createIndex();
        this.logger.info(`Index "${this.INDEX_NAME}" created successfully`);
      } else {
        this.logger.info(`Index "${this.INDEX_NAME}" already exists`);
      }

      // Test connection
      const health = await this.client.cluster.health();
      this.logger.info(`Elasticsearch cluster health: ${health.status}`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize Elasticsearch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create index with mappings and settings
   */
  private async createIndex(): Promise<void> {
    await this.client.indices.create({
      index: this.INDEX_NAME,
      body: {
        settings: {
          number_of_shards: 2,
          number_of_replicas: 1,
          analysis: {
            analyzer: {
              // English analyzer
              english_analyzer: {
                type: 'standard',
                stopwords: '_english_',
              },
              // Hindi analyzer
              hindi_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'hindi_stop', 'hindi_stemmer'],
              },
              // Autocomplete analyzer (edge n-grams)
              autocomplete_analyzer: {
                type: 'custom',
                tokenizer: 'autocomplete_tokenizer',
                filter: ['lowercase', 'asciifolding'],
              },
              // Search analyzer for autocomplete
              autocomplete_search_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'],
              },
            },
            tokenizer: {
              autocomplete_tokenizer: {
                type: 'edge_ngram',
                min_gram: 2,
                max_gram: 20,
                token_chars: ['letter', 'digit'],
              },
            },
            filter: {
              hindi_stop: {
                type: 'stop',
                stopwords: [
                  'और',
                  'का',
                  'के',
                  'की',
                  'में',
                  'से',
                  'को',
                  'है',
                  'हैं',
                  'था',
                  'थे',
                  'हो',
                  'इस',
                  'उस',
                  'ये',
                  'वे',
                  'पर',
                  'तक',
                  'कि',
                  'एक',
                  'यह',
                  'वह',
                ],
              },
              hindi_stemmer: {
                type: 'stemmer',
                language: 'hindi',
              },
            },
          },
        },
        mappings: {
          properties: {
            id: {
              type: 'keyword',
            },
            title: {
              type: 'text',
              fields: {
                english: {
                  type: 'text',
                  analyzer: 'english_analyzer',
                },
                hindi: {
                  type: 'text',
                  analyzer: 'hindi_analyzer',
                },
                autocomplete: {
                  type: 'text',
                  analyzer: 'autocomplete_analyzer',
                  search_analyzer: 'autocomplete_search_analyzer',
                },
                keyword: {
                  type: 'keyword',
                },
              },
            },
            description: {
              type: 'text',
              fields: {
                english: {
                  type: 'text',
                  analyzer: 'english_analyzer',
                },
                hindi: {
                  type: 'text',
                  analyzer: 'hindi_analyzer',
                },
              },
            },
            category_id: {
              type: 'keyword',
            },
            category_name: {
              type: 'text',
              fields: {
                keyword: {
                  type: 'keyword',
                },
                autocomplete: {
                  type: 'text',
                  analyzer: 'autocomplete_analyzer',
                  search_analyzer: 'autocomplete_search_analyzer',
                },
              },
            },
            price: {
              type: 'float',
            },
            vendor_id: {
              type: 'keyword',
            },
            vendor_name: {
              type: 'text',
              fields: {
                keyword: {
                  type: 'keyword',
                },
              },
            },
            vendor_verified: {
              type: 'boolean',
            },
            vendor_rating: {
              type: 'float',
            },
            sku: {
              type: 'keyword',
            },
            brand: {
              type: 'text',
              fields: {
                keyword: {
                  type: 'keyword',
                },
              },
            },
            attributes: {
              type: 'object',
              enabled: true,
            },
            tags: {
              type: 'keyword',
            },
            status: {
              type: 'keyword',
            },
            is_featured: {
              type: 'boolean',
            },
            availability: {
              type: 'keyword',
            },
            delivery_options: {
              type: 'keyword',
            },
            inventory_quantity: {
              type: 'integer',
            },
            images: {
              type: 'keyword',
            },
            created_at: {
              type: 'date',
            },
            updated_at: {
              type: 'date',
            },
          },
        },
      },
    });
  }

  /**
   * Index a single product
   */
  async indexProduct(product: ProductDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.INDEX_NAME,
        id: product.id,
        document: product,
        refresh: 'wait_for',
      });
      this.logger.info(`Product ${product.id} indexed successfully`);
    } catch (error: any) {
      this.logger.error(`Failed to index product ${product.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk index products
   */
  async bulkIndexProducts(products: ProductDocument[]): Promise<void> {
    if (products.length === 0) {
      return;
    }

    try {
      const operations = products.flatMap((product) => [
        { index: { _index: this.INDEX_NAME, _id: product.id } },
        product,
      ]);

      const bulkResponse = await this.client.bulk({
        refresh: 'wait_for',
        operations,
      });

      if (bulkResponse.errors) {
        const erroredDocuments = bulkResponse.items.filter((item: any) => item.index?.error);
        this.logger.error(`Bulk indexing had errors: ${erroredDocuments.length} documents failed`);
        erroredDocuments.forEach((doc: any) => {
          this.logger.error(`Document ${doc.index?._id} error: ${doc.index?.error?.reason}`);
        });
      } else {
        this.logger.info(`Bulk indexed ${products.length} products successfully`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to bulk index products: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a product from index
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.INDEX_NAME,
        id: productId,
        refresh: 'wait_for',
      });
      this.logger.info(`Product ${productId} deleted from index`);
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        this.logger.warn(`Product ${productId} not found in index`);
      } else {
        this.logger.error(`Failed to delete product ${productId}: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Search products with full-text search
   */
  async searchProducts(searchQuery: SearchQuery): Promise<SearchResult> {
    const page = searchQuery.page || 1;
    const limit = searchQuery.limit || 20;
    const from = (page - 1) * limit;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Full-text search on title and description
    if (searchQuery.query) {
      mustClauses.push({
        multi_match: {
          query: searchQuery.query,
          fields: [
            'title^3',
            'title.english^2',
            'title.hindi^2',
            'description',
            'description.english',
            'description.hindi',
            'category_name^1.5',
            'vendor_name',
            'sku',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Filter by category
    if (searchQuery.category_id) {
      filterClauses.push({
        term: { category_id: searchQuery.category_id },
      });
    }

    // Filter by vendor
    if (searchQuery.vendor_id) {
      filterClauses.push({
        term: { vendor_id: searchQuery.vendor_id },
      });
    }

    // Filter by price range
    if (searchQuery.price_min !== undefined || searchQuery.price_max !== undefined) {
      const rangeQuery: any = {};
      if (searchQuery.price_min !== undefined) {
        rangeQuery.gte = searchQuery.price_min;
      }
      if (searchQuery.price_max !== undefined) {
        rangeQuery.lte = searchQuery.price_max;
      }
      filterClauses.push({
        range: { price: rangeQuery },
      });
    }

    // Filter by tags
    if (searchQuery.tags && searchQuery.tags.length > 0) {
      filterClauses.push({
        terms: { tags: searchQuery.tags },
      });
    }

    // Filter by dynamic attributes
    if (searchQuery.attributes) {
      Object.entries(searchQuery.attributes).forEach(([key, value]) => {
        filterClauses.push({
          term: { [`attributes.${key}`]: value },
        });
      });
    }

    // Filter by status
    if (searchQuery.status) {
      filterClauses.push({
        term: { status: searchQuery.status },
      });
    }

    // Default to active products if no status specified
    if (!searchQuery.status) {
      filterClauses.push({
        term: { status: 'active' },
      });
    }

    // Build query
    const query: any = {
      bool: {
        must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }],
        filter: filterClauses,
      },
    };

    // Build sort
    const sort: any[] = [];
    if (searchQuery.sort_by) {
      sort.push({
        [searchQuery.sort_by]: {
          order: searchQuery.sort_order || 'asc',
        },
      });
    } else if (searchQuery.query) {
      sort.push('_score'); // Sort by relevance if searching
    } else {
      sort.push({ created_at: { order: 'desc' } }); // Default sort by newest
    }

    try {
      const response = await this.client.search({
        index: this.INDEX_NAME,
        body: {
          query,
          sort,
          from,
          size: limit,
        },
      });

      const hits = response.hits.hits.map((hit: any) => hit._source as ProductDocument);
      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : response.hits.total?.value || 0;

      return {
        hits,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Autocomplete suggestions
   */
  async autocomplete(query: string, limit: number = 10): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const response = await this.client.search({
        index: this.INDEX_NAME,
        body: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: [
                      'title.autocomplete^3',
                      'category_name.autocomplete^2',
                    ],
                    type: 'bool_prefix',
                  },
                },
              ],
              filter: [
                {
                  term: { status: 'active' },
                },
              ],
            },
          },
          _source: ['title'],
          size: limit,
        },
      });

      const suggestions = response.hits.hits
        .map((hit: any) => (hit._source as ProductDocument).title)
        .filter((title: string, index: number, self: string[]) => self.indexOf(title) === index); // Remove duplicates

      return suggestions;
    } catch (error: any) {
      this.logger.error(`Autocomplete failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<ProductDocument | null> {
    try {
      const response = await this.client.get({
        index: this.INDEX_NAME,
        id: productId,
      });

      return response._source as ProductDocument;
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      this.logger.error(`Failed to get product ${productId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all documents from index
   */
  async clearIndex(): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: this.INDEX_NAME,
        body: {
          query: {
            match_all: {},
          },
        },
        refresh: true,
      });
      this.logger.info('Index cleared successfully');
    } catch (error: any) {
      this.logger.error(`Failed to clear index: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<any> {
    try {
      const stats = await this.client.indices.stats({
        index: this.INDEX_NAME,
      });
      return stats;
    } catch (error: any) {
      this.logger.error(`Failed to get index stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if Elasticsearch is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.client.cluster.health();
      return health.status === 'green' || health.status === 'yellow';
    } catch (error: any) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Close Elasticsearch connection
   */
  async close(): Promise<void> {
    await this.client.close();
    this.logger.info('Elasticsearch connection closed');
  }
}

// Singleton instance
let elasticsearchService: ElasticsearchService | null = null;

export function getElasticsearchService(): ElasticsearchService {
  if (!elasticsearchService) {
    elasticsearchService = new ElasticsearchService();
  }
  return elasticsearchService;
}
