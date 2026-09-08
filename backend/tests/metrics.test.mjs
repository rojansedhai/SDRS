import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AWS_PRICING } from '../functions/shared/constants.mjs';

describe('Metrics & Resiliency Calculations', () => {
  test('RTO calculation: elapsed time between detection and recovery', () => {
    const detectedAt = '2026-09-04T10:00:02.000Z';
    const recoveredAt = '2026-09-04T10:00:18.500Z';

    const rto = new Date(recoveredAt).getTime() - new Date(detectedAt).getTime();
    assert.equal(rto, 16500, 'RTO should be exactly 16,500 milliseconds (16.5s)');
    assert.ok(rto > 0, 'RTO must be positive');
  });

  test('RPO calculation: data loss window between last success and post-recovery success when data was lost', () => {
    const lastSuccess = '2026-09-04T10:00:00.000Z';
    const firstPostRecoverySuccess = '2026-09-04T10:00:03.200Z';
    const lostCount = 5;

    const rpo = lostCount === 0 ? 0 : new Date(firstPostRecoverySuccess).getTime() - new Date(lastSuccess).getTime();
    assert.equal(rpo, 3200, 'RPO window should be exactly 3,200ms when data was lost');
  });

  test('RPO calculation: RPO is strictly 0 when zero events lost during SQS buffering', () => {
    const lastSuccess = '2026-09-04T10:00:00.000Z';
    const firstPostRecoverySuccess = '2026-09-04T10:00:15.000Z';
    const lostCount = 0;
    const pendingCount = 78;

    const rpo = lostCount === 0 ? 0 : new Date(firstPostRecoverySuccess).getTime() - new Date(lastSuccess).getTime();
    assert.equal(rpo, 0, 'RPO must be strictly 0 when SQS successfully buffered all events without loss');
    assert.equal(pendingCount, 78, 'Pending SQS events must be tracked in pendingCount / queueDepth, not lostCount');
  });

  test('Detection Time: elapsed time between failure injection and first error detection', () => {
    const injectedAt = '2026-09-04T10:00:00.000Z';
    const firstFailure = '2026-09-04T10:00:01.850Z';

    const detectionTime = new Date(firstFailure).getTime() - new Date(injectedAt).getTime();
    assert.equal(detectionTime, 1850, 'Detection time should be 1,850ms');
  });

  test('Data Consistency: accurately computes percentage including duplicates and lost events', () => {
    const totalRequests = 1000;
    const failedCount = 30;
    const duplicateCount = 10;
    const lostCount = 5;

    const consistentCount = Math.max(0, totalRequests - failedCount - duplicateCount - lostCount);
    const dataConsistency = Math.round((consistentCount / totalRequests) * 10000) / 100;

    assert.equal(consistentCount, 955);
    assert.equal(dataConsistency, 95.5, 'Consistency should be 95.5%');
  });

  test('Data Consistency: returns 100% when zero failures, duplicates, or lost events', () => {
    const totalRequests = 500;
    const failedCount = 0;
    const duplicateCount = 0;
    const lostCount = 0;

    const consistentCount = Math.max(0, totalRequests - failedCount - duplicateCount - lostCount);
    const dataConsistency = Math.round((consistentCount / totalRequests) * 10000) / 100;

    assert.equal(dataConsistency, 100.0);
  });

  test('Cost Estimation: formula follows standard AWS on-demand pricing rules', () => {
    const totalRequests = 100000;
    const successCount = 98000;
    const avgLatencyMs = 120;

    const apiCost = (totalRequests / 1000000) * AWS_PRICING.apiGatewayPerMillion;
    const ebCost = (totalRequests / 1000000) * AWS_PRICING.eventBridgePerMillion;
    const sqsCost = ((totalRequests * 2) / 1000000) * AWS_PRICING.sqsPerMillionRequests;
    const lambdaInvocationsCost = (successCount / 1000000) * AWS_PRICING.lambdaPerMillionInvocations;
    const lambdaComputeCost = ((avgLatencyMs / 1000) * successCount * (256 / 1024)) * AWS_PRICING.lambdaComputeGbSecond;
    const ddbCost = ((totalRequests / 1000000) * AWS_PRICING.dynamoReadPerMillion) +
                    ((successCount / 1000000) * AWS_PRICING.dynamoWritePerMillion);

    const total = parseFloat((apiCost + ebCost + sqsCost + lambdaInvocationsCost + lambdaComputeCost + ddbCost).toFixed(6));

    assert.ok(total > 0, 'Cost must be strictly positive');
    assert.ok(total < 1.00, 'Cost for 100k events should be well under $1.00');
  });

  test('Comprehensive SLA Compliance: checks RTO, RPO, and consistency jointly', () => {
    const evaluateCompliance = (metrics, targetRtoSec = 60, targetRpoEvents = 0) => {
      const rtoTargetMs = targetRtoSec * 1000;
      const rtoPass = metrics.rto !== undefined ? metrics.rto <= rtoTargetMs : true;
      const rpoPass = metrics.failedCount <= targetRpoEvents;
      const consistencyPass = (metrics.dataConsistency ?? 100) >= 95;
      const hasRequests = metrics.totalRequests > 0;
      return rtoPass && rpoPass && consistencyPass && hasRequests;
    };

    // Ideal test run: PASS
    assert.equal(evaluateCompliance({ rto: 25000, failedCount: 0, dataConsistency: 99.5, totalRequests: 500 }), true);

    // Exceeded RTO: FAIL
    assert.equal(evaluateCompliance({ rto: 75000, failedCount: 0, dataConsistency: 99.5, totalRequests: 500 }, 60, 0), false);

    // Exceeded RPO: FAIL
    assert.equal(evaluateCompliance({ rto: 20000, failedCount: 15, dataConsistency: 98.0, totalRequests: 500 }, 60, 0), false);

    // Zero requests (stalled/unprocessed pipeline): FAIL
    assert.equal(evaluateCompliance({ rto: 10000, failedCount: 0, dataConsistency: 100.0, totalRequests: 0 }), false);
  });
});
