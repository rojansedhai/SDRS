1. Pre-Deployment Security & Billing Guardrails
Before running any deploy commands, configure these safety measures:

A. Set an AWS Budget ($5.00 Threshold)
To guarantee you will never receive an unexpected bill, create a budget alert:

Open the AWS Console 
→
→ Search for AWS Budgets.
Click Create budget 
→
→ Choose Zero spend budget or Cost budget set to $5.00.
Enter your email address to receive immediate alerts if your account incurs charges.
B. Use an IAM Sandbox User / Role (Never Root)
Never deploy using your AWS root credentials.
Use an IAM User or temporary AWS SSO credentials with Administrator access in a sandbox/development account.
C. Restrict API Gateway CORS to Localhost
Currently in backend/template.yaml, CORS origins are set to *. Before deploying to AWS, restrict it so only your local frontend can invoke your backend: In 
backend/template.yaml
:

yaml


  SimulatorApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins:
          - "http://localhost:5173"
          - "http://127.0.0.1:5173"
        AllowMethods:
          - "GET"
          - "POST"
          - "OPTIONS"
        AllowHeaders:
          - "Content-Type"
          - "x-api-key"
2. How to Deploy to AWS Securely
You can deploy either in Single-Region (Recommended for initial validation) or Multi-Region (Phase 2).

Option A: Single-Region Deployment (us-east-1)
Step 1: Verify Prerequisites
Ensure AWS CLI and AWS SAM CLI are installed and configured:

powershell


aws sts get-caller-identity
sam --version
Step 2: Deploy Backend Stack via SAM
Run the deployment script from the project root in PowerShell:

powershell


.\scripts\deploy.ps1 -StackName "sdrs-stack" -Region "us-east-1"
Or execute manually via SAM CLI:

powershell


cd backend
sam build
sam deploy `
    --stack-name "sdrs-stack" `
    --region "us-east-1" `
    --resolve-s3 `
    --capabilities CAPABILITY_IAM `
    --no-confirm-changeset
Step 3: Connect the Frontend
When the SAM deployment finishes, the terminal will print your API Gateway URL:

text


API Gateway URL: https://<api-id>.execute-api.us-east-1.amazonaws.com/
Update your frontend environment file 
frontend/.env
:

ini


VITE_DEMO_MODE=false
VITE_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
Then start the frontend:

powershell


cd ../frontend
npm run dev
Open http://localhost:5173. The dashboard badge will now read ☁️ Live AWS Deployment instead of Demo Sandbox.

Option B: Multi-Region Deployment (us-east-1 + us-west-2)
If you want to test Route 53 failover and DynamoDB Global Tables:

powershell


.\scripts\deploy-multi-region.ps1 -PrimaryRegion us-east-1 -SecondaryRegion us-west-2 -StackNamePrefix "sdrs"
This provisions:

sdrs-primary in us-east-1
sdrs-secondary in us-west-2
sdrs-multiregion-orchestrator (DynamoDB Global Tables and Route 53 health check probe)
3. What You Will Be Billed During Testing
All resources are configured as Serverless On-Demand:

API Gateway HTTP API: $1.00 per 1M calls (first 300 requests = $0.0003)
AWS Lambda (ARM64 Graviton): 1 million free invocations/month; $0.20 per 1M thereafter
Amazon SQS: First 1 million requests/month are free
DynamoDB: On-demand pay-per-request (first 25 RCU/WCU are free under AWS Free Tier)
Route 53 Health Check (Multi-region only): $0.50/month (prorated by hour: ~$0.0007 per hour)
NOTE

Total Expected Cost: Running an experiment generating 2,000–5,000 events costs less than $0.02. When you stop testing and the system is idle, your ongoing compute and queue cost is $0.00.

4. How to Delete Everything (Ensure $0.00 Ongoing Cost)
Once your testing is complete, run these commands to cleanly remove all resources so no lingering fees can accumulate:

Step 1: Delete CloudFormation Stacks
If you deployed Single-Region:
powershell


# Using the cleanup script:
.\scripts\cleanup.ps1 -StackName "sdrs-stack" -Region "us-east-1"
# Or directly using SAM CLI:
sam delete --stack-name sdrs-stack --region us-east-1 --no-prompts
If you deployed Multi-Region:
Delete the stacks in reverse order:

powershell


# 1. Delete Multi-Region Orchestrator (Global Tables & Route 53 health checks)
sam delete --stack-name sdrs-multiregion-orchestrator --region us-east-1 --no-prompts
# 2. Delete Secondary Regional Stack
sam delete --stack-name sdrs-secondary --region us-west-2 --no-prompts
# 3. Delete Primary Regional Stack
sam delete --stack-name sdrs-primary --region us-east-1 --no-prompts
Step 2: Delete the SAM S3 Deployment Bucket (Avoid Storage Fees)
When you run sam deploy --resolve-s3, AWS creates an S3 bucket to hold your Lambda zip files (named aws-sam-cli-managed-default-samclisourcebucket-...).

To find and delete it:

powershell


# List your buckets to find the SAM bucket
aws s3 ls
# Delete the deployment bucket and its contents (replace with your bucket name)
aws s3 rb s3://aws-sam-cli-managed-default-samclisourcebucket-<id> --force
Step 3: Delete CloudWatch Log Groups
Lambda creates CloudWatch log groups under /aws/lambda/sdrs-*. Clean them up with PowerShell:

powershell


Get-ChildItem -ErrorAction SilentlyContinue
# In us-east-1:
(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/sdrs" --region us-east-1 --query "logGroups[*].logGroupName" --output text).Split() | ForEach-Object {
    if ($_ -ne "") { aws logs delete-log-group --log-group-name $_ --region us-east-1 }
}
# If Multi-Region, also clean us-west-2:
(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/sdrs" --region us-west-2 --query "logGroups[*].logGroupName" --output text).Split() | ForEach-Object {
    if ($_ -ne "") { aws logs delete-log-group --log-group-name $_ --region us-west-2 }
}
Step 4: Reset Frontend Back to Local Demo Sandbox
After deleting the backend, switch your frontend configuration back to offline Demo Mode: In frontend/.env:

ini


VITE_DEMO_MODE=true
VITE_API_URL=
Step 5: Verification Checklist in AWS Console
To verify that your account has 0 active SDRS resources remaining:

CloudFormation: Navigate to us-east-1 (and us-west-2) 
→
→ Confirm all sdrs-* stacks are in DELETE_COMPLETE status.
DynamoDB: Tables 
→
→ Confirm no sdrs-* tables exist.
SQS: Queues 
→
→ Confirm no sdrs-* queues exist.
Route 53: Health checks 
→
→ Confirm 0 health checks remain.