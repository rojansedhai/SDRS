# Serverless Disaster Recovery Simulator — Architecture

## Overview [MVP] [Single Region]

The Serverless Disaster Recovery Simulator (SDRS) is an educational tool that lets developers
understand how AWS serverless architectures behave during failures. Users run controlled
failure experiments against a real AWS serverless pipeline and observe detection, failover,
recovery metrics, RTO, RPO, and estimated cost in real time.

SDRS supports two execution modes:
- **Local Demo Mode** `[Simulated]`: Runs 100% offline in the browser with mock state, zero cloud dependencies.
- **Live AWS Mode** `[Real AWS]`: Executes against deployed AWS resources in `us-east-1`, injecting real non-destructive failure controls.

---

## System Architecture [Real AWS] [Single Region] [MVP]

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Architecture │  │  Experiment  │  │   Metrics    │              │
│  │   Diagram     │  │   Controls   │  │  Dashboard   │              │
│  │  (React Flow) │  │              │  │  (Recharts)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │   Timeline    │  │  Experiment  │                                │
│  │ Visualization │  │   History    │                                │
│  └──────────────┘  └──────────────┘                                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP (REST)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AWS BACKEND (us-east-1)                         │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ API Gateway   │───▶│ EventBridge  │───▶│    SQS       │          │
│  │ (HTTP API)    │    │ (Custom Bus) │    │  (+ DLQ)     │          │
│  └──────┬───────┘    └──────────────┘    └──────┬───────┘          │
│         │                                        │                  │
│         │  ┌──────────────┐              ┌──────▼───────┐          │
│         │  │   Failure    │              │   Lambda      │          │
│         ├─▶│   Engine     │              │  (Processor)  │          │
│         │  └──────────────┘              └──────┬───────┘          │
│         │                                        │                  │
│         │  ┌──────────────┐              ┌──────▼───────┐          │
│         └─▶│  API Lambda  │              │  DynamoDB     │          │
│            │  Functions   │─────────────▶│  (3 Tables)   │          │
│            └──────────────┘              └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow [Real AWS] [MVP]

### Normal Operation (Happy Path)

1. **Frontend** sends a batch ingestion request to **API Gateway** (`POST /experiments/{id}/events`).
2. **Generate Events Lambda** generates compliant events and publishes them to **EventBridge** (`SDRSEventBus`).
3. **EventBridge Rule** matches events with `source: sdrs.simulator` and routes them to the **SQS Main Queue** (`SDRSMainQueue`).
4. **SQS** triggers the **Event Processor Lambda** via an Event Source Mapping (batch size: 10, batch window: 5s).
5. **Processor Lambda** writes each event to **DynamoDB** (`EventsTable`) using conditional writes for idempotency, stamping `processedAt`.
6. **Frontend** polls `GET /experiments/{id}/metrics` to fetch live metrics and health statuses.

### Failure Injection Flow

1. User selects a failure scenario in the **Experiment Panel** and confirms the modal dialog.
2. Frontend issues `POST /experiments/{id}/failures` with the failure type.
3. **Failure Engine Lambda** applies the controlled failure:
   - **Lambda failure** (`chaos-lambda-failure`): Sets reserved concurrency to 0 via `PutFunctionConcurrency`.
   - **SQS backlog** (`chaos-sqs-backlog`): Disables the Event Source Mapping via `UpdateEventSourceMapping`.
   - **DynamoDB throttle** (`chaos-ddb-throttle`): Sets chaos flag in `ExperimentsTable`; processor simulates `ProvisionedThroughputExceededException`.
   - **API failure** (`chaos-api-failure`): Sets chaos flag in `ExperimentsTable`; ingestion handler returns HTTP 500.
   - **EventBridge failure** (`chaos-eb-failure`): Disables the EventBridge rule via `DisableRule`.
4. Workload continues or accumulates; telemetry detects degradation and marks services 🔴.

### Recovery Flow

