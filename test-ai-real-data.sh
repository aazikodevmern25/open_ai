#!/bin/bash

echo "Testing AI with real database data..."
echo "======================================"
echo ""

# Get real data from database
echo "1. Fetching real data from database..."
REAL_DATA=$(curl -s 'http://localhost:5001/api/hscode/search/482290?country=Bangladesh' | jq '.data')

# Test AI with real data
echo "2. Sending to AI for analysis..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:5001/api/hscode/ask \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"Give me key points about this export data for Bangladesh\",\"data\":$REAL_DATA}")

echo "AI Response:"
echo "============"
echo "$RESPONSE" | jq -r '.answer'
echo ""
echo "Token Usage:"
echo "$RESPONSE" | jq '.usage'
