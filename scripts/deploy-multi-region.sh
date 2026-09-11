#!/usr/bin/env bash
# ==============================================================================
# SDRS Phase 2 — Multi-Region Automated Deployment Script (Bash)
# Deploys Authoritative Global Tables, Primary Region Stack, and Secondary Region Stack
# ==============================================================================

set -euo pipefail

PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
STACK_PREFIX="${STACK_PREFIX:-sdrs}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
PRIMARY_CERT_ARN="${PRIMARY_CERT_ARN:-}"
SECONDARY_CERT_ARN="${SECONDARY_CERT_ARN:-}"

# Parse flags
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
    --domain-name)
      DOMAIN_NAME="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

echo "======================================================="
echo "   SDRS Phase 2 -- Multi-Region Deployment Initiator   "
echo "======================================================="
echo "Primary Region:   ${PRIMARY_REGION}"
echo "Secondary Region: ${SECONDARY_REGION}"
echo ""

# 1. Build Backend SAM Artifacts
echo "[Step 1/4] Building Backend SAM Artifacts..."
cd "${BACKEND_DIR}"
sam build

# 2. Deploy Authoritative Storage Orchestrator (DynamoDB Global Tables + Cognito)
echo "[Step 2/4] Deploying Authoritative Global Tables & Cognito (${STACK_PREFIX}-multiregion-orchestrator)..."
sam deploy \
  --template-file template-multiregion.yaml \
  --stack-name "${STACK_PREFIX}-multiregion-orchestrator" \
  --region "${PRIMARY_REGION}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "PrimaryRegion=${PRIMARY_REGION} SecondaryRegion=${SECONDARY_REGION} HostedZoneId=${HOSTED_ZONE_ID} DomainName=${DOMAIN_NAME}" \
  --no-confirm-changeset \
  --resolve-s3

# Extract Authoritative Cognito Outputs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-multiregion-orchestrator" --region "${PRIMARY_REGION}" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text 2>/dev/null || true)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-multiregion-orchestrator" --region "${PRIMARY_REGION}" --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text 2>/dev/null || true)
USER_POOL_ISSUER_URL=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-multiregion-orchestrator" --region "${PRIMARY_REGION}" --query "Stacks[0].Outputs[?OutputKey=='UserPoolIssuerUrl'].OutputValue" --output text 2>/dev/null || true)

echo "Authoritative Cognito User Pool ID:     ${USER_POOL_ID}"
echo "Authoritative Cognito Client ID:       ${USER_POOL_CLIENT_ID}"
echo "Authoritative Cognito Issuer URL:      ${USER_POOL_ISSUER_URL}"

COGNITO_PARAMS="CognitoUserPoolId=${USER_POOL_ID} CognitoUserPoolClientId=${USER_POOL_CLIENT_ID} CognitoUserPoolIssuerUrl=${USER_POOL_ISSUER_URL}"

# 3. Deploy Primary Regional Stack
echo "[Step 3/4] Deploying Primary Regional Stack in ${PRIMARY_REGION}..."
sam deploy \
  --stack-name "${STACK_PREFIX}-primary" \
  --region "${PRIMARY_REGION}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "PrimaryRegion=${PRIMARY_REGION} SecondaryRegion=${SECONDARY_REGION} DeploymentRegionRole=primary UseGlobalTables=true ${COGNITO_PARAMS}" \
  --no-confirm-changeset \
  --resolve-s3

PRIMARY_API_URL=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-primary" --region "${PRIMARY_REGION}" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>/dev/null || true)
echo "Primary API Gateway URL: ${PRIMARY_API_URL}"

# 4. Deploy Secondary Regional Stack
echo "[Step 4/4] Deploying Secondary Regional Stack in ${SECONDARY_REGION}..."
sam deploy \
  --stack-name "${STACK_PREFIX}-secondary" \
  --region "${SECONDARY_REGION}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "PrimaryRegion=${PRIMARY_REGION} SecondaryRegion=${SECONDARY_REGION} DeploymentRegionRole=secondary UseGlobalTables=true ${COGNITO_PARAMS}" \
  --no-confirm-changeset \
  --resolve-s3

SECONDARY_API_URL=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-secondary" --region "${SECONDARY_REGION}" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>/dev/null || true)
echo "Secondary API Gateway URL: ${SECONDARY_API_URL}"

echo "======================================================="
echo "Multi-Region Deployment Complete!"
echo "Primary API:   ${PRIMARY_API_URL}"
echo "Secondary API: ${SECONDARY_API_URL}"
echo "======================================================="

