#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting MercurJS development environment...');

// Check if .env.local exists, create if not
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envLocalPath)) {
    console.log('📝 Creating .env.local file for development...');
    if (fs.existsSync(envPath)) {
        fs.copyFileSync(envPath, envLocalPath);
        console.log('✅ .env.local created from .env. You may want to adjust development-specific settings.');
    } else {
        console.log('⚠️  .env file not found. Please create .env.local manually.');
        process.exit(1);
    }
}

// Build and start services in development mode
console.log('🔨 Building and starting services...');
try {
    execSync('docker-compose up --build --remove-orphans', {
        stdio: 'inherit',
        cwd: __dirname
    });
} catch (error) {
    console.error('❌ Failed to start development environment:', error.message);
    process.exit(1);
}

console.log('🎉 Development environment is running!');
console.log('📱 Storefront: http://localhost');
console.log('🏪 Vendor Panel: http://localhost/vendor/');
console.log('🔧 API: http://localhost/api/');
console.log('🔧 Direct backend: http://localhost:3001');
console.log('📊 Elasticsearch: http://localhost:9201');
console.log('🗄️ PostgreSQL: localhost:5434');
console.log('💾 Redis: localhost:6381');