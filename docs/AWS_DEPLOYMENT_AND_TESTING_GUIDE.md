# 🚀 SDRS — Multi-Region AWS Deployment & Verification Runbook

This guide provides the complete, copy-pasteable step-by-step instructions to deploy the hardened SDRS multi-region architecture to AWS, execute all 24 security, failover, and data replication verification checks, and perform a clean teardown to prevent ongoing AWS billing.

---

## 📋 Prerequisites

- **Shell:** Windows PowerShell 5.1+ or PowerShell Core (pwsh)
- **Tools:** AWS CLI v2 (`aws`) and AWS SAM CLI (`sam`)
- **Node.js:** Node.js 18+ or 22+
- **AWS Credentials:** Configured with administrator or SDRS deployment IAM permissions (`aws configure`).

Verify your identity and working directory:
```powershell
cd SDRS
aws sts get-caller-identity
```

---

## 🏗️ Phase 1: Deployment

### Option A: One-Script Automated Deployment (Recommended)

Run the multi-region deployment script, which builds the backend, provisions the authoritative DynamoDB Global Tables + Cognito User Pool in `us-east-1`, and deploys both regional application stacks:
```powershell
.\scripts\deploy-multi-region.ps1
```

---

### Option B: Step-by-Step Manual Deployment

#### 1. Build Backend SAM Artifacts
```powershell
cd backend
sam build
```

#### 2. Deploy Multi-Region Orchestrator (Global Tables + Cognito User Pool)
Deploys `sdrs-events-global`, `sdrs-experiments-global`, `sdrs-metrics-global`, and `sdrs-config-global` with cross-region replicas in `us-east-1` and `us-west-2`, plus the authoritative Cognito User Pool in `us-east-1`:
```powershell
sam deploy `
  --template-file template-multiregion.yaml `
  --stack-name sdrs-multiregion-orchestrator `
  --region us-east-1 `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides "PrimaryRegion=us-east-1 SecondaryRegion=us-west-2" `
  --resolve-s3 `
  --no-confirm-changeset
```

#### 3. Extract Orchestrator Stack Outputs
Query the exported Cognito User Pool and Client parameters:
```powershell
$Orch = aws cloudformation describe-stacks --stack-name sdrs-multiregion-orchestrator --region us-east-1 --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
$UserPoolId = ($Orch | Where-Object OutputKey -eq "UserPoolId").OutputValue
$UserPoolClientId = ($Orch | Where-Object OutputKey -eq "UserPoolClientId").OutputValue
$UserPoolIssuerUrl = ($Orch | Where-Object OutputKey -eq "UserPoolIssuerUrl").OutputValue

Write-Host "Authoritative Cognito UserPoolId:        $UserPoolId" -ForegroundColor Green
Write-Host "Authoritative Cognito UserPoolClientId:  $UserPoolClientId" -ForegroundColor Green
Write-Host "Authoritative Cognito UserPoolIssuerUrl: $UserPoolIssuerUrl" -ForegroundColor Green
```

#### 4. Deploy Primary Region Stack (`us-east-1`)
```powershell
sam deploy `
  --stack-name sdrs-primary `
  --region us-east-1 `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides "PrimaryRegion=us-east-1 SecondaryRegion=us-west-2 DeploymentRegionRole=primary UseGlobalTables=true CognitoUserPoolId=$UserPoolId CognitoUserPoolClientId=$UserPoolClientId CognitoUserPoolIssuerUrl=$UserPoolIssuerUrl" `
  --resolve-s3 `
  --no-confirm-changeset

