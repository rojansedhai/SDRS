export const TABLE_NAMES = {
  EVENTS: process.env.EVENTS_TABLE,
  EXPERIMENTS: process.env.EXPERIMENTS_TABLE,
  METRICS: process.env.METRICS_TABLE,
  CONFIG: process.env.CONFIG_TABLE,
};

export const FAILURE_TYPES = {
  LAMBDA_FAILURE: 'lambda-failure',
  SQS_BACKLOG: 'sqs-backlog',
  DDB_THROTTLE: 'ddb-throttle',
  API_FAILURE: 'api-failure',
  EVENTBRIDGE_FAILURE: 'eventbridge-failure',
  REGION_FAILURE: 'region-failure', // Phase 2: Regional outage triggering Route 53 failover
};

export const EXPERIMENT_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed'
};

export const EVENT_STATUS = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  DUPLICATE: 'duplicate',
  LOST: 'lost'
};

export const SERVICE_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  FAILED: 'failed'
};

export const SERVICE_ROLE = {
  ACTIVE: 'active',
  STANDBY: 'standby'
};

export const REGION_MODES = {
  SINGLE_REGION: 'single-region',
  MULTI_REGION: 'multi-region'
};

export const REGIONS = ['us-east-1', 'us-west-2'];

export const MAX_EXPERIMENT_DURATION_MS = 30 * 60 * 1000;

export const AWS_COSTS = {
  LAMBDA_GB_S: 0.0000166667,
  DDB_WRU: 0.00000125,
  DDB_RRU: 0.00000025,
  SQS_REQ: 0.00000040,
  EB_EVENT: 0.00000100,
  // Phase 2 Multi-Region Cost Multipliers
  ROUTE53_HEALTH_CHECK_MONTHLY: 0.50,
  ROUTE53_QUERY_PER_MILLION: 0.40,
  DDB_REPLICATED_WRU: 0.000001875, // Global Table replicated write unit in us-east-1 / us-west-2
  CROSS_REGION_DATA_TRANSFER_GB: 0.02,
};

export const AWS_PRICING = {
  apiGatewayPerMillion: 1.00,
  eventBridgePerMillion: 1.00,
  sqsPerMillionRequests: 0.40,
  lambdaPerMillionInvocations: 0.20,
  lambdaComputeGbSecond: 0.0000166667,
  dynamoWritePerMillion: 1.25,
  dynamoReadPerMillion: 0.25,
  // Phase 2 Multi-Region Pricing
  dynamoReplicatedWritePerMillion: 1.875,
  route53HealthCheckMonthly: 0.50,
  route53PerMillionQueries: 0.40,
  crossRegionTransferPerGb: 0.02,
};
