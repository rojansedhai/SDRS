#!/bin/bash
# SDRS Cleanup Script
# Removes all AWS resources created by the SDRS deployment.
set -euo pipefail

STACK_NAME="${STACK_NAME:-sdrs-stack}"
REGION="${AWS_REGION:-us-east-1}"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   SDRS — Cleanup Script                              ║"
echo "║   This will DELETE all SDRS AWS resources             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "⚠️  Stack:  $STACK_NAME"
echo "   Region: $REGION"
echo ""
echo "This will delete:"
echo "  - API Gateway"
echo "  - Lambda functions"
echo "  - SQS queues"
echo "  - EventBridge event bus & rules"
echo "  - DynamoDB tables (ALL DATA WILL BE LOST)"
echo "  - IAM roles"
echo "  - CloudWatch log groups"
echo ""

read -p "Are you sure you want to delete ALL SDRS resources? (yes/no) " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo ""
echo "🗑️  Deleting CloudFormation stack: $STACK_NAME..."
aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

echo "⏳ Waiting for stack deletion to complete..."
aws cloudformation wait stack-delete-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

echo ""
echo "🧹 Cleaning up S3 deployment bucket..."
# Find and empty the SAM deployment bucket
SAM_BUCKET=$(aws cloudformation list-stack-resources \
    --stack-name "aws-sam-cli-managed-default" \
    --region "$REGION" \
    --query "StackResourceSummaries[?LogicalResourceId=='SamCliSourceBucket'].PhysicalResourceId" \
    --output text 2>/dev/null || true)

if [ -n "$SAM_BUCKET" ] && [ "$SAM_BUCKET" != "None" ]; then
    echo "   SAM bucket: $SAM_BUCKET"
    echo "   (Keeping bucket — it's shared across SAM deployments)"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ SDRS resources deleted successfully!"
echo ""
echo "   All Lambda functions, DynamoDB tables, SQS queues,"
echo "   and other resources have been removed."
echo "═══════════════════════════════════════════════════════"

