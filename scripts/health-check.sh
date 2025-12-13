#!/bin/bash

echo "Checking BazaarHub Services..."

check_service() {
    url=$1
    name=$2
    code=$(curl -s -o /dev/null -w "%{http_code}" $url)
    if [ "$code" == "200" ] || [ "$code" == "307" ] || [ "$code" == "308" ]; then
        echo "✅ $name is UP ($url) - Status: $code"
    else
        echo "❌ $name is DOWN ($url) - Status: $code"
    fi
}

check_service "http://localhost:3001" "Storefront"
check_service "http://localhost:3002" "Vendor Panel"
check_service "http://localhost:3003" "Admin Panel"
check_service "http://localhost:5004/health" "Backend API"
check_service "http://localhost:80" "Nginx Gateway"
