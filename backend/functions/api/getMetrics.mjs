import { calculateMetrics } from '../shared/metrics.mjs';
import { queryItems, getItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES } from '../shared/constants.mjs';
import { requireAuth, forbiddenResponse } from '../shared/auth.mjs';

export const handler = async (event) => {
  // SEC-01 & SEC-04: Strict authentication check
  const { errorResponse, userId } = requireAuth(event);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const experimentId = event.pathParameters?.id;
    if (!experimentId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing experiment ID' })
      };
    }

    // Fetch and validate experiment ownership
    const expRecord = await getItem({
      TableName: TABLE_NAMES.EXPERIMENTS,
      Key: { experimentId }
    });
    const experiment = expRecord.Item;
    if (!experiment) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NotFound', message: `Experiment '${experimentId}' not found.` })
      };
    }

    // SEC-04: Enforce ownership check
    if (experiment.userId && experiment.userId !== userId) {
      return forbiddenResponse(experiment.userId, userId);
    }
    
    const currentMetrics = await calculateMetrics(experimentId);
    
    const queryParams = {
      TableName: TABLE_NAMES.METRICS,
      KeyConditionExpression: 'experimentId = :eid',
      ExpressionAttributeValues: {
        ':eid': experimentId
      }
    };
    
    const result = await queryItems(queryParams);
    const rawSnapshots = result.Items || [];
    
    // Normalize historical snapshots so properties are flat for TimeSeriesChart & MetricSnapshot compatibility
    const historicalSnapshots = rawSnapshots.map((item) => {
      const m = item.metrics || {};
      return {
        timestamp: item.timestamp,
        totalRequests: m.totalRequests ?? 0,
        successCount: m.successCount ?? 0,
        failedCount: m.failedCount ?? 0,
        duplicateCount: m.duplicateCount ?? 0,
        lostCount: m.lostCount ?? 0,
        primaryRequests: m.primaryRequests ?? m.primaryEventsCount ?? 0,
        secondaryRequests: m.secondaryRequests ?? m.secondaryEventsCount ?? 0,
        avgLatency: m.avgLatency ?? 0,
        p95Latency: m.p95Latency ?? 0,
        queueDepth: m.lostCount ?? 0,
        errorRate: m.totalRequests > 0 ? Math.round((m.failedCount / m.totalRequests) * 100) : 0,
        metrics: m
      };
    });
    
    // SEC-03: Return standard Content-Type; let API Gateway handle CORS
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current: currentMetrics,
        history: historicalSnapshots
      })
    };
  } catch (error) {
    console.error('Error getting metrics:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get metrics', message: error.message })
    };
  }
};