1. User clicks **Restore** in the UI.
2. Frontend calls `POST /experiments/{id}/restore`.
3. **Failure Engine** reverses the failure (restores concurrency, re-enables ESM or rule, clears chaos flags).
4. Pipeline processes backlogged messages from SQS.
5. Telemetry records `recoveredAt` timestamp and computes RTO / RPO.

---

## Event Schema [MVP]

Every event flowing through the pipeline complies with this schema:

```json
{
  "eventId": "evt-uuid-v4",
  "experimentId": "exp-uuid-v4",
  "createdAt": "2026-09-04T10:00:00.000Z",
  "receivedAt": "2026-09-04T10:00:00.150Z",
  "processedAt": "2026-09-04T10:00:00.300Z",
  "region": "us-east-1",
  "status": "processed | failed | duplicate | lost",
  "payload": {
    "sequence": 42,
    "data": "test-payload"
  }
}
```

---

## DynamoDB Tables [Real AWS] [MVP]

### EventsTable

| Attribute    | Type   | Key     | Description                    |
|-------------|--------|---------|--------------------------------|
| eventId     | String | PK      | Unique event identifier        |
| experimentId| String | GSI1 PK | Links event to experiment      |
| createdAt   | String | GSI1 SK | ISO timestamp for ordering     |
| receivedAt  | String |         | When SQS received the event    |
| processedAt | String |         | When Lambda processed it       |
| region      | String |         | AWS region                     |
| status      | String |         | processed/failed/duplicate/lost|
| duplicateCount | Number |     | Count of duplicate delivery attempts |

### ExperimentsTable

| Attribute       | Type   | Key  | Description                     |
|----------------|--------|------|---------------------------------|
| experimentId   | String | PK   | Unique experiment identifier    |
| name           | String |      | User-provided name              |
| scenario       | String |      | Predefined scenario type        |
| status         | String |      | running/completed/failed        |
| startedAt      | String |      | Experiment start time           |
| stoppedAt      | String |      | Experiment stop time            |
| failureType    | String |      | Injected failure type           |
| failureInjectedAt | String |   | When failure was injected       |
| detectedAt     | String |      | When failure was detected       |
| recoveredAt    | String |      | When service recovered          |
| region         | String |      | Primary region (`us-east-1`)    |
| metrics        | Map    |      | Computed metrics snapshot       |
| result         | String |      | PASS / FAIL                     |
| timeline       | List   |      | Array of timeline events        |

### MetricsTable

| Attribute      | Type   | Key     | Description                     |
|---------------|--------|---------|----------------------------------|
| experimentId  | String | PK      | Links to experiment              |
| timestamp     | String | SK      | Metric snapshot time             |
| totalRequests | Number |         | Total events sent                |
| successCount  | Number |         | Successfully processed           |
| failedCount   | Number |         | Failed to process                |
| duplicateCount| Number |         | Duplicate events detected        |
| lostCount     | Number |         | Events that were lost            |
| avgLatency    | Number |         | Average processing latency (ms)  |
| p95Latency    | Number |         | P95 processing latency (ms)      |
| queueDepth    | Number |         | Current SQS queue depth          |
| errorRate     | Number |         | Error rate percentage            |

---

## Idempotency, Deduplication & Race Condition Mechanics [Real AWS] [MVP]

Distributed serverless pipelines operate under **at-least-once** delivery guarantees. SDRS implements and validates enterprise-grade idempotency mechanisms:

### 1. Conditional Puts
- The Event Processor Lambda writes to DynamoDB using a conditional expression:
  ```javascript
  ConditionExpression: 'attribute_not_exists(eventId)'
  ```
- If an event is delivered multiple times by SQS or resubmitted by the caller, the conditional write fails with a `ConditionalCheckFailedException`.

### 2. Duplicate Tracking Without Silent Drops
- Instead of ignoring duplicate delivery errors, the processor catches `ConditionalCheckFailedException` and issues an atomic DynamoDB update:
  ```javascript
  UpdateExpression: 'ADD duplicateCount :one'
  ```
- This ensures that duplicate deliveries are recorded in telemetry, allowing exact data consistency measurements.

