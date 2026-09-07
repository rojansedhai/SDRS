# SDRS Local Testing Script (PowerShell)
# Runs the frontend in demo mode for local development.

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   SDRS -- Serverless Disaster Recovery Simulator      " -ForegroundColor Cyan
Write-Host "   Running in Demo Mode (No AWS deployment required)   " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "frontend"

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not in PATH."
    exit 1
}

$NodeVersion = node --version
Write-Host "Node.js version: $NodeVersion" -ForegroundColor Green

Set-Location $FrontendDir

if (-not (Test-Path "node_modules")) {
    Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Yellow
    npm install
}

$env:VITE_DEMO_MODE = "true"

Write-Host "`nStarting Vite dev server..." -ForegroundColor Green
Write-Host "Demo mode: ACTIVE (all AWS serverless behaviors simulated)" -ForegroundColor Cyan
Write-Host "Opening http://localhost:3000`n" -ForegroundColor Cyan

npm run dev

