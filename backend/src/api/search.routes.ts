import { Router } from 'express';
import { getElasticsearchService } from '../services/elasticsearch/elasticsearch.service';

const router = Router();

/**
 * @route   GET /api/search/products
 * @desc    Search products with full-text search
 * @access  Public
 * @query   q - Search query
 * @query   category_id - Filter by category
 * @query   vendor_id - Filter by vendor
 * @query   price_min - Minimum price
 * @query   price_max - Maximum price
 * @query   tags - Comma-separated tags
 * @query   status - Product status (active, draft, etc.)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   sort_by - Sort field (price, created_at, etc.)
 * @query   sort_order - Sort order (asc, desc)
 */
router.get('/products', async (req, res) => {
  try {
    const elasticsearchService = getElasticsearchService();

    const searchQuery = {
      query: req.query.q as string,
      category_id: req.query.category_id as string,
      vendor_id: req.query.vendor_id as string,
      price_min: req.query.price_min ? parseFloat(req.query.price_min as string) : undefined,
      price_max: req.query.price_max ? parseFloat(req.query.price_max as string) : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      status: req.query.status as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      sort_by: req.query.sort_by as string,
      sort_order: (req.query.sort_order as 'asc' | 'desc') || 'asc',
    };

    const result = await elasticsearchService.searchProducts(searchQuery);

    res.json({
      success: true,
      data: result,
      query: searchQuery,
    });
  } catch (error: any) {
    console.error('[Search API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed',
    });
  }
});

/**
 * @route   GET /api/search/autocomplete
 * @desc    Get autocomplete suggestions
 * @access  Public
 * @query   q - Search query (minimum 2 characters)
 * @query   limit - Number of suggestions (default: 10)
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          message: 'Query must be at least 2 characters',
        },
      });
    }

    const elasticsearchService = getElasticsearchService();
    const suggestions = await elasticsearchService.autocomplete(query, limit);

    res.json({
      success: true,
      data: {
        suggestions,
        query,
      },
    });
  } catch (error: any) {
    console.error('[Autocomplete API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Autocomplete failed',
    });
  }
});

/**
 * @route   GET /api/search/product/:id
 * @desc    Get product by ID from Elasticsearch
 * @access  Public
 */
router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const elasticsearchService = getElasticsearchService();
    const product = await elasticsearchService.getProduct(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error('[Get Product API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get product',
    });
  }
});

/**
 * @route   GET /api/search/stats
 * @desc    Get Elasticsearch index statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const elasticsearchService = getElasticsearchService();
    const stats = await elasticsearchService.getStats();

    const indexStats = stats.indices?.products;

    res.json({
      success: true,
      data: {
        documents: indexStats?.total?.docs?.count || 0,
        size_bytes: indexStats?.total?.store?.size_in_bytes || 0,
        size_mb: ((indexStats?.total?.store?.size_in_bytes || 0) / 1024 / 1024).toFixed(2),
        shards: {
          total: indexStats?.total?.docs?.count || 0,
          primaries: indexStats?.primaries?.docs?.count || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('[Stats API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get stats',
    });
  }
});

/**
 * @route   GET /api/search/health
 * @desc    Check Elasticsearch health
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const elasticsearchService = getElasticsearchService();
    const isHealthy = await elasticsearchService.healthCheck();

    res.json({
      success: true,
      data: {
        elasticsearch: isHealthy ? 'healthy' : 'unhealthy',
      },
    });
  } catch (error: any) {
    console.error('[Health API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed',
    });
  }
});

export default router;
