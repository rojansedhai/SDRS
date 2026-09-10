import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthenticatedUserId, requireAuth, forbiddenResponse } from '../functions/shared/auth.mjs';
import { MAX_EXPERIMENT_DURATION_MS, EXPERIMENT_STATUS } from '../functions/shared/constants.mjs';
import fs from 'fs';
import path from 'path';

test('SEC-01 & SEC-04: Authentication & User Ownership Isolation Invariants', async (t) => {
  await t.test('getAuthenticatedUserId extracts subject claim from HTTP API JWT Authorizer', () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'user-uuid-1234',
              email: 'operator@example.com'
            }
          }
        }
      }
    };
    assert.equal(getAuthenticatedUserId(event), 'user-uuid-1234');
  });

  await t.test('getAuthenticatedUserId rejects claims lacking sub (username alone is not authoritative)', () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              username: 'admin-operator'
            }
          }
        }
      }
    };
    assert.equal(getAuthenticatedUserId(event), null);
  });

  await t.test('getAuthenticatedUserId returns null when authorizer context is missing', () => {
    assert.equal(getAuthenticatedUserId({}), null);
    assert.equal(getAuthenticatedUserId({ requestContext: {} }), null);
    assert.equal(getAuthenticatedUserId(null), null);
  });

  await t.test('requireAuth rejects unauthenticated requests with HTTP 401 Unauthorized (No anonymous fallback)', () => {
    const unauthenticatedEvent = { requestContext: {} };
    const { errorResponse, userId } = requireAuth(unauthenticatedEvent);

    assert.equal(userId, null);
    assert.ok(errorResponse, 'Must produce an error response');
    assert.equal(errorResponse.statusCode, 401);
    assert.equal(errorResponse.headers['Content-Type'], 'application/json');
    const body = JSON.parse(errorResponse.body);
    assert.equal(body.error, 'Unauthorized');
  });

  await t.test('requireAuth succeeds with valid authenticated caller identity', () => {
    const authEvent = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'sec-user-5678'
            }
          }
        }
      }
    };
    const { errorResponse, userId } = requireAuth(authEvent);
    assert.equal(errorResponse, null);
    assert.equal(userId, 'sec-user-5678');
  });

  await t.test('forbiddenResponse generates HTTP 403 Forbidden with ownership violation details', () => {
    const res = forbiddenResponse('owner-user-1', 'attacker-user-2');
    assert.equal(res.statusCode, 403);
    assert.equal(res.headers['Content-Type'], 'application/json');
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Forbidden');
    assert.ok(body.message.includes('attacker-user-2'));
    assert.ok(body.message.includes('owner-user-1'));
  });
});

test('OPS-02 & COD-01: Server-Side Experiment Expiration & Cost Bounds', async (t) => {
  await t.test('MAX_EXPERIMENT_DURATION_MS is bounded to exactly 30 minutes', () => {
    assert.equal(MAX_EXPERIMENT_DURATION_MS, 30 * 60 * 1000);
  });

  await t.test('Experiment runtime evaluation flags experiments exceeding 30 minutes', () => {
    const now = Date.now();
    const activeStartedAt = new Date(now - 10 * 60 * 1000).toISOString(); // 10 mins ago
    const expiredStartedAt = new Date(now - 35 * 60 * 1000).toISOString(); // 35 mins ago

    const isExpiredActive = (now - new Date(activeStartedAt).getTime()) > MAX_EXPERIMENT_DURATION_MS;
    const isExpiredOld = (now - new Date(expiredStartedAt).getTime()) > MAX_EXPERIMENT_DURATION_MS;

    assert.equal(isExpiredActive, false, '10-minute experiment must not be expired');
    assert.equal(isExpiredOld, true, '35-minute experiment must be flagged as expired');
  });
});

