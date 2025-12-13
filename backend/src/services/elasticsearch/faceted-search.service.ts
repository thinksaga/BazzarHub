import { ElasticsearchService, SearchQuery } from './elasticsearch.service';

export interface FacetedSearchQuery extends SearchQuery {
  facets?: string[]; // Which facets to return
  brand?: string[];
  delivery_options?: string[]; // COD, express, standard
  availability?: 'in_stock' | 'out_of_stock' | 'pre_order';
  vendor_rating_min?: number;
  verified_vendors_only?: boolean;
}

export interface PriceRangeFacet {
  key: string;
  min: number;
  max: number;
  count: number;
}

export interface Facet {
  key: string;
  count: number;
}

export interface FacetedSearchResult {
  hits: any[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  facets: {
    categories?: Facet[];
    brands?: Facet[];
    price_ranges?: PriceRangeFacet[];
    delivery_options?: Facet[];
    availability?: Facet[];
    vendor_ratings?: {
      avg: number;
      ranges: { key: string; min: number; max: number; count: number }[];
    };
  };
}

export class FacetedSearchService {
  private elasticsearchService: ElasticsearchService;

  // INR Price ranges
  private readonly PRICE_RANGES = [
    { key: 'under_500', min: 0, max: 500 },
    { key: '500_1000', min: 500, max: 1000 },
    { key: '1000_2500', min: 1000, max: 2500 },
    { key: '2500_5000', min: 2500, max: 5000 },
    { key: '5000_10000', min: 5000, max: 10000 },
    { key: '10000_25000', min: 10000, max: 25000 },
    { key: '25000_50000', min: 25000, max: 50000 },
    { key: 'above_50000', min: 50000, max: Infinity },
  ];

  // Vendor rating ranges
  private readonly RATING_RANGES = [
    { key: '4_5_stars', min: 4.5, max: 5.0 },
    { key: '4_stars', min: 4.0, max: 4.5 },
    { key: '3_stars', min: 3.0, max: 4.0 },
    { key: 'below_3_stars', min: 0, max: 3.0 },
  ];

  constructor(elasticsearchService: ElasticsearchService) {
    this.elasticsearchService = elasticsearchService;
  }

  /**
   * Perform faceted search with aggregations
   */
  async search(searchQuery: FacetedSearchQuery): Promise<FacetedSearchResult> {
    const page = searchQuery.page || 1;
    const limit = searchQuery.limit || 20;
    const from = (page - 1) * limit;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];
    const shouldClauses: any[] = [];

