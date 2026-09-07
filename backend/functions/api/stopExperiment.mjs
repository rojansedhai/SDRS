import { updateItem, getItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES, EXPERIMENT_STATUS } from '../shared/constants.mjs';
import { calculateMetrics } from '../shared/metrics.mjs';
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

    const metrics = await calculateMetrics(experimentId);
    const stoppedAt = new Date().toISOString();
    
    const rtoTargetMs = (experiment.targetRtoSeconds ?? metrics.targetRtoSeconds ?? 60) * 1000;
    const rpoTargetEvents = experiment.targetRpoEvents ?? metrics.targetRpoEvents ?? 0;

    const rtoPass = metrics.rto !== undefined ? metrics.rto <= rtoTargetMs : true;
    const rpoPass = metrics.failedCount <= rpoTargetEvents;
    const consistencyPass = (metrics.dataConsistency ?? 100) >= 95;
    const hasRequests = metrics.totalRequests > 0;

    const isPass = rtoPass && rpoPass && consistencyPass && hasRequests;
    const resultStatus = isPass ? 'PASS' : 'FAIL';
    
    const updateParams = {
      TableName: TABLE_NAMES.EXPERIMENTS,
      Key: { experimentId },
      UpdateExpression: 'SET #st = :status, stoppedAt = :stoppedAt, #m = :metrics, isPass = :isPass, #res = :result',
      ExpressionAttributeNames: {
        '#st': 'status',
        '#res': 'result',
        '#m': 'metrics'
      },
      ExpressionAttributeValues: {
        ':status': EXPERIMENT_STATUS.COMPLETED,
        ':stoppedAt': stoppedAt,
        ':metrics': metrics,
        ':isPass': isPass,
        ':result': resultStatus
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await updateItem(updateParams);
    
    // SEC-03: Return standard Content-Type; let API Gateway handle CORS
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error('Error stopping experiment:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to stop experiment', message: error.message })
    };
  }
};
