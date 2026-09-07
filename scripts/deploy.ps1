# SDRS Deployment Script (PowerShell)
# Deploys the AWS SAM backend and optionally builds the frontend.

param (
    [string]$StackName = "sdrs-stack",
    [string]$Region = "us-east-1"
)

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   SDRS -- Serverless Disaster Recovery Simulator      " -ForegroundColor Cyan
Write-Host "   AWS Deployment Script                               " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

# Check SAM CLI
if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    Write-Error "AWS SAM CLI is not installed. Please install SAM CLI to deploy the stack."
    exit 1
}

# Check AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Error "AWS CLI is not installed. Please install AWS CLI and run 'aws configure'."
    exit 1
}

Write-Host "Verifying AWS credentials..." -ForegroundColor Yellow
$CallerIdentity = aws sts get-caller-identity --output json 2>$null | ConvertFrom-Json
if (-not $CallerIdentity) {
    Write-Error "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
}

Write-Host "AWS Account: $($CallerIdentity.Account)" -ForegroundColor Green
Write-Host "Deploy Region: $Region" -ForegroundColor Green
Write-Host "Stack Name: $StackName" -ForegroundColor Green
Write-Host ""

# Build SAM backend
Write-Host "Building SAM backend application..." -ForegroundColor Yellow
Set-Location $BackendDir
sam build
if ($LASTEXITCODE -ne 0) {
    Write-Error "SAM build failed. Please fix build errors before deploying."
    exit 1
}

# Deploy SAM backend
Write-Host "`nDeploying CloudFormation stack via SAM..." -ForegroundColor Yellow
sam deploy `
    --stack-name $StackName `
    --region $Region `
    --resolve-s3 `
    --capabilities CAPABILITY_IAM `
    --no-confirm-changeset `
    --no-fail-on-empty-changeset

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n=======================================================" -ForegroundColor Red
    Write-Host "SAM deployment failed with exit code $LASTEXITCODE." -ForegroundColor Red
    Write-Host "Check the AWS IAM permissions for your active credentials." -ForegroundColor Yellow
    Write-Host "=======================================================" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Retrieve outputs
$ApiUrl = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
    --output text 2>$null

if ([string]::IsNullOrWhiteSpace($ApiUrl) -or $ApiUrl -eq "None") {
    Write-Host "`n[WARNING] Could not retrieve ApiUrl from stack outputs." -ForegroundColor Yellow
    Write-Host "Verify the stack in AWS CloudFormation console: https://$Region.console.aws.amazon.com/cloudformation" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "Backend deployment completed successfully!" -ForegroundColor Green
Write-Host "API Gateway URL: $ApiUrl" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Stack: $StackName" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Green

Write-Host "`nTo point your frontend to this backend, set frontend/.env:" -ForegroundColor Yellow
Write-Host "VITE_DEMO_MODE=false"
Write-Host "VITE_API_URL=$ApiUrl"

