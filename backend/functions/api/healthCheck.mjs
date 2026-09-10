import { getItem } from '../shared/dynamodb.mjs';
import { TABLE_NAMES } from '../shared/constants.mjs';

/**
 * Health check handler used by AWS Route 53 to assess regional availability.
 * When the regional failure injection (chaos-primary-unhealthy) is active in ConfigTable,
 * this endpoint returns HTTP 503 Service Unavailable, prompting Route 53 to failover to the standby region.
 *
 * NOTE: /health is the ONLY intentionally unauthenticated route in the SDRS API.
 */
export const handler = async (event) => {
  const currentRegion = process.env.REGION || process.env.AWS_REGION || 'us-east-1';
  const currentRole = process.env.DEPLOYMENT_REGION_ROLE || 'primary';

  try {
    // Check if regional chaos flag is active for this region
    let isDegraded = false;
    try {
      const chaosFlag = await getItem({
        TableName: TABLE_NAMES.CONFIG,
        Key: { configKey: 'chaos-primary-unhealthy' }
      });
      if (chaosFlag.Item && chaosFlag.Item.active) {
        // Degrade only if this region is the primary region or matches the intended targetRegion
        const targetRegion = chaosFlag.Item.targetRegion || 'us-east-1';
        isDegraded = (currentRegion === targetRegion) || (currentRole === 'primary');
      }
    } catch (dbErr) {
      console.warn('Could not read ConfigTable for chaos flag, defaulting to healthy:', dbErr.message);
    }

    if (isDegraded) {
      return {
        statusCode: 503,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'UNHEALTHY',
          region: currentRegion,
          message: 'Simulated Regional Outage: Primary region health check degraded by SDRS Failure Engine',
          timestamp: new Date().toISOString()
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'HEALTHY',
        region: currentRegion,
        role: process.env.DEPLOYMENT_REGION_ROLE || 'primary',
        message: 'Regional SDRS pipeline operating nominally',
        timestamp: new Date().toISOString()
      })
    };
  } catch (err) {
    console.error('HealthCheck execution error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'ERROR',
        region: currentRegion,
        error: err.message
      })
    };
  }
};
