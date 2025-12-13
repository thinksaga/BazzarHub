# Advanced Search Features Documentation

## Overview

This document describes the advanced search capabilities implemented in MercurJS using Elasticsearch, including faceted search, search ranking, analytics, and intelligent suggestions.

## Features

### 1. **Faceted Search**
Filter products using multiple criteria simultaneously with real-time counts.

### 2. **Search Ranking & Boosting**
- Verified vendors get 2x boost
- Featured products get 1.5x boost
- High-rated vendors (4.5+ stars) get 1.3x boost

### 3. **Search Analytics**
- Track all search queries
- Monitor zero-result queries
- Analyze trending searches
- Track product clicks from search results

### 4. **Intelligent Suggestions**
- Trending query-based suggestions
- Popular searches by category
- Real-time autocomplete

## API Endpoints

### 1. Advanced Product Search

**GET** `/api/advanced-search/products`

Full-featured search with faceted filters and aggregations.

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | Search query (searches across title, description, brand, etc.) | `laptop` |
| `category_id` | string | Filter by category | `cat_electronics` |
| `vendor_id` | string | Filter by vendor | `vendor_abc123` |
| `brand` | string | Comma-separated brand names | `Dell,HP,Lenovo` |
| `delivery_options` | string | Comma-separated options | `cod,express` |
| `availability` | string | Stock status | `in_stock`, `out_of_stock`, `pre_order` |
| `vendor_rating_min` | number | Minimum vendor rating (0-5) | `4.0` |
| `verified_vendors_only` | boolean | Show only verified vendors | `true` |
| `price_min` | number | Minimum price in INR | `5000` |
| `price_max` | number | Maximum price in INR | `50000` |
| `tags` | string | Comma-separated tags | `featured,sale` |
| `status` | string | Product status | `active` |
| `page` | number | Page number (starts from 1) | `1` |
| `limit` | number | Items per page (max 100) | `20` |
| `sort_by` | string | Sort field | `price`, `created_at`, `vendor_rating` |
| `sort_order` | string | Sort order | `asc`, `desc` |
| `facets` | string | Which facets to return | `categories,brands,price_ranges` |

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/advanced-search/products?q=laptop&brand=Dell,HP&price_min=30000&price_max=100000&verified_vendors_only=true&delivery_options=cod&page=1&limit=20"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "hits": [
      {
        "id": "prod_123",
        "title": "Dell XPS 15 Laptop",
        "description": "High-performance laptop with Intel i7",
        "category_id": "cat_electronics",
        "category_name": "Electronics",
        "price": 85000,
        "vendor_id": "vendor_abc",
        "vendor_name": "Tech Store India",
        "vendor_verified": true,
        "vendor_rating": 4.7,
        "sku": "DELL-XPS15-001",
        "brand": "Dell",
        "attributes": {},
        "tags": ["featured", "laptop", "premium"],
        "status": "active",
        "is_featured": true,
        "availability": "in_stock",
        "delivery_options": ["cod", "express", "standard"],
        "inventory_quantity": 15,
        "images": ["https://..."],
        "created_at": "2025-01-01T00:00:00.000Z",
        "updated_at": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 145,
    "page": 1,
    "limit": 20,
    "total_pages": 8,
    "facets": {
      "categories": [
        { "key": "Electronics", "count": 145 },
        { "key": "Computers", "count": 98 }
      ],
      "brands": [
        { "key": "Dell", "count": 45 },
        { "key": "HP", "count": 38 },
        { "key": "Lenovo", "count": 32 }
      ],
      "price_ranges": [
        { "key": "under_500", "min": 0, "max": 500, "count": 0 },
        { "key": "25000_50000", "min": 25000, "max": 50000, "count": 23 },
        { "key": "50000_100000", "min": 50000, "max": 100000, "count": 89 }
      ],
      "delivery_options": [
        { "key": "cod", "count": 120 },
        { "key": "express", "count": 95 },
        { "key": "standard", "count": 145 }
      ],
      "availability": [
        { "key": "in_stock", "count": 120 },
        { "key": "out_of_stock", "count": 15 },
        { "key": "pre_order", "count": 10 }
      ],
      "vendor_ratings": {
        "avg": 4.3,
        "ranges": [
          { "key": "4_5_stars", "min": 4.5, "max": 5.0, "count": 78 },
          { "key": "4_stars", "min": 4.0, "max": 4.5, "count": 45 }
        ]
      }
    }
  }
}
```

### 2. Get Available Filters

**GET** `/api/advanced-search/filters`

Get all available filter options without applying any filters.

**Example Request:**
```bash
curl http://localhost:3001/api/advanced-search/filters
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "key": "Electronics", "count": 1250 },
      { "key": "Fashion", "count": 850 }
    ],
    "brands": [
      { "key": "Samsung", "count": 345 },
      { "key": "Apple", "count": 289 }
    ],
    "delivery_options": [
      { "key": "cod", "count": 980 },
      { "key": "express", "count": 650 }
    ],
    "availability": [
      { "key": "in_stock", "count": 1100 },
      { "key": "out_of_stock", "count": 150 }
    ],
    "price_ranges": [
      { "key": "under_500", "min": 0, "max": 500 },
      { "key": "500_1000", "min": 500, "max": 1000 },
      { "key": "1000_2500", "min": 1000, "max": 2500 }
    ],
    "vendor_rating_ranges": [
      { "key": "4_5_stars", "min": 4.5, "max": 5.0 },
      { "key": "4_stars", "min": 4.0, "max": 4.5 }
    ]
  }
}
```

### 3. Trending Queries

**GET** `/api/advanced-search/trending`

Get the most popular search queries.

**Query Parameters:**
- `limit` (number, default: 10) - Number of queries to return

**Example Request:**
```bash
curl http://localhost:3001/api/advanced-search/trending?limit=5
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "queries": [
      {
        "query": "laptop",
        "count": 1523,
        "avg_results": 145,
        "conversion_rate": 0.23
      },
      {
        "query": "mobile phone",
        "count": 1342,
        "avg_results": 289,
        "conversion_rate": 0.31
      }
    ]
  }
}
```

### 4. Zero-Result Queries

**GET** `/api/advanced-search/zero-results`

Get queries that returned no results (useful for product gap analysis).

**Query Parameters:**
- `limit` (number, default: 20) - Number of queries to return

**Example Request:**
```bash
curl http://localhost:3001/api/advanced-search/zero-results?limit=10
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "queries": [
      {
        "query": "gaming chair rgb",
        "count": 45,
        "last_searched": "2025-12-07T10:30:00.000Z"
      },
      {
        "query": "wireless earbuds under 1000",
        "count": 38,
        "last_searched": "2025-12-07T09:15:00.000Z"
      }
    ]
  }
}
```

### 5. Search Suggestions

**GET** `/api/advanced-search/suggestions`

Get search suggestions based on trending queries and user behavior.

**Query Parameters:**
- `q` (string, required) - Search prefix (minimum 2 characters)
- `limit` (number, default: 10) - Number of suggestions

**Example Request:**
```bash
curl "http://localhost:3001/api/advanced-search/suggestions?q=lap&limit=5"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "laptop",
      "laptop bag",
      "laptop stand",
      "laptop cooling pad",
      "laptop charger"
    ],
    "query": "lap"
  }
}
```

### 6. Track Product Click

**POST** `/api/advanced-search/track-click`

Track when a user clicks a product from search results.

**Request Body:**
```json
{
  "query": "laptop dell",
  "product_id": "prod_123",
  "position": 3,
  "session_id": "sess_abc123"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/advanced-search/track-click \
  -H "Content-Type: application/json" \
  -d '{
    "query": "laptop dell",
    "product_id": "prod_123",
    "position": 3,
    "session_id": "sess_abc123"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Click tracked successfully"
}
```

### 7. Popular Searches by Category

**GET** `/api/advanced-search/category/:categoryId/popular`

Get popular search queries within a specific category.

**Query Parameters:**
- `limit` (number, default: 10) - Number of queries to return

**Example Request:**
```bash
curl http://localhost:3001/api/advanced-search/category/cat_electronics/popular?limit=5
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "category_id": "cat_electronics",
    "queries": [
      "laptop",
      "smartphone",
      "wireless headphones",
      "smart watch",
      "tablet"
    ]
  }
}
```

## Price Ranges (INR)

The system includes predefined price ranges optimized for the Indian market:

| Range Key | Min Price (₹) | Max Price (₹) |
|-----------|---------------|---------------|
| `under_500` | 0 | 500 |
| `500_1000` | 500 | 1,000 |
| `1000_2500` | 1,000 | 2,500 |
| `2500_5000` | 2,500 | 5,000 |
| `5000_10000` | 5,000 | 10,000 |
| `10000_25000` | 10,000 | 25,000 |
| `25000_50000` | 25,000 | 50,000 |
| `above_50000` | 50,000 | ∞ |

## Vendor Rating Ranges

| Range Key | Min Rating | Max Rating |
|-----------|------------|------------|
| `4_5_stars` | 4.5 | 5.0 |
| `4_stars` | 4.0 | 4.5 |
| `3_stars` | 3.0 | 4.0 |
| `below_3_stars` | 0 | 3.0 |

## Delivery Options

- `cod` - Cash on Delivery
- `express` - Express Delivery (1-2 days)
- `standard` - Standard Delivery (3-7 days)

## Availability Status

- `in_stock` - Product is available for immediate purchase
- `out_of_stock` - Product is currently unavailable
- `pre_order` - Product can be pre-ordered

## Search Ranking Formula

The search relevance score is calculated using:

1. **Text Match Score** (Base relevance)
   - Title matches: 3x weight
   - English/Hindi titles: 2.5x weight
   - Brand: 2x weight
   - Category: 1.5x weight
   - Description, vendor name, SKU: 1x weight

2. **Verified Vendor Boost**: +2.0
3. **Featured Product Boost**: +1.5
4. **High Rating Boost**: +1.3 (for vendors rated 4.5+)

**Final Score** = Text Match Score + Boosts

## Usage Examples

### Example 1: Search for Budget Laptops with COD

```bash
curl -X GET "http://localhost:3001/api/advanced-search/products?\
q=laptop&\
price_min=20000&\
price_max=40000&\
delivery_options=cod&\
availability=in_stock&\
sort_by=price&\
sort_order=asc&\
page=1&\
limit=20"
```

### Example 2: Search for Premium Products from Verified Vendors

```bash
curl -X GET "http://localhost:3001/api/advanced-search/products?\
q=smartphone&\
verified_vendors_only=true&\
vendor_rating_min=4.5&\
price_min=50000&\
tags=featured,premium&\
delivery_options=express&\
sort_by=vendor_rating&\
sort_order=desc"
```

### Example 3: Browse Electronics with All Facets

```bash
curl -X GET "http://localhost:3001/api/advanced-search/products?\
category_id=cat_electronics&\
facets=categories,brands,price_ranges,delivery_options,availability,vendor_ratings&\
page=1&\
limit=20"
```

### Example 4: Search with Multiple Brands

```bash
curl -X GET "http://localhost:3001/api/advanced-search/products?\
q=laptop&\
brand=Dell,HP,Lenovo&\
price_min=40000&\
price_max=80000&\
delivery_options=cod,express"
```

## Frontend Integration

### React Example

```javascript
import React, { useState, useEffect } from 'react';

function AdvancedSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [filters, setFilters] = useState({
    brand: [],
    price_min: null,
    price_max: null,
    delivery_options: [],
    verified_vendors_only: false,
  });

  const search = async () => {
    const params = new URLSearchParams({
      q: query,
      ...filters,
      brand: filters.brand.join(','),
      delivery_options: filters.delivery_options.join(','),
    });

    const response = await fetch(
      `http://localhost:3001/api/advanced-search/products?${params}`
    );
    const data = await response.json();
    setResults(data.data);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />
      <button onClick={search}>Search</button>
      
      {/* Render filters and results */}
    </div>
  );
}
```

### Tracking Clicks

```javascript
const trackClick = async (query, productId, position) => {
  await fetch('http://localhost:3001/api/advanced-search/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      product_id: productId,
      position,
      session_id: sessionStorage.getItem('session_id'),
    }),
  });
};
```

## Performance Considerations

1. **Caching**: Consider caching filter options and trending queries in Redis
2. **Pagination**: Use reasonable page sizes (20-50 items)
3. **Facets**: Only request facets you need using the `facets` parameter
4. **Analytics**: Analytics are tracked asynchronously and don't block responses

## Monitoring & Analytics

### Key Metrics to Track

1. **Search Performance**
   - Average response time
   - Queries per second
   - Cache hit rate

2. **User Behavior**
   - Click-through rate (CTR)
   - Zero-result query rate
   - Average results per query
   - Conversion rate

3. **Product Insights**
   - Most searched products
   - Popular categories
   - Top brands
   - Price range distribution

### Analytics Maintenance

Clear old analytics data periodically (default: 90 days):

```bash
# Add this to your cron jobs
curl -X POST http://localhost:3001/admin/analytics/cleanup
```

## Troubleshooting

### No Results Returned

1. Check if products are indexed: `GET /api/search/stats`
2. Verify index exists: `docker-compose exec elasticsearch curl localhost:9200/_cat/indices`
3. Run bulk indexing: `npm run index:products`

### Facets Not Showing

1. Ensure facets parameter includes desired facets
2. Check if field mappings are correct
3. Verify data has been indexed with correct field values

### Analytics Not Working

1. Check Redis connection: `GET /health`
2. Verify analytics indices exist: `GET /api/search/stats`
3. Check backend logs for errors

## Future Enhancements

- [ ] Personalized search based on user history
- [ ] Image-based search
- [ ] Voice search support
- [ ] Multi-language support expansion
- [ ] A/B testing framework for search relevance
- [ ] Machine learning-based ranking
- [ ] Real-time inventory updates in search results
- [ ] Spell correction and "Did you mean?"

## License

MIT
