#!/bin/bash

echo "🧪 Testing HS Code AI Search Application..."
echo ""

# Test Backend
echo "1️⃣ Testing Backend (Port 5001)..."
echo "   Testing root endpoint:"
curl -s http://localhost:5001/ | jq '.' 2>/dev/null || curl -s http://localhost:5001/
echo ""

echo "   Testing health endpoint:"
curl -s http://localhost:5001/health | jq '.' 2>/dev/null || curl -s http://localhost:5001/health
echo ""
echo ""

# Test Frontend
echo "2️⃣ Testing Frontend (Port 3001)..."
echo "   Checking if frontend is running:"
curl -s -o /dev/null -w "   Status: %{http_code}\n" http://localhost:3001/
echo ""

# Test API through proxy
echo "3️⃣ Testing API through Frontend Proxy..."
echo "   Testing search endpoint (should return 404 for invalid HS code):"
curl -s http://localhost:3001/api/hscode/search/999999 | jq '.' 2>/dev/null || curl -s http://localhost:3001/api/hscode/search/999999
echo ""
echo ""

echo "✅ Test Complete!"
echo ""
echo "If you see JSON responses above, the backend is working!"
echo "If you see Status: 200 for frontend, React app is running!"
