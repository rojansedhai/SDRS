# ==============================================================================
# SDRS Multi-Region Automated Deployment Script (PowerShell)
# Deploys Authoritative Global Tables, Primary Region Stack, and Secondary Region Stack
# ==============================================================================

param (
    [string]$PrimaryRegion = "us-east-1",
    [string]$SecondaryRegion = "us-west-2",
    [string]$StackNamePrefix = "sdrs",
    [string]$HostedZoneId = "",
    [string]$DomainName = "",
    [string]$PrimaryCertificateArn = "",
    [string]$SecondaryCertificateArn = ""
)

$ErrorActionPreference = "Stop"

function Clean-FailedStack {
    param(
        [string]$Stack,
        [string]$Reg
    )
    $Status = aws cloudformation list-stacks --region $Reg --stack-status-filter ROLLBACK_COMPLETE --query "StackSummaries[?StackName=='$Stack'].StackStatus" --output text
    if ($Status -and $Status.Trim() -eq "ROLLBACK_COMPLETE") {
        Write-Host "Prior failed stack '$Stack' in $Reg is in ROLLBACK_COMPLETE. Deleting before re-deployment..." -ForegroundColor Yellow
        aws cloudformation delete-stack --stack-name $Stack --region $Reg
        aws cloudformation wait stack-delete-complete --stack-name $Stack --region $Reg
        Write-Host "Prior failed stack '$Stack' deleted." -ForegroundColor Green
    }
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   SDRS -- Multi-Region Deployment Initiator           " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Primary Region:   $PrimaryRegion" -ForegroundColor Yellow
Write-Host "Secondary Region: $SecondaryRegion" -ForegroundColor Yellow
Write-Host ""

# 1. Build Backend SAM Artifacts
Write-Host "[Step 1/4] Building Backend SAM Artifacts..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\..\backend"
sam build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] SAM build failed." -ForegroundColor Red
    exit 1
}

# 2. Deploy Authoritative Storage Orchestrator (DynamoDB Global Tables + Cognito)
Write-Host "[Step 2/4] Deploying Authoritative Global Tables & Cognito (sdrs-*-global)..." -ForegroundColor Green
Clean-FailedStack -Stack "$StackNamePrefix-multiregion-orchestrator" -Reg $PrimaryRegion
sam deploy `
    --template-file template-multiregion.yaml `
    --stack-name "$StackNamePrefix-multiregion-orchestrator" `
    --region $PrimaryRegion `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides "PrimaryRegion=$PrimaryRegion SecondaryRegion=$SecondaryRegion HostedZoneId=$HostedZoneId DomainName=$DomainName" `
    --no-confirm-changeset `
    --resolve-s3

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to deploy $StackNamePrefix-multiregion-orchestrator. Halting deployment." -ForegroundColor Red
    exit 1
}

$UserPoolId = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-multiregion-orchestrator" --region $PrimaryRegion --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text 2>$null)
$UserPoolClientId = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-multiregion-orchestrator" --region $PrimaryRegion --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text 2>$null)
$UserPoolIssuerUrl = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-multiregion-orchestrator" --region $PrimaryRegion --query "Stacks[0].Outputs[?OutputKey=='UserPoolIssuerUrl'].OutputValue" --output text 2>$null)

Write-Host "Authoritative Cognito User Pool ID:     $UserPoolId" -ForegroundColor Green
Write-Host "Authoritative Cognito Client ID:       $UserPoolClientId" -ForegroundColor Green
Write-Host "Authoritative Cognito Issuer URL:      $UserPoolIssuerUrl" -ForegroundColor Green

$CognitoParams = "CognitoUserPoolId=$UserPoolId CognitoUserPoolClientId=$UserPoolClientId CognitoUserPoolIssuerUrl=$UserPoolIssuerUrl"

