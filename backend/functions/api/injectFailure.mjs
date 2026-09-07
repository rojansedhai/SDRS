import { getItem, updateItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES, FAILURE_TYPES } from '../shared/constants.mjs';
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

    const body = event.body ? JSON.parse(event.body) : {};
    const failureType = body.failureType;
    
    if (!Object.values(FAILURE_TYPES).includes(failureType)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid failure type', allowedTypes: Object.values(FAILURE_TYPES) })
      };
    }
    
    // Invoke Failure Engine
    const invokeCommand = new InvokeCommand({
      FunctionName: process.env.FAILURE_ENGINE_FUNCTION_NAME,
      Payload: Buffer.from(JSON.stringify({
        action: 'inject',
        failureType,
        experimentId
      }))
    });
    const invokeResponse = await lambdaClient.send(invokeCommand);
    if (invokeResponse.FunctionError) {
      const errorPayload = invokeResponse.Payload ? Buffer.from(invokeResponse.Payload).toString() : 'Unknown error';
      throw new Error(`FailureEngine execution failed: ${invokeResponse.FunctionError} - ${errorPayload}`);
    }
    
    const failureInjectedAt = new Date().toISOString();
    
    const updateParams = {
      TableName: TABLE_NAMES.EXPERIMENTS,
      Key: { experimentId },
      UpdateExpression: 'SET failureType = :failureType, failureInjectedAt = :failureInjectedAt',
      ExpressionAttributeValues: {
        ':failureType': failureType,
        ':failureInjectedAt': failureInjectedAt
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
    console.error('Error injecting failure:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to inject failure', message: error.message })
    };
  }
};
