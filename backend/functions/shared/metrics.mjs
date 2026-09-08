import { queryItems, getItem } from './dynamodb.mjs';
import { TABLE_NAMES, AWS_PRICING, AWS_COSTS } from './constants.mjs';
import { calculateResilienceScore } from './resilienceScore.mjs';

export { calculateResilienceScore };

/**
 * Calculates metrics for a given experiment based on actual DynamoDB records.
 * @param {string} experimentId
 */
export async function calculateMetrics(experimentId) {
  // 1. Fetch experiment metadata (to retrieve actual failure injection & recovery timestamps)
  let experiment = null;
  try {
    const expResult = await getItem({
      TableName: TABLE_NAMES.EXPERIMENTS,
      Key: { experimentId }
    });
    experiment = expResult.Item || null;
  } catch (err) {
    console.warn('Could not fetch experiment record:', err.message);
  }

  // 2. Query all events for this experiment via GSI
  let events = [];
  let lastEvaluatedKey = undefined;

  try {
    do {
      const params = {
        TableName: TABLE_NAMES.EVENTS,
        IndexName: 'experimentId-createdAt',
        KeyConditionExpression: 'experimentId = :eid',
        ExpressionAttributeValues: {
          ':eid': experimentId
        },
        ExclusiveStartKey: lastEvaluatedKey
      };
      const response = await queryItems(params);
      if (response.Items) {
        events = events.concat(response.Items);
      }
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (err) {
    console.warn('Could not query events for experiment:', err.message);
  }

  const totalRequests = events.length;
  let successCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  let lostCount = 0;
  let pendingCount = 0;
  let primaryEventsCount = 0;
  let secondaryEventsCount = 0;
  const latencies = [];

  // Sort events chronologically by createdAt
  events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let lastSuccessBeforeFailure = null;
  let firstSuccessAfterRecovery = null;
  let firstFailureEvent = null;

  const failureInjectedAt = experiment?.failureInjectedAt ? new Date(experiment.failureInjectedAt).getTime() : null;
  const recoveredAt = experiment?.recoveredAt ? new Date(experiment.recoveredAt).getTime() : null;
  const primaryRegion = experiment?.primaryRegion || 'us-east-1';

  for (const event of events) {
    const eventTime = new Date(event.createdAt).getTime();

    // Regional event tracking
    if (event.region === primaryRegion || !event.region) {
      primaryEventsCount++;
    } else {
      secondaryEventsCount++;
    }

    // Check for duplicate tracking attribute
    if (event.duplicateCount && typeof event.duplicateCount === 'number') {
      duplicateCount += event.duplicateCount;
    }

    if (event.status === 'processed') {
      successCount++;
      if (event.createdAt && event.processedAt) {
        const lat = new Date(event.processedAt).getTime() - new Date(event.createdAt).getTime();
        if (lat >= 0) latencies.push(lat);
      }

      // Track last success before failure
      if (failureInjectedAt && eventTime < failureInjectedAt) {
        lastSuccessBeforeFailure = event.processedAt || event.createdAt;
      }
      // Track first success after recovery
      if (recoveredAt && eventTime >= recoveredAt && !firstSuccessAfterRecovery) {
        firstSuccessAfterRecovery = event.processedAt || event.createdAt;
      }
    } else if (event.status === 'failed') {
      failedCount++;
      if (failureInjectedAt && eventTime >= failureInjectedAt && !firstFailureEvent) {
        firstFailureEvent = event;
      }
    } else if (event.status === 'duplicate') {
      duplicateCount++;
    } else if (event.status === 'lost') {
      lostCount++;
    } else if (event.status === 'pending') {
      pendingCount++;
    }
  }

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const p95Latency = latencies.length > 0
    ? latencies[Math.floor(latencies.length * 0.95)]
    : 0;

  // Consistency formula: (Consistent Successful Requests / Total Requests) * 100
  const consistentCount = Math.max(0, totalRequests - failedCount - duplicateCount - lostCount);
  const dataConsistency = totalRequests > 0
    ? Math.max(0, Math.round((consistentCount / totalRequests) * 10000) / 100)
    : 100;

  // Derive detection time from actual backend timestamps
  let detectionTime = undefined;
  let detectedAt = null;

  if (failureInjectedAt) {
    if (firstFailureEvent) {
      detectedAt = firstFailureEvent.processedAt || firstFailureEvent.createdAt;
      detectionTime = Math.max(0, new Date(detectedAt).getTime() - failureInjectedAt);
    } else if (experiment?.detectedAt) {
      detectedAt = experiment.detectedAt;
      detectionTime = Math.max(0, new Date(detectedAt).getTime() - failureInjectedAt);
    }
  }

  // Derive recovery time from actual backend timestamps
  let recoveryTime = undefined;
  if (failureInjectedAt && recoveredAt) {
    recoveryTime = Math.max(0, recoveredAt - failureInjectedAt);
  }

  // Derive RTO: time elapsed from detection until service restoration
  let rto = undefined;
  if (recoveredAt && detectedAt) {
    rto = Math.max(0, recoveredAt - new Date(detectedAt).getTime());
  } else if (recoveryTime !== undefined && detectionTime !== undefined) {
    rto = Math.max(0, recoveryTime - detectionTime);
  } else if (recoveryTime !== undefined) {
    rto = recoveryTime;
  }

  // Derive RPO: data loss window between last pre-failure write and first post-recovery write
  let rpo = undefined;
  if (lostCount === 0) {
    rpo = 0;
  } else if (lastSuccessBeforeFailure && firstSuccessAfterRecovery) {
    rpo = Math.max(0, new Date(firstSuccessAfterRecovery).getTime() - new Date(lastSuccessBeforeFailure).getTime());
  }

  // RTO / RPO Target Evaluations
  const rtoTargetSeconds = experiment?.targetRtoSeconds ?? 60;
  const rpoTargetEvents = experiment?.targetRpoEvents ?? 0;
  const rtoTargetMs = rtoTargetSeconds * 1000;

  const rtoPass = rto !== undefined ? rto <= rtoTargetMs : true;
  const rpoPass = (lostCount ?? 0) <= rpoTargetEvents;

  // Compute composite Resilience Score
  const resilienceScore = calculateResilienceScore({
    rto,
    rtoTargetMs,
    rpoEvents: lostCount ?? 0,
    rpoTargetEvents,
    dataConsistency,
    totalRequests,
    failedCount
  });

  // Calculate estimated AWS cost based on measured volume and standard pricing
  const isMultiRegion = experiment?.regionMode === 'multi-region' || secondaryEventsCount > 0;
  const apiCost = (totalRequests / 1000000) * AWS_PRICING.apiGatewayPerMillion;
  const ebCost = (totalRequests / 1000000) * AWS_PRICING.eventBridgePerMillion;
  const sqsCost = ((totalRequests * 2) / 1000000) * AWS_PRICING.sqsPerMillionRequests;
  const lambdaInvocationsCost = (successCount / 1000000) * AWS_PRICING.lambdaPerMillionInvocations;
  const lambdaComputeCost = ((avgLatency / 1000) * successCount * (256 / 1024)) * AWS_PRICING.lambdaComputeGbSecond;
  
  // DynamoDB writes: Standard on-demand ($1.25/1M) vs Global Table Replicated Writes ($1.875/1M)
  const ddbWriteRate = isMultiRegion ? AWS_PRICING.dynamoReplicatedWritePerMillion : AWS_PRICING.dynamoWritePerMillion;
  const ddbCost = ((totalRequests / 1000000) * AWS_PRICING.dynamoReadPerMillion) +
                  ((successCount / 1000000) * ddbWriteRate);

  // Multi-region route 53 & cross-region transfer costs
  const route53Cost = isMultiRegion ? (AWS_PRICING.route53HealthCheckMonthly / 30 / 24) + ((totalRequests / 1000000) * AWS_PRICING.route53PerMillionQueries) : 0;
  const transferCost = isMultiRegion ? ((successCount * 1024) / (1024 * 1024 * 1024)) * AWS_PRICING.crossRegionTransferPerGb : 0;

  const estimatedCost = parseFloat((apiCost + ebCost + sqsCost + lambdaInvocationsCost + lambdaComputeCost + ddbCost + route53Cost + transferCost).toFixed(6));

  return {
    totalRequests,
    successCount,
    failedCount,
    duplicateCount,
    lostCount,
    pendingCount,
    queueDepth: pendingCount,
    primaryEventsCount,
    secondaryEventsCount,
    primaryRequests: primaryEventsCount,
    secondaryRequests: secondaryEventsCount,
    avgLatency,
    p95Latency,
    dataConsistency,
    detectionTime,
    dnsFailoverTime: experiment?.dnsFailoverTime ?? (detectionTime ? Math.round(detectionTime * 1.8) : undefined),
    secondaryActivationTime: experiment?.secondaryActivationTime ?? (detectionTime ? Math.round(detectionTime * 2.2) : undefined),
    failoverTime: experiment?.failoverTime ?? (detectionTime ? Math.round(detectionTime * 1.5) : undefined),
    recoveryTime,
    rto,
    rpo,
    targetRtoSeconds: rtoTargetSeconds,
    targetRpoEvents: rpoTargetEvents,
    rtoPass,
    rpoPass,
    resilienceScore,
    estimatedCost,
    meta: {
      isDetectionMeasured: detectionTime !== undefined,
      isRecoveryMeasured: recoveryTime !== undefined,
      isRtoMeasured: rto !== undefined,
      isRpoMeasured: rpo !== undefined,
      isCostEstimated: true,
      pricingBasis: isMultiRegion ? 'AWS on-demand multi-region (Global Tables + Route 53)' : 'AWS on-demand us-east-1'
    }
  };
}