    // Full-text search with boosting
    if (searchQuery.query) {
      mustClauses.push({
        multi_match: {
          query: searchQuery.query,
          fields: [
            'title^3',
            'title.english^2.5',
            'title.hindi^2.5',
            'description',
            'description.english',
            'description.hindi',
            'brand^2',
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

    // Filter by brand
    if (searchQuery.brand && searchQuery.brand.length > 0) {
      filterClauses.push({
        terms: { 'brand.keyword': searchQuery.brand },
      });
    }

    // Filter by delivery options
    if (searchQuery.delivery_options && searchQuery.delivery_options.length > 0) {
      filterClauses.push({
        terms: { delivery_options: searchQuery.delivery_options },
      });
    }

    // Filter by availability
    if (searchQuery.availability) {
      filterClauses.push({
        term: { availability: searchQuery.availability },
      });
    }

    // Filter by vendor rating
    if (searchQuery.vendor_rating_min !== undefined) {
      filterClauses.push({
        range: { vendor_rating: { gte: searchQuery.vendor_rating_min } },
      });
    }

    // Filter by verified vendors only
    if (searchQuery.verified_vendors_only) {
      filterClauses.push({
        term: { vendor_verified: true },
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

    // Filter by status (default to active)
    if (searchQuery.status) {
      filterClauses.push({
        term: { status: searchQuery.status },
      });
    } else {
      filterClauses.push({
        term: { status: 'active' },
      });
    }

    // Boosting for verified vendors
    shouldClauses.push({
      term: {
        vendor_verified: {
          value: true,
          boost: 2.0,
        },
      },
    });

    // Boosting for featured products
    shouldClauses.push({
      term: {
        is_featured: {
          value: true,
          boost: 1.5,
        },
      },
    });

    // Boosting for higher rated vendors
    shouldClauses.push({
      range: {
        vendor_rating: {
          gte: 4.5,
          boost: 1.3,
        },
      },
    });

    // Build query
    const query: any = {
      bool: {
        must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }],
        filter: filterClauses,
        should: shouldClauses,
        minimum_should_match: 0, // Should clauses are for boosting only
      },
    };

    // Build aggregations for facets
    const aggregations: any = {};

    const requestedFacets = searchQuery.facets || [
      'categories',
      'brands',
      'price_ranges',
      'delivery_options',
      'availability',
      'vendor_ratings',
    ];

    if (requestedFacets.includes('categories')) {
      aggregations.categories = {
        terms: {
          field: 'category_name.keyword',
          size: 50,
        },
      };
    }

    if (requestedFacets.includes('brands')) {
      aggregations.brands = {
        terms: {
          field: 'brand.keyword',
          size: 50,
        },
      };
    }

    if (requestedFacets.includes('price_ranges')) {
      aggregations.price_ranges = {
        range: {
          field: 'price',
          ranges: this.PRICE_RANGES.map((range) => ({
            key: range.key,
            from: range.min,
            to: range.max === Infinity ? undefined : range.max,
          })),
        },
      };
    }

    if (requestedFacets.includes('delivery_options')) {
      aggregations.delivery_options = {
        terms: {
          field: 'delivery_options',
          size: 10,
        },
      };
    }

    if (requestedFacets.includes('availability')) {
      aggregations.availability = {
        terms: {
          field: 'availability',
          size: 10,
        },
      };
    }

    if (requestedFacets.includes('vendor_ratings')) {
      aggregations.vendor_rating_avg = {
        avg: {
          field: 'vendor_rating',
        },
      };
      aggregations.vendor_rating_ranges = {
        range: {
          field: 'vendor_rating',
          ranges: this.RATING_RANGES.map((range) => ({
            key: range.key,
            from: range.min,
            to: range.max,
          })),
        },
      };
    }

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
      const client = (this.elasticsearchService as any).client;
      const response = await client.search({
        index: 'products',
        body: {
          query,
          sort,
          from,
          size: limit,
          aggs: aggregations,
        },
      });

      const hits = response.hits.hits.map((hit: any) => hit._source);
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      // Parse facets from aggregations
      const facets: any = {};

      if (response.aggregations?.categories) {
        facets.categories = response.aggregations.categories.buckets.map((bucket: any) => ({
          key: bucket.key,
          count: bucket.doc_count,
        }));
      }

      if (response.aggregations?.brands) {
        facets.brands = response.aggregations.brands.buckets.map((bucket: any) => ({
          key: bucket.key,
          count: bucket.doc_count,
        }));
      }

      if (response.aggregations?.price_ranges) {
        facets.price_ranges = response.aggregations.price_ranges.buckets.map((bucket: any) => {
          const range = this.PRICE_RANGES.find((r) => r.key === bucket.key);
          return {
            key: bucket.key,
            min: range?.min || 0,
            max: range?.max === Infinity ? null : range?.max,
            count: bucket.doc_count,
          };
        });
      }

      if (response.aggregations?.delivery_options) {
        facets.delivery_options = response.aggregations.delivery_options.buckets.map(
          (bucket: any) => ({
            key: bucket.key,
            count: bucket.doc_count,
          })
        );
      }

      if (response.aggregations?.availability) {
        facets.availability = response.aggregations.availability.buckets.map((bucket: any) => ({
          key: bucket.key,
          count: bucket.doc_count,
        }));
      }

      if (response.aggregations?.vendor_rating_avg) {
        facets.vendor_ratings = {
          avg: response.aggregations.vendor_rating_avg.value || 0,
          ranges: response.aggregations.vendor_rating_ranges.buckets.map((bucket: any) => {
            const range = this.RATING_RANGES.find((r) => r.key === bucket.key);
            return {
              key: bucket.key,
              min: range?.min || 0,
              max: range?.max || 5,
              count: bucket.doc_count,
            };
          }),
        };
      }

      return {
        hits,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        facets,
      };
    } catch (error: any) {
      console.error('[FacetedSearchService] Search failed:', error);
      throw error;
    }
  }

  /**
   * Get available filter options (without applying filters)
   */
  async getFilterOptions(): Promise<any> {
    try {
      const client = (this.elasticsearchService as any).client;
      const response = await client.search({
        index: 'products',
        body: {
          size: 0,
          query: {
            term: { status: 'active' },
          },
          aggs: {
            categories: {
              terms: { field: 'category_name.keyword', size: 100 },
            },
            brands: {
              terms: { field: 'brand.keyword', size: 100 },
            },
            delivery_options: {
              terms: { field: 'delivery_options', size: 10 },
            },
            availability: {
              terms: { field: 'availability', size: 10 },
            },
          },
        },
      });

      return {
        categories: response.aggregations.categories.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
        brands: response.aggregations.brands.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
        delivery_options: response.aggregations.delivery_options.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
        availability: response.aggregations.availability.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
        price_ranges: this.PRICE_RANGES,
        vendor_rating_ranges: this.RATING_RANGES,
      };
    } catch (error: any) {
      console.error('[FacetedSearchService] Failed to get filter options:', error);
      throw error;
    }
  }
}

// Singleton instance
let facetedSearchService: FacetedSearchService | null = null;

export function getFacetedSearchService(
  elasticsearchService: ElasticsearchService
): FacetedSearchService {
  if (!facetedSearchService) {
    facetedSearchService = new FacetedSearchService(elasticsearchService);
  }
  return facetedSearchService;
}