# 3. Deploy Primary Regional Stack (referencing Global Tables + Cognito)
Write-Host "[Step 3/4] Deploying Primary Regional Stack in $PrimaryRegion..." -ForegroundColor Green
$PrimaryDomainParam = if ($DomainName -and $PrimaryCertificateArn) { "DomainName=$DomainName CertificateArn=$PrimaryCertificateArn" } else { "" }
Clean-FailedStack -Stack "$StackNamePrefix-primary" -Reg $PrimaryRegion
sam deploy `
    --stack-name "$StackNamePrefix-primary" `
    --region $PrimaryRegion `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides "PrimaryRegion=$PrimaryRegion SecondaryRegion=$SecondaryRegion DeploymentRegionRole=primary UseGlobalTables=true $CognitoParams $PrimaryDomainParam" `
    --no-confirm-changeset `
    --resolve-s3

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to deploy $StackNamePrefix-primary. Halting deployment." -ForegroundColor Red
    exit 1
}

$PrimaryApiUrl = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-primary" --region $PrimaryRegion --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>$null)
$PrimaryApiId = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-primary" --region $PrimaryRegion --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>$null | ForEach-Object { ($_ -split "//|/")[1] -split "\." | Select-Object -First 1 })
Write-Host "Primary API URL: $PrimaryApiUrl" -ForegroundColor Green

# 4. Deploy Secondary Regional Stack (referencing Global Tables + Cognito)
Write-Host "[Step 4/4] Deploying Secondary Regional Stack in $SecondaryRegion..." -ForegroundColor Green
$SecondaryDomainParam = if ($DomainName -and $SecondaryCertificateArn) { "DomainName=$DomainName CertificateArn=$SecondaryCertificateArn" } else { "" }
Clean-FailedStack -Stack "$StackNamePrefix-secondary" -Reg $SecondaryRegion
sam deploy `
    --stack-name "$StackNamePrefix-secondary" `
    --region $SecondaryRegion `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides "PrimaryRegion=$PrimaryRegion SecondaryRegion=$SecondaryRegion DeploymentRegionRole=secondary UseGlobalTables=true $CognitoParams $SecondaryDomainParam" `
    --no-confirm-changeset `
    --resolve-s3

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to deploy $StackNamePrefix-secondary. Halting deployment." -ForegroundColor Red
    exit 1
}

$SecondaryApiUrl = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-secondary" --region $SecondaryRegion --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>$null)
Write-Host "Secondary API URL: $SecondaryApiUrl" -ForegroundColor Green

# 5. Link Route 53 Health Checks and Failover DNS Records
$PrimaryDomainNameOutput = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-primary" --region $PrimaryRegion --query "Stacks[0].Outputs[?OutputKey=='RegionalDomainName'].OutputValue" --output text 2>$null)
$PrimaryHostedZoneIdOutput = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-primary" --region $PrimaryRegion --query "Stacks[0].Outputs[?OutputKey=='RegionalHostedZoneId'].OutputValue" --output text 2>$null)
$SecondaryDomainNameOutput = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-secondary" --region $SecondaryRegion --query "Stacks[0].Outputs[?OutputKey=='RegionalDomainName'].OutputValue" --output text 2>$null)
$SecondaryHostedZoneIdOutput = (aws cloudformation describe-stacks --stack-name "$StackNamePrefix-secondary" --region $SecondaryRegion --query "Stacks[0].Outputs[?OutputKey=='RegionalHostedZoneId'].OutputValue" --output text 2>$null)

$DnsOverrides = "PrimaryRegion=$PrimaryRegion SecondaryRegion=$SecondaryRegion"
if ($PrimaryApiId -and $PrimaryApiId -ne "None") {
    $DnsOverrides += " PrimaryApiId=$PrimaryApiId"
}
if ($HostedZoneId) {
    $DnsOverrides += " HostedZoneId=$HostedZoneId"
}
if ($DomainName) {
    $DnsOverrides += " DomainName=$DomainName"
}
if ($PrimaryDomainNameOutput -and $PrimaryDomainNameOutput -ne "None") {
    $DnsOverrides += " PrimaryRegionalDomainName=$PrimaryDomainNameOutput PrimaryRegionalHostedZoneId=$PrimaryHostedZoneIdOutput"
}
if ($SecondaryDomainNameOutput -and $SecondaryDomainNameOutput -ne "None") {
    $DnsOverrides += " SecondaryRegionalDomainName=$SecondaryDomainNameOutput SecondaryRegionalHostedZoneId=$SecondaryHostedZoneIdOutput"
}

if (($PrimaryApiId -and $PrimaryApiId -ne "None") -or $HostedZoneId) {
    Write-Host "`nUpdating Route 53 Orchestrator with API IDs & Regional DNS endpoints..." -ForegroundColor Yellow
    sam deploy `
        --template-file template-multiregion.yaml `
        --stack-name "$StackNamePrefix-multiregion-orchestrator" `
        --region $PrimaryRegion `
        --capabilities CAPABILITY_IAM `
        --parameter-overrides $DnsOverrides `
        --no-confirm-changeset `
        --resolve-s3
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Multi-Region Deployment Complete!" -ForegroundColor Green
Write-Host "Orchestrator:    $StackNamePrefix-multiregion-orchestrator (Global Tables + Cognito in sync)"
Write-Host "Primary Stack:   $StackNamePrefix-primary ($PrimaryRegion)"
Write-Host "Secondary Stack: $StackNamePrefix-secondary ($SecondaryRegion)"
Write-Host "=======================================================" -ForegroundColor Cyan
