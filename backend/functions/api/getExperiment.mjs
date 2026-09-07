import { getItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES } from '../shared/constants.mjs';
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
    
    const result = await getItem({
      TableName: TABLE_NAMES.EXPERIMENTS,
      Key: { experimentId }
    });
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NotFound', message: `Experiment '${experimentId}' not found.` })
      };
    }
    
    const experiment = result.Item;

    // SEC-04: Enforce ownership check
    if (experiment.userId && experiment.userId !== userId) {
      return forbiddenResponse(experiment.userId, userId);
    }

    if (experiment.status === 'running') {
      const currentMetrics = await calculateMetrics(experimentId);
      experiment.metrics = currentMetrics;
    }
    
    // SEC-03: Return standard Content-Type; let API Gateway handle CORS
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(experiment)
    };
  } catch (error) {
    console.error('Error getting experiment:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get experiment', message: error.message })
    };
  }
};
