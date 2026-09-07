# 🛡️ SDRS — Pre-Deployment Security & Billing Guardrails

Before executing any deployment commands against live AWS, configure these essential safety measures and review operational guardrails.

---

## 1. Safety Guardrails & Billing Protection

### A. Set an AWS Budget ($5.00 Threshold)
To guarantee that you will never incur unexpected cloud expenses, create an immediate budget alert:
1. Open the **AWS Console** → Search for **AWS Budgets**.
2. Click **Create budget** → Choose **Zero spend budget** or **Cost budget** set to **$5.00 USD**.
3. Configure your email address to receive real-time threshold notifications.

### B. Use an IAM Sandbox User or Temporary SSO Role (Never Root)
* Never deploy infrastructure using AWS Root Account credentials.
* Use a development IAM user or temporary AWS IAM Identity Center (SSO) credentials with administrator or scoped deployment permissions in a sandbox account.

### C. Pre-Configured Localhost CORS Lockdown (SEC-03)
In `backend/template.yaml`, production CORS is pre-configured to strictly allow requests originating from your local development ports:
```yaml
SimulatorApi:
  Type: AWS::Serverless::HttpApi
  Properties:
    CorsConfiguration:
      AllowOrigins:
        - "http://localhost:3000"
        - "http://localhost:5173"
        - "http://127.0.0.1:3000"
        - "http://127.0.0.1:5173"
      AllowMethods:
        - "GET"
        - "POST"
        - "OPTIONS"
      AllowHeaders:
        - "Content-Type"
        - "Authorization"
```
No manual CORS modification is necessary prior to deployment.

---

## 2. How to Deploy to AWS Securely

You can deploy in either **Single-Region** (for simple evaluation) or **Multi-Region** (for Route 53 failover and DynamoDB Global Tables).

### Option A: Single-Region Deployment (`us-east-1`)

#### Step 1: Verify Prerequisites
Ensure the AWS CLI v2 and AWS SAM CLI are installed and configured:
```powershell
aws sts get-caller-identity
sam --version
```

#### Step 2: Deploy Backend Stack via SAM
Run the deployment script from the project root in PowerShell:
```powershell
.\scripts\deploy.ps1 -StackName "sdrs-stack" -Region "us-east-1"
```

Or execute manually via SAM CLI:
```powershell
cd backend
sam build
sam deploy `
    --stack-name "sdrs-stack"     --region "us-east-1"     --resolve-s3     --capabilities CAPABILITY_IAM     --no-confirm-changeset
```

#### Step 3: Connect the Frontend
When the SAM deployment completes, the terminal will print your API Gateway URL:
```text
API Gateway URL: https://<api-id>.execute-api.us-east-1.amazonaws.com/
```

Update your frontend environment file by copying the template:
```powershell
Copy-Item frontend\.env.example frontend\.env
```
Set your deployed endpoint in `frontend/.env`:
```ini
VITE_DEMO_MODE=false
VITE_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
```

Then start the frontend:
```powershell
cd frontend
npm run dev
```
Open **http://localhost:3000**. The dashboard badge will reflect ☁️ **Live AWS Deployment**.

---

### Option B: Multi-Region Deployment (`us-east-1` + `us-west-2`)

To evaluate active-passive Route 53 DNS failover and DynamoDB Global Tables:
```powershell
.\scripts\deploy-multi-region.ps1 -PrimaryRegion us-east-1 -SecondaryRegion us-west-2
```

This automatically provisions:
1. `sdrs-multiregion-orchestrator` (Authoritative DynamoDB Global Tables & Cognito User Pool in `us-east-1`)
2. `sdrs-primary` (Primary regional application stack in `us-east-1`)
3. `sdrs-secondary` (Standby regional application stack in `us-west-2`)

---

## 3. Estimated AWS Resource Billing During Testing

All resources are provisioned on Serverless On-Demand pricing:
- **API Gateway HTTP API**: $1.00 per 1M calls (first 300 test requests = ~$0.0003)
- **AWS Lambda (ARM64 Graviton)**: 1M free invocations/month under AWS Free Tier; $0.20 per 1M thereafter
- **Amazon SQS**: First 1M requests/month free
- **DynamoDB On-Demand**: Free tier covers first 25 RCU/WCU; pay-per-request thereafter
- **Route 53 Health Check (Multi-region only)**: ~$0.50/month prorated (~$0.0007 per hour while active)

> 💡 **Total Expected Cost:** Running an experiment generating 2,000–5,000 events costs **less than $0.02**. When the experiment is stopped and idle, ongoing compute cost is **$0.00**.

---

## 4. How to Delete Everything (Ensure $0.00 Ongoing Cost)

When testing is complete, clean up all resources to guarantee zero ongoing charges:

### Step 1: Delete CloudFormation Stacks

#### Multi-Region Cleanup (Automated):
Run the automated teardown script, which deletes all multi-region stacks in proper reverse-dependency order with interactive confirmation:
```powershell
.\scripts\cleanup.ps1 -PrimaryRegion us-east-1 -SecondaryRegion us-west-2
```
*(On Linux/macOS: `./scripts/cleanup.sh --primary-region us-east-1 --secondary-region us-west-2`)*

#### Multi-Region Cleanup (Manual via SAM CLI):
If deleting manually, strictly follow reverse dependency order:
```powershell
# 1. Delete Secondary Regional Application Stack
sam delete --stack-name sdrs-secondary --region us-west-2 --no-prompts

# 2. Delete Primary Regional Application Stack
sam delete --stack-name sdrs-primary --region us-east-1 --no-prompts

# 3. Delete Multi-Region Storage Orchestrator (Global Tables & Cognito)
sam delete --stack-name sdrs-multiregion-orchestrator --region us-east-1 --no-prompts
```

#### Single-Region Cleanup:
```powershell
sam delete --stack-name sdrs-stack --region us-east-1 --no-prompts
```

### Step 2: Delete CloudWatch Log Groups (Optional)
Lambda generates log groups under `/aws/lambda/sdrs-*`. To purge them via PowerShell:
```powershell
# us-east-1:
(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/sdrs" --region us-east-1 --query "logGroups[*].logGroupName" --output text).Split() | ForEach-Object {
    if ($_ -ne "") { aws logs delete-log-group --log-group-name $_ --region us-east-1 }
}

# us-west-2 (if multi-region deployed):
(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/sdrs" --region us-west-2 --query "logGroups[*].logGroupName" --output text).Split() | ForEach-Object {
    if ($_ -ne "") { aws logs delete-log-group --log-group-name $_ --region us-west-2 }
}
```

### Step 3: Reset Frontend Back to Local Demo Sandbox
Remove or reset your local environment file:
```ini
VITE_DEMO_MODE=true
VITE_API_URL=
```

---

## 5. Verification Checklist in AWS Console

Confirm 100% resource removal:
- [ ] **CloudFormation**: Navigate to `us-east-1` and `us-west-2` → Confirm all `sdrs-*` stacks are deleted.
- [ ] **DynamoDB**: Tables → Confirm no `sdrs-*` tables exist.
- [ ] **SQS**: Queues → Confirm no `sdrs-*` queues exist.
- [ ] **Route 53**: Health checks → Confirm 0 SDRS health checks remain.
