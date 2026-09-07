export const AWS_PRICING = {
  apiRequests: 0.000001, // $1.00 per 1M requests
  lambdaInvocations: 0.0000002, // $0.20 per 1M invocations
  lambdaDurationMs: 0.0000000166667, // per ms for 1GB (arm64 ~$0.0000133/GB-s)
  sqsRequests: 0.0000004, // $0.40 per 1M requests
  dynamodbReads: 0.00000025, // $0.25 per 1M reads
  dynamodbWrites: 0.00000125, // $1.25 per 1M standard writes
  dynamodbReplicatedWrites: 0.000001875, // $1.875 per 1M replicated writes (Global Tables)
  eventbridgeEvents: 0.000001, // $1.00 per 1M events
  route53HealthCheckHourly: 0.50 / 720, // $0.50 / month / check (~$0.000694 / hr)
  route53Queries: 0.0000004, // $0.40 per 1M DNS queries
  crossRegionTransferPerByte: 0.02 / (1024 * 1024 * 1024), // $0.02 per GB
};

export interface UsageMetrics {
  apiRequests: number;
  lambdaInvocations: number;
  lambdaDurationMs: number;
  sqsRequests: number;
  dynamodbReads: number;
  dynamodbWrites: number;
  eventbridgeEvents: number;
  isMultiRegion?: boolean;
  primaryRequests?: number;
  secondaryRequests?: number;
}

export interface DetailedCostBreakdown {
  primaryCost: number;
  secondaryCost: number;
  globalTableCost: number;
  route53Cost: number;
  transferCost: number;
  totalCost: number;
}

export function calculateDetailedCost(metrics: UsageMetrics): DetailedCostBreakdown {
  const isMulti = !!metrics.isMultiRegion;
  const primaryReqs = metrics.primaryRequests ?? (isMulti ? Math.round(metrics.apiRequests * 0.6) : metrics.apiRequests);
  const secondaryReqs = metrics.secondaryRequests ?? (isMulti ? Math.max(0, metrics.apiRequests - primaryReqs) : 0);

  // Compute primary and secondary compute & messaging costs
  const computeRatio = metrics.apiRequests > 0 ? primaryReqs / metrics.apiRequests : 1;
  const secComputeRatio = metrics.apiRequests > 0 ? secondaryReqs / metrics.apiRequests : 0;

  const baseLambda = metrics.lambdaInvocations * AWS_PRICING.lambdaInvocations + metrics.lambdaDurationMs * AWS_PRICING.lambdaDurationMs;
  const baseSqs = metrics.sqsRequests * AWS_PRICING.sqsRequests;
  const baseEb = metrics.eventbridgeEvents * AWS_PRICING.eventbridgeEvents;
  const baseApi = metrics.apiRequests * AWS_PRICING.apiRequests;

  const primaryCost = (baseLambda + baseSqs + baseEb + baseApi) * computeRatio;
  const secondaryCost = (baseLambda + baseSqs + baseEb + baseApi) * secComputeRatio;

  // DynamoDB Storage & Replication
  const ddbRate = isMulti ? AWS_PRICING.dynamodbReplicatedWrites : AWS_PRICING.dynamodbWrites;
  const globalTableCost = (metrics.dynamodbReads * AWS_PRICING.dynamodbReads) + (metrics.dynamodbWrites * ddbRate);

  // Route 53 & Cross Region Data Transfer
  const route53Cost = isMulti ? (AWS_PRICING.route53HealthCheckHourly * 1) + (metrics.apiRequests * AWS_PRICING.route53Queries) : 0;
  const transferCost = isMulti ? (metrics.dynamodbWrites * 1024 * AWS_PRICING.crossRegionTransferPerByte) : 0;

  const totalCost = primaryCost + secondaryCost + globalTableCost + route53Cost + transferCost;

  return {
    primaryCost: parseFloat(primaryCost.toFixed(6)),
    secondaryCost: parseFloat(secondaryCost.toFixed(6)),
    globalTableCost: parseFloat(globalTableCost.toFixed(6)),
    route53Cost: parseFloat(route53Cost.toFixed(6)),
    transferCost: parseFloat(transferCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6))
  };
}

export function calculateEstimatedCost(metrics: UsageMetrics): number {
  return calculateDetailedCost(metrics).totalCost;
}