### 3. SQS Visibility Timeout vs Lambda Execution Timeout
- **Queue Visibility Timeout**: 30 seconds.
- **Lambda Function Timeout**: 30 seconds.
- When `chaos-lambda-failure` is active (concurrency = 0), invocations are throttled immediately. SQS holds the messages and retries them once visibility expires.
- After 3 failed receive attempts (`maxReceiveCount: 3`), SQS routes undeliverable messages to `SDRSDLQ` (Dead Letter Queue).

### 4. Race Condition Protection
- DynamoDB provides item-level serializable isolation on conditional writes.
- If concurrent Lambda execution environments attempt to process identical event IDs simultaneously, exactly one writer succeeds in creating the item, and all concurrent attempts catch the condition check failure.

---

## Metrics Calculations & Telemetry Grounding

SDRS explicitly discloses which values are **[Measured]** from empirical cloud telemetry and which are **[Estimated]** or **[Simulated]**:

### RTO (Recovery Time Objective) `[Measured]`
Time from failure detection to full service recovery:
```
RTO = recoveredAt - detectedAt
```
Derived from verified timestamps stored in DynamoDB `ExperimentsTable`.

### RPO (Recovery Point Objective) `[Measured]`
Maximum data loss window — time elapsed between the last successful write before failure and the first successful write after recovery:
```
RPO = firstSuccessAfterRecovery.processedAt - lastSuccessBeforeFailure.processedAt
```

### Detection Time `[Measured]`
Time from failure injection until the first failed request or error anomaly is detected:
```
DetectionTime = detectedAt - failureInjectedAt
```

### Failover Time `[Simulated in MVP]` / `[Measured in Phase 2]`
In single-region MVP, failover is a simulated compensation interval. In Phase 2 multi-region, this will be measured via Route 53 health-check failover latency.

### Recovery Time `[Measured]`
Total elapsed duration from failure injection to full recovery:
```
RecoveryTime = recoveredAt - failureInjectedAt
```

### Data Consistency `[Measured]`
Percentage of events processed exactly once:
```
DataConsistency = ((totalEvents - duplicates - lost) / totalEvents) * 100
```

### Estimated Cost `[Estimated]`
Calculated based on standard AWS us-east-1 on-demand pricing rates:
- **API Gateway**: \$1.00 / 1M requests
- **Lambda**: \$0.20 / 1M requests + \$0.0000166667 / GB-second (ARM64: \$0.0000133334 / GB-second)
- **SQS**: \$0.40 / 1M requests
- **DynamoDB**: \$1.25 / 1M write units, \$0.25 / 1M read units
- **EventBridge**: \$1.00 / 1M events

All metric payloads include metadata: `isCostEstimated: true, isTelemetryMeasured: true`.

---

## Failure Injection Mechanisms [Real AWS] [MVP]

All failure injection is **safe, scoped, and reversible**. No resources are deleted.

| Failure Type         | Mechanism                              | AWS API Used                    | Reversible |
|---------------------|----------------------------------------|---------------------------------|------------|
| Lambda Failure      | Set reserved concurrency to 0          | `PutFunctionConcurrency`        | ✅ `DeleteFunctionConcurrency` |
| SQS Backlog         | Disable event source mapping           | `UpdateEventSourceMapping`      | ✅ Re-enable mapping |
| DynamoDB Throttle   | Set chaos flag in `ExperimentsTable`   | `UpdateItem` on config record   | ✅ Remove flag |
| API Failure         | Set chaos flag in `ExperimentsTable`   | `UpdateItem` on config record   | ✅ Remove flag |
| EventBridge Failure | Disable EventBridge routing rule       | `DisableRule`                   | ✅ `EnableRule` |

### Safety Guardrails
1. **Target Resource Pinning**: Target ARNs are strictly injected via backend environment variables; client payloads cannot specify arbitrary resource names.
2. **Non-Destructive Invariant**: No `DeleteFunction`, `DeleteQueue`, or `DeleteTable` IAM permissions exist in the stack.
3. **IAM Least Privilege**: `PutFunctionConcurrency` is pinned specifically to `EventProcessorFunction.Arn`.
4. **Auto-Cleanup**: Experiments auto-stop after 30 minutes.
5. **Confirmation Modals**: UI requires user confirmation before initiating any failure injection.