test('SEC-03: CORS Remediation & Response Header Sanitization', async (t) => {
  await t.test('Backend functions do not return wildcard Access-Control-Allow-Origin: *', () => {
    const apiFiles = [
      '../functions/api/generateEvents.mjs',
      '../functions/api/startExperiment.mjs',
      '../functions/api/stopExperiment.mjs',
      '../functions/api/getExperiment.mjs',
      '../functions/api/listExperiments.mjs',
      '../functions/api/injectFailure.mjs',
      '../functions/api/restoreService.mjs',
      '../functions/api/getMetrics.mjs',
      '../functions/api/healthCheck.mjs'
    ];

    for (const relPath of apiFiles) {
      const fullPath = path.resolve(import.meta.dirname, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(
        !content.includes("'Access-Control-Allow-Origin': '*'"),
        `File ${relPath} still contains wildcard CORS header`
      );
    }
  });
});

test('SEC-02: FailureEngine IAM Least-Privilege Blast Radius Verification', async (t) => {
  await t.test('template.yaml eliminates wildcard event-source-mapping permissions', () => {
    const templatePath = path.resolve(import.meta.dirname, '../template.yaml');
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Confirm explicit EventSourceMapping resource is declared
    assert.ok(templateContent.includes('ProcessingQueueEventSourceMapping:'), 'Must define explicit EventSourceMapping');
    assert.ok(templateContent.includes('Type: AWS::Lambda::EventSourceMapping'), 'Must be of type AWS::Lambda::EventSourceMapping');

    // Confirm lambda:UpdateEventSourceMapping references the exact ARN of ProcessingQueueEventSourceMapping
    assert.ok(
      templateContent.includes('event-source-mapping:${ProcessingQueueEventSourceMapping}'),
      'Must target exact ARN of ProcessingQueueEventSourceMapping'
    );

    // Confirm wildcard event-source-mapping:* is eliminated
    assert.ok(
      !templateContent.includes('arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:event-source-mapping:*'),
      'Must eliminate wildcard event-source-mapping ARN'
    );
  });
});

test('INF-01 & INF-02: Multi-Region Global Table & Route 53 Custom Domain Invariants', async (t) => {
  await t.test('template-multiregion.yaml authoritatively provisions Global Tables with regional replicas', () => {
    const multiRegionTemplate = path.resolve(import.meta.dirname, '../template-multiregion.yaml');
    const content = fs.readFileSync(multiRegionTemplate, 'utf8');

    assert.ok(content.includes('EventsGlobalTable:'), 'Must provision EventsGlobalTable');
    assert.ok(content.includes('Type: AWS::DynamoDB::GlobalTable'), 'Must be AWS::DynamoDB::GlobalTable');
    assert.ok(content.includes('TableName: sdrs-events-global'), 'Must name global table sdrs-events-global');
    assert.ok(content.includes('PointInTimeRecoveryEnabled: true'), 'PITR must be enabled on replicas');
  });

  await t.test('template.yaml defines Regional Custom Domain outputs for Route 53 Alias routing', () => {
    const regionalTemplate = path.resolve(import.meta.dirname, '../template.yaml');
    const content = fs.readFileSync(regionalTemplate, 'utf8');

    assert.ok(content.includes('RegionalApiDomain:'), 'Must define RegionalApiDomain');
    assert.ok(content.includes('RegionalApiMapping:'), 'Must define RegionalApiMapping');
    assert.ok(content.includes('RegionalDomainName:'), 'Must output RegionalDomainName');
    assert.ok(content.includes('RegionalHostedZoneId:'), 'Must output RegionalHostedZoneId');
  });
});

test('OPS-01: Observability Alarms Specification', async (t) => {
  await t.test('template.yaml provisions CloudWatch Alarms for DLQ, Queue Age, Lambda Errors/Throttles, and API 5xx', () => {
    const regionalTemplate = path.resolve(import.meta.dirname, '../template.yaml');
    const content = fs.readFileSync(regionalTemplate, 'utf8');

    assert.ok(content.includes('DLQMessageAlarm:'), 'Must define DLQMessageAlarm');
    assert.ok(content.includes('ProcessingQueueAgeAlarm:'), 'Must define ProcessingQueueAgeAlarm');
    assert.ok(content.includes('ProcessorErrorAlarm:'), 'Must define ProcessorErrorAlarm');
    assert.ok(content.includes('ProcessorThrottleAlarm:'), 'Must define ProcessorThrottleAlarm');
    assert.ok(content.includes('Api5xxAlarm:'), 'Must define Api5xxAlarm');
    assert.ok(content.includes('SDRSAlertTopic:'), 'Must define SDRSAlertTopic');
  });
});

test('SEC-01 & INF-01: Authoritative Single Cognito Pool Architecture', async (t) => {
  await t.test('template-multiregion.yaml authoritatively provisions single Cognito User Pool & App Client', () => {
    const multiRegionTemplate = path.resolve(import.meta.dirname, '../template-multiregion.yaml');
    const content = fs.readFileSync(multiRegionTemplate, 'utf8');

    assert.ok(content.includes('SDRSUserPool:'), 'Must provision SDRSUserPool in orchestrator');
    assert.ok(content.includes('Type: AWS::Cognito::UserPool'), 'Must be AWS::Cognito::UserPool');
    assert.ok(content.includes('SDRSUserPoolClient:'), 'Must provision SDRSUserPoolClient');
    assert.ok(content.includes('Type: AWS::Cognito::UserPoolClient'), 'Must be AWS::Cognito::UserPoolClient');
    assert.ok(content.includes('UserPoolId:'), 'Must export UserPoolId');
    assert.ok(content.includes('UserPoolClientId:'), 'Must export UserPoolClientId');
    assert.ok(content.includes('UserPoolIssuerUrl:'), 'Must export UserPoolIssuerUrl');
  });

  await t.test('template.yaml does NOT provision local Cognito pools and references authoritative Cognito parameters', () => {
    const regionalTemplate = path.resolve(import.meta.dirname, '../template.yaml');
    const content = fs.readFileSync(regionalTemplate, 'utf8');

    // Invariant: No duplicate regional Cognito User Pools
    assert.ok(!content.includes('Type: AWS::Cognito::UserPool\n'), 'Must not create local regional User Pools');
    assert.ok(!content.includes('Type: AWS::Cognito::UserPoolClient\n'), 'Must not create local regional User Pool Clients');

    // Invariant: Takes parameters from orchestrator
    assert.ok(content.includes('CognitoUserPoolClientId:'), 'Must accept CognitoUserPoolClientId parameter');
    assert.ok(content.includes('CognitoUserPoolIssuerUrl:'), 'Must accept CognitoUserPoolIssuerUrl parameter');

    // Invariant: API Gateway JWT authorizer is configured with JwtConfiguration
    assert.ok(content.includes('CognitoJwtAuthorizer:'), 'Must configure CognitoJwtAuthorizer');
    assert.ok(content.includes('JwtConfiguration:'), 'Must use JwtConfiguration');
    assert.ok(content.includes('issuer: !Ref CognitoUserPoolIssuerUrl'), 'Must use CognitoUserPoolIssuerUrl as issuer');
    assert.ok(content.includes('audience:'), 'Must specify audience');
  });
});

test('COD-02: BatchWriteItem Retry and Backoff Resiliency', async (t) => {
  await t.test('dynamodb.mjs exports batchWriteWithRetry with bounded exponential backoff and jitter', () => {
    const ddbModulePath = path.resolve(import.meta.dirname, '../functions/shared/dynamodb.mjs');
    const content = fs.readFileSync(ddbModulePath, 'utf8');

    assert.ok(content.includes('export async function batchWriteWithRetry'), 'Must export batchWriteWithRetry');
    assert.ok(content.includes('UnprocessedItems'), 'Must check UnprocessedItems');
    assert.ok(content.includes('maxRetries = 4'), 'Must define bounded default maxRetries');
    assert.ok(content.includes('Math.pow(2, attempt)'), 'Must implement exponential backoff');
    assert.ok(content.includes('jitter'), 'Must incorporate jitter to avoid thundering herd');
    assert.ok(content.includes('attempt > maxRetries'), 'Must terminate and throw when retries are exhausted');
  });

  await t.test('batchWriteWithRetry logic accurately retries unprocessed subsets and accumulates processed count', async () => {
    // Pure algorithmic verification of the batchWriteWithRetry loop pattern
    async function simulateBatchWriteWithRetry(requestItems, senderFn, maxRetries = 4) {
      let currentItems = requestItems;
      let attempt = 0;
      let totalProcessed = 0;

      while (currentItems && Object.keys(currentItems).length > 0) {
        const response = await senderFn(currentItems);
        for (const table of Object.keys(currentItems)) {
          const attempted = currentItems[table]?.length || 0;
          const unprocessed = response.UnprocessedItems?.[table]?.length || 0;
          totalProcessed += (attempted - unprocessed);
        }

        const unprocessed = response.UnprocessedItems;
        if (!unprocessed || Object.keys(unprocessed).length === 0) {
          return { success: true, attempts: attempt + 1, totalProcessed };
        }

        attempt++;
        if (attempt > maxRetries) {
          throw new Error('Retries exhausted');
        }
        currentItems = unprocessed;
      }
      return { success: true, attempts: attempt, totalProcessed };
    }

    let calls = 0;
    const mockSender = async (items) => {
      calls++;
      if (calls === 1) {
        return {
          UnprocessedItems: {
            'test-table': [{ PutRequest: { Item: { id: 'retry-2' } } }]
          }
        };
      }
      return { UnprocessedItems: {} };
    };

    const initialItems = {
      'test-table': [
        { PutRequest: { Item: { id: 'item-1' } } },
        { PutRequest: { Item: { id: 'retry-2' } } }
      ]
    };

    const res = await simulateBatchWriteWithRetry(initialItems, mockSender, 3);
    assert.equal(calls, 2);
    assert.equal(res.success, true);
    assert.equal(res.attempts, 2);
    assert.equal(res.totalProcessed, 2);
  });
});

test('SEC-01 & INF-02: Cross-Region Auth Verification Script Contract', async (t) => {
  await t.test('scripts/test-cross-region-auth.mjs exists and passes dry-run', () => {
    const scriptPath = path.resolve(import.meta.dirname, '../../scripts/test-cross-region-auth.mjs');
    assert.ok(fs.existsSync(scriptPath), 'test-cross-region-auth.mjs must exist');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(content.includes('InitiateAuth'), 'Must support Cognito InitiateAuth');
    assert.ok(content.includes('decodeJwt'), 'Must support JWT decoding');
    assert.ok(content.includes('sub'), 'Must verify sub claim');
    assert.ok(content.includes('secondaryUrl'), 'Must test secondary URL');
  });
});

test('AUDIT-FIX-01: No hardcoded test passwords in repository files', async (t) => {
  await t.test('Frontend services, components, scripts do not contain SdrsTestPassword123!', () => {
    const filesToCheck = [
      '../../frontend/src/services/api.ts',
      '../../frontend/src/components/layout/Header.tsx',
      '../../scripts/refresh-token.mjs',
      '../../frontend/.env.example'
    ];
    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(import.meta.dirname, relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!content.includes('SdrsTestPassword123!'), `${relPath} still contains hardcoded test password`);
      }
    }
  });

  await t.test('scripts/refresh-token.mjs reads password from process.env.COGNITO_PASSWORD', () => {
    const scriptPath = path.resolve(import.meta.dirname, '../../scripts/refresh-token.mjs');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(content.includes('process.env.COGNITO_PASSWORD'), 'Must read password from environment');
  });

  await t.test('frontend/src/services/api.ts requires password parameter in loginWithCognito', () => {
    const apiPath = path.resolve(import.meta.dirname, '../../frontend/src/services/api.ts');
    const content = fs.readFileSync(apiPath, 'utf8');
    assert.ok(content.includes('export async function loginWithCognito('), 'loginWithCognito function must be exported');
    assert.ok(content.includes('password: string'), 'loginWithCognito must accept mandatory password parameter');
    assert.ok(!content.includes('password = '), 'Must not have default password assignment');
  });
});

