import { Experiment, FailureType, TimelineEvent } from '../types/experiment';
import { ExperimentMetrics, MetricSnapshot } from '../types/metrics';
import { ServiceStatus, ServiceType } from '../types/architecture';
import { calculateEstimatedCost } from '../utils/cost';

export const mockExperiments: Experiment[] = [
  {
    experimentId: 'exp-1',
    name: 'Lambda Concurrency Collapse',
    scenario: 'Simulate sudden Lambda exhaustion and recovery via DLQ',
    status: 'completed',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    stoppedAt: new Date(Date.now() - 3480000).toISOString(),
    failureType: 'lambda-failure',
    failureInjectedAt: new Date(Date.now() - 3570000).toISOString(),
    detectedAt: new Date(Date.now() - 3568200).toISOString(),
    failoverStartedAt: new Date(Date.now() - 3566000).toISOString(),
    recoveredAt: new Date(Date.now() - 3545000).toISOString(),
    region: 'us-east-1',
    regionMode: 'single-region',
    targetRtoSeconds: 60,
    targetRpoEvents: 0,
    resilienceScore: 98,
    result: 'PASS',
    metrics: {
      detectionTime: 1800,
      failoverTime: 4000,
      recoveryTime: 25000,
      totalRequests: 2450,
      successCount: 2380,
      failedCount: 70,
      duplicateCount: 12,
      lostCount: 0,
      dataConsistency: 99.5,
      rto: 23200,
      rpo: 0,
      targetRtoSeconds: 60,
      targetRpoEvents: 0,
      rtoPass: true,
      rpoPass: true,
      resilienceScore: 98,
      estimatedCost: 0.0084
    },
    timeline: [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), label: 'Experiment Started', type: 'start', description: 'Experiment baseline started' },
      { timestamp: new Date(Date.now() - 3570000).toISOString(), label: 'Failure Injected', type: 'failure', description: 'Lambda concurrency zeroed' },
      { timestamp: new Date(Date.now() - 3568200).toISOString(), label: 'Failure Detected', type: 'detection', description: 'CloudWatch 5xx alarm triggered' },
      { timestamp: new Date(Date.now() - 3566000).toISOString(), label: 'Failover Triggered', type: 'failover', description: 'Backup consumer engaged' },
      { timestamp: new Date(Date.now() - 3545000).toISOString(), label: 'Service Recovered', type: 'recovery', description: 'Concurrency restored' },
      { timestamp: new Date(Date.now() - 3480000).toISOString(), label: 'Experiment Stopped', type: 'stop', description: 'Metrics consolidated' }
    ]
  },
  {
    experimentId: 'exp-2',
    name: 'DynamoDB Write Throttling',
    scenario: 'Inject heavy write throttling on primary order table',
    status: 'completed',
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    stoppedAt: new Date(Date.now() - 7050000).toISOString(),
    failureType: 'ddb-throttle',
    failureInjectedAt: new Date(Date.now() - 7180000).toISOString(),
    detectedAt: new Date(Date.now() - 7177500).toISOString(),
    recoveredAt: new Date(Date.now() - 7130000).toISOString(),
    region: 'us-east-1',
    regionMode: 'single-region',
    targetRtoSeconds: 60,
    targetRpoEvents: 150,
    resilienceScore: 88,
    result: 'PASS',
    metrics: {
      detectionTime: 2500,
      failoverTime: 0,
      recoveryTime: 50000,
      totalRequests: 3120,
      successCount: 3010,
      failedCount: 110,
      duplicateCount: 45,
      lostCount: 0,
      dataConsistency: 96.47,
      rto: 47500,
      rpo: 4100,
      targetRtoSeconds: 60,
      targetRpoEvents: 150,
      rtoPass: true,
      rpoPass: true,
      resilienceScore: 88,
      estimatedCost: 0.0125
    },
    timeline: [
      { timestamp: new Date(Date.now() - 7200000).toISOString(), label: 'Experiment Started', type: 'start', description: 'Test initialized' },
      { timestamp: new Date(Date.now() - 7180000).toISOString(), label: 'Failure Injected', type: 'failure', description: 'Throttling simulated' },
      { timestamp: new Date(Date.now() - 7177500).toISOString(), label: 'Failure Detected', type: 'detection', description: 'Throughput exceeded exception' },
      { timestamp: new Date(Date.now() - 7130000).toISOString(), label: 'Service Recovered', type: 'recovery', description: 'Exponential backoff resolved' },
      { timestamp: new Date(Date.now() - 7050000).toISOString(), label: 'Experiment Stopped', type: 'stop', description: 'Test completed' }
    ]
  },
  {
    experimentId: 'exp-3',
    name: 'Multi-Region Failover & Recovery',
    scenario: 'Route 53 active-passive failover on primary region outage',
    status: 'completed',
    startedAt: new Date(Date.now() - 10800000).toISOString(),
    stoppedAt: new Date(Date.now() - 10500000).toISOString(),
    failureType: 'region-failure',
    failureInjectedAt: new Date(Date.now() - 10740000).toISOString(),
    detectedAt: new Date(Date.now() - 10720000).toISOString(),
    failoverStartedAt: new Date(Date.now() - 10700000).toISOString(),
    recoveredAt: new Date(Date.now() - 10620000).toISOString(),
    region: 'us-east-1',
    regionMode: 'multi-region',
    primaryRegion: 'us-east-1',
    secondaryRegion: 'us-west-2',
    targetRtoSeconds: 60,
    targetRpoEvents: 0,
    resilienceScore: 97,
    result: 'PASS',
    metrics: {
      detectionTime: 20000,
      dnsFailoverTime: 40000,
      secondaryActivationTime: 45000,
      failoverTime: 40000,
      recoveryTime: 120000,
      totalRequests: 4800,
      successCount: 4765,
      failedCount: 35,
      duplicateCount: 8,
      lostCount: 0,
      primaryRequests: 2600,
      secondaryRequests: 2200,
      dataConsistency: 99.1,
      rto: 42000,
      rpo: 0,
      targetRtoSeconds: 60,
      targetRpoEvents: 0,
      rtoPass: true,
      rpoPass: true,
      resilienceScore: 97,
      estimatedCost: 0.0215
    },
    timeline: [
      { timestamp: new Date(Date.now() - 10800000).toISOString(), label: 'Experiment Started', type: 'start', description: 'Multi-Region baseline load established' },
      { timestamp: new Date(Date.now() - 10740000).toISOString(), label: 'Primary Failure Injected', type: 'failure', description: 'Primary region health check degraded' },
      { timestamp: new Date(Date.now() - 10720000).toISOString(), label: 'Health Check Failed', type: 'healthcheck-failed', description: 'Route 53 marked Primary unhealthy (3/3 failures)' },
      { timestamp: new Date(Date.now() - 10700000).toISOString(), label: 'Failover Started', type: 'failover', description: 'Route 53 DNS redirected to Secondary (us-west-2)' },
      { timestamp: new Date(Date.now() - 10695000).toISOString(), label: 'Secondary Active', type: 'secondary-active', description: 'Secondary Region begins processing full ingress' },
      { timestamp: new Date(Date.now() - 10660000).toISOString(), label: 'Traffic Recovered', type: 'recovery', description: 'Zero dropped requests; global table synchronized' },
      { timestamp: new Date(Date.now() - 10640000).toISOString(), label: 'Primary Restored', type: 'normal', description: 'Primary health check returned HTTP 200' },
      { timestamp: new Date(Date.now() - 10620000).toISOString(), label: 'Failback Completed', type: 'failback', description: 'Route 53 restored active status to us-east-1' }
    ]
  }
];

