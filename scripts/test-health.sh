#!/bin/bash

echo "Checking service health..."

# Backend
if curl -s http://localhost:5004/health > /dev/null; then
    echo "✅ Backend is UP"
else
    echo "❌ Backend is DOWN"
fi

# Storefront
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Storefront is UP"
else
    echo "❌ Storefront is DOWN"
fi

# Vendor Panel
if curl -s http://localhost:3002 > /dev/null; then
    echo "✅ Vendor Panel is UP"
else
    echo "❌ Vendor Panel is DOWN"
fi

# Admin Panel
if curl -s http://localhost:3003 > /dev/null; then
    echo "✅ Admin Panel is UP"
else
    echo "❌ Admin Panel is DOWN"
fi

# Elasticsearch
if curl -s http://localhost:9200 > /dev/null; then
    echo "✅ Elasticsearch is UP"
else
    echo "❌ Elasticsearch is DOWN"
fi

echo "Health check complete."
