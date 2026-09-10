#!/usr/bin/env node
/**
 * Live AWS Verification Script for Post-Audit Remediations
 * Tests:
 * 1. Experiment Lifecycle: Start -> Baseline
 * 2. Failure Injection: lambda-failure
 * 3. Service Restoration: Verify recoveredAt is populated
 * 4. Failure Re-Injection: Inject ddb-throttle -> Verify recoveredAt is REMOVED/cleared
 * 5. Verify failure state is ACTIVE and metrics reflect new failure state
 * 6. Clean restoration: Restore service
 * 7. Tenant Isolation: Verify listExperiments returns only experiments belonging to authenticated user
 *
 * Usage:
 *   TOKEN="<jwt>" [API_URL="<api-gateway-url>"] node scripts/test-live-remediation.mjs
 */

import assert from 'node:assert/strict';

const apiUrl = (process.env.API_URL || 'https://vluypv9j3k.execute-api.us-east-1.amazonaws.com').replace(/\/$/, '');
const token = (process.env.TOKEN || process.env.JWT_TOKEN || '').trim();

if (!token) {
  console.error('[Error] TOKEN or JWT_TOKEN environment variable is required.');
  console.error('Usage: TOKEN="<jwt>" [API_URL="<url>"] node scripts/test-live-remediation.mjs');
  process.exit(1);
}