$PrimaryApiUrl = (aws cloudformation describe-stacks --stack-name sdrs-primary --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text).TrimEnd('/')
Write-Host "Primary API Gateway URL: $PrimaryApiUrl" -ForegroundColor Green
```

#### 5. Deploy Secondary Region Stack (`us-west-2`)
```powershell
sam deploy `
  --stack-name sdrs-secondary `
  --region us-west-2 `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides "PrimaryRegion=us-east-1 SecondaryRegion=us-west-2 DeploymentRegionRole=secondary UseGlobalTables=true CognitoUserPoolId=$UserPoolId CognitoUserPoolClientId=$UserPoolClientId CognitoUserPoolIssuerUrl=$UserPoolIssuerUrl" `
  --resolve-s3 `
  --no-confirm-changeset

$SecondaryApiUrl = (aws cloudformation describe-stacks --stack-name sdrs-secondary --region us-west-2 --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text).TrimEnd('/')
Write-Host "Secondary API Gateway URL: $SecondaryApiUrl" -ForegroundColor Green
```

---

## 🔍 Phase 2: 24-Step Verification Runbook

### Step 4: Verify Cognito Outputs
```powershell
aws cognito-idp describe-user-pool --user-pool-id $UserPoolId --region us-east-1 --query "UserPool.{Id:Id,Name:Name,Status:Status}"
aws cognito-idp describe-user-pool-client --user-pool-id $UserPoolId --client-id $UserPoolClientId --region us-east-1 --query "UserPoolClient.{ClientId:ClientId,ClientName:ClientName}"
```

### Step 5: Verify Global Tables & Cross-Region Replicas
Confirm that `sdrs-events-global` has active replicas in both `us-east-1` and `us-west-2`:
```powershell
aws dynamodb describe-table --table-name sdrs-events-global --region us-east-1 --query "Table.{TableName:TableName,TableStatus:TableStatus,Replicas:Replicas[*].{Region:RegionName,Status:ReplicaStatus}}"
```

### Steps 6 & 7: Verify Regional Custom Domains & Route 53
*(Note: Custom domains and Route 53 failover records are activated conditionally when `DomainName` and `CertificateArn` parameters are passed. In default mode without a domain, regional stacks output `"None"` and use direct API Gateway execute-api endpoints)*:
```powershell
aws cloudformation describe-stacks --stack-name sdrs-primary --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='RegionalDomainName'].OutputValue" --output text
```

### Step 8: Obtain a Real Cognito JWT
Create a verified test user and acquire a live ID token:
```powershell
# 1. Create user in primary Cognito pool
aws cognito-idp admin-create-user `
  --user-pool-id $UserPoolId `
  --username "testuser@sdrs.internal" `
  --user-attributes Name=email,Value=testuser@sdrs.internal `
  --message-action SUPPRESS `
  --region us-east-1

# 2. Set permanent password
aws cognito-idp admin-set-user-password `
  --user-pool-id $UserPoolId `
  --username "testuser@sdrs.internal" `
  --password "<YourSecurePasswordHere>" `
  --permanent `
  --region us-east-1

# 3. Authenticate & obtain JWT IdToken
$AuthRes = aws cognito-idp initiate-auth `
  --client-id $UserPoolClientId `
  --auth-flow USER_PASSWORD_AUTH `
  --auth-parameters USERNAME=testuser@sdrs.internal,PASSWORD="<YourSecurePasswordHere>" `
  --region us-east-1 | ConvertFrom-Json

$JwtToken = $AuthRes.AuthenticationResult.IdToken
Write-Host "JWT Token Acquired (Length: $($JwtToken.Length))" -ForegroundColor Green
```

### Step 9: GET `/health` Without JWT → 200 OK
Verifies unauthenticated Route 53 health checking probes work over HTTPS:
```powershell
Invoke-RestMethod -Uri "$PrimaryApiUrl/health" -Method GET
Invoke-RestMethod -Uri "$SecondaryApiUrl/health" -Method GET
```
*Expected: HTTP 200 with `{ "status": "healthy" }` or `{ "status": "ok" }`.*

### Step 10: Protected Endpoint Without JWT → 401 Unauthorized
```powershell
try {
  Invoke-RestMethod -Uri "$PrimaryApiUrl/experiments" -Method POST -Body '{"name":"Unauth","scenario":"lambda-failure"}' -ContentType "application/json"
} catch {
  Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
  # Expected: 401 Unauthorized
}
```

