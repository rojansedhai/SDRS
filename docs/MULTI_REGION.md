# 🌐 SDRS Phase 2 — Multi-Region Disaster Recovery Guide

This document provides complete technical, operational, and architectural documentation for the **Multi-Region Disaster Recovery** capabilities introduced in SDRS Phase 2.

---

## 1. Architecture Topology `[Phase 2]` `[Real AWS]` `[Simulated in Demo]`

```text
                        Route 53 (DNS Failover)
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
           PRIMARY REGION (`us-east-1`)   SECONDARY REGION (`us-west-2`)
               (ACTIVE)                      (STANDBY)
                    │                             │
               API Gateway                   API Gateway
                    │                             │
               EventBridge                   EventBridge
                    │                             │
                   SQS                           SQS
                    │                             │
                 Lambda                        Lambda
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                   DynamoDB Global Table (`EventsTable`)
                    (Active-Active Replicated Storage)
```

### Component Responsibility Matrix

| Component | Primary Region (`us-east-1`) | Secondary Region (`us-west-2`) | Operational State |
|---|---|---|---|
| **Route 53** | Active Target (`Failover: PRIMARY`) | Standby Target (`Failover: SECONDARY`) | Anycast DNS with fast 10s health check evaluation interval |
| **API Gateway** | HTTP API Ingress (Port 443) | HTTP API Ingress (Port 443) | Distinct regional endpoints with `/health` probe |
| **EventBridge** | `sdrs-event-bus` (Primary) | `sdrs-event-bus` (Secondary) | Independent regional event routing to regional SQS |
| **SQS + DLQ** | Regional Message Queue + DLQ | Regional Message Queue + DLQ | 180s visibility timeout; 3 max receives before DLQ |
| **Lambda Processor** | ARM64 / Node.js 22.x | ARM64 / Node.js 22.x | Batch size 10; conditional puts on DynamoDB |
| **DynamoDB** | `EventsGlobalTable` Replica | `EventsGlobalTable` Replica | Global Table with sub-second replication latency |

---

## 2. Route 53 Active-Passive DNS Failover `[Phase 2]` `[Real AWS]`

Route 53 manages DNS-level routing between the primary active region and the secondary standby region.

### Health Check Configuration
- **Resource Path**: `GET /health`
- **Protocol**: HTTPS (Port 443)
- **Request Interval**: 10 seconds (Fast interval)
- **Failure Threshold**: 3 consecutive failed checks
- **Detection Window**: \(3 \times 10\text{s} = 30\text{s}\)

### DNS Failover Mechanics & Propagation Latency `[Real AWS]`
In real AWS environments, DNS failover is **not instantaneous**:
1. **Health Probe Tripping**: Takes 30 seconds for 3 consecutive 503 errors.
2. **CloudWatch Alarm Transition**: Takes 10–15 seconds for Route 53 global health checkers to register the outage across AWS edge locations.
3. **DNS Caching / TTL Delay**: Clients cache DNS records according to the RecordSet TTL (configured to `60` seconds in SDRS).
4. **Total Expected Real-World RTO**: 60s to 90s under standard AWS Route 53 failover.

In **Demo Mode** `[Simulated]`, SDRS models this exact multi-stage progression:
- `0s`: Failure injected into Primary.
- `1.5s`: First error anomaly detected.
- `3.0s`: Health check threshold reached (`healthcheck-failed`).
- `4.5s`: Route 53 switches active CNAME to secondary (`failover`).
- `6.0s`: Secondary region becomes `active`, ingesting 100% of new traffic.
- `8.0s`: Steady-state traffic recovered with zero packet loss.

---

## 3. DynamoDB Global Tables (Active-Active Replication) `[Phase 2]` `[Real AWS]`

To prevent split-brain inconsistencies and ensure that events processed in either region are preserved, SDRS provisions **DynamoDB Global Tables** (`AWS::DynamoDB::GlobalTable`):

- **Tables Replicated**:
  - `EventsGlobalTable` (`eventId` PK, `experimentId-createdAt` GSI)
  - `ExperimentsGlobalTable` (`experimentId` PK)
  - `MetricsGlobalTable` (`experimentId` PK, `timestamp` SK)
  - `ConfigGlobalTable` (`configKey` PK)
- **Replication Protocol**: Fully managed by AWS using DynamoDB Streams.
- **Replication Latency**: Typically sub-second (50ms – 300ms inter-region latency between `us-east-1` and `us-west-2`).
- **Conflict Resolution**: Last-Writer-Wins (LWW) based on machine timestamp.

---

## 4. Regional Failure Injection (`💥 Fail Primary Region`) `[Phase 2]` `[Real AWS]` `[Simulated in Demo]`

### Mechanism
The regional failure injection targets only SDRS stack resources:
1. When user clicks **"💥 Fail Primary Region"**, the Failure Engine writes a chaos flag to `ConfigTable`:
   ```json
   {
     "configKey": "chaos-primary-unhealthy",
     "active": true,
     "experimentId": "exp-1234",
     "targetRegion": "us-east-1"
   }
   ```
2. The Primary API Gateway `GET /health` endpoint immediately begins returning **HTTP 503 Service Unavailable**:
   ```json
   {
     "status": "UNHEALTHY",
     "region": "us-east-1",
     "message": "Simulated Regional Outage: Primary region health check degraded by SDRS Failure Engine"
   }
   ```
