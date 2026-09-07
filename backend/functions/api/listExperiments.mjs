import { docClient } from '../shared/dynamodb.mjs';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '../shared/constants.mjs';
import { requireAuth } from '../shared/auth.mjs';

export const handler = async (event) => {
  // SEC-01 & SEC-04: Strict authentication check
  const { errorResponse, userId } = requireAuth(event);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const command = new ScanCommand({
      TableName: TABLE_NAMES.EXPERIMENTS,
      FilterExpression: 'attribute_not_exists(userId) OR userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      },
      Limit: 100
    });
    
    const result = await docClient.send(command);
    let experiments = (result.Items || []).filter(exp => !exp.userId || exp.userId === userId);
    
    // Sort by startedAt descending
    experiments.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    // SEC-03: Return standard Content-Type; let API Gateway handle CORS
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(experiments)
    };
  } catch (error) {
    console.error('Error listing experiments:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to list experiments', message: error.message })
    };
  }
};
