import { execSync } from 'child_process';

const token = process.argv[2] || process.env.JWT_TOKEN;
const primaryUrl = (process.argv[3] || process.env.PRIMARY_API_URL || '').replace(/\/$/, '');

if (!token || !primaryUrl) {
  console.error('Usage: node scripts/test-expiry-cap.mjs <JWT_TOKEN> <PRIMARY_URL>');
  console.error('Or set JWT_TOKEN and PRIMARY_API_URL environment variables.');
  process.exit(1);
}

async function testExpiry() {
  console.log('[Step 1] Creating fresh experiment...');
  const createRes = await fetch(`${primaryUrl}/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'Expiry-Cap-Live-Test', scenario: 'lambda-failure' })
  });
  const exp = await createRes.json();
  const eid = exp.experimentId;
  console.log('Created experiment:', eid);

  console.log('[Step 2] Fast-forwarding startedAt in DynamoDB to 35 minutes ago...');
  const pastDate = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  
  const keyJson = JSON.stringify({ experimentId: { S: eid } });
  const exprAttrJson = JSON.stringify({ ':p': { S: pastDate } });
  
  execSync(`aws dynamodb update-item --table-name sdrs-experiments-global --key "${keyJson.replace(/"/g, '\\"')}" --update-expression "SET startedAt = :p" --expression-attribute-values "${exprAttrJson.replace(/"/g, '\\"')}" --region us-east-1`);
  console.log('Fast-forwarded startedAt to:', pastDate);

  console.log('[Step 3] Calling /events on expired experiment...');
  const genRes = await fetch(`${primaryUrl}/experiments/${eid}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ count: 5 })
  });

  const genData = await genRes.json();
  console.log('GenerateEvents HTTP Status:', genRes.status);
  console.log('GenerateEvents Response Body:', JSON.stringify(genData));

  if (genRes.status === 400 && genData.error === 'ExperimentExpired') {
    console.log('\n[PASS] Server-side 30-minute expiry cap successfully enforced with HTTP 400 ExperimentExpired!');
  } else {
    throw new Error(`Expiry cap check failed: Status ${genRes.status}, Body: ${JSON.stringify(genData)}`);
  }

  console.log('[Step 4] Verifying experiment auto-finalization in DynamoDB...');
  const verifyRes = await fetch(`${primaryUrl}/experiments/${eid}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const finalizedExp = await verifyRes.json();
  console.log('Finalized experiment status:', finalizedExp.status);
  console.log('Finalized experiment autoExpired:', finalizedExp.autoExpired);
  console.log('Finalized experiment result:', finalizedExp.result);

  if (finalizedExp.status === 'completed' && finalizedExp.autoExpired === true && finalizedExp.result === 'EXPIRED') {
    console.log('[PASS] Experiment correctly auto-finalized to status=completed, autoExpired=true, result=EXPIRED!');
  } else {
    throw new Error('Experiment state was not correctly updated in DynamoDB');
  }
}

testExpiry().catch(err => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
