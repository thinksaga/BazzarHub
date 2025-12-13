# Elasticsearch Integration for MercurJS

This implementation replaces Algolia with Elasticsearch for product search functionality.

## Features

### 1. **Multi-Language Support**
- **English Analyzer**: Full-text search with stopwords and stemming
- **Hindi Analyzer**: Custom analyzer with Hindi stopwords and stemming
- Supports searching in both languages simultaneously

### 2. **Autocomplete**
- Edge n-grams for fast autocomplete suggestions
- Minimum 2 characters required
- Searches across product titles and category names

### 3. **Full-Text Search**
- Multi-field search (title, description, category, vendor, SKU)
- Field boosting (title gets higher relevance)
- Fuzzy matching for typo tolerance
- Best fields matching strategy

### 4. **Advanced Filtering**
- Filter by category
- Filter by vendor
- Price range filtering
- Tag filtering
- Status filtering

### 5. **Sorting & Pagination**
- Sort by price, date, relevance
- Configurable page size
- Total count and page information

### 6. **Real-Time Sync**
- Automatic indexing on product creation
- Automatic updates on product modification
- Automatic deletion when products are removed
- Event-driven architecture using MedusaJS event bus

### 7. **Bulk Indexing**
- Initial data migration script
- Batch processing for large datasets
- Progress tracking
- Index statistics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MercurJS Backend                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐        ┌──────────────────────────────┐   │
│  │  PostgreSQL  │        │     Elasticsearch Cluster     │   │
│  │   (Source)   │───────▶│    (Search & Autocomplete)   │   │
│  └──────────────┘        └──────────────────────────────┘   │
│         │                              ▲                     │
│         │                              │                     │
│         ▼                              │                     │
│  ┌──────────────────────────────────────────────────┐       │
│  │         Indexing Service                          │       │
│  │  • Transform products to documents                │       │
│  │  • Bulk indexing                                  │       │
│  │  • Individual indexing                            │       │
│  └──────────────────────────────────────────────────┘       │
│         ▲                                                    │
│         │                                                    │
│  ┌──────────────────────────────────────────────────┐       │
│  │    Product Event Subscriber                       │       │
│  │  • product.created                                │       │
│  │  • product.updated                                │       │
│  │  • product.deleted                                │       │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │         Search API Endpoints                      │       │
│  │  • GET /api/search/products                       │       │
│  │  • GET /api/search/autocomplete                   │       │
│  │  • GET /api/search/product/:id                    │       │
│  │  • GET /api/search/stats                          │       │
│  │  • GET /api/search/health                         │       │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Index Mappings

```json
{
  "properties": {
    "id": { "type": "keyword" },
    "title": {
      "type": "text",
      "fields": {
        "english": { "type": "text", "analyzer": "english_analyzer" },
        "hindi": { "type": "text", "analyzer": "hindi_analyzer" },
        "autocomplete": { "type": "text", "analyzer": "autocomplete_analyzer" },
        "keyword": { "type": "keyword" }
      }
    },
    "description": {
      "type": "text",
      "fields": {
        "english": { "type": "text", "analyzer": "english_analyzer" },
        "hindi": { "type": "text", "analyzer": "hindi_analyzer" }
      }
    },
    "category_id": { "type": "keyword" },
    "category_name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
    "price": { "type": "float" },
    "vendor_id": { "type": "keyword" },
    "vendor_name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
    "sku": { "type": "keyword" },
    "attributes": { "type": "object", "enabled": true },
    "tags": { "type": "keyword" },
    "status": { "type": "keyword" },
    "inventory_quantity": { "type": "integer" },
    "images": { "type": "keyword" },
    "created_at": { "type": "date" },
    "updated_at": { "type": "date" }
  }
}
```

## Usage

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Add to `.env`:

```env
ELASTICSEARCH_URL=http://elasticsearch:9200
# Optional: If Elasticsearch has authentication
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
```

### 3. Initialize Elasticsearch

The index will be created automatically on first startup. You can also manually initialize:

```bash
npm run dev
```

### 4. Bulk Index Existing Products

```bash
# Index all products (keeps existing data)
npm run index:products

# Clear and reindex all products
npm run index:products:clear
```

### 5. Search Products

**Basic Search:**
```bash
curl "http://localhost:3001/api/search/products?q=laptop"
```

**Advanced Search with Filters:**
```bash
curl "http://localhost:3001/api/search/products?q=phone&category_id=electronics&price_min=10000&price_max=50000&page=1&limit=20"
```

**Autocomplete:**
```bash
curl "http://localhost:3001/api/search/autocomplete?q=lap"
```

### 6. Check Health

```bash
curl http://localhost:3001/api/search/health
```

### 7. Get Index Statistics

