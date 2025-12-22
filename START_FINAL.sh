#!/bin/bash

echo "🚀 HS Code AI Search - FINAL START"
echo "===================================="
echo ""

# Kill all node processes on our ports
echo "1️⃣ Cleaning up..."
lsof -ti:5001 2>/dev/null | xargs -r kill -9 2>/dev/null
lsof -ti:3025 2>/dev/null | xargs -r kill -9 2>/dev/null
sleep 2

# Verify ports are free
echo "2️⃣ Checking ports..."
if lsof -i:5001 >/dev/null 2>&1; then
    echo "   ❌ Port 5001 still busy!"
    echo "   Run: lsof -ti:5001 | xargs kill -9"
    exit 1
fi

if lsof -i:3025 >/dev/null 2>&1; then
    echo "   ❌ Port 3025 still busy!"
    echo "   Run: lsof -ti:3025 | xargs kill -9"
    exit 1
fi

echo "   ✅ Ports are free!"
echo ""

# Start application
echo "3️⃣ Starting servers..."
echo ""
echo "   Backend will start on: http://localhost:5001"
echo "   Frontend will start on: http://localhost:3025"
echo ""
echo "   Once you see 'Compiled successfully!', open:"
echo "   👉 http://localhost:3025"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
