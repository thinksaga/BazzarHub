#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting BazaarHub development environment...');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env file not found. Please create .env file first.');
    process.exit(1);
}

// Start backend services with Docker
console.log('🐳 Starting backend services (PostgreSQL, Redis, Elasticsearch, API)...');
try {
    execSync('docker-compose up -d postgres redis elasticsearch backend', {
        stdio: 'inherit',
        cwd: __dirname
    });
} catch (error) {
    console.error('❌ Failed to start backend services:', error.message);
    process.exit(1);
}

// Wait for backend to be healthy
console.log('⏳ Waiting for backend services to be ready...');
const waitForServices = () => {
    return new Promise((resolve, reject) => {
        const checkHealth = () => {
            try {
                execSync('curl -f http://localhost:5004/health', { stdio: 'pipe' });
                console.log('✅ Backend API is healthy');
                resolve();
            } catch (error) {
                setTimeout(checkHealth, 2000);
            }
        };
        checkHealth();
    });
};

waitForServices().then(() => {
    console.log('🎉 All backend services are ready!');
    
    // Display service URLs
    console.log('\n📋 Service URLs:');
    console.log('  🔗 Backend API: http://localhost:5004');
    console.log('  🔗 Storefront:  http://localhost:5001');
    console.log('  🔗 Vendor Panel: http://localhost:5002');
    console.log('  🔗 Admin Panel: http://localhost:5003');
    console.log('  🔗 API Docs:    http://localhost:5004/docs');
    
    // Start frontend applications
    console.log('\n🖥️  Starting frontend applications...');
    
    const frontends = [
        { name: 'storefront', port: 5001, dir: 'storefront' },
        { name: 'vendor-panel', port: 5002, dir: 'vendor-panel' },
        { name: 'admin-panel', port: 5003, dir: 'admin-panel' }
    ];
    
    const processes = [];
    
    frontends.forEach(({ name, port, dir }) => {
        console.log(`   Starting ${name} on port ${port}...`);
        const proc = spawn('npm', ['run', 'dev'], {
            cwd: path.join(__dirname, dir),
            stdio: 'inherit',
            env: { ...process.env, PORT: port.toString() }
        });
        
        processes.push({ name, proc });
    });
    
    // Handle cleanup on exit
    const cleanup = () => {
        console.log('\n🧹 Shutting down services...');
        processes.forEach(({ name, proc }) => {
            console.log(`   Stopping ${name}...`);
            proc.kill();
        });
        
        console.log('   Stopping backend services...');
        try {
            execSync('docker-compose down', { stdio: 'pipe', cwd: __dirname });
        } catch (error) {
            console.error('Error stopping Docker services:', error.message);
        }
        
        console.log('✅ All services stopped. Goodbye!');
        process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    console.log('\n🎊 BazaarHub is now running!');
    console.log('   Press Ctrl+C to stop all services\n');
    
}).catch((error) => {
    console.error('❌ Failed to start services:', error.message);
    process.exit(1);
});