export function createInitialMetrics(isMultiRegion = false): ExperimentMetrics {
  return {
    totalRequests: 100,
    successCount: 100,
    failedCount: 0,
    duplicateCount: 0,
    lostCount: 0,
    primaryRequests: isMultiRegion ? 100 : 100,
    secondaryRequests: 0,
    dataConsistency: 100,
    detectionTime: undefined,
    failoverTime: undefined,
    dnsFailoverTime: undefined,
    secondaryActivationTime: undefined,
    recoveryTime: undefined,
    rto: undefined,
    rpo: undefined,
    targetRtoSeconds: 60,
    targetRpoEvents: 0,
    rtoPass: true,
    rpoPass: true,
    resilienceScore: 100,
    estimatedCost: calculateEstimatedCost({
      apiRequests: 100,
      lambdaInvocations: 100,
      lambdaDurationMs: 100 * 120,
      sqsRequests: 100 * 2,
      dynamodbReads: 100,
      dynamodbWrites: 100,
      eventbridgeEvents: 100,
      isMultiRegion,
      primaryRequests: 100,
      secondaryRequests: 0
    })
  };
}

export function createInitialHistory(): MetricSnapshot[] {
  const now = Date.now();
  return Array.from({ length: 25 }).map((_, i) => {
    const total = 50 + i * 2 + Math.floor(Math.random() * 5);
    return {
      timestamp: new Date(now - (25 - i) * 2000).toISOString(),
      totalRequests: total,
      successCount: total,
      failedCount: 0,
      duplicateCount: 0,
      lostCount: 0,
      primaryRequests: total,
      secondaryRequests: 0,
      avgLatency: Math.floor(Math.random() * 20 + 80),
      p95Latency: Math.floor(Math.random() * 40 + 120),
      queueDepth: Math.floor(Math.random() * 3),
      errorRate: 0,
    };
  });
}

