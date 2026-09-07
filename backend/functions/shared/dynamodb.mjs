import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

export async function putItem(params) {
  const command = new PutCommand(params);
  return docClient.send(command);
}

export async function getItem(params) {
  const command = new GetCommand(params);
  return docClient.send(command);
}

export async function queryItems(params) {
  const command = new QueryCommand(params);
  return docClient.send(command);
}

export async function updateItem(params) {
  const command = new UpdateCommand(params);
  return docClient.send(command);
}

export async function batchWriteItems(params) {
  const command = new BatchWriteCommand(params);
  return docClient.send(command);
}

/**
 * Writes items in batches and actively retries any UnprocessedItems with bounded exponential backoff.
 * Ensures that partial write failures do not silently drop items.
 * @param {object} params - BatchWriteCommand parameters containing RequestItems
 * @param {number} [maxRetries=4] - Maximum retry attempts for unprocessed items
 * @param {number} [baseDelayMs=50] - Base delay in milliseconds for exponential backoff
 * @returns {Promise<{ success: boolean, attempts: number, totalProcessed: number }>}
 */
export async function batchWriteWithRetry(params, maxRetries = 4, baseDelayMs = 50) {
  let requestItems = params.RequestItems;
  let attempt = 0;
  let totalProcessed = 0;

  while (requestItems && Object.keys(requestItems).length > 0) {
    const command = new BatchWriteCommand({ RequestItems: requestItems });
    const response = await docClient.send(command);

    // Count items successfully accepted in this round
    for (const tableName of Object.keys(requestItems)) {
      const attemptedCount = requestItems[tableName]?.length || 0;
      const unprocessedCount = response.UnprocessedItems?.[tableName]?.length || 0;
      totalProcessed += (attemptedCount - unprocessedCount);
    }

    const unprocessed = response.UnprocessedItems;
    if (!unprocessed || Object.keys(unprocessed).length === 0) {
      return { success: true, attempts: attempt + 1, totalProcessed };
    }

    attempt++;
    if (attempt > maxRetries) {
      const remainingCount = Object.values(unprocessed).reduce((acc, items) => acc + items.length, 0);
      throw new Error(`DynamoDB BatchWrite failed: ${remainingCount} items remained unprocessed after ${maxRetries} retries due to persistent throughput throttling.`);
    }

    // Bounded exponential backoff with jitter
    const jitter = Math.random() * 25;
    const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
    await new Promise(resolve => setTimeout(resolve, delay));
    requestItems = unprocessed;
  }

  return { success: true, attempts: attempt, totalProcessed };
}