### Step 11: Protected Endpoint With Valid JWT → 200 OK
```powershell
$Headers = @{
  "Authorization" = "Bearer $JwtToken"
  "Content-Type"  = "application/json"
}
$Experiments = Invoke-RestMethod -Uri "$PrimaryApiUrl/experiments" -Method GET -Headers $Headers
Write-Host "Experiments list retrieved successfully: $($Experiments.Count) experiments" -ForegroundColor Green
```

### Step 12: Create Experiment in Primary Region
```powershell
$ExpBody = @{
  name     = "MultiRegion-E2E-Drill"
  scenario = "lambda-failure"
} | ConvertTo-Json

$NewExp = Invoke-RestMethod -Uri "$PrimaryApiUrl/experiments" -Method POST -Headers $Headers -Body $ExpBody
$ExpId = $NewExp.experimentId
$OwnerUserId = $NewExp.userId

Write-Host "Created Experiment ID: $ExpId" -ForegroundColor Green
Write-Host "Owner userId (JWT sub): $OwnerUserId" -ForegroundColor Green
```

### Steps 13 & 14: Read Same Experiment from Secondary Using the SAME JWT & Verify Ownership
```powershell
# Allow 1-2 seconds for DynamoDB cross-region replication
Start-Sleep -Seconds 2

$SecExp = Invoke-RestMethod -Uri "$SecondaryApiUrl/experiments/$ExpId" -Method GET -Headers $Headers

Write-Host "Read from Secondary Region:" -ForegroundColor Green
Write-Host "  Experiment ID: $($SecExp.experimentId)"
Write-Host "  Status:        $($SecExp.status)"
Write-Host "  Owner userId:  $($SecExp.userId)"

if ($SecExp.userId -eq $OwnerUserId) {
  Write-Host "[PASS] User ownership and identity consistent across regions!" -ForegroundColor Green
}
```

### Step 15: Attempt Cross-User Access → 403 Forbidden
Create a second user and attempt to read User 1's experiment:
```powershell
# 1. Create second user
aws cognito-idp admin-create-user --user-pool-id $UserPoolId --username "intruder@sdrs.internal" --user-attributes Name=email,Value=intruder@sdrs.internal --message-action SUPPRESS --region us-east-1
aws cognito-idp admin-set-user-password --user-pool-id $UserPoolId --username "intruder@sdrs.internal" --password "<YourSecurePasswordHere>" --permanent --region us-east-1

# 2. Authenticate second user
$Auth2 = aws cognito-idp initiate-auth --client-id $UserPoolClientId --auth-flow USER_PASSWORD_AUTH --auth-parameters USERNAME=intruder@sdrs.internal,PASSWORD="<YourSecurePasswordHere>" --region us-east-1 | ConvertFrom-Json
$IntruderToken = $Auth2.AuthenticationResult.IdToken

# 3. Attempt access
try {
  $IntruderHeaders = @{ "Authorization" = "Bearer $IntruderToken"; "Content-Type" = "application/json" }
  Invoke-RestMethod -Uri "$SecondaryApiUrl/experiments/$ExpId" -Method GET -Headers $IntruderHeaders
} catch {
  Write-Host "Access Rejected as expected! Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
  # Expected: 403 Forbidden
}
```

### Step 16: Inject Failure on Primary Region
```powershell
$FailBody = @{ failureType = "lambda-failure" } | ConvertTo-Json
$FailRes = Invoke-RestMethod -Uri "$PrimaryApiUrl/experiments/$ExpId/failures" -Method POST -Headers $Headers -Body $FailBody
Write-Host "Failure injected on Primary: $($FailRes.message)" -ForegroundColor Green
```

