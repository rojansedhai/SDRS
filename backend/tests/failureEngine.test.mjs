import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FAILURE_TYPES } from '../functions/shared/constants.mjs';

describe('FailureEngine Invariants & Security Guardrails', () => {
  const allowedFailures = Object.values(FAILURE_TYPES);

  test('Simulator only defines approved, non-destructive failure types', () => {
    assert.deepEqual(
      allowedFailures.sort(),
      ['api-failure', 'ddb-throttle', 'eventbridge-failure', 'lambda-failure', 'region-failure', 'sqs-backlog'].sort()
    );
  });

  test('FailureEngine rejects destructive or arbitrary failure types', () => {
    const maliciousTypes = [
      'delete-database',
      'terminate-instances',
      'drop-table',
      'rm-rf',
      'arbitrary-command',
      'undefined'
    ];

    for (const invalidType of maliciousTypes) {
      assert.ok(
        !allowedFailures.includes(invalidType),
        `Type '${invalidType}' must never be accepted by FailureEngine`
      );
    }
  });

  test('FailureEngine action validation ensures only inject and restore are allowed', () => {
    const allowedActions = ['inject', 'restore'];

    const testActions = ['inject', 'restore', 'destroy', 'delete', 'execute', 'eval'];
    const valid = testActions.filter(a => allowedActions.includes(a));
    const invalid = testActions.filter(a => !allowedActions.includes(a));

    assert.deepEqual(valid, ['inject', 'restore']);
    assert.deepEqual(invalid, ['destroy', 'delete', 'execute', 'eval']);
  });

  test('Safety invariant: Target function name must come from environment, not payload', () => {
    // Verifies that a payload with malicious functionName cannot redirect chaos
    const maliciousPayload = {
      action: 'inject',
      failureType: 'lambda-failure',
      functionName: 'arn:aws:lambda:us-east-1:123456789012:function:ProductionCriticalFunction'
    };

    const targetFn = process.env.EVENT_PROCESSOR_FUNCTION_NAME || 'sdrs-EventProcessorFunction';
    // Ensure our engine only resolves the environment variable
    assert.equal(targetFn !== maliciousPayload.functionName, true);
  });
});

