import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { getItem, updateItem, batchWriteWithRetry } from '../shared/dynamodb.mjs';
import { TABLE_NAMES, EXPERIMENT_STATUS, MAX_EXPERIMENT_DURATION_MS } from '../shared/constants.mjs';
import { createEvent } from '../shared/eventSchema.mjs';
import { requireAuth, forbiddenResponse } from '../shared/auth.mjs';

const ebClient = new EventBridgeClient({ region: process.env.REGION || 'us-east-1' });

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

    // Fetch and validate experiment ownership and lifecycle
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

    // OPS-02: Check experiment lifecycle status
    if (experiment.status === EXPERIMENT_STATUS.COMPLETED) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'ExperimentClosed',
          message: 'Experiment is already marked COMPLETED. Workload generation rejected.'
        })
      };
    }

    // OPS-02 & COD-01: Enforce MAX_EXPERIMENT_DURATION_MS (30 mins) server-side
    const elapsedMs = Date.now() - new Date(experiment.startedAt).getTime();
    if (elapsedMs > MAX_EXPERIMENT_DURATION_MS) {
      console.warn(`[CostCap] Experiment ${experimentId} exceeded maximum duration (${elapsedMs}ms > ${MAX_EXPERIMENT_DURATION_MS}ms). Auto-finalizing.`);
      const stoppedAt = new Date().toISOString();
      await updateItem({
        TableName: TABLE_NAMES.EXPERIMENTS,
        Key: { experimentId },
        UpdateExpression: 'SET #st = :status, stoppedAt = :stoppedAt, autoExpired = :expired, #res = :result',
        ExpressionAttributeNames: { '#st': 'status', '#res': 'result' },
        ExpressionAttributeValues: {
          ':status': EXPERIMENT_STATUS.COMPLETED,
          ':stoppedAt': stoppedAt,
          ':expired': true,
          ':result': 'EXPIRED'
        }
      });

      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'ExperimentExpired',
          message: `Experiment exceeded maximum allowed duration of ${MAX_EXPERIMENT_DURATION_MS / 60000} minutes. Workload generation halted.`
        })
      };
    }

    // Check chaos-api-failure switch
    const apiFailureConfig = await getItem({
      TableName: TABLE_NAMES.CONFIG,
      Key: { configKey: 'chaos-api-failure' }
    });

    if (apiFailureConfig.Item && apiFailureConfig.Item.active) {
      console.warn(`[Chaos] Simulated API Gateway failure triggered for experiment ${experimentId}`);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Simulated API Gateway Route Failure: 500 Internal Server Error',
          faultType: 'api-failure',
          experimentId
        })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const count = Math.min(500, Math.max(1, body.count || 10));
    const duplicateCount = Math.min(count, Math.max(0, body.duplicateCount || 0));

    const eventRegion = body.region || process.env.REGION || 'us-east-1';
    const events = [];
    for (let i = 0; i < count; i++) {
      const evt = createEvent(experimentId, i + 1, eventRegion);
      events.push(evt);
    }

    // Inject intentional duplicates if requested for testing idempotency
    for (let d = 0; d < duplicateCount; d++) {
      const original = events[d];
      events.push({
        ...original,
        sequence: count + d + 1,
        createdAt: new Date().toISOString()
      });
    }

    // APP-01: High-performance batch writes to DynamoDB (chunks of 25)
    if (TABLE_NAMES.EVENTS) {
      const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 3600); // 7-day retention
      const BATCH_DDB_SIZE = 25;
      for (let i = 0; i < events.length; i += BATCH_DDB_SIZE) {
        const chunk = events.slice(i, i + BATCH_DDB_SIZE);
        const putRequests = chunk.map(evt => ({
          PutRequest: {
            Item: { ...evt, ttl }
          }
        }));

        try {
          await batchWriteWithRetry({
            RequestItems: {
              [TABLE_NAMES.EVENTS]: putRequests
            }
          });
        } catch (batchErr) {
          console.warn('Batch write warning for pending events:', batchErr.message);
        }
      }
    }

    // EventBridge PutEvents accepts a maximum of 10 entries per call
    const BATCH_EB_SIZE = 10;
    for (let i = 0; i < events.length; i += BATCH_EB_SIZE) {
      const batch = events.slice(i, i + BATCH_EB_SIZE).map(evt => ({
        Source: 'sdrs.simulator',
        DetailType: 'SimulatorEvent',
        Detail: JSON.stringify(evt),
        EventBusName: process.env.EVENT_BUS_NAME
      }));

      const ebResponse = await ebClient.send(new PutEventsCommand({ Entries: batch }));
      if (ebResponse.FailedEntryCount && ebResponse.FailedEntryCount > 0) {
        console.warn(`[EventBridge] ${ebResponse.FailedEntryCount} entries failed to publish to bus`);
      }
    }

    // SEC-03: Return standard Content-Type; let API Gateway handle CORS
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experimentId,
        generatedCount: events.length,
        uniqueEvents: count,
        duplicateEventsInjected: duplicateCount,
        status: 'published'
      })
    };
  } catch (error) {
    console.error('Error generating events:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate events', message: error.message })
    };
  }
};
