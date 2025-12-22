#!/bin/bash

echo "🔄 Complete Restart - HS Code AI Search"
echo "========================================"
echo ""

# Step 1: Kill all processes
echo "1️⃣ Stopping all processes..."
lsof -ti:5001 | xargs -r kill -9 2>/dev/null
lsof -ti:3001 | xargs -r kill -9 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
pkill -f "concurrently" 2>/dev/null
sleep 2
echo "   ✅ All processes stopped"
echo ""

# Step 2: Verify ports are free
echo "2️⃣ Verifying ports are free..."
if lsof -ti:5001 >/dev/null 2>&1; then
    echo "   ❌ Port 5001 still in use!"
    exit 1
fi
if lsof -ti:3001 >/dev/null 2>&1; then
    echo "   ❌ Port 3001 still in use!"
    exit 1
fi
echo "   ✅ Ports 5001 and 3001 are free"
echo ""

# Step 3: Start the application
echo "3️⃣ Starting application..."
echo ""
npm run dev
