#!/bin/bash
# SDRS Deployment Script
# Deploys the AWS SAM backend and optionally builds the frontend.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STACK_NAME="${STACK_NAME:-sdrs-stack}"
REGION="${AWS_REGION:-us-east-1}"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   SDRS — Serverless Disaster Recovery Simulator      ║"
echo "║   Deployment Script                                   ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI is not installed."
    echo "   Install it: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed."
    echo "   Install it: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    exit 1
fi

echo "✅ Prerequisites met"
echo ""

# Check AWS credentials
echo "🔐 Verifying AWS credentials..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi
echo "✅ AWS Account: $AWS_ACCOUNT_ID"
echo "   Region: $REGION"
echo ""

# Build and deploy backend
echo "🏗️  Building SAM application..."
cd "$PROJECT_ROOT/backend"
sam build --use-container 2>/dev/null || sam build

echo ""
echo "🚀 Deploying SAM stack: $STACK_NAME to $REGION..."
sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --resolve-s3 \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

echo ""
echo "📋 Retrieving stack outputs..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text)

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Backend deployed successfully!"
echo ""
echo "   API URL:    $API_URL"
echo "   Stack:      $STACK_NAME"
echo "   Region:     $REGION"
echo ""
echo "   To connect the frontend, update frontend/.env:"
echo "   VITE_DEMO_MODE=false"
echo "   VITE_API_URL=$API_URL"
echo "═══════════════════════════════════════════════════════"

# Optionally build frontend
read -p "Build frontend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📦 Installing frontend dependencies..."
    cd "$PROJECT_ROOT/frontend"
    npm install

    echo ""
    echo "🔨 Building frontend..."
    npm run build

    echo ""
    echo "✅ Frontend built to frontend/dist/"
    echo "   Serve it with: npx serve frontend/dist"
fi

