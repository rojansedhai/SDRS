export type ServiceStatus = 'healthy' | 'degraded' | 'failed';
export type ServiceRole = 'active' | 'standby';
export type ServiceType =
  | 'api-gateway'
  | 'eventbridge'
  | 'sqs'
  | 'lambda'
  | 'dynamodb'
  | 'route53'
  | 'dynamodb-global';

export interface ServiceNodeData {
  [key: string]: unknown;
  id: string;
  label: string;
  serviceType: ServiceType;
  status: ServiceStatus;
  role?: ServiceRole;
  regionName?: string;
  isMultiRegion?: boolean;
  metrics?: {
    requestCount: number;
    errorRate: number;
    latency: number;
  };
}
