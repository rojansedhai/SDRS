import crypto from 'crypto';
import { EVENT_STATUS } from './constants.mjs';

/**
 * Creates a new event for the simulator
 * @param {string} experimentId
 * @param {number} sequence
 * @param {string} [region='us-east-1']
 * @returns {object} The event object
 */
export function createEvent(experimentId, sequence, region = 'us-east-1') {
  return {
    eventId: crypto.randomUUID(),
    experimentId,
    sequence,
    createdAt: new Date().toISOString(),
    receivedAt: null,
    processedAt: null,
    region: region || 'us-east-1',
    status: EVENT_STATUS.PENDING
  };
}

/**
 * Validates an event object
 * @param {object} event
 * @returns {boolean} True if valid
 */
export function validateEvent(event) {
  return !!(
    event &&
    event.eventId &&
    event.experimentId &&
    event.createdAt &&
    event.region &&
    event.status
  );
}