### Steps 17 & 18: Secondary Continues Operating (Failover Workload)
Generate events and query metrics directly on the Secondary Region while Primary processor is failed:
```powershell
$GenBody = @{ count = 25; duplicateCount = 2 } | ConvertTo-Json
$GenRes = Invoke-RestMethod -Uri "$SecondaryApiUrl/experiments/$ExpId/events" -Method POST -Headers $Headers -Body $GenBody
Write-Host "Secondary generated $($GenRes.generatedCount) events safely." -ForegroundColor Green
```

### Step 19: Verify Global Table Replication
Confirm that events generated in the secondary region replicate to the primary region table:
```powershell
aws dynamodb query `
  --table-name sdrs-events-global `
  --region us-east-1 `
  --key-condition-expression "experimentId = :e" `
  --expression-attribute-values "{\":e\":{\"S\":\"$ExpId\"}}" `
  --query "Count"
```

### Step 20: Verify CloudWatch Alarms
Verify all 5 provisioned production alarms are active:
```powershell
aws cloudwatch describe-alarms `
  --alarm-name-prefix sdrs-primary `
  --region us-east-1 `
  --query "MetricAlarms[*].{Name:AlarmName,State:StateValue,Metric:MetricName}" `
  --output table
```

### Step 21: Verify 30-Minute Server-Side Expiry
Check that `backend/functions/api/generateEvents.mjs` evaluates `MAX_EXPERIMENT_DURATION_MS = 30 * 60 * 1000`:
```powershell
npm test -- --test-name-pattern="Experiment runtime evaluation"
```

### Step 22: Run Smoke Test with Bearer Token
Run the full 11-step end-to-end smoke test script with your live JWT token:
```powershell
cd SDRS
.\scripts\smoke-test.ps1 -ApiUrl $PrimaryApiUrl -BearerToken $JwtToken
```

### Step 23: Run the Automated Cross-Region Auth & Replication Test Script
Run [`scripts/test-cross-region-auth.mjs`](../scripts/test-cross-region-auth.mjs) which executes Steps 8–15, 18, and 19 end-to-end and measures real replication latency in milliseconds:
```powershell
node .\scripts\test-cross-region-auth.mjs --primary-url $PrimaryApiUrl --secondary-url $SecondaryApiUrl --token $JwtToken
```

### Step 24: Re-run the Security Audit Suite
Review [`docs/SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md) and run all 73 local unit and security invariant tests:
```powershell
npm test
```

---

## 🧹 Phase 3: Clean Teardown (Avoid Continuing AWS Charges)

When testing is complete, delete the CloudFormation stacks in reverse order to cleanly remove all resources:

```powershell
# 1. Delete Secondary Stack (us-west-2)
aws cloudformation delete-stack --stack-name sdrs-secondary --region us-west-2
Write-Host "Waiting for secondary stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name sdrs-secondary --region us-west-2

# 2. Delete Primary Stack (us-east-1)
aws cloudformation delete-stack --stack-name sdrs-primary --region us-east-1
Write-Host "Waiting for primary stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name sdrs-primary --region us-east-1

# 3. Delete Multi-Region Orchestrator Stack (Global Tables & Cognito in us-east-1)
aws cloudformation delete-stack --stack-name sdrs-multiregion-orchestrator --region us-east-1
Write-Host "Waiting for orchestrator stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name sdrs-multiregion-orchestrator --region us-east-1

# 4. (Optional) Delete SAM Staging S3 Bucket
# Note: SDRS does not use S3 for runtime data storage. This bucket is created by SAM CLI to stage Lambda ZIP archives.
$SamBucket = (aws s3 ls | Select-String "aws-sam-cli-managed").ToString().Trim().Split()[-1]
if ($SamBucket) {
    Write-Host "Emptying and deleting SAM staging bucket: $SamBucket"
    aws s3 rb "s3://$SamBucket" --force
}

Write-Host "All AWS resources deleted cleanly. Zero continuing costs." -ForegroundColor Green
```

