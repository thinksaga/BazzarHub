import { getElasticsearchService } from './elasticsearch.service';
import RedisService from '../redis';

export interface SearchAnalytics {
  query: string;
  results_count: number;
  timestamp: Date;
  user_id?: string;
  session_id?: string;
  filters?: any;
  clicked_products?: string[];
}

export interface TrendingQuery {
  query: string;
  count: number;
  avg_results: number;
  conversion_rate: number;
}

export interface ZeroResultQuery {
  query: string;
  count: number;
  last_searched: Date;
}

export class SearchAnalyticsService {
  private redisService: RedisService;
  private readonly ANALYTICS_INDEX = 'search_analytics';
  private readonly TRENDING_KEY = 'search:trending';
  private readonly ZERO_RESULTS_KEY = 'search:zero_results';
  private readonly TRENDING_TTL = 7 * 24 * 60 * 60; // 7 days

  constructor(redisService: RedisService) {
    this.redisService = redisService;
  }

  /**
   * Track search query
   */
  async trackSearch(analytics: SearchAnalytics): Promise<void> {
    try {
      const elasticsearchService = getElasticsearchService();
      const client = (elasticsearchService as any).client;

      // Index search analytics to Elasticsearch
      await client.index({
        index: this.ANALYTICS_INDEX,
        document: {
          ...analytics,
          timestamp: analytics.timestamp || new Date(),
        },
      });

      // Update trending queries in Redis
      const normalizedQuery = analytics.query.toLowerCase().trim();
      const redisClient = this.redisService.getClient();
      await redisClient.zincrby(this.TRENDING_KEY, 1, normalizedQuery);
      await redisClient.expire(this.TRENDING_KEY, this.TRENDING_TTL);

      // Track zero-result queries
      if (analytics.results_count === 0) {
        const zeroResultData = JSON.stringify({
          query: normalizedQuery,
          timestamp: new Date(),
        });
        await redisClient.zadd(
          this.ZERO_RESULTS_KEY,
          Date.now(),
          `${normalizedQuery}:${zeroResultData}`
        );
      }

      console.log('[SearchAnalytics] Tracked search:', normalizedQuery);
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to track search:', error);
    }
  }

  /**
   * Track product click from search results
   */
  async trackClick(
    query: string,
    productId: string,
    position: number,
    sessionId?: string
  ): Promise<void> {
    try {
      const elasticsearchService = getElasticsearchService();
      const client = (elasticsearchService as any).client;

      await client.index({
        index: 'search_clicks',
        document: {
          query: query.toLowerCase().trim(),
          product_id: productId,
          position,
          session_id: sessionId,
          timestamp: new Date(),
        },
      });

      console.log('[SearchAnalytics] Tracked click:', { query, productId, position });
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to track click:', error);
    }
  }

  /**
   * Get trending queries
   */
  async getTrendingQueries(limit: number = 10): Promise<TrendingQuery[]> {
    try {
      // Get top queries from Redis
      const redisClient = this.redisService.getClient();
      const trending = await redisClient.zrevrange(
        this.TRENDING_KEY,
        0,
        limit - 1,
        'WITHSCORES'
      );

      const queries: TrendingQuery[] = [];
      for (let i = 0; i < trending.length; i += 2) {
        const query = trending[i];
        const count = parseInt(trending[i + 1]);

        // Get analytics from Elasticsearch
        const stats = await this.getQueryStats(query);

        queries.push({
          query,
          count,
          avg_results: stats.avg_results,
          conversion_rate: stats.conversion_rate,
        });
      }

      return queries;
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to get trending queries:', error);
      return [];
    }
  }

  /**
   * Get zero-result queries
   */
  async getZeroResultQueries(limit: number = 20): Promise<ZeroResultQuery[]> {
    try {
      const redisClient = this.redisService.getClient();
      const zeroResults = await redisClient.zrevrange(
        this.ZERO_RESULTS_KEY,
        0,
        limit - 1,
        'WITHSCORES'
      );

      const queries: ZeroResultQuery[] = [];
      const seenQueries = new Set<string>();

      for (let i = 0; i < zeroResults.length; i += 2) {
        const data = zeroResults[i].split(':');
        const query = data[0];
        const timestamp = parseInt(zeroResults[i + 1]);

        if (!seenQueries.has(query)) {
          seenQueries.add(query);

          // Get count from Elasticsearch
          const count = await this.getZeroResultCount(query);

          queries.push({
            query,
            count,
            last_searched: new Date(timestamp),
          });
        }
      }

      return queries.slice(0, limit);
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to get zero-result queries:', error);
      return [];
    }
  }