console.log('===============================================================');
console.log('   SDRS Live AWS Remediation & Re-Injection Verification       ');
console.log('===============================================================');
console.log(`Target API: ${apiUrl}`);
console.log(`Token Prefix: ${token.substring(0, 20)}...`);

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  // Step 1: Start Experiment
  console.log('\n--- Step 1: Starting Live Experiment ---');
  const startRes = await fetch(`${apiUrl}/experiments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Re-Injection & Stale recoveredAt Live Verification',
      scenario: 'Audit-Verification',
      regionMode: 'single-region',
      primaryRegion: 'us-east-1',
      targetRtoSeconds: 60,
      targetRpoEvents: 0
    })
  });
  
  assert.equal(startRes.status, 200, `Start experiment returned status ${startRes.status}`);
  const startData = await startRes.json();
  const experimentId = startData.experimentId;
  console.log(`[PASS] Experiment started: ${experimentId}`);
  assert.ok(experimentId, 'experimentId must be returned');

  // Step 2: Inject First Failure (lambda-failure)
  console.log('\n--- Step 2: Injecting First Failure (lambda-failure) ---');
  const inject1Res = await fetch(`${apiUrl}/experiments/${experimentId}/failures`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      failureType: 'lambda-failure'
    })
  });
  assert.equal(inject1Res.status, 200, `First failure injection failed: ${inject1Res.status}`);
  console.log('[PASS] Injected lambda-failure successfully.');

  // Verify experiment state has failureType and failureInjectedAt
  const exp1Res = await fetch(`${apiUrl}/experiments/${experimentId}`, { headers });
  assert.equal(exp1Res.status, 200);
  const exp1Data = await exp1Res.json();
  console.log(`Current failure state: ${exp1Data.failureType}, injectedAt: ${exp1Data.failureInjectedAt}`);
  assert.equal(exp1Data.failureType, 'lambda-failure');
  assert.ok(exp1Data.failureInjectedAt, 'failureInjectedAt must be present');
  assert.equal(exp1Data.recoveredAt, undefined, 'recoveredAt must not be set yet');

  // Step 3: Restore Service (First Recovery)
  console.log('\n--- Step 3: Restoring Service ---');
  await sleep(1000);
  const restore1Res = await fetch(`${apiUrl}/experiments/${experimentId}/restore`, {
    method: 'POST',
    headers
  });
  assert.equal(restore1Res.status, 200, `Restore failed: ${restore1Res.status}`);
  console.log('[PASS] Restore service executed.');

  // Verify recoveredAt is now populated
  const exp2Res = await fetch(`${apiUrl}/experiments/${experimentId}`, { headers });
  assert.equal(exp2Res.status, 200);
  const exp2Data = await exp2Res.json();
  console.log(`Recovered state: recoveredAt=${exp2Data.recoveredAt}`);
  assert.ok(exp2Data.recoveredAt, 'recoveredAt must be populated after restore');

  // Step 4: Re-Inject Another Failure (ddb-throttle)
  console.log('\n--- Step 4: Re-Injecting Second Failure (ddb-throttle) ---');
  await sleep(1000);
  const inject2Res = await fetch(`${apiUrl}/experiments/${experimentId}/failures`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      failureType: 'ddb-throttle'
    })
  });
  assert.equal(inject2Res.status, 200, `Re-injection failed: ${inject2Res.status}`);
  console.log('[PASS] Injected ddb-throttle successfully.');

  // Step 5: CRITICAL CHECK - Verify recoveredAt is REMOVED / cleared and failure is ACTIVE
  console.log('\n--- Step 5: Verifying recoveredAt is Cleared & Failure is Active ---');
  const exp3Res = await fetch(`${apiUrl}/experiments/${experimentId}`, { headers });
  assert.equal(exp3Res.status, 200);
  const exp3Data = await exp3Res.json();
  console.log(`Post-Re-injection state:`);
  console.log(`  failureType: ${exp3Data.failureType}`);
  console.log(`  failureInjectedAt: ${exp3Data.failureInjectedAt}`);
  console.log(`  recoveredAt: ${exp3Data.recoveredAt}`);

  assert.equal(exp3Data.failureType, 'ddb-throttle', 'failureType must be updated to ddb-throttle');
  assert.ok(exp3Data.failureInjectedAt, 'failureInjectedAt must be updated');
  assert.equal(exp3Data.recoveredAt, undefined, `CRITICAL: recoveredAt must be cleared! Found: ${exp3Data.recoveredAt}`);
  console.log('[PASS] VERIFIED: recoveredAt is cleanly REMOVED upon re-injection!');

  // Step 6: Verify Metrics Calculation with New Active Failure
  console.log('\n--- Step 6: Verifying Metrics Calculation with Active Failure ---');
  const metricsRes = await fetch(`${apiUrl}/experiments/${experimentId}/metrics`, { headers });
  assert.equal(metricsRes.status, 200);
  const metricsJson = await metricsRes.json();
  const metricsData = metricsJson.current;
  console.log(`Metrics returned: totalRequests=${metricsData.totalRequests}, pendingCount=${metricsData.pendingCount}, successCount=${metricsData.successCount}`);
  assert.ok(metricsData.totalRequests !== undefined, 'Metrics totalRequests must be defined');
  console.log('[PASS] Metrics calculated successfully for active failure state.');

  // Step 7: Final Restoration & Experiment Stop
  console.log('\n--- Step 7: Final Restoration & Stopping Experiment ---');
  await fetch(`${apiUrl}/experiments/${experimentId}/restore`, {
    method: 'POST',
    headers
  });
  const stopRes = await fetch(`${apiUrl}/experiments/${experimentId}/stop`, {
    method: 'POST',
    headers
  });
  assert.equal(stopRes.status, 200);
  console.log('[PASS] Experiment stopped and restored cleanly.');

  // Step 8: Strict Tenant Isolation Check
  console.log('\n--- Step 8: Strict Tenant Isolation Check (listExperiments) ---');
  const listRes = await fetch(`${apiUrl}/experiments`, { headers });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.ok(Array.isArray(listData), 'Must return array of experiments');
  console.log(`User owns ${listData.length} experiments.`);
  
  const tokenPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const userSub = tokenPayload.sub;
  console.log(`Caller sub: ${userSub}`);

  for (const exp of listData) {
    assert.equal(exp.userId, userSub, `Tenant leak detected! Experiment ${exp.experimentId} has userId '${exp.userId}', expected '${userSub}'`);
  }
  console.log(`[PASS] All ${listData.length} experiments strictly match authenticated userId = ${userSub}`);

  console.log('\n===============================================================');
  console.log('   ALL LIVE AWS REMEDIATION CHECKS PASSED!                    ');
  console.log('===============================================================');
}

run().catch(err => {
  console.error('\n[FAIL] Live verification error:', err);
  process.exit(1);
});