---

## API Endpoints [Real AWS] [MVP]

All API endpoints require an `x-api-key` header when deployed to AWS:

| Method | Path                              | Description                                     |
|--------|-----------------------------------|-------------------------------------------------|
| `POST` | `/experiments`                    | Start new experiment                            |
| `GET`  | `/experiments`                    | List all past and active experiments           |
| `GET`  | `/experiments/{id}`               | Get experiment status and live telemetry        |
| `POST` | `/experiments/{id}/stop`          | Stop experiment, compute final PASS/FAIL result|
| `POST` | `/experiments/{id}/failures`      | Inject non-destructive failure                  |
| `POST` | `/experiments/{id}/restore`       | Restore pipeline from failure                   |
| `POST` | `/experiments/{id}/events`        | Generate and ingest test batch of events        |
| `GET`  | `/experiments/{id}/metrics`       | Fetch computed real-time metrics snapshot       |

---

## Cost Safety & AWS Budgets [Real AWS]

To prevent unexpected billing while running experiments against live AWS, set up a strict budget alert:

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

### Complete Teardown Command
When finished experimenting on AWS, destroy all resources:
```bash
cd backend
sam delete --stack-name sdrs-stack --region us-east-1 --no-prompts
```

---

## Multi-Region Disaster Recovery Architecture [Phase 2] [Real AWS] [Simulated]

Phase 2 extends the single-region MVP into an active-passive multi-region disaster recovery topology spanning two configurable AWS regions:
- **Primary Region (`us-east-1`)**: Defaults to **ACTIVE** role, ingesting live production traffic.
- **Secondary Region (`us-west-2`)**: Defaults to **STANDBY** role, provisioned and ready for warm failover.

> 📘 Refer to **[docs/MULTI_REGION.md](./docs/MULTI_REGION.md)** for the complete multi-region operations guide, runbooks, and failure injection mechanics.

```
                         Route 53
                    (DNS Failover Routing)
                             │
              ┌──────────────┴──────────────┐
              │ Health Check Probe          │ Standby DNS Route
              ▼                             ▼
   ┌─────────────────────┐       ┌─────────────────────┐
   │   PRIMARY REGION    │       │  SECONDARY REGION   │
   │     (us-east-1)     │       │     (us-west-2)     │
   │       ACTIVE        │       │       STANDBY       │
   │                     │       │                     │
   │ API Gateway HTTP v2 │       │ API Gateway HTTP v2 │
   │   (GET /health)     │       │   (GET /health)     │
   │          │          │       │          │          │
   │          ▼          │       │          ▼          │
   │  EventBridge Bus    │       │  EventBridge Bus    │
   │          │          │       │          │          │
   │          ▼          │       │          ▼          │
   │    SQS Main Queue   │       │    SQS Main Queue   │
   │          │          │       │          │          │
   │          ▼          │       │          ▼          │
   │   Lambda Processor  │       │   Lambda Processor  │
   │  (ARM64 / Node 22)  │       │  (ARM64 / Node 22)  │
   └──────────┬──────────┘       └──────────┬──────────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │    DynamoDB Global Table    │
              │  (Active-Active Replication)│
              │   • EventsGlobalTable       │
              │   • ExperimentsGlobalTable  │
              │   • MetricsGlobalTable      │
              │   • ConfigGlobalTable       │
              └─────────────────────────────┘
```

### 1. Active-Passive Route 53 DNS Failover [Real AWS]
- **Routing Policy**: Route 53 Failover record set with Primary (Target: Primary API Gateway) and Secondary (Target: Secondary API Gateway).
- **Health Check Probe**: Probes `GET /health` on the Primary API Gateway every 10 seconds with a failure threshold of 3 consecutive failures (30 seconds total detection window).
- **DNS TTL & Latency Reality**: TTL is configured to 60 seconds. In real AWS, full DNS traffic migration takes between 30s to 90s due to recursive resolver caching.
- **In Demo Mode `[Simulated]`**: The simulator models this multi-stage progression:
  1. Primary Failure Injected (t = 0s)
  2. Health Check Failed (t = 2s)
  3. Route 53 Failover Triggered (t = 4s)
  4. Secondary Region Active (t = 6s)
  5. Traffic Recovered (t = 8s)