```bash
curl http://localhost:3001/api/search/stats
```

## API Endpoints

### Search Products
**GET** `/api/search/products`

**Query Parameters:**
- `q` - Search query (searches title, description, category, vendor, SKU)
- `category_id` - Filter by category ID
- `vendor_id` - Filter by vendor ID
- `price_min` - Minimum price
- `price_max` - Maximum price
- `tags` - Comma-separated tags (e.g., `featured,sale`)
- `status` - Product status (`active`, `draft`, `archived`)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort_by` - Sort field (`price`, `created_at`, `updated_at`)
- `sort_order` - Sort order (`asc`, `desc`)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "hits": [
      {
        "id": "prod_123",
        "title": "Laptop Dell XPS 15",
        "description": "High-performance laptop",
        "category_id": "cat_electronics",
        "category_name": "Electronics",
        "price": 1299.99,
        "vendor_id": "vendor_abc",
        "vendor_name": "Tech Store",
        "sku": "DELL-XPS15-001",
        "attributes": {},
        "tags": ["featured", "laptop"],
        "status": "active",
        "inventory_quantity": 10,
        "images": ["https://..."],
        "created_at": "2025-01-01T00:00:00.000Z",
        "updated_at": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 145,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

### Autocomplete
**GET** `/api/search/autocomplete`

**Query Parameters:**
- `q` - Search query (minimum 2 characters)
- `limit` - Number of suggestions (default: 10)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "Laptop Dell XPS 15",
      "Laptop HP Pavilion",
      "Laptop Gaming ASUS"
    ],
    "query": "lap"
  }
}
```

### Get Product by ID
**GET** `/api/search/product/:id`

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "prod_123",
    "title": "Laptop Dell XPS 15",
    ...
  }
}
```

### Index Statistics
**GET** `/api/search/stats`

**Example Response:**
```json
{
  "success": true,
  "data": {
    "documents": 1250,
    "size_bytes": 5242880,
    "size_mb": "5.00",
    "shards": {
      "total": 1250,
      "primaries": 1250
    }
  }
}
```

### Health Check
**GET** `/api/search/health`

**Example Response:**
```json
{
  "success": true,
  "data": {
    "elasticsearch": "healthy"
  }
}
```

## Real-Time Sync

The system automatically syncs product changes to Elasticsearch:

1. **Product Created** → Indexed immediately
2. **Product Updated** → Index updated
3. **Product Deleted** → Removed from index

No manual intervention required!

## Performance Considerations

### Index Settings
- **Shards**: 2 primary shards (scalable)
- **Replicas**: 1 replica (for redundancy)
- **Refresh Interval**: `wait_for` (ensures data is searchable immediately)

### Batch Processing
- Bulk operations use batches of 100 products
- Progress tracking for large migrations
- Automatic retry on failures

### Caching
- Consider using Redis to cache frequent searches
- Cache autocomplete results
- Cache category/vendor filters

## Monitoring

### Check Cluster Health
```bash
curl http://elasticsearch:9200/_cluster/health?pretty
```

### Check Index Status
```bash
curl http://elasticsearch:9200/products/_stats?pretty
```

### View Mappings
```bash
curl http://elasticsearch:9200/products/_mapping?pretty
```

### Search Directly
```bash
curl -X GET "http://elasticsearch:9200/products/_search?pretty" -H 'Content-Type: application/json' -d'
{
  "query": {
    "multi_match": {
      "query": "laptop",
      "fields": ["title", "description"]
    }
  }
}
'
```

## Troubleshooting

### Index Not Created
```bash
# Check Elasticsearch is running
docker-compose ps elasticsearch

# Check logs
docker-compose logs elasticsearch

# Manually create index
curl -X PUT "http://localhost:9201/products"
```

### Search Returns No Results
```bash
# Check document count
curl http://localhost:3001/api/search/stats

# If zero, run bulk indexing
npm run index:products
```

### Connection Refused
- Ensure Elasticsearch container is running
- Check `ELASTICSEARCH_URL` environment variable
- Verify port 9201 is accessible

## Migration from Algolia

1. **Remove Algolia dependencies** from `package.json`
2. **Update search components** in frontend to use new API endpoints
3. **Run bulk indexing** to migrate existing data
4. **Test search functionality** thoroughly
5. **Monitor performance** and adjust as needed

## Future Enhancements

- [ ] Implement faceted search (category counts, price ranges)
- [ ] Add search analytics (popular searches, conversion tracking)
- [ ] Implement search personalization
- [ ] Add spell checking and "did you mean"
- [ ] Implement geo-search for location-based products
- [ ] Add A/B testing for search relevance
- [ ] Implement search suggestions based on user history
- [ ] Add image search using machine learning

## License

MIT
