export function calculateRTO(detectedAt: string, recoveredAt: string): number {
  return new Date(recoveredAt).getTime() - new Date(detectedAt).getTime();
}

export function calculateRPO(lastSuccessBeforeFailure: string, firstSuccessAfterRecovery: string): number {
  return new Date(firstSuccessAfterRecovery).getTime() - new Date(lastSuccessBeforeFailure).getTime();
}

export function getMetricStatus(metricName: string, value: number): 'good' | 'warning' | 'critical' {
  switch (metricName) {
    case 'RTO':
      if (value < 30000) return 'good';
      if (value < 60000) return 'warning';
      return 'critical';
    case 'RPO':
      if (value < 10000) return 'good';
      if (value < 30000) return 'warning';
      return 'critical';
    case 'dataConsistency':
      if (value >= 99) return 'good';
      if (value >= 95) return 'warning';
      return 'critical';
    default:
      return 'good';
  }
}
