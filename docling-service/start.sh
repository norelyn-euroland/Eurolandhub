#!/bin/bash

# Quick start script for Docling service

echo "🚀 Starting Docling Document Parsing Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check if Docling is installed
python3 -c "import docling" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Docling may not be installed correctly"
    echo "   Run: pip install docling"
fi

# Start the service
echo "✅ Starting service on http://localhost:8000"
echo "   Health check: http://localhost:8000/health"
echo ""
python main.py


