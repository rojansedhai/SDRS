# 🛡️ SDRS — Serverless Disaster Recovery Simulator

An open-source, interactive web application that helps developers understand how AWS serverless architectures behave during failures. Run controlled failure experiments against a real AWS serverless pipeline and observe detection, failover, recovery metrics, RTO, RPO, and estimated cost in real time.

![License](https://img.shields.io/badge/license-MIT-blue)
![AWS](https://img.shields.io/badge/AWS-Serverless-orange)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Node](https://img.shields.io/badge/Node.js-22.x-green)
![Tests](https://img.shields.io/badge/Tests-59%20Passing-brightgreen)

> 📘 Read the full **[VALIDATION_REPORT.md](./VALIDATION_REPORT.md)** for our complete technical compliance audit, bug-fix log, and test results.  
> 🌐 Read the comprehensive **[docs/MULTI_REGION.md](./docs/MULTI_REGION.md)** for Multi-Region Disaster Recovery architecture, runbooks, and Route 53 failover mechanics.  
> 🚀 Follow the step-by-step **[docs/AWS_DEPLOYMENT_AND_TESTING_GUIDE.md](./docs/AWS_DEPLOYMENT_AND_TESTING_GUIDE.md)** for live AWS deployment, 24-step verification, and teardown runbook.  
> 🛡️ Read the **[docs/SECURITY_AUDIT_REPORT.md](./docs/SECURITY_AUDIT_REPORT.md)** for full security remediation evidence and compliance scorecard.

---

## ✨ Execution Modes

SDRS supports two primary modes:
1. **Local Demo Mode** `[Simulated]`: Runs 100% offline in your browser with simulated AWS services — **no AWS account required**.
2. **Live AWS Mode** `[Real AWS]`: Connects to deployed AWS SAM stack(s) in `us-east-1` (Single-Region) or `us-east-1` + `us-west-2` (Multi-Region), injecting real non-destructive failures into actual serverless infrastructure.

---

## ✨ Features

### 🏗️ Live Architecture Dashboard `[MVP]` `[Phase 2]`
Interactive React Flow diagram with real-time health status for each service and a **Single-Region** vs **Multi-Region** toggle:
- **Single-Region View**: API Gateway → EventBridge → SQS → Lambda → DynamoDB.
- **Multi-Region View**: Route 53 (DNS Failover) → Primary Region (`us-east-1`, ACTIVE) & Secondary Region (`us-west-2`, STANDBY) → DynamoDB Global Tables.
- Dynamic animated traffic lines showing live failover shifting to the standby region during disruptions.
- Status indicators: 🟢 Healthy · 🟠 Degraded · 🔴 Failed · 🔵 Active · ⚪ Standby.

### 💥 Failure Injection `[Real AWS]` `[MVP]` `[Phase 2]`
Safely inject controlled, reversible failures into the pipeline:
| Failure Type | Scope | Real AWS Mechanism | Reversible |
|---|---|---|---|
| Lambda Failure | Regional | Sets reserved concurrency to 0 | ✅ |
| SQS Backlog | Regional | Disables Event Source Mapping | ✅ |
| DynamoDB Throttle | Regional / Global | Injects throughput error simulation | ✅ |
| API Failure | Edge | Injects HTTP 500 edge responses | ✅ |
| EventBridge Failure | Regional | Disables EventBridge routing rule | ✅ |
| **Fail Primary Region** `[Phase 2]` | Multi-Region | Trips `/health` probe (HTTP 503) triggering Route 53 failover | ✅ |

> ⚠️ All failure injection targets only SDRS resources. No destructive operations (`Delete*`) are permitted.

### 📊 Real-Time Metrics & Grounding `[Phase 2]`
- **Measured Telemetry**: RTO, RPO, Detection Time, Recovery Time, Total / Success / Failed / Duplicate / Lost events, Data Consistency %.
- **Target Evaluation**: User-defined RTO (seconds) and RPO (events) targets with real-time PASS/FAIL badges.
- **Composite Resilience Score (0–100%)**: Weighted algorithmic scoring reflecting real recovery efficacy.
- **Regional Split**: Separate event accounting for Primary (`us-east-1`) vs Secondary (`us-west-2`).
- **Estimated Telemetry**: Estimated AWS cost breakdown including multi-region standby overhead (Global Table rWUs, Route 53, cross-region transfer).

### ⏱️ 8-Step Regional Timeline Visualization `[Phase 2]`
Tracks disaster recovery milestones with precision:
`Started` → `Failure Injected` → `Health Check Failed` → `Failover Started` → `Secondary Active` → `Traffic Recovered` → `Primary Restored` → `Failback Completed`.

### 🔬 Side-by-Side Experiment Comparison `[Phase 2]`
Compare any two historical experiments side-by-side to evaluate the resilience and cost trade-offs of architectural changes.

---

## 🏛️ Architecture `[Real AWS] [Single Region] [MVP]`

```
Frontend (React + Vite)
        │
        ▼
API Gateway (HTTP API v2)
        │
        ├──► EventBridge (Custom Bus)
        │           │
        │           ▼
        │       SQS Queue (+ DLQ)
        │           │
        │           ▼
        │     Lambda Processor (Node 22 / ARM64)
        │           │
        │           ▼
        └──► DynamoDB (Events, Experiments, Metrics Tables)
```

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for in-depth system design, idempotency mechanics, and race-condition handling.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 20.x (Node 22.x recommended)
- **npm** ≥ 10.x
- **AWS CLI** v2 (only if deploying to AWS)
- **AWS SAM CLI** ≥ 1.100 (only if deploying to AWS)

### 1. Local Development (Demo Mode) `[Simulated]`
Run the application completely offline:
```bash
# Clone the repository
git clone https://github.com/your-org/sdrs.git
cd sdrs

# Install all dependencies
npm install
npm --prefix frontend install
npm --prefix backend install

# Start development server (Demo Mode enabled by default)
npm --prefix frontend run dev
```
Open **http://localhost:3000** in your browser (default configured port; API Gateway CORS also permits `5173`).

---

### 2. Automated Tests & Smoke Testing

Run the automated test suite locally:
```bash
# Run unit, calculation & security invariant tests (59/59 tests pass)
npm test

# Run offline smoke test script (PowerShell)
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -DemoMode

# Run offline smoke test script (Linux/macOS Bash)
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh --demo
```

---

### 3. Deploy to AWS `[Real AWS]`

#### Option A: Single-Region Deployment (`us-east-1`)
```bash
cd backend
sam build
sam deploy --guided --stack-name sdrs-stack --region us-east-1
```

#### Option B: Multi-Region Deployment (`us-east-1` + `us-west-2`) `[Phase 2]`
Run the automated deployment script that provisions Global Tables and dual-region regional stacks:
```bash
# Windows PowerShell:
.\scripts\deploy-multi-region.ps1 -PrimaryRegion us-east-1 -SecondaryRegion us-west-2

# Linux/macOS:
chmod +x scripts/deploy-multi-region.sh
./scripts/deploy-multi-region.sh --primary-region us-east-1 --secondary-region us-west-2
```

4. **Configure Frontend:**
Copy `frontend/.env.example` to `frontend/.env`:
```env
VITE_DEMO_MODE=false
VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
```
*(Note: Protected API routes enforce Amazon Cognito JWT Bearer tokens via API Gateway HTTP API JWT Authorizer. When running live, acquire a JWT token via Cognito User Pool or run in Demo Mode for full offline simulation).*

5. **Run Live Smoke Test against AWS:**
```bash
# PowerShell (with acquired Cognito JWT token):
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -ApiUrl "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com" `
  -BearerToken "$JwtToken"

# Linux/macOS Bash:
./scripts/smoke-test.sh \
  --api-url "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com" \
  --bearer-token "$JwtToken"
```

6. **Start the Frontend:**
```bash
cd frontend
npm run dev
```

---

## 💰 Cost Safety & Guardrails `[Real AWS]`

SDRS resources use pay-per-use on-demand serverless pricing (< $0.01 per experiment). To ensure complete cost protection, configure an AWS budget alarm:

```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{
    "BudgetName": "SDRS-Monthly-Limit",
    "BudgetLimit": { "Amount": "5.0", "Unit": "USD" },
    "CostTypes": { "IncludeTax": true, "IncludeSubscription": true },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "your-email@example.com"
    }]
  }]'
