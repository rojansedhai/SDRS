import crypto from 'crypto';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { putItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES, EXPERIMENT_STATUS } from '../shared/constants.mjs';
import { createEvent } from '../shared/eventSchema.mjs';
import { requireAuth } from '../shared/auth.mjs';

const ebClient = new EventBridgeClient({ region: process.env.REGION || 'us-east-1' });

export const handler = async (event) => {
  // SEC-01 & SEC-04: Strict authentication check (No 'anonymous' fallback)
  const { errorResponse, userId } = requireAuth(event);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const name = typeof body.name === 'string' ? body.name.slice(0, 100) : 'Unnamed Experiment';
    const scenario = typeof body.scenario === 'string' ? body.scenario.slice(0, 50) : 'Default';
    const targetRtoSeconds = typeof body.targetRtoSeconds === 'number' ? Math.max(1, Math.min(3600, body.targetRtoSeconds)) : 60;
    const targetRpoEvents = typeof body.targetRpoEvents === 'number' ? Math.max(0, Math.min(10000, body.targetRpoEvents)) : 0;
    const regionMode = body.regionMode === 'multi-region' ? 'multi-region' : 'single-region';
    
    // Validate region pattern
    const regionRegex = /^[a-z]{2}-[a-z]+-\d$/;
    const primaryRegion = regionRegex.test(body.primaryRegion) ? body.primaryRegion : (process.env.REGION || 'us-east-1');
    const secondaryRegion = regionRegex.test(body.secondaryRegion) ? body.secondaryRegion : 'us-west-2';

    const experimentId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const experiment = {
      experimentId,
      userId, // SEC-04: Enforce ownership attribution
      name,
      scenario,
      status: EXPERIMENT_STATUS.RUNNING,
      startedAt,
      region: primaryRegion,
      primaryRegion,
      secondaryRegion,
      regionMode,
      targetRtoSeconds,
      targetRpoEvents
    };

    await putItem({
      TableName: TABLE_NAMES.EXPERIMENTS,
      Item: experiment
    });

    // Publish an initial baseline batch of 5 events
    const events = [];
    for (let i = 0; i < 5; i++) {
      const evt = createEvent(experimentId, i + 1, primaryRegion);
      events.push({
        Source: 'sdrs.simulator',
        DetailType: 'SimulatorEvent',
        Detail: JSON.stringify(evt),
        EventBusName: process.env.EVENT_BUS_NAME
      });
    }

    await ebClient.send(new PutEventsCommand({ Entries: events }));

    // SEC-03: Return standard Content-Type; let API Gateway handle CORS
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(experiment)
    };
  } catch (error) {
    console.error('Error starting experiment:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to start experiment', message: error.message })
    };
  }
};
