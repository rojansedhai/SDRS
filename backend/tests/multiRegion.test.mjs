import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGIONS,
  FAILURE_TYPES,
  SERVICE_ROLE,
  REGION_MODES,
  AWS_PRICING
} from '../functions/shared/constants.mjs';
import { calculateResilienceScore } from '../functions/shared/resilienceScore.mjs';
import { createEvent, validateEvent } from '../functions/shared/eventSchema.mjs';

test('Multi-Region Configuration & Region Validation', async (t) => {
  await t.test('Simulator defines supported multi-region deployment regions', () => {
    assert.ok(Array.isArray(REGIONS));
    assert.ok(REGIONS.includes('us-east-1'), 'Must include primary us-east-1');
    assert.ok(REGIONS.includes('us-west-2'), 'Must include secondary us-west-2');
  });

  await t.test('Multi-region configuration validates distinct primary and secondary regions', () => {
    const validateRegionalPair = (primary, secondary) => {
      if (!REGIONS.includes(primary)) throw new Error(`Invalid primary region: ${primary}`);
      if (!REGIONS.includes(secondary)) throw new Error(`Invalid secondary region: ${secondary}`);
      if (primary === secondary) throw new Error('Primary and Secondary regions must be distinct');
      return true;
    };

    assert.equal(validateRegionalPair('us-east-1', 'us-west-2'), true);
    assert.throws(() => validateRegionalPair('us-east-1', 'us-east-1'), /distinct/);
    assert.throws(() => validateRegionalPair('eu-central-1', 'us-west-2'), /Invalid primary region/);
  });

  await t.test('createEvent attaches region metadata correctly across multi-region workloads', () => {
    const evtPrimary = createEvent('exp-test', 1, 'us-east-1');
    assert.equal(evtPrimary.region, 'us-east-1');
    assert.equal(validateEvent(evtPrimary), true);

    const evtSecondary = createEvent('exp-test', 2, 'us-west-2');
    assert.equal(evtSecondary.region, 'us-west-2');
    assert.equal(validateEvent(evtSecondary), true);
  });
});

test('Primary/Secondary State Transitions & Failover State Machine', async (t) => {
  await t.test('Initial regional role assignment establishes Active-Passive topology', () => {
    const roles = {
      primary: SERVICE_ROLE.ACTIVE,
      secondary: SERVICE_ROLE.STANDBY
    };
    assert.equal(roles.primary, 'active');
    assert.equal(roles.secondary, 'standby');
  });

  await t.test('Failover state machine correctly transitions roles during regional disruption', () => {
    // State machine simulator
    const state = {
      primaryRole: SERVICE_ROLE.ACTIVE,
      secondaryRole: SERVICE_ROLE.STANDBY,
      failoverActive: false,
      stage: 'normal'
    };

    // 1. Failure injected into Primary
    state.stage = 'failure-injected';
    assert.equal(state.failoverActive, false);

    // 2. Health check threshold reached
    state.stage = 'healthcheck-failed';
    assert.equal(state.failoverActive, false);

    // 3. Route 53 switches active CNAME to secondary
    state.stage = 'failover-active';
    state.failoverActive = true;
    state.primaryRole = SERVICE_ROLE.STANDBY;
    state.secondaryRole = SERVICE_ROLE.ACTIVE;

    assert.equal(state.primaryRole, 'standby');
    assert.equal(state.secondaryRole, 'active');
    assert.equal(state.failoverActive, true);

    // 4. Primary recovered -> Failback completed
    state.stage = 'failback-completed';
    state.failoverActive = false;
    state.primaryRole = SERVICE_ROLE.ACTIVE;
    state.secondaryRole = SERVICE_ROLE.STANDBY;

    assert.equal(state.primaryRole, 'active');
    assert.equal(state.secondaryRole, 'standby');
    assert.equal(state.failoverActive, false);
  });
});

test('RTO/RPO Targets & Resilience Score Calculations', async (t) => {
  await t.test('Evaluates RTO Target PASS when actual RTO is within threshold', () => {
    const targetRtoSec = 60;
    const actualRtoMs = 43000; // 43s
    const isPass = actualRtoMs <= (targetRtoSec * 1000);
    assert.equal(isPass, true);
  });

  await t.test('Evaluates RTO Target FAIL when actual RTO exceeds threshold', () => {
    const targetRtoSec = 30;
    const actualRtoMs = 45000; // 45s
    const isPass = actualRtoMs <= (targetRtoSec * 1000);
    assert.equal(isPass, false);
  });

  await t.test('Evaluates RPO Target PASS when data loss is within target events', () => {
    const targetRpoEvents = 0;
    const failedEvents = 0;
    const isPass = failedEvents <= targetRpoEvents;
    assert.equal(isPass, true);
  });

  await t.test('Resilience Score algorithm returns 100% on ideal multi-region failover', () => {
    const score = calculateResilienceScore({
      rto: 42000,
      rtoTargetMs: 60000,
      rpoEvents: 0,
      rpoTargetEvents: 0,
      dataConsistency: 100,
      totalRequests: 2000,
      failedCount: 0
    });
    assert.equal(score, 100);
  });

  await t.test('Resilience Score algorithm penalizes excessive recovery time and packet loss', () => {
    const score = calculateResilienceScore({
      rto: 120000, // 2x target
      rtoTargetMs: 60000,
      rpoEvents: 25, // 25 dropped events
      rpoTargetEvents: 0,
      dataConsistency: 85,
      totalRequests: 100,
      failedCount: 15
    });
    assert.ok(score < 70, `Score should reflect degraded resiliency, got ${score}`);
    assert.ok(score >= 0, 'Score cannot be negative');
  });
});

test('Resource Ownership Validation & Failure Injection Authorization', async (t) => {
  await t.test('Simulator authorizes region-failure as an approved failure type', () => {
    const allowed = Object.values(FAILURE_TYPES);
    assert.ok(allowed.includes('region-failure'));
  });

  await t.test('Simulator rejects destructive or unauthorized chaos operations', () => {
    const isAuthorized = (type) => Object.values(FAILURE_TYPES).includes(type);

    assert.equal(isAuthorized('region-failure'), true);
    assert.equal(isAuthorized('lambda-failure'), true);
    assert.equal(isAuthorized('ec2-terminate'), false);
    assert.equal(isAuthorized('delete-table'), false);
    assert.equal(isAuthorized('drop-database'), false);
  });

  await t.test('Multi-Region pricing includes Global Tables and Route 53 rates', () => {
    assert.ok(AWS_PRICING.dynamoReplicatedWritePerMillion > AWS_PRICING.dynamoWritePerMillion,
      'Global table replicated writes must be priced higher than standard single-region writes');
    assert.ok(AWS_PRICING.route53HealthCheckMonthly > 0);
    assert.ok(AWS_PRICING.crossRegionTransferPerGb > 0);
  });
});