```

### 🧹 Cleanup (Delete All AWS Resources)

#### Single-Region Cleanup:
```bash
sam delete --stack-name sdrs-stack --region us-east-1 --no-prompts
```

#### Multi-Region Cleanup `[Phase 2]`:
Use the automated cleanup script to cleanly delete all stacks in proper reverse-dependency order:
```powershell
# PowerShell:
.\scripts\cleanup.ps1 -PrimaryRegion us-east-1 -SecondaryRegion us-west-2
```
```bash
# Linux/macOS Bash:
./scripts/cleanup.sh --primary-region us-east-1 --secondary-region us-west-2
```

Or manually delete via AWS SAM CLI in reverse dependency order:
```bash
# 1. Delete Secondary Application Stack
sam delete --stack-name sdrs-secondary --region us-west-2 --no-prompts

# 2. Delete Primary Application Stack
sam delete --stack-name sdrs-primary --region us-east-1 --no-prompts

# 3. Delete Multi-Region Storage Orchestrator (Global Tables & Cognito)
sam delete --stack-name sdrs-multiregion-orchestrator --region us-east-1 --no-prompts
```

---

## 🌐 Multi-Region Disaster Recovery Guide `[Phase 2]`

Full operational details and architectural reference are provided in **[docs/MULTI_REGION.md](./docs/MULTI_REGION.md)**, covering:
- Active-Passive Route 53 DNS failover configuration & health checking (`/health`).
- DynamoDB Global Tables active-active cross-region replication & conflict resolution.
- Regional failure injection runbook (`💥 Fail Primary Region`).
- RTO / RPO target threshold validation and composite Resilience Score formula.
- Side-by-side Experiment Comparison modal for architectural trade-off analysis.
- Multi-region cost breakdown & standby overhead.

---

## 📄 License
MIT — see [LICENSE](./LICENSE) for details.
