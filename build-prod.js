#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting MercurJS production environment...');

// Set production environment
process.env.NODE_ENV = 'production';

// Build production images
console.log('🔨 Building production images...');
try {
    execSync('docker-compose build --no-cache', {
        stdio: 'inherit',
        cwd: __dirname
    });
} catch (error) {
    console.error('❌ Failed to build production images:', error.message);
    process.exit(1);
}

// Start services in detached mode
console.log('🏃 Starting production services...');
try {
    execSync('docker-compose up -d --remove-orphans', {
        stdio: 'inherit',
        cwd: __dirname
    });
} catch (error) {
    console.error('❌ Failed to start production services:', error.message);
    process.exit(1);
}

// Wait for services to be healthy
console.log('⏳ Waiting for services to be healthy...');
setTimeout(() => {
    // Check service health
    console.log('🔍 Checking service health...');
    try {
        execSync('docker-compose ps', {
            stdio: 'inherit',
            cwd: __dirname
        });
    } catch (error) {
        console.error('❌ Failed to check service health:', error.message);
    }

    console.log('🎉 Production environment is running!');
    console.log('📱 Storefront: http://localhost');
    console.log('🏪 Vendor Panel: http://localhost/vendor');
    console.log('🔧 API: http://localhost/api');
    console.log('');
    console.log('📋 Useful commands:');
    console.log('  View logs: docker-compose logs -f [service_name]');
    console.log('  Stop services: docker-compose down');
    console.log('  Restart service: docker-compose restart [service_name]');
    console.log('  View running containers: docker-compose ps');
}, 30000);