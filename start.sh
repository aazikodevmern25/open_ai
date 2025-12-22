#!/bin/bash

echo "🚀 Starting HS Code AI Search Application..."
echo ""

# Kill any existing processes on ports 5001 and 3001
echo "🧹 Cleaning up ports..."
lsof -ti:5001 | xargs -r kill -9 2>/dev/null
lsof -ti:3001 | xargs -r kill -9 2>/dev/null
sleep 1

echo "✅ Ports cleared!"
echo ""

# Start the application
echo "🎯 Starting backend and frontend..."
echo ""
npm run dev
