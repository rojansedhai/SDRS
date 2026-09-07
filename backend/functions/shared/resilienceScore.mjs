/**
 * Calculates a composite Resilience Score (0 - 100%) based on:
 * - RTO compliance: up to 30 points
 * - RPO compliance: up to 30 points
 * - Data Consistency: up to 30 points
 * - Low Error Rate: up to 10 points
 */
export function calculateResilienceScore({
  rto,
  rtoTargetMs = 60000,
  rpoEvents = 0,
  rpoTargetEvents = 0,
  dataConsistency = 100,
  totalRequests = 1,
  failedCount = 0
}) {
  let rtoScore = 30;
  if (rto !== undefined && rtoTargetMs > 0) {
    if (rto <= rtoTargetMs) {
      rtoScore = 30;
    } else {
      const penalty = ((rto - rtoTargetMs) / rtoTargetMs) * 30;
      rtoScore = Math.max(0, Math.round(30 - penalty));
    }
  }

  let rpoScore = 30;
  if (rpoEvents <= rpoTargetEvents) {
    rpoScore = 30;
  } else {
    const excess = rpoEvents - rpoTargetEvents;
    rpoScore = Math.max(0, 30 - excess * 5);
  }

  const consistencyScore = Math.round((Math.max(0, Math.min(100, dataConsistency)) / 100) * 30);

  const errorRatio = totalRequests > 0 ? failedCount / totalRequests : 0;
  const errorScore = Math.max(0, Math.round((1 - errorRatio) * 10));

  return Math.max(0, Math.min(100, rtoScore + rpoScore + consistencyScore + errorScore));
}

