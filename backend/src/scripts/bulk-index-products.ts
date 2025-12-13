#!/usr/bin/env node

/**
 * Bulk Indexing Script for Elasticsearch
 * 
 * This script performs initial data migration from PostgreSQL to Elasticsearch.
 * It fetches all products from the database and indexes them in batches.
 * 
 * Usage:
 *   npm run index:products
 *   
 * Options:
 *   --clear   Clear the index before reindexing
 */

import { createConnection } from 'typeorm';
import { Product } from '@medusajs/medusa';
import { getElasticsearchService } from '../services/elasticsearch/elasticsearch.service';
import { getIndexingService } from '../services/elasticsearch/indexing.service';

const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');

async function bulkIndex() {
  console.log('=================================');
  console.log('Elasticsearch Bulk Indexing');
  console.log('=================================\n');

  let connection;

  try {
    // Create database connection
    console.log('Connecting to database...');
    connection = await createConnection({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5434'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'mercurjs',
      entities: [Product],
      logging: false,
    });
    console.log('✓ Database connected\n');

    // Initialize Elasticsearch
    console.log('Connecting to Elasticsearch...');
    const elasticsearchService = getElasticsearchService();
    await elasticsearchService.initialize();
    console.log('✓ Elasticsearch connected\n');

    // Check cluster health
    const isHealthy = await elasticsearchService.healthCheck();
    if (!isHealthy) {
      console.error('✗ Elasticsearch cluster is not healthy');
      process.exit(1);
    }
    console.log('✓ Elasticsearch cluster is healthy\n');

    // Initialize indexing service
    const indexingService = getIndexingService(elasticsearchService);

    // Clear index if requested
    if (shouldClear) {
      console.log('Clearing existing index...');
      await elasticsearchService.clearIndex();
      console.log('✓ Index cleared\n');
    }

    // Get total count
    const totalProducts = await connection.manager.count(Product);
    console.log(`Total products in database: ${totalProducts}\n`);

    if (totalProducts === 0) {
      console.log('No products to index. Exiting...');
      await elasticsearchService.close();
      await connection.close();
      process.exit(0);
    }

    // Batch indexing
    console.log('Starting bulk indexing...\n');
    const batchSize = 100;
    let offset = 0;
    let totalIndexed = 0;
    const startTime = Date.now();

    while (offset < totalProducts) {
      const batchStart = Date.now();

      // Fetch batch with all relations
      const products = await connection.manager
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

      // Index batch
      await indexingService.bulkIndexProducts(products);
      totalIndexed += products.length;
      offset += batchSize;

      const batchTime = Date.now() - batchStart;
      const progress = ((totalIndexed / totalProducts) * 100).toFixed(2);

      console.log(
        `[${progress}%] Indexed ${totalIndexed}/${totalProducts} products (batch: ${products.length}, time: ${batchTime}ms)`
      );
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ Bulk indexing completed!`);
    console.log(`  Total products: ${totalIndexed}`);
    console.log(`  Total time: ${totalTime}s`);
    console.log(`  Average: ${(totalIndexed / parseFloat(totalTime)).toFixed(2)} products/s\n`);

    // Get index stats
    console.log('Fetching index statistics...');
    const stats = await elasticsearchService.getStats();
    const indexStats = stats.indices?.products;
    
    if (indexStats) {
      console.log('\nIndex Statistics:');
      console.log(`  Documents: ${indexStats.total?.docs?.count || 0}`);
      console.log(`  Size: ${(indexStats.total?.store?.size_in_bytes / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Shards: ${indexStats.primaries?.docs?.count || 0}`);
    }

    // Close connections
    await elasticsearchService.close();
    await connection.close();

    console.log('\n✓ All connections closed');
    console.log('=================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ Bulk indexing failed:');
    console.error(error.message);
    console.error(error.stack);

    if (connection) {
      await connection.close();
    }

    process.exit(1);
  }
}

// Run the script
bulkIndex();
