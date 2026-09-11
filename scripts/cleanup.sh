#!/bin/bash
# ==============================================================================
# SDRS Cleanup Script (Bash)
# Deletes all AWS CloudFormation stacks created by SDRS in proper reverse dependency order.
# ==============================================================================

set -euo pipefail

PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
STACK_PREFIX="${STACK_PREFIX:-sdrs}"
FORCE="${FORCE:-false}"

# Parse command line flags
while [[ $# -gt 0 ]]; do
  case $1 in
    --primary-region)
      PRIMARY_REGION="$2"
      shift 2
      ;;
    --secondary-region)
      SECONDARY_REGION="$2"
      shift 2
      ;;
    --stack-prefix)
      STACK_PREFIX="$2"
      shift 2
      ;;
    --force)
      FORCE="true"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   SDRS — Multi-Region Teardown & Cleanup Script       ║"
echo "║   This will DELETE all SDRS AWS resources             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "Stacks to check and delete in reverse-dependency order:"
echo "  1. ${STACK_PREFIX}-secondary              (${SECONDARY_REGION})"
echo "  2. ${STACK_PREFIX}-primary                (${PRIMARY_REGION})"
echo "  3. ${STACK_PREFIX}-multiregion-orchestrator (${PRIMARY_REGION})"
echo "  4. ${STACK_PREFIX}-stack                  (${PRIMARY_REGION}, if single-region)"
echo ""

if [ "$FORCE" != "true" ]; then
    read -p "Are you sure you want to delete ALL SDRS resources? (yes/no) " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "❌ Cleanup cancelled."
        exit 0
    fi
fi

delete_stack_if_exists() {
    local stack_name="$1"
    local region="$2"
    
    local status
    status=$(aws cloudformation describe-stacks --stack-name "$stack_name" --region "$region" --query "Stacks[0].StackStatus" --output text 2>/dev/null || true)
    
    if [ -n "$status" ] && [ "$status" != "None" ]; then
        echo "🗑️  Deleting stack '$stack_name' in $region..."
        aws cloudformation delete-stack --stack-name "$stack_name" --region "$region"
        echo "⏳ Waiting for '$stack_name' deletion to complete..."
        aws cloudformation wait stack-delete-complete --stack-name "$stack_name" --region "$region"
        echo "✅ '$stack_name' deleted successfully."
    fi
}

echo ""
# 1. Delete Secondary Regional Stack (us-west-2)
delete_stack_if_exists "${STACK_PREFIX}-secondary" "${SECONDARY_REGION}"

# 2. Delete Primary Regional Stack (us-east-1)
delete_stack_if_exists "${STACK_PREFIX}-primary" "${PRIMARY_REGION}"

# 3. Delete Multi-Region Storage Orchestrator (us-east-1)
delete_stack_if_exists "${STACK_PREFIX}-multiregion-orchestrator" "${PRIMARY_REGION}"

# 4. Delete Single-Region Stack if deployed (us-east-1)
delete_stack_if_exists "${STACK_PREFIX}-stack" "${PRIMARY_REGION}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ SDRS teardown complete!"
echo "   All stacks, tables, Cognito pools, and queues have"
echo "   been removed. Zero continuing cloud costs."
echo "═══════════════════════════════════════════════════════"

