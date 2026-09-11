import { getItem, putItem, updateItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES } from '../shared/constants.mjs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { requireAuth, forbiddenResponse } from '../shared/auth.mjs';

const lambdaClient = new LambdaClient({ region: process.env.REGION || 'us-east-1' });

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
    const expResult = await getItem({
      TableName: TABLE_NAMES.EXPERIMENTS,
      Key: { experimentId }
    });
    const experiment = expResult.Item;
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
    
    const recoveredAt = new Date().toISOString();
    const restoredAt = recoveredAt;

    // 1. Immediate self-healing: clear simulator flags in ConfigTable directly
    try {
      await Promise.all([
        putItem({
          TableName: TABLE_NAMES.CONFIG,
          Item: { configKey: 'chaos-ddb-throttle', active: false, restoredAt }
        }),
        putItem({
          TableName: TABLE_NAMES.CONFIG,
          Item: { configKey: 'chaos-api-failure', active: false, restoredAt }
        }),
        putItem({
          TableName: TABLE_NAMES.CONFIG,
          Item: { configKey: 'chaos-primary-unhealthy', active: false, restoredAt }
        }),
        putItem({
          TableName: TABLE_NAMES.CONFIG,
          Item: { configKey: 'chaos-eventbridge-failure', active: false, restoredAt }
        })
      ]);
    } catch (cfgErr) {
      console.warn('Could not reset ConfigTable flags directly:', cfgErr.message);
    }

    // 2. Invoke Failure Engine with retry backoff for rate limits/concurrency contention
    let lastError = null;
    let invokeSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const invokeCommand = new InvokeCommand({
          FunctionName: process.env.FAILURE_ENGINE_FUNCTION_NAME,
          Payload: Buffer.from(JSON.stringify({
            action: 'restore',
            experimentId
          }))
        });
        const invokeResponse = await lambdaClient.send(invokeCommand);
        if (invokeResponse.FunctionError) {
          const errorPayload = invokeResponse.Payload ? Buffer.from(invokeResponse.Payload).toString() : 'Unknown error';
          throw new Error(`FailureEngine restore failed: ${invokeResponse.FunctionError} - ${errorPayload}`);
        }
        invokeSuccess = true;
        break;
      } catch (invokeErr) {
        lastError = invokeErr;
        console.warn(`FailureEngine invocation attempt ${attempt} failed:`, invokeErr.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 500));
        }
      }
    }

    if (!invokeSuccess) {
      console.warn('FailureEngine invoke failed after retries, but config flags were cleared directly:', lastError?.message);
    }
    
    const updateParams = {
      TableName: TABLE_NAMES.EXPERIMENTS,
      Key: { experimentId },
      UpdateExpression: 'SET recoveredAt = :recoveredAt',
      ExpressionAttributeValues: {
        ':recoveredAt': recoveredAt
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
    console.error('Error restoring service:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to restore service', message: error.message })
    };
  }
};
