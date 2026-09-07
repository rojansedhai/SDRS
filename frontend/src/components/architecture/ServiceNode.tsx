import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Activity, AlertCircle, CheckCircle2, PauseCircle } from 'lucide-react';
import {
  ApiGatewayIcon,
  EventBridgeIcon,
  SqsIcon,
  LambdaIcon,
  DynamoDbIcon,
  Route53Icon,
  DynamoDbGlobalIcon,
} from './AwsIcons';
import type { ServiceNodeData } from '../../types/architecture';

const serviceConfig: Record<string, {
  icon: React.ElementType;
  accentBg: string;
  accentText: string;
  category: string;
}> = {
  'api-gateway': {
    icon: ApiGatewayIcon,
    accentBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    accentText: 'text-purple-600 dark:text-purple-400',
    category: 'HTTP Gateway',
  },
  'eventbridge': {
    icon: EventBridgeIcon,
    accentBg: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30',
    accentText: 'text-pink-600 dark:text-pink-400',
    category: 'Event Bus',
  },
  'sqs': {
    icon: SqsIcon,
    accentBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    category: 'Message Queue',
  },
  'lambda': {
    icon: LambdaIcon,
    accentBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    accentText: 'text-amber-600 dark:text-amber-400',
    category: 'Compute (arm64)',
  },
  'dynamodb': {
    icon: DynamoDbIcon,
    accentBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    accentText: 'text-blue-600 dark:text-blue-400',
    category: 'NoSQL Storage',
  },
  'route53': {
    icon: Route53Icon,
    accentBg: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
    accentText: 'text-teal-600 dark:text-teal-400',
    category: 'DNS & Failover',
  },
  'dynamodb-global': {
    icon: DynamoDbGlobalIcon,
    accentBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    accentText: 'text-cyan-600 dark:text-cyan-400',
    category: 'Global Table (Active-Active)',
  },
};

/**
 * Custom React Flow node component representing an AWS service in the architecture.
 */
export const ServiceNode = memo(({ data }: { data: ServiceNodeData }) => {
  const config = serviceConfig[data.serviceType] || {
    icon: ApiGatewayIcon,
    accentBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-300',
    accentText: 'text-slate-600 dark:text-slate-400',
    category: 'Managed Service',
  };

  const Icon = config.icon;
  const status = data.status || 'healthy';
  const role = data.role;

  const statusStyles: Record<string, { ring: string; badge: string; dot: string; label: string }> = {
    healthy: {
      ring: 'border-emerald-500/40 dark:border-emerald-500/50 shadow-sm hover:shadow-emerald-500/10',
      badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-500/30',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
      label: 'HEALTHY',
    },
    degraded: {
      ring: 'border-amber-500 dark:border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse',
      badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-500/40',
      dot: 'bg-amber-500 animate-ping shadow-[0_0_8px_rgba(245,158,11,0.9)]',
      label: 'DEGRADED',
    },
    failed: {
      ring: 'border-rose-500 dark:border-rose-500 shadow-[0_0_25px_rgba(225,29,72,0.35)] animate-pulse',
      badge: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-500/40',
      dot: 'bg-rose-500 animate-ping shadow-[0_0_10px_rgba(225,29,72,1)]',
      label: 'FAILED',
    },
  };

  const current = statusStyles[status] || statusStyles.healthy;

  return (
    <div className={`
      relative min-w-[210px] rounded-2xl bg-white dark:bg-slate-900
      border-2 transition-all duration-200 p-3.5 shadow-md
      ${current.ring}
    `}>
      {/* Target connection ports (Left and Top for flexible multi-region flow) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-600 !border-2 !border-white dark:!border-slate-900 rounded-full !-left-1.5 transition-colors hover:!bg-indigo-500"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-600 !border-2 !border-white dark:!border-slate-900 rounded-full !-top-1.5 transition-colors hover:!bg-indigo-500"
      />

      <div className="flex flex-col gap-2.5">
        {/* Top bar: Category + Role/Status */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {config.category}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Active / Standby Role Badge */}
            {role && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-black tracking-widest uppercase border ${
                role === 'active'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-400/40'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 border-slate-300 dark:border-slate-700'
              }`}>
                {role === 'active' ? <CheckCircle2 size={10} className="text-blue-500" /> : <PauseCircle size={10} className="text-slate-400" />}
                {role}
              </span>
            )}

            {/* Health Status Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase border ${current.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`}></span>
              {current.label}
            </span>
          </div>
        </div>

        {/* Center: Icon + Service Name + Region indicator */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 flex items-center justify-center">
            <Icon size={32} className="shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight leading-tight truncate">
              {data.label}
            </h3>
            <span className="text-[11px] font-semibold font-mono text-slate-500 dark:text-slate-400 block truncate mt-0.5">
              {data.regionName ? data.regionName : 'AWS Managed'}
            </span>
          </div>
        </div>

        {/* Live Metrics Footer */}
        {data.metrics && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg">
              <Activity size={12} className="text-slate-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase">Requests</span>
                <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                  {data.metrics.requestCount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${data.metrics.errorRate > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
              <AlertCircle size={12} className={data.metrics.errorRate > 0 ? 'text-rose-500' : 'text-slate-400'} />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase">Error Rate</span>
                <span className={`font-bold text-[11px] ${data.metrics.errorRate > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {data.metrics.errorRate}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Source connection ports (Right and Bottom for flexible multi-region flow) */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-600 !border-2 !border-white dark:!border-slate-900 rounded-full !-right-1.5 transition-colors hover:!bg-indigo-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-600 !border-2 !border-white dark:!border-slate-900 rounded-full !-bottom-1.5 transition-colors hover:!bg-indigo-500"
      />
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';
