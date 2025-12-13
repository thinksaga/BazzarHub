import { Router } from 'express';
import { getElasticsearchService } from '../services/elasticsearch/elasticsearch.service';
import { getFacetedSearchService } from '../services/elasticsearch/faceted-search.service';
import { getSearchAnalyticsService } from '../services/elasticsearch/search-analytics.service';
import RedisService from '../services/redis';

const router = Router();
const redisService = new RedisService();

/**
 * @route   GET /api/advanced-search/products
 * @desc    Advanced search with faceted filters and boosting
 * @access  Public
 */
router.get('/products', async (req, res) => {
  try {
    const elasticsearchService = getElasticsearchService();
    const facetedSearchService = getFacetedSearchService(elasticsearchService);
    const analyticsService = getSearchAnalyticsService(redisService);

    const searchQuery = {
      query: req.query.q as string,
      category_id: req.query.category_id as string,
      vendor_id: req.query.vendor_id as string,
      brand: req.query.brand ? (req.query.brand as string).split(',') : undefined,
      delivery_options: req.query.delivery_options
        ? (req.query.delivery_options as string).split(',')
        : undefined,
      availability: req.query.availability as any,
      vendor_rating_min: req.query.vendor_rating_min
        ? parseFloat(req.query.vendor_rating_min as string)
        : undefined,
      verified_vendors_only: req.query.verified_vendors_only === 'true',
      price_min: req.query.price_min ? parseFloat(req.query.price_min as string) : undefined,
      price_max: req.query.price_max ? parseFloat(req.query.price_max as string) : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      status: req.query.status as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      sort_by: req.query.sort_by as string,
      sort_order: (req.query.sort_order as 'asc' | 'desc') || 'asc',
      facets: req.query.facets ? (req.query.facets as string).split(',') : undefined,
    };

    const result = await facetedSearchService.search(searchQuery);

    // Track search analytics
    if (searchQuery.query) {
      await analyticsService.trackSearch({
        query: searchQuery.query,
        results_count: result.total,
        timestamp: new Date(),
        session_id: req.headers['x-session-id'] as string,
        filters: {
          category_id: searchQuery.category_id,
          vendor_id: searchQuery.vendor_id,
          brand: searchQuery.brand,
          price_range: {
            min: searchQuery.price_min,
            max: searchQuery.price_max,
          },
        },
      });
    }

    res.json({
      success: true,
      data: result,
      query: searchQuery,
    });
  } catch (error: any) {
    console.error('[Advanced Search API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed',
    });
  }
});

/**
 * @route   GET /api/advanced-search/filters
 * @desc    Get available filter options
 * @access  Public
 */
router.get('/filters', async (req, res) => {
  try {
    const elasticsearchService = getElasticsearchService();
    const facetedSearchService = getFacetedSearchService(elasticsearchService);

    const filters = await facetedSearchService.getFilterOptions();

    res.json({
      success: true,
      data: filters,
    });
  } catch (error: any) {
    console.error('[Filters API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get filters',
    });
  }
});

/**
 * @route   GET /api/advanced-search/trending
 * @desc    Get trending search queries
 * @access  Public
 */
router.get('/trending', async (req, res) => {
  try {
    const analyticsService = getSearchAnalyticsService(redisService);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const trending = await analyticsService.getTrendingQueries(limit);

    res.json({
      success: true,
      data: {
        queries: trending,
      },
    });
  } catch (error: any) {
    console.error('[Trending API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get trending queries',
    });
  }
});

/**
 * @route   GET /api/advanced-search/zero-results
 * @desc    Get queries with zero results (for admin analysis)
 * @access  Public (should be protected in production)
 */
router.get('/zero-results', async (req, res) => {
  try {
    const analyticsService = getSearchAnalyticsService(redisService);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const zeroResults = await analyticsService.getZeroResultQueries(limit);

    res.json({
      success: true,
      data: {
        queries: zeroResults,
      },
    });
  } catch (error: any) {
    console.error('[Zero Results API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get zero-result queries',
    });
  }
});

/**
 * @route   GET /api/advanced-search/suggestions
 * @desc    Get search suggestions based on trending queries
 * @access  Public
 */
router.get('/suggestions', async (req, res) => {
  try {
    const analyticsService = getSearchAnalyticsService(redisService);
    const prefix = req.query.q as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (!prefix || prefix.length < 2) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          message: 'Query must be at least 2 characters',
        },
      });
    }

    const suggestions = await analyticsService.getSuggestions(prefix, limit);

    res.json({
      success: true,
      data: {
        suggestions,
        query: prefix,
      },
    });
  } catch (error: any) {
    console.error('[Suggestions API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get suggestions',
    });
  }
});

/**
 * @route   POST /api/advanced-search/track-click
 * @desc    Track product click from search results
 * @access  Public
 */
router.post('/track-click', async (req, res) => {
  try {
    const analyticsService = getSearchAnalyticsService(redisService);
    const { query, product_id, position, session_id } = req.body;

    if (!query || !product_id) {
      return res.status(400).json({
        success: false,
        error: 'Query and product_id are required',
      });
    }

    await analyticsService.trackClick(query, product_id, position || 0, session_id);

    res.json({
      success: true,
      message: 'Click tracked successfully',
    });
  } catch (error: any) {
    console.error('[Track Click API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to track click',
    });
  }
});

/**
 * @route   GET /api/advanced-search/category/:categoryId/popular
 * @desc    Get popular searches in a category
 * @access  Public
 */
router.get('/category/:categoryId/popular', async (req, res) => {
  try {
    const analyticsService = getSearchAnalyticsService(redisService);
    const { categoryId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const queries = await analyticsService.getPopularSearchesByCategory(categoryId, limit);

    res.json({
      success: true,
      data: {
        category_id: categoryId,
        queries,
      },
    });
  } catch (error: any) {
    console.error('[Category Popular API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get popular searches',
    });
  }
});

export default router;
