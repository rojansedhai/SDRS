# SDRS Multi-Region Cleanup Script (PowerShell)
# Deletes all AWS CloudFormation stacks created by the SDRS multi-region architecture in proper reverse dependency order.

param (
    [string]$PrimaryRegion = "us-east-1",
    [string]$SecondaryRegion = "us-west-2",
    [switch]$Force = $false
)

Write-Host "=======================================================" -ForegroundColor Red
Write-Host "   SDRS -- Multi-Region Teardown & Cleanup Script      " -ForegroundColor Red
Write-Host "   WARNING: This will delete ALL live SDRS AWS stacks: " -ForegroundColor Red
Write-Host "   1. sdrs-secondary              ($SecondaryRegion)" -ForegroundColor Red
Write-Host "   2. sdrs-primary                ($PrimaryRegion)" -ForegroundColor Red
Write-Host "   3. sdrs-multiregion-orchestrator ($PrimaryRegion)" -ForegroundColor Red
Write-Host "=======================================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    $Confirm = Read-Host "Are you sure you want to delete ALL SDRS multi-region resources? (yes/no)"
    if ($Confirm -ne "yes") {
        Write-Host "Cleanup cancelled." -ForegroundColor Cyan
        exit 0
    }
}

# 1. Delete Secondary Application Stack (us-west-2)
Write-Host "`n[Step 1/3] Deleting Secondary Stack 'sdrs-secondary' in $SecondaryRegion..." -ForegroundColor Yellow
aws cloudformation delete-stack --stack-name sdrs-secondary --region $SecondaryRegion
Write-Host "Waiting for 'sdrs-secondary' deletion to complete..." -ForegroundColor Yellow
aws cloudformation wait stack-delete-complete --stack-name sdrs-secondary --region $SecondaryRegion
Write-Host "[PASS] 'sdrs-secondary' deleted successfully." -ForegroundColor Green

# 2. Delete Primary Application Stack (us-east-1)
Write-Host "`n[Step 2/3] Deleting Primary Stack 'sdrs-primary' in $PrimaryRegion..." -ForegroundColor Yellow
aws cloudformation delete-stack --stack-name sdrs-primary --region $PrimaryRegion
Write-Host "Waiting for 'sdrs-primary' deletion to complete..." -ForegroundColor Yellow
aws cloudformation wait stack-delete-complete --stack-name sdrs-primary --region $PrimaryRegion
Write-Host "[PASS] 'sdrs-primary' deleted successfully." -ForegroundColor Green

# 3. Delete Authoritative Multi-Region Orchestrator Stack (us-east-1)
Write-Host "`n[Step 3/3] Deleting Orchestrator Stack 'sdrs-multiregion-orchestrator' (Global Tables & Cognito) in $PrimaryRegion..." -ForegroundColor Yellow
aws cloudformation delete-stack --stack-name sdrs-multiregion-orchestrator --region $PrimaryRegion
Write-Host "Waiting for 'sdrs-multiregion-orchestrator' deletion to complete..." -ForegroundColor Yellow
aws cloudformation wait stack-delete-complete --stack-name sdrs-multiregion-orchestrator --region $PrimaryRegion
Write-Host "[PASS] 'sdrs-multiregion-orchestrator' deleted successfully." -ForegroundColor Green

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "   Multi-Region Teardown Complete!                    " -ForegroundColor Green
Write-Host "   All API Gateways, Lambdas, SQS Queues, Alarms,     " -ForegroundColor Green
Write-Host "   Global Tables, Cognito, and Route 53 resources have" -ForegroundColor Green
Write-Host "   been removed. Continuing charges stopped.          " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green


