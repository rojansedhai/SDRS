import { getItem, putItem, updateItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES, EVENT_STATUS } from '../shared/constants.mjs';
import { calculateMetrics } from '../shared/metrics.mjs';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const handler = async (event) => {
  const batchItemFailures = [];
  let processedCount = 0;
  let currentExperimentId = null;

  // Check config table once per invocation for chaos flags
  let isDdbThrottle = false;
  try {
    const ddbThrottleConfig = await getItem({
      TableName: TABLE_NAMES.CONFIG,
      Key: { configKey: 'chaos-ddb-throttle' }
    });
    isDdbThrottle = !!(ddbThrottleConfig.Item && ddbThrottleConfig.Item.active);
  } catch (cfgErr) {
    console.warn('Could not read ConfigTable for chaos flags:', cfgErr.message);
  }

  for (const record of event.Records || []) {
    try {
      const body = JSON.parse(record.body);
      // For SQS events containing EventBridge envelope:
      const payload = body.detail || body;
      const simEvent = typeof payload === 'string' ? JSON.parse(payload) : payload;

      const receivedAt = new Date(parseInt(record.attributes.SentTimestamp)).toISOString();
      const processedAt = new Date().toISOString();
      currentExperimentId = simEvent.experimentId || currentExperimentId;

      if (isDdbThrottle) {
        // Add 2s throttle latency
        await sleep(2000);
        // 50% failure rate simulating ProvisionedThroughputExceededException
        if (Math.random() < 0.5) {
          const throttleError = new Error('ProvisionedThroughputExceededException: The level of configured provisioned throughput for the table was exceeded.');
          throttleError.name = 'ProvisionedThroughputExceededException';
          throw throttleError;
        }
      }

      simEvent.receivedAt = receivedAt;
      simEvent.processedAt = processedAt;
      simEvent.status = EVENT_STATUS.PROCESSED;

      try {
        // Transition from pending to processed, or insert if not existing
        await putItem({
          TableName: TABLE_NAMES.EVENTS,
          Item: simEvent,
          ConditionExpression: 'attribute_not_exists(eventId) OR #st = :pending',
          ExpressionAttributeNames: {
            '#st': 'status'
          },
          ExpressionAttributeValues: {
            ':pending': EVENT_STATUS.PENDING
          }
        });
        processedCount++;
      } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
          // Idempotency check prevented duplicate write.
          // Increment duplicate counter on original item for metrics audit.
          console.warn(`[Idempotency] Duplicate event prevented: ${simEvent.eventId}`);
          try {
            await updateItem({
              TableName: TABLE_NAMES.EVENTS,
              Key: { eventId: simEvent.eventId },
              UpdateExpression: 'ADD duplicateCount :one SET lastDuplicateAt = :now',
              ExpressionAttributeValues: {
                ':one': 1,
                ':now': processedAt
              }
            });
          } catch (dupUpdateErr) {
            console.error('Could not update duplicate counter:', dupUpdateErr);
          }
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error(`Error processing SQS record ${record.messageId}:`, error);
      // Allow SQS to handle individual retries and redrive to DLQ via partial batch response
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Record a metrics snapshot if events were processed
  if (processedCount > 0 && currentExperimentId) {
    try {
      const metrics = await calculateMetrics(currentExperimentId);
      await putItem({
        TableName: TABLE_NAMES.METRICS,
        Item: {
          experimentId: currentExperimentId,
          timestamp: new Date().toISOString(),
          metrics
        }
      });
    } catch (metricErr) {
      console.warn('Could not record metrics snapshot:', metricErr.message);
    }
  }

  return { batchItemFailures };
};
