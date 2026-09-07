import { ExperimentMetrics } from './metrics';

export type FailureType =
  | 'lambda-failure'
  | 'sqs-backlog'
  | 'ddb-throttle'
  | 'api-failure'
  | 'eventbridge-failure'
  | 'region-failure'; // Phase 2: Regional outage triggering Route 53 DNS failover

export interface TimelineEvent {
  timestamp: string;
  label: string;
  type:
    | 'start'
    | 'normal'
    | 'failure'
    | 'detection'
    | 'healthcheck-failed'
    | 'failover'
    | 'secondary-active'
    | 'recovery'
    | 'failback'
    | 'stop';
  description: string;
}

export interface Experiment {
  experimentId: string;
  name: string;
  scenario: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  stoppedAt?: string;
  failureType?: FailureType;
  failureInjectedAt?: string;
  detectedAt?: string;
  failoverStartedAt?: string;
  recoveredAt?: string;
  region: string;
  regionMode?: 'single-region' | 'multi-region';
  primaryRegion?: string;
  secondaryRegion?: string;
  targetRtoSeconds?: number;
  targetRpoEvents?: number;
  resilienceScore?: number;
  metrics?: ExperimentMetrics;
  result: 'PASS' | 'FAIL' | null;
  timeline: TimelineEvent[];
}

export interface PredefinedScenario {
  id: string;
  name: string;
  description: string;
  failureType: FailureType;
  icon: string;
  targetRtoSeconds?: number;
  targetRpoEvents?: number;
  regionMode?: 'single-region' | 'multi-region';
}
