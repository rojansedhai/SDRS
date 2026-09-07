#!/bin/bash
# SDRS Local Testing Script
# Runs the frontend in demo mode for local development.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   SDRS — Local Development                           ║"
echo "║   Running in Demo Mode (no AWS required)             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Install dependencies
cd "$PROJECT_ROOT/frontend"

if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
fi

# Ensure demo mode
export VITE_DEMO_MODE=true

echo ""
echo "🚀 Starting development server..."
echo "   Demo mode: ON (simulated AWS services)"
echo "   URL: http://localhost:3000"
echo ""
npm run dev

