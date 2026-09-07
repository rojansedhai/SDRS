#!/usr/bin/env bash
# ==============================================================================
# SDRS Phase 2 — Multi-Region Automated Deployment Script (Bash)
# ==============================================================================

set -euo pipefail

PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
STACK_PREFIX="${STACK_PREFIX:-sdrs}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
DOMAIN_NAME="${DOMAIN_NAME:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

echo "======================================================="
echo "   SDRS Phase 2 -- Multi-Region Deployment Initiator   "
echo "======================================================="
echo "Primary Region:   ${PRIMARY_REGION}"
echo "Secondary Region: ${SECONDARY_REGION}"
echo ""

# 1. Build Backend
echo "[Step 1/4] Building Backend SAM Artifacts..."
cd "${BACKEND_DIR}"
sam build

# 2. Deploy Primary Stack
echo "[Step 2/4] Deploying Primary Stack in ${PRIMARY_REGION}..."
sam deploy \
  --stack-name "${STACK_PREFIX}-primary" \
  --region "${PRIMARY_REGION}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "PrimaryRegion=${PRIMARY_REGION} SecondaryRegion=${SECONDARY_REGION} DeploymentRegionRole=primary" \
  --no-confirm-changeset \
  --resolve-s3

# 3. Deploy Secondary Stack
echo "[Step 3/4] Deploying Secondary Stack in ${SECONDARY_REGION}..."
sam deploy \
  --stack-name "${STACK_PREFIX}-secondary" \
  --region "${SECONDARY_REGION}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "PrimaryRegion=${PRIMARY_REGION} SecondaryRegion=${SECONDARY_REGION} DeploymentRegionRole=secondary" \
  --no-confirm-changeset \
  --resolve-s3

# 4. Multi-Region Orchestrator
echo "[Step 4/4] Deploying Multi-Region Orchestrator..."
sam deploy \
  --template-file template-multiregion.yaml \
  --stack-name "${STACK_PREFIX}-multiregion-orchestrator" \
  --region "${PRIMARY_REGION}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "PrimaryRegion=${PRIMARY_REGION} SecondaryRegion=${SECONDARY_REGION} HostedZoneId=${HOSTED_ZONE_ID} DomainName=${DOMAIN_NAME}" \
  --no-confirm-changeset \
  --resolve-s3

echo "======================================================="
echo "Multi-Region Deployment Complete!"
echo "======================================================="