3. Route 53 health checkers fail 3 consecutive probes and trigger failover to `us-west-2`.
4. Ingress traffic reroutes cleanly to the Secondary API Gateway.

### Recovery & Failback
1. When user clicks **"Restore Service"**, the Failure Engine clears the `chaos-primary-unhealthy` flag.
2. `GET /health` in `us-east-1` returns **HTTP 200 OK**.
3. Route 53 health checks pass and traffic gracefully returns to Primary (**Failback Completed**).

---

## 5. RTO/RPO Methodology & Resilience Score `[Phase 2]` `[AWS-Measured]`

SDRS allows experiments to define explicit recovery targets:
- **Target RTO**: (e.g. `60` seconds)
- **Target RPO**: (e.g. `0` events lost)

### Metric Definitions
- **Actual RTO `[Measured]`**: Elapsed time from `detectedAt` to `recoveredAt`.
- **Actual RPO `[Measured]`**: Count of lost or dropped requests during the failover transition window.
- **RTO Compliance**: `PASS` if `actualRto <= targetRtoSeconds * 1000`, else `FAIL`.
- **RPO Compliance**: `PASS` if `failedCount <= targetRpoEvents`, else `FAIL`.

### Resilience Score Algorithm `[Phase 2]`
A weighted composite index (0–100%):
$$\text{Resilience Score} = \text{Score}_{\text{RTO}} + \text{Score}_{\text{RPO}} + \text{Score}_{\text{Consistency}} + \text{Score}_{\text{Error}}$$
- **RTO Weight (30 pts)**: Full 30 points if within target, penalty proportional to delay if exceeded.
- **RPO Weight (30 pts)**: Full 30 points if 0 lost events, -5 points per dropped event.
- **Consistency Weight (30 pts)**: `(DataConsistency / 100) * 30`.
- **Error Rate Weight (10 pts)**: `(1 - ErrorRate) * 10`.

---

## 6. Multi-Region AWS Costs & Billing Protection `[Phase 2]` `[Estimated]`

Running a two-region active-passive architecture incurs slight operational overhead:

| Service | Single-Region Cost | Multi-Region Active-Passive Cost | Notes |
|---|---|---|---|
| **API Gateway** | \$1.00 / 1M reqs | \$1.00 / 1M reqs | Pay-per-use in active region |
| **SQS** | \$0.40 / 1M reqs | \$0.40 / 1M reqs | Pay-per-use in active region |
| **Lambda** | \$0.20 / 1M + compute | \$0.20 / 1M + compute | Pay-per-use in active region |
| **DynamoDB Writes** | \$1.25 / 1M writes | \$1.875 / 1M writes | Replicated Write Units (rWUs) for Global Tables |
| **Route 53 Health Probe** | \$0.00 | \$0.50 / month / probe | 1 HTTPS fast-interval check |
| **Route 53 DNS Queries** | \$0.00 | \$0.40 / 1M queries | Global Anycast DNS resolution |
| **Inter-Region Data Transfer** | \$0.00 | \$0.02 / GB | DynamoDB stream replication across AWS backbone |

> 💡 **Typical Cost**: Running a 5,000-request multi-region disaster recovery simulation costs **< \$0.03**.

---

## 7. Automated Multi-Region Deployment & Cleanup `[Phase 2]` `[Real AWS]`

### Automated Deployment (PowerShell)
```powershell
.\scripts\deploy-multi-region.ps1 -PrimaryRegion us-east-1 -SecondaryRegion us-west-2
```

### Automated Deployment (Bash)
```bash
./scripts/deploy-multi-region.sh
```

### Complete Teardown & Destruction
```bash
# 1. Delete Primary Stack
sam delete --stack-name sdrs-primary --region us-east-1 --no-prompts

# 2. Delete Secondary Stack
sam delete --stack-name sdrs-secondary --region us-west-2 --no-prompts

# 3. Delete Global Orchestrator
sam delete --stack-name sdrs-multiregion-orchestrator --region us-east-1 --no-prompts
```

---

## 8. Known Limitations `[Phase 2]`

1. **DNS Caching at ISP Level**: Certain external DNS resolvers ignore low TTLs (60s) and cache records for longer (up to 300s). In production environments, client-side retry libraries (e.g. AWS SDK with exponential backoff) are essential.
2. **Eventual Consistency on Global Tables**: Replicated writes between `us-east-1` and `us-west-2` complete in \~150ms. If an immediate read occurs on the standby region within 100ms of a write to primary, slight eventual consistency windows exist.
3. **Standby Queue Drainage**: In an ungraceful regional collapse, any messages already trapped inside the primary regional SQS queue cannot be processed until the primary region recovers and drains them.
4. **API Gateway Custom Domain & ACM Certificate Requirement**: Route 53 CNAME routing from a custom domain (e.g. `sdrs.example.com`) to an execute-api endpoint requires an API Gateway Custom Domain Name (`AWS::ApiGatewayV2::DomainName`) with a valid ACM TLS certificate in both regions. Without this, API Gateway rejects client requests with HTTP 403 Forbidden due to mismatched `Host` headers. For sandbox testing without custom domains, clients route directly to regional API Gateway URLs.

