import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw, Maximize2, ShieldCheck, AlertOctagon, Layers, Globe } from 'lucide-react';
import { ServiceNode } from './ServiceNode';
import { AnimatedEdge } from './AnimatedEdge';
import { useExperimentStore } from '../../store/experimentStore';
import type { ServiceNodeData, ServiceStatus } from '../../types/architecture';

const nodeTypes = {
  serviceNode: ServiceNode,
};

const edgeTypes = {
  animatedEdge: AnimatedEdge,
};

/**
 * Main architecture visualization component supporting both Single-Region (MVP)
 * and Multi-Region (Phase 2) Active-Passive Disaster Recovery topology.
 */
const ArchitectureDiagramContent: React.FC = () => {
  const { fitView } = useReactFlow();
  const serviceStatuses = useExperimentStore((s) => s.serviceStatuses);
  const secondaryStatuses = useExperimentStore((s) => s.secondaryServiceStatuses);
  const serviceRoles = useExperimentStore((s) => s.serviceRoles);
  const failoverActive = useExperimentStore((s) => s.failoverActive);
  const regionMode = useExperimentStore((s) => s.regionMode);
  const setRegionMode = useExperimentStore((s) => s.setRegionMode);
  const activeExperiment = useExperimentStore((s) => s.activeExperiment);
  const metrics = activeExperiment?.metrics;

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.08, duration: 400, maxZoom: 1.0 });
  }, [fitView]);

  const hasFailure = Object.values(serviceStatuses).some((st) => st === 'failed');
  const hasDegraded = Object.values(serviceStatuses).some((st) => st === 'degraded');

  const isMultiRegion = regionMode === 'multi-region';

  // Build nodes based on regionMode
  const nodes = useMemo((): Node[] => {
    const total = metrics?.totalRequests ?? 0;
    const success = metrics?.successCount ?? 0;
    const failed = metrics?.failedCount ?? 0;
    const primaryReqs = metrics?.primaryRequests ?? (failoverActive ? 0 : total);
    const secondaryReqs = metrics?.secondaryRequests ?? (failoverActive ? total : 0);

    const apiErrorRate = serviceStatuses['api-gateway'] === 'failed' ? 100 : (serviceStatuses['api-gateway'] === 'degraded' ? 25 : 0);
    const ebErrorRate = serviceStatuses.eventbridge === 'failed' ? 100 : (serviceStatuses.eventbridge === 'degraded' ? 20 : 0);
    const sqsErrorRate = serviceStatuses.sqs === 'failed' ? 100 : (serviceStatuses.sqs === 'degraded' ? 30 : 0);
    const lambdaErrorRate = serviceStatuses.lambda === 'failed' ? 95 : (serviceStatuses.lambda === 'degraded' ? 40 : (failed > 0 && total > 0 ? Math.round((failed / total) * 100) : 0));
    const ddbErrorRate = serviceStatuses.dynamodb === 'failed' ? 100 : (serviceStatuses.dynamodb === 'degraded' ? 50 : 0);

    if (!isMultiRegion) {
      // 1. Single-Region (MVP) Horizontal Pipeline
      return [
        {
          id: 'api-gateway',
          type: 'serviceNode',
          position: { x: 20, y: 130 },
          data: {
            id: 'api-gateway',
            label: 'API Gateway',
            serviceType: 'api-gateway',
            status: serviceStatuses['api-gateway'],
            regionName: 'us-east-1',
            metrics: total > 0 ? { requestCount: total, errorRate: apiErrorRate, latency: 15 } : undefined
          } satisfies ServiceNodeData
        },
        {
          id: 'eventbridge',
          type: 'serviceNode',
          position: { x: 270, y: 130 },
          data: {
            id: 'eventbridge',
            label: 'EventBridge',
            serviceType: 'eventbridge',
            status: serviceStatuses.eventbridge,
            regionName: 'us-east-1',
            metrics: total > 0 ? { requestCount: total, errorRate: ebErrorRate, latency: 25 } : undefined
          } satisfies ServiceNodeData
        },
        {
          id: 'sqs',
          type: 'serviceNode',
          position: { x: 520, y: 130 },
          data: {
            id: 'sqs',
            label: 'SQS (+ DLQ)',
            serviceType: 'sqs',
            status: serviceStatuses.sqs,
            regionName: 'us-east-1',
            metrics: total > 0 ? { requestCount: Math.max(0, total - (serviceStatuses.eventbridge === 'failed' ? total : 0)), errorRate: sqsErrorRate, latency: 45 } : undefined
          } satisfies ServiceNodeData
        },
        {
          id: 'lambda',
          type: 'serviceNode',
          position: { x: 770, y: 130 },
          data: {
            id: 'lambda',
            label: 'Lambda Processor',
            serviceType: 'lambda',
            status: serviceStatuses.lambda,
            regionName: 'us-east-1',
            metrics: total > 0 ? { requestCount: success + failed, errorRate: lambdaErrorRate, latency: 120 } : undefined
          } satisfies ServiceNodeData
        },
        {
          id: 'dynamodb',
          type: 'serviceNode',
          position: { x: 1020, y: 130 },
          data: {
            id: 'dynamodb',
            label: 'DynamoDB',
            serviceType: 'dynamodb',
            status: serviceStatuses.dynamodb,
            regionName: 'us-east-1',
            metrics: total > 0 ? { requestCount: success, errorRate: ddbErrorRate, latency: 10 } : undefined
          } satisfies ServiceNodeData
        }
      ];
    }

    // 2. Multi-Region (Phase 2) Active-Passive Topology
    return [
      // Top Node: Route 53
      {
        id: 'route53',
        type: 'serviceNode',
        position: { x: 380, y: 10 },
        data: {
          id: 'route53',
          label: 'Route 53 (DNS Failover)',
          serviceType: 'route53',
          status: failoverActive ? 'degraded' : 'healthy',
          regionName: 'Global Anycast',
          metrics: total > 0 ? { requestCount: total, errorRate: 0, latency: 5 } : undefined
        } satisfies ServiceNodeData
      },

      // --- PRIMARY REGION (us-east-1) ---
      {
        id: 'primary-api-gateway',
        type: 'serviceNode',
        position: { x: 120, y: 115 },
        data: {
          id: 'primary-api-gateway',
          label: 'API Gateway',
          serviceType: 'api-gateway',
          status: serviceStatuses['api-gateway'],
          role: serviceRoles.primary,
          regionName: 'us-east-1 (Primary)',
          metrics: { requestCount: primaryReqs, errorRate: apiErrorRate, latency: 15 }
        } satisfies ServiceNodeData
      },
      {
        id: 'primary-eventbridge',
        type: 'serviceNode',
        position: { x: 120, y: 230 },
        data: {
          id: 'primary-eventbridge',
          label: 'EventBridge Bus',
          serviceType: 'eventbridge',
          status: serviceStatuses.eventbridge,
          role: serviceRoles.primary,
          regionName: 'us-east-1',
          metrics: { requestCount: primaryReqs, errorRate: ebErrorRate, latency: 25 }
        } satisfies ServiceNodeData
      },
      {
        id: 'primary-sqs',
        type: 'serviceNode',
        position: { x: 120, y: 345 },
        data: {
          id: 'primary-sqs',
          label: 'SQS (+ DLQ)',
          serviceType: 'sqs',
          status: serviceStatuses.sqs,
          role: serviceRoles.primary,
          regionName: 'us-east-1',
          metrics: { requestCount: primaryReqs, errorRate: sqsErrorRate, latency: 45 }
        } satisfies ServiceNodeData
      },
      {
        id: 'primary-lambda',
        type: 'serviceNode',
        position: { x: 120, y: 460 },
        data: {
          id: 'primary-lambda',
          label: 'Lambda Processor',
          serviceType: 'lambda',
          status: serviceStatuses.lambda,
          role: serviceRoles.primary,
          regionName: 'us-east-1',
          metrics: { requestCount: primaryReqs, errorRate: lambdaErrorRate, latency: 120 }
        } satisfies ServiceNodeData
      },

      // --- SECONDARY REGION (us-west-2) ---
      {
        id: 'secondary-api-gateway',
        type: 'serviceNode',
        position: { x: 640, y: 115 },
        data: {
          id: 'secondary-api-gateway',
          label: 'API Gateway',
          serviceType: 'api-gateway',
          status: secondaryStatuses['api-gateway'] || 'healthy',
          role: serviceRoles.secondary,
          regionName: 'us-west-2 (Secondary)',
          metrics: { requestCount: secondaryReqs, errorRate: 0, latency: 20 }
        } satisfies ServiceNodeData
      },
      {
        id: 'secondary-eventbridge',
        type: 'serviceNode',
        position: { x: 640, y: 230 },
        data: {
          id: 'secondary-eventbridge',
          label: 'EventBridge Bus',
          serviceType: 'eventbridge',
          status: secondaryStatuses.eventbridge || 'healthy',
          role: serviceRoles.secondary,
          regionName: 'us-west-2',
          metrics: { requestCount: secondaryReqs, errorRate: 0, latency: 30 }
        } satisfies ServiceNodeData
      },
      {
        id: 'secondary-sqs',
        type: 'serviceNode',
        position: { x: 640, y: 345 },
        data: {
          id: 'secondary-sqs',
          label: 'SQS (+ DLQ)',
          serviceType: 'sqs',
          status: secondaryStatuses.sqs || 'healthy',
          role: serviceRoles.secondary,
          regionName: 'us-west-2',
          metrics: { requestCount: secondaryReqs, errorRate: 0, latency: 50 }
        } satisfies ServiceNodeData
      },
      {
        id: 'secondary-lambda',
        type: 'serviceNode',
        position: { x: 640, y: 460 },
        data: {
          id: 'secondary-lambda',
          label: 'Lambda Processor',
          serviceType: 'lambda',
          status: secondaryStatuses.lambda || 'healthy',
          role: serviceRoles.secondary,
          regionName: 'us-west-2',
          metrics: { requestCount: secondaryReqs, errorRate: 0, latency: 125 }
        } satisfies ServiceNodeData
      },

      // --- SHARED GLOBAL DATABASE ---
      {
        id: 'dynamodb-global',
        type: 'serviceNode',
        position: { x: 380, y: 575 },
        data: {
          id: 'dynamodb-global',
          label: 'DynamoDB Global Tables',
          serviceType: 'dynamodb-global',
          status: serviceStatuses['dynamodb-global'] || 'healthy',
          regionName: 'Multi-Region Replicated',
          metrics: { requestCount: success, errorRate: ddbErrorRate, latency: 12 }
        } satisfies ServiceNodeData
      }
    ];
  }, [isMultiRegion, serviceStatuses, secondaryStatuses, serviceRoles, failoverActive, metrics]);

  // Build edges based on regionMode
  const edges = useMemo((): Edge[] => {
    const getEdgeStatus = (src: ServiceStatus, tgt: ServiceStatus): string => {
      if (src === 'failed' || tgt === 'failed') return 'failed';
      if (src === 'degraded' || tgt === 'degraded') return 'degraded';
      return 'healthy';
    };

    if (!isMultiRegion) {
      return [
        {
          id: 'e-api-eb',
          source: 'api-gateway',
          target: 'eventbridge',
          type: 'animatedEdge',
          data: { status: getEdgeStatus(serviceStatuses['api-gateway'], serviceStatuses.eventbridge) }
        },
        {
          id: 'e-eb-sqs',
          source: 'eventbridge',
          target: 'sqs',
          type: 'animatedEdge',
          data: { status: getEdgeStatus(serviceStatuses.eventbridge, serviceStatuses.sqs) }
        },
        {
          id: 'e-sqs-lambda',
          source: 'sqs',
          target: 'lambda',
          type: 'animatedEdge',
          data: { status: getEdgeStatus(serviceStatuses.sqs, serviceStatuses.lambda) }
        },
        {
          id: 'e-lambda-ddb',
          source: 'lambda',
          target: 'dynamodb',
          type: 'animatedEdge',
          data: { status: getEdgeStatus(serviceStatuses.lambda, serviceStatuses.dynamodb) }
        }
      ];
    }

    // Multi-Region Edges with dynamic Route 53 failover traffic animation
    return [
      // Route 53 -> Primary API (Active normally, disrupted during failover)
      {
        id: 'e-r53-pri',
        source: 'route53',
        target: 'primary-api-gateway',
        type: 'animatedEdge',
        data: {
          status: failoverActive ? 'degraded' : getEdgeStatus(serviceStatuses.route53, serviceStatuses['api-gateway']),
          animated: !failoverActive && serviceStatuses['api-gateway'] !== 'failed'
        }
      },
      // Route 53 -> Secondary API (Dormant normally, dynamically ACTIVE during failover)
      {
        id: 'e-r53-sec',
        source: 'route53',
        target: 'secondary-api-gateway',
        type: 'animatedEdge',
        data: {
          status: failoverActive ? 'healthy' : 'degraded',
          animated: failoverActive
        }
      },

      // Primary Pipeline
      {
        id: 'e-pri-api-eb',
        source: 'primary-api-gateway',
        target: 'primary-eventbridge',
        type: 'animatedEdge',
        data: {
          status: getEdgeStatus(serviceStatuses['api-gateway'], serviceStatuses.eventbridge),
          animated: !failoverActive && serviceStatuses['api-gateway'] !== 'failed'
        }
      },
      {
        id: 'e-pri-eb-sqs',
        source: 'primary-eventbridge',
        target: 'primary-sqs',
        type: 'animatedEdge',
        data: {
          status: getEdgeStatus(serviceStatuses.eventbridge, serviceStatuses.sqs),
          animated: !failoverActive && serviceStatuses.eventbridge !== 'failed'
        }
      },
      {
        id: 'e-pri-sqs-lambda',
        source: 'primary-sqs',
        target: 'primary-lambda',
        type: 'animatedEdge',
        data: {
          status: getEdgeStatus(serviceStatuses.sqs, serviceStatuses.lambda),
          animated: !failoverActive && serviceStatuses.sqs !== 'failed'
        }
      },
      {
        id: 'e-pri-lambda-ddb',
        source: 'primary-lambda',
        target: 'dynamodb-global',
        type: 'animatedEdge',
        data: {
          status: getEdgeStatus(serviceStatuses.lambda, serviceStatuses['dynamodb-global']),
          animated: !failoverActive && serviceStatuses.lambda !== 'failed'
        }
      },

      // Secondary Pipeline
      {
        id: 'e-sec-api-eb',
        source: 'secondary-api-gateway',
        target: 'secondary-eventbridge',
        type: 'animatedEdge',
        data: {
          status: secondaryStatuses['api-gateway'] || 'healthy',
          animated: failoverActive
        }
      },
      {
        id: 'e-sec-eb-sqs',
        source: 'secondary-eventbridge',
        target: 'secondary-sqs',
        type: 'animatedEdge',
        data: {
          status: secondaryStatuses.eventbridge || 'healthy',
          animated: failoverActive
        }
      },
      {
        id: 'e-sec-sqs-lambda',
        source: 'secondary-sqs',
        target: 'secondary-lambda',
        type: 'animatedEdge',
        data: {
          status: secondaryStatuses.sqs || 'healthy',
          animated: failoverActive
        }
      },
      {
        id: 'e-sec-lambda-ddb',
        source: 'secondary-lambda',
        target: 'dynamodb-global',
        type: 'animatedEdge',
        data: {
          status: secondaryStatuses.lambda || 'healthy',
          animated: failoverActive
        }
      }
    ];
  }, [isMultiRegion, serviceStatuses, secondaryStatuses, failoverActive]);

  return (
    <div className={`flex flex-col w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden relative transition-all duration-300 ${
      isMultiRegion ? 'h-[620px]' : 'h-[520px]'
    }`}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Architecture Topology</span>
          </h2>

          {/* Single-Region vs Multi-Region Mode Switcher */}
          <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setRegionMode('single-region')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                !isMultiRegion
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>Single Region [MVP]</span>
            </button>
            <button
              onClick={() => setRegionMode('multi-region')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                isMultiRegion
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe size={13} />
              <span>Multi-Region [Phase 2]</span>
            </button>
          </div>
        </div>

        {/* Live Architecture Status Badge */}
        <div className="flex items-center gap-3">
          {failoverActive ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse">
              <AlertOctagon size={14} />
              <span>Failover Active: Traffic Rerouted to us-west-2</span>
            </div>
          ) : (activeExperiment?.failureType === 'region-failure' && !activeExperiment?.recoveredAt) ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 animate-pulse">
              <AlertOctagon size={14} />
              <span>Primary Regional Outage Active</span>
            </div>
          ) : hasFailure ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 animate-pulse">
              <AlertOctagon size={14} />
              <span>Component Fault Active ({activeExperiment?.failureType || 'Outage'})</span>
            </div>
          ) : hasDegraded ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              <AlertOctagon size={14} />
              <span>Backpressure / Throttling Detected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>{isMultiRegion ? 'Route 53 Active-Passive Nominal' : 'All 5 Services Healthy (100% Flow)'}</span>
            </div>
          )}

          <button
            onClick={handleFitView}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            title="Reset View / Fit to Screen"
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">Fit View</span>
          </button>

          <button
            onClick={handleFitView}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh Layout"
            aria-label="Refresh layout"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main React Flow Canvas */}
      <div className="flex-1 relative w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          fitView
          fitViewOptions={{ padding: 0.08, maxZoom: 1.0 }}
          minZoom={0.35}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="bg-slate-50/50 dark:bg-slate-950"
        >
          <Background color="#94a3b8" gap={20} size={1} className="opacity-40 dark:opacity-20" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
};

export const ArchitectureDiagram: React.FC = () => (
  <ReactFlowProvider>
    <ArchitectureDiagramContent />
  </ReactFlowProvider>
);