  /**
   * Get search suggestions based on trending and user behavior
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    try {
      const normalizedPrefix = prefix.toLowerCase().trim();

      if (normalizedPrefix.length < 2) {
        return [];
      }

      // Get trending queries that match the prefix
      const redisClient = this.redisService.getClient();
      const allTrending = await redisClient.zrevrange(
        this.TRENDING_KEY,
        0,
        100,
        'WITHSCORES'
      );

      const suggestions: Array<{ query: string; score: number }> = [];

      for (let i = 0; i < allTrending.length; i += 2) {
        const query = allTrending[i];
        const count = parseInt(allTrending[i + 1]);

        if (query.startsWith(normalizedPrefix)) {
          suggestions.push({ query, score: count });
        }
      }

      // Sort by score (popularity) and return top N
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.query);
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get query statistics
   */
  private async getQueryStats(query: string): Promise<{
    avg_results: number;
    conversion_rate: number;
  }> {
    try {
      const elasticsearchService = getElasticsearchService();
      const client = (elasticsearchService as any).client;

      const response = await client.search({
        index: this.ANALYTICS_INDEX,
        body: {
          size: 0,
          query: {
            term: { 'query.keyword': query },
          },
          aggs: {
            avg_results: {
              avg: { field: 'results_count' },
            },
            total_searches: {
              value_count: { field: 'query.keyword' },
            },
            searches_with_clicks: {
              filter: {
                exists: { field: 'clicked_products' },
              },
            },
          },
        },
      });

      const avgResults = response.aggregations?.avg_results?.value || 0;
      const totalSearches = response.aggregations?.total_searches?.value || 0;
      const searchesWithClicks = response.aggregations?.searches_with_clicks?.doc_count || 0;

      const conversionRate = totalSearches > 0 ? searchesWithClicks / totalSearches : 0;

      return {
        avg_results: Math.round(avgResults),
        conversion_rate: conversionRate,
      };
    } catch (error: any) {
      return { avg_results: 0, conversion_rate: 0 };
    }
  }

  /**
   * Get zero-result count for a query
   */
  private async getZeroResultCount(query: string): Promise<number> {
    try {
      const elasticsearchService = getElasticsearchService();
      const client = (elasticsearchService as any).client;

      const response = await client.count({
        index: this.ANALYTICS_INDEX,
        body: {
          query: {
            bool: {
              must: [
                { term: { 'query.keyword': query } },
                { term: { results_count: 0 } },
              ],
            },
          },
        },
      });

      return response.count || 0;
    } catch (error: any) {
      return 0;
    }
  }

  /**
   * Get popular searches in a category
   */
  async getPopularSearchesByCategory(categoryId: string, limit: number = 10): Promise<string[]> {
    try {
      const elasticsearchService = getElasticsearchService();
      const client = (elasticsearchService as any).client;

      const response = await client.search({
        index: this.ANALYTICS_INDEX,
        body: {
          size: 0,
          query: {
            term: { 'filters.category_id': categoryId },
          },
          aggs: {
            popular_queries: {
              terms: {
                field: 'query.keyword',
                size: limit,
              },
            },
          },
        },
      });

      return (
        response.aggregations?.popular_queries?.buckets.map((b: any) => b.key) || []
      );
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to get popular searches by category:', error);
      return [];
    }
  }

  /**
   * Initialize analytics indices
   */
  async initialize(): Promise<void> {
    try {
      const elasticsearchService = getElasticsearchService();
      const client = (elasticsearchService as any).client;

      // Create search_analytics index
      const analyticsExists = await client.indices.exists({
        index: this.ANALYTICS_INDEX,
      });

      if (!analyticsExists) {
        await client.indices.create({
          index: this.ANALYTICS_INDEX,
          body: {
            mappings: {
              properties: {
                query: {
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' },
                  },
                },
                results_count: { type: 'integer' },
                timestamp: { type: 'date' },
                user_id: { type: 'keyword' },
                session_id: { type: 'keyword' },
                filters: { type: 'object' },
                clicked_products: { type: 'keyword' },
              },
            },
          },
        });
        console.log('[SearchAnalytics] Created search_analytics index');
      }

      // Create search_clicks index
      const clicksExists = await client.indices.exists({
        index: 'search_clicks',
      });

      if (!clicksExists) {
        await client.indices.create({
          index: 'search_clicks',
          body: {
            mappings: {
              properties: {
                query: {
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' },
                  },
                },
                product_id: { type: 'keyword' },
                position: { type: 'integer' },
                session_id: { type: 'keyword' },
                timestamp: { type: 'date' },
              },
            },
          },
        });
        console.log('[SearchAnalytics] Created search_clicks index');
      }
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to initialize:', error);
    }
  }

  /**
   * Clear old analytics data (older than N days)
   */
  async clearOldData(daysToKeep: number = 90): Promise<void> {
    try {
      const elasticsearchService = getElasticsearchService();
      const client = (elasticsearchService as any).client;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await client.deleteByQuery({
        index: this.ANALYTICS_INDEX,
        body: {
          query: {
            range: {
              timestamp: {
                lt: cutoffDate.toISOString(),
              },
            },
          },
        },
      });

      console.log(`[SearchAnalytics] Cleared data older than ${daysToKeep} days`);
    } catch (error: any) {
      console.error('[SearchAnalytics] Failed to clear old data:', error);
    }
  }
}

// Singleton instance
let searchAnalyticsService: SearchAnalyticsService | null = null;

export function getSearchAnalyticsService(redisService: RedisService): SearchAnalyticsService {
  if (!searchAnalyticsService) {
    searchAnalyticsService = new SearchAnalyticsService(redisService);
  }
  return searchAnalyticsService;
}
