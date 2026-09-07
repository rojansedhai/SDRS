export interface ExperimentMetrics {
  detectionTime?: number;
  failoverTime?: number;
  recoveryTime?: number;
  dnsFailoverTime?: number;
  secondaryActivationTime?: number;
  totalRequests: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  lostCount: number;
  primaryRequests?: number;
  secondaryRequests?: number;
  dataConsistency: number;
  rto?: number;
  rpo?: number;
  targetRtoSeconds?: number;
  targetRpoEvents?: number;
  rtoPass?: boolean;
  rpoPass?: boolean;
  resilienceScore?: number;
  estimatedCost: number;
}

export interface MetricSnapshot {
  timestamp: string;
  totalRequests: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  lostCount: number;
  primaryRequests?: number;
  secondaryRequests?: number;
  avgLatency: number;
  p95Latency: number;
  queueDepth: number;
  errorRate: number;
}

export interface MetricCardData {
  label: string;
  value: string | number;
  unit?: string;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
}
