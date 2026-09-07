import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, validateEvent } from '../functions/shared/eventSchema.mjs';
import { EVENT_STATUS } from '../functions/shared/constants.mjs';

describe('Event Schema & Idempotency Invariants', () => {
  test('createEvent generates all required MVP fields', () => {
    const experimentId = 'exp-test-uuid';
    const sequence = 1;
    const event = createEvent(experimentId, sequence);

    assert.ok(event.eventId, 'Must contain eventId (UUID)');
    assert.equal(event.experimentId, experimentId, 'Must contain matching experimentId');
    assert.equal(event.sequence, 1, 'Must record sequence number');
    assert.ok(event.createdAt, 'Must have createdAt timestamp');
    assert.equal(event.receivedAt, null, 'receivedAt must be null prior to ingestion');
    assert.equal(event.processedAt, null, 'processedAt must be null prior to processing');
    assert.equal(event.region, 'us-east-1', 'Must specify deployment region');
    assert.equal(event.status, EVENT_STATUS.PENDING, 'Initial status must be PENDING');
  });

  test('validateEvent succeeds on compliant event', () => {
    const validEvent = {
      eventId: 'evt-12345',
      experimentId: 'exp-54321',
      createdAt: new Date().toISOString(),
      region: 'us-east-1',
      status: EVENT_STATUS.PROCESSED
    };

    assert.equal(validateEvent(validEvent), true);
  });

  test('validateEvent rejects malformed or incomplete events', () => {
    assert.equal(validateEvent(null), false);
    assert.equal(validateEvent({}), false);
    assert.equal(validateEvent({ eventId: 'only-id' }), false);
    assert.equal(validateEvent({ eventId: 'id', experimentId: 'exp' }), false);
  });

  test('Idempotency: unique eventIds are generated across separate invocations', () => {
    const count = 100;
    const eventIds = new Set();

    for (let i = 0; i < count; i++) {
      const evt = createEvent('exp-dedup-test', i);
      assert.ok(!eventIds.has(evt.eventId), `Duplicate eventId generated at iteration ${i}`);
      eventIds.add(evt.eventId);
    }

    assert.equal(eventIds.size, count);
  });
});