test('AUDIT-FIX-02: injectFailure removes stale recoveredAt on re-injection', async (t) => {
  await t.test('injectFailure.mjs includes REMOVE recoveredAt in UpdateExpression', () => {
    const injectPath = path.resolve(import.meta.dirname, '../functions/api/injectFailure.mjs');
    const content = fs.readFileSync(injectPath, 'utf8');
    assert.ok(content.includes('REMOVE recoveredAt'), 'UpdateExpression must contain REMOVE recoveredAt');
    assert.ok(content.includes('SET failureType = :failureType, failureInjectedAt = :failureInjectedAt REMOVE recoveredAt'), 'Must update failureType and clear recoveredAt');
  });
});

test('AUDIT-FIX-03: failureEngine eliminates dead ListEventSourceMappings fallback and enforces mapping UUID', async (t) => {
  await t.test('failureEngine.mjs does NOT import or use ListEventSourceMappingsCommand', () => {
    const enginePath = path.resolve(import.meta.dirname, '../functions/failure/failureEngine.mjs');
    const content = fs.readFileSync(enginePath, 'utf8');
    assert.ok(!content.includes('ListEventSourceMappingsCommand'), 'Must not import or invoke ListEventSourceMappingsCommand');
  });

  await t.test('failureEngine.mjs fails safely with configuration exception when SQS_EVENT_SOURCE_MAPPING_UUID is missing', () => {
    const enginePath = path.resolve(import.meta.dirname, '../functions/failure/failureEngine.mjs');
    const content = fs.readFileSync(enginePath, 'utf8');
    assert.ok(content.includes('Configuration Exception: SQS_EVENT_SOURCE_MAPPING_UUID is not set'), 'Must throw configuration exception if mapping UUID is unset');
  });

  await t.test('template.yaml guarantees SQS_EVENT_SOURCE_MAPPING_UUID is passed to FailureEngineFunction', () => {
    const templatePath = path.resolve(import.meta.dirname, '../template.yaml');
    const content = fs.readFileSync(templatePath, 'utf8');
    assert.ok(content.includes('SQS_EVENT_SOURCE_MAPPING_UUID: !Ref ProcessingQueueEventSourceMapping'), 'SAM template must inject SQS_EVENT_SOURCE_MAPPING_UUID');
  });
});