export const mockMetricsHistory: MetricSnapshot[] = createInitialHistory();

export function simulateFailure(type: FailureType): Record<ServiceType, ServiceStatus> {
  const statuses: Record<ServiceType, ServiceStatus> = {
    'api-gateway': 'healthy',
    eventbridge: 'healthy',
    sqs: 'healthy',
    lambda: 'healthy',
    dynamodb: 'healthy',
    route53: 'healthy',
    'dynamodb-global': 'healthy'
  };

  switch (type) {
    case 'lambda-failure':
      statuses.lambda = 'failed';
      statuses.sqs = 'degraded';
      break;
    case 'ddb-throttle':
      statuses.dynamodb = 'failed';
      statuses.lambda = 'degraded';
      break;
    case 'sqs-backlog':
      statuses.sqs = 'failed';
      statuses.lambda = 'degraded';
      break;
    case 'api-failure':
      statuses['api-gateway'] = 'failed';
      break;
    case 'eventbridge-failure':
      statuses.eventbridge = 'failed';
      break;
    case 'region-failure':
      statuses['api-gateway'] = 'failed';
      statuses.eventbridge = 'degraded';
      statuses.sqs = 'degraded';
      statuses.lambda = 'degraded';
      statuses.route53 = 'degraded';
      break;
  }
  return statuses;
}

export function simulateRecovery(): Record<ServiceType, ServiceStatus> {
  return {
    'api-gateway': 'healthy',
    eventbridge: 'healthy',
    sqs: 'healthy',
    lambda: 'healthy',
    dynamodb: 'healthy',
    route53: 'healthy',
    'dynamodb-global': 'healthy'
  };
}

export function generateMockTimeline(type: TimelineEvent['type'], detail?: string): TimelineEvent {
  const labels: Record<TimelineEvent['type'], string> = {
    start: 'Experiment Started',
    normal: 'System Operating Normally',
    failure: 'Failure Injected',
    detection: 'Failure Detected',
    'healthcheck-failed': 'Health Check Failed',
    failover: 'Route 53 Failover Started',
    'secondary-active': 'Secondary Region Active',
    recovery: 'Traffic Recovered',
    failback: 'Failback Completed',
    stop: 'Experiment Stopped'
  };
  return {
    timestamp: new Date().toISOString(),
    label: labels[type] || 'Milestone Reached',
    type,
    description: detail || `Automated event triggered: ${type}`
  };
}
