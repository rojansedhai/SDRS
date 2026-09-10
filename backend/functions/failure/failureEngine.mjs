import {
  LambdaClient,
  PutFunctionConcurrencyCommand,
  DeleteFunctionConcurrencyCommand,
  UpdateEventSourceMappingCommand
} from '@aws-sdk/client-lambda';
import {
  EventBridgeClient,
  DisableRuleCommand,
  EnableRuleCommand
} from '@aws-sdk/client-eventbridge';
import { putItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES, FAILURE_TYPES } from '../shared/constants.mjs';

const lambdaClient = new LambdaClient({ region: process.env.REGION || 'us-east-1' });
const ebClient = new EventBridgeClient({ region: process.env.REGION || 'us-east-1' });

const ALLOWED_FAILURES = Object.values(FAILURE_TYPES);

/**
 * Hardened FailureEngine handler enforcing strict invariants:
 * 1. Only allowed simulator failure types can be targeted.
 * 2. Target functions, rules, and SQS event source mapping UUIDs are strictly bound to CloudFormation environment variables.
 * 3. No arbitrary resources, functions, or external commands can be passed.
 */
export const handler = async (event) => {
  console.log('FailureEngine triggered with event:', JSON.stringify(event));

  const { action, failureType, experimentId } = event || {};

  if (!action || !['inject', 'restore'].includes(action)) {
    throw new Error(`Security Exception: Invalid action '${action}'. Allowed actions: 'inject', 'restore'.`);
  }

  // Strictly bind target resources to environment variables
  const targetLambda = process.env.EVENT_PROCESSOR_FUNCTION_NAME;
  const targetRule = process.env.EVENT_BRIDGE_RULE_NAME ? process.env.EVENT_BRIDGE_RULE_NAME.split('|').pop() : '';
  const targetBus = process.env.EVENT_BUS_NAME || 'sdrs-event-bus';
  const targetMappingUuid = process.env.SQS_EVENT_SOURCE_MAPPING_UUID;

  if (!targetLambda) {
    throw new Error('Configuration Exception: EVENT_PROCESSOR_FUNCTION_NAME is not set.');
  }

  try {
    if (action === 'inject') {
      if (!failureType || !ALLOWED_FAILURES.includes(failureType)) {
        throw new Error(`Security Exception: Invalid failureType '${failureType}'. Allowed: ${ALLOWED_FAILURES.join(', ')}`);
      }

      switch (failureType) {
        case 'lambda-failure':
          console.log(`[Chaos] Setting reserved concurrency to 0 for target function: ${targetLambda}`);
          await lambdaClient.send(new PutFunctionConcurrencyCommand({
            FunctionName: targetLambda,
            ReservedConcurrentExecutions: 0
          }));
          break;

        case 'sqs-backlog':
          console.log(`[Chaos] Disabling SQS Event Source Mapping for target function: ${targetLambda}`);
          if (!targetMappingUuid) {
            throw new Error('Configuration Exception: SQS_EVENT_SOURCE_MAPPING_UUID is not set. SQS event source mapping cannot be resolved.');
          }
          await updateEventSourceMappingWithRetry({
            UUID: targetMappingUuid,
            Enabled: false
          });
          console.log(`[Chaos] Explicit SQS mapping disabled: ${targetMappingUuid}`);
          break;

        case 'ddb-throttle':
          console.log(`[Chaos] Activating DynamoDB write throttle simulation flag for experiment: ${experimentId}`);
          await putItem({
            TableName: TABLE_NAMES.CONFIG,
            Item: { configKey: 'chaos-ddb-throttle', active: true, experimentId, activatedAt: new Date().toISOString() }
          });
          break;

        case 'api-failure':
          console.log(`[Chaos] Activating API Gateway failure simulation flag for experiment: ${experimentId}`);
          await putItem({
            TableName: TABLE_NAMES.CONFIG,
            Item: { configKey: 'chaos-api-failure', active: true, experimentId, activatedAt: new Date().toISOString() }
          });
          break;

        case 'eventbridge-failure':
          console.log(`[Chaos] Disabling EventBridge Rule '${targetRule}' on Event Bus '${targetBus}'`);
          await ebClient.send(new DisableRuleCommand({
            Name: targetRule,
            EventBusName: targetBus
          }));
          await putItem({
            TableName: TABLE_NAMES.CONFIG,
            Item: { configKey: 'chaos-eventbridge-failure', active: true, experimentId, activatedAt: new Date().toISOString() }
          });
          break;

        case 'region-failure':
          console.log(`[Chaos] Simulating primary region outage for experiment: ${experimentId}`);
          await putItem({
            TableName: TABLE_NAMES.CONFIG,
            Item: {
              configKey: 'chaos-primary-unhealthy',
              active: true,
              experimentId,
              activatedAt: new Date().toISOString(),
              targetRegion: process.env.REGION || 'us-east-1'
            }
          });
          break;
      }
    } else if (action === 'restore') {
      console.log('[Recovery] Restoring all simulator components to healthy state...');

      // 1. Restore Lambda concurrency
      try {
        await lambdaClient.send(new DeleteFunctionConcurrencyCommand({
          FunctionName: targetLambda
        }));
        console.log(`[Recovery] Unreserved concurrency restored for ${targetLambda}`);
      } catch (e) {
        console.warn('Lambda concurrency was not restricted or already restored:', e.message);
      }

      // 2. Restore SQS Event Source Mapping
      try {
        if (!targetMappingUuid) {
          throw new Error('Configuration Exception: SQS_EVENT_SOURCE_MAPPING_UUID is not set. SQS event source mapping cannot be resolved.');
        }
        await updateEventSourceMappingWithRetry({
          UUID: targetMappingUuid,
          Enabled: true
        });
        console.log(`[Recovery] Explicit SQS mapping re-enabled: ${targetMappingUuid}`);
      } catch (e) {
        console.warn('Failed to restore SQS mapping:', e.message);
      }

      // 3. Clear DynamoDB write throttle flag
      await putItem({
        TableName: TABLE_NAMES.CONFIG,
        Item: { configKey: 'chaos-ddb-throttle', active: false, restoredAt: new Date().toISOString() }
      });

      // 4. Clear API Gateway failure flag
      await putItem({
        TableName: TABLE_NAMES.CONFIG,
        Item: { configKey: 'chaos-api-failure', active: false, restoredAt: new Date().toISOString() }
      });

      // 5. Restore EventBridge Rule
      try {
        if (targetRule && targetBus) {
          await ebClient.send(new EnableRuleCommand({
            Name: targetRule,
            EventBusName: targetBus
          }));
          console.log(`[Recovery] EventBridge rule '${targetRule}' re-enabled.`);
        }
      } catch (e) {
        console.warn('Failed to restore EventBridge rule:', e.message);
      }

      await putItem({
        TableName: TABLE_NAMES.CONFIG,
        Item: { configKey: 'chaos-eventbridge-failure', active: false, restoredAt: new Date().toISOString() }
      });

      // 6. Restore Regional Health Check flag
      await putItem({
        TableName: TABLE_NAMES.CONFIG,
        Item: { configKey: 'chaos-primary-unhealthy', active: false, restoredAt: new Date().toISOString() }
      });
    }

    return {
      success: true,
      action,
      failureType: action === 'inject' ? failureType : 'all-restored',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('FailureEngine Execution Error:', err);
    throw err;
  }
};