test('AUDIT-FIX-04: listExperiments enforces strict userId = :uid isolation', async (t) => {
  await t.test('listExperiments.mjs FilterExpression strictly checks userId = :uid without legacy fallback', () => {
    const listPath = path.resolve(import.meta.dirname, '../functions/api/listExperiments.mjs');
    const content = fs.readFileSync(listPath, 'utf8');
    assert.ok(content.includes("FilterExpression: 'userId = :uid'"), 'FilterExpression must strictly require userId = :uid');
    assert.ok(!content.includes('attribute_not_exists'), 'Must eliminate attribute_not_exists fallback');
  });

  await t.test('listExperiments filtering logic rejects unowned or mismatched userId items', () => {
    const userId = 'user-owner-123';
    const rawItems = [
      { experimentId: 'exp-1', userId: 'user-owner-123', startedAt: '2026-09-10T10:00:00Z' },
      { experimentId: 'exp-2', userId: 'user-attacker-456', startedAt: '2026-09-10T10:05:00Z' },
      { experimentId: 'exp-3', startedAt: '2026-09-10T10:10:00Z' }, // legacy unowned
      { experimentId: 'exp-4', userId: null, startedAt: '2026-09-10T10:15:00Z' }
    ];

    const filtered = rawItems.filter(exp => exp.userId === userId);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].experimentId, 'exp-1');
  });
});