### 2. Multi-Region Storage Layer: DynamoDB Global Tables [Real AWS]
- Replaces isolated regional tables with `AWS::DynamoDB::GlobalTable` (v2019.11.21).
- **Active-Active Replicas**: Replicated across `us-east-1` and `us-west-2`.
- **Conflict Resolution**: Last-Writer-Wins (LWW) based on DynamoDB's internal timestamps.
- **Replication Latency**: Typically < 1,000ms between US East and US West.
- **Cross-Region Write Units**: Every write in either region incurs a Replicated Write Unit (rWU) charged at $1.875 per million units.

### 3. Failover State Machine & Lifecycle
```
[ Normal Active ] ──(Region Outage)──▶ [ Degraded / Unhealthy ]
                                               │
                                       (Health Check Fails)
                                               │
                                               ▼
[ Failback Complete ] ◀──(Restore)── [ Failover Active (Secondary) ]
```

1. **Normal Active**: Route 53 routes 100% of user traffic to Primary API Gateway in `us-east-1`. Secondary region remains warm in standby.
2. **Degraded / Outage**: Primary region experiences disruption (`region-failure` injected). `GET /health` returns HTTP 503.
3. **Health Check Failure**: Route 53 marks primary endpoint UNHEALTHY after consecutive failed probes.
4. **DNS Failover to Secondary**: Route 53 automatically flips DNS resolution to the Secondary API Gateway in `us-west-2`.
5. **Secondary Active**: Event traffic enters `us-west-2`, buffered by secondary SQS and processed by secondary Lambda into DynamoDB Global Table.
6. **Recovery & Failback**: Administrator restores primary health. Route 53 health check passes, flipping primary DNS back to ACTIVE.

### 4. Controlled Failure Injection: Regional Failure (`region-failure`) [Real AWS] [Simulated]
- **Target**: Controlled regional health signal (`chaos-primary-unhealthy` flag in `ConfigTable`).
- **Safety Invariant**: Strict whitelist validation; never accepts arbitrary AWS resources, account-level deletes, or cross-tenant operations.
- **Execution Flow**:
  1. User triggers **💥 Fail Primary Region** from UI or API.
  2. Failure engine sets `chaos-primary-unhealthy` in `ConfigTable`.
  3. `HealthCheckFunction` (`GET /health`) reads the flag and begins returning HTTP 503.
  4. Route 53 health check fails and triggers DNS failover.

### 5. Multi-Region Disaster Recovery Metrics
- **RTO (Recovery Time Objective)**: Actual elapsed time until secondary region begins successfully processing traffic.
- **RPO (Recovery Point Objective)**: Data gap or lost events during the transition window.
- **Resilience Score (0–100%)**:
  $$\text{Score} = (0.30 \times \text{RTO Compliance}) + (0.30 \times \text{RPO Compliance}) + (0.30 \times \text{Data Consistency}) + (0.10 \times \text{Success Rate})$$
- **Regional Split**: Telemetry attributes events to `primaryEventsCount` (`us-east-1`) and `secondaryEventsCount` (`us-west-2`).

### 6. Multi-Region Cost Impact [Estimated]
Operating multi-region infrastructure incurs baseline standby overhead:
| Service Component | Single-Region Cost | Multi-Region Overhead |
|---|---|---|
| Route 53 Health Check | $0.50 / month (if active) | Standard public health check rate |
| Route 53 DNS Queries | $0.40 / 1M queries | Failover routing query costs |
| DynamoDB Writes | $1.25 / 1M WCU | + $1.875 / 1M replicated writes (rWU) |
| Cross-Region Data Transfer | $0.00 (same region) | $0.02 / GB |
| Secondary Standby Compute (API/Lambda/SQS) | $0.00 | $0.00 baseline (100% serverless, zero fixed idle cost) |

