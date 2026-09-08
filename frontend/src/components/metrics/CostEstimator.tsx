import React from 'react';
import { useExperimentStore } from '../../store/experimentStore';
import { calculateDetailedCost } from '../../utils/cost';
import { formatCost, formatNumber } from '../../utils/formatters';
import { DollarSign, AlertCircle } from 'lucide-react';
import { Glossary } from '../onboarding/GlossaryTooltip';

/**
 * CostEstimator displays a granular breakdown of estimated AWS usage costs,
 * contrasting single-region costs with multi-region operational overhead.
 */
export const CostEstimator: React.FC = () => {
  const { activeExperiment, regionMode } = useExperimentStore();
  const metrics = activeExperiment?.metrics;
  const isMulti = activeExperiment?.regionMode === 'multi-region' || regionMode === 'multi-region';

  const totalReqs = metrics?.totalRequests ?? 1500;
  const successCount = metrics?.successCount ?? 1480;
  const primaryReqs = metrics?.primaryRequests ?? Math.round(totalReqs * 0.6);
  const secondaryReqs = metrics?.secondaryRequests ?? Math.round(totalReqs * 0.4);

  const detailed = calculateDetailedCost({
    apiRequests: totalReqs,
    lambdaInvocations: totalReqs,
    lambdaDurationMs: totalReqs * 120,
    sqsRequests: totalReqs * 2,
    dynamodbReads: totalReqs,
    dynamodbWrites: successCount,
    eventbridgeEvents: totalReqs,
    isMultiRegion: isMulti,
    primaryRequests: primaryReqs,
    secondaryRequests: secondaryReqs
  });

  const singleRegionBaseline = calculateDetailedCost({
    apiRequests: totalReqs,
    lambdaInvocations: totalReqs,
    lambdaDurationMs: totalReqs * 120,
    sqsRequests: totalReqs * 2,
    dynamodbReads: totalReqs,
    dynamodbWrites: successCount,
    eventbridgeEvents: totalReqs,
    isMultiRegion: false
  });

  const multiRegionDelta = Math.max(0, detailed.totalCost - singleRegionBaseline.totalCost);

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-500" />
            <span>Estimated AWS Cost Analysis</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transparent breakdown of compute, messaging, and multi-region replication costs
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          Mode: {isMulti ? 'Multi-Region (Dual-Stack)' : 'Single-Region'}
        </span>
      </div>

      {/* Cost Comparison Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500">
            Total Run Cost
          </span>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">
            {formatCost(detailed.totalCost)}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {formatNumber(totalReqs)} total events
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500">
            Single-Region Baseline
          </span>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">
            {formatCost(singleRegionBaseline.totalCost)}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Without replication overhead
          </span>
        </div>

        <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
          <span className="text-[11px] uppercase font-bold text-blue-700 dark:text-blue-300">
            DR Redundancy Premium
          </span>
          <p className="text-xl font-extrabold text-blue-900 dark:text-blue-100 font-mono mt-1">
            +{formatCost(multiRegionDelta)}
          </p>
          <span className="text-[11px] text-blue-600 dark:text-blue-400">
            <Glossary term="Global Tables">Global Tables</Glossary> + <Glossary term="Route 53">Route 53</Glossary>
          </span>
        </div>
      </div>

      {/* Granular Cost Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 text-[10px] uppercase text-slate-500 dark:text-slate-400 font-mono">
            <tr>
              <th className="px-4 py-2.5 font-bold">Cost Component</th>
              <th className="px-4 py-2.5 font-bold">AWS Resource</th>
              <th className="px-4 py-2.5 font-bold">Usage Basis</th>
              <th className="px-4 py-2.5 font-bold text-right">Estimated Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">Primary Ingestion & Compute</td>
              <td className="px-4 py-2.5 font-mono text-[11px]">API GW + EB + SQS + Lambda (us-east-1)</td>
              <td className="px-4 py-2.5">{formatNumber(primaryReqs)} requests @ on-demand</td>
              <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCost(detailed.primaryCost)}</td>
            </tr>

            {isMulti && (
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">Secondary Ingestion & Compute</td>
                <td className="px-4 py-2.5 font-mono text-[11px]">API GW + EB + SQS + Lambda (us-west-2)</td>
                <td className="px-4 py-2.5">{formatNumber(secondaryReqs)} failover requests</td>
                <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCost(detailed.secondaryCost)}</td>
              </tr>
            )}

            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                {isMulti ? <Glossary term="Global Tables">DynamoDB Global Tables</Glossary> : <Glossary term="DynamoDB">DynamoDB Storage</Glossary>}
              </td>
              <td className="px-4 py-2.5 font-mono text-[11px]">
                {isMulti ? <>Active-Active Replicated Writes (<Glossary term="rWU">rWUs</Glossary>)</> : 'Single-Region On-Demand WRUs'}
              </td>
              <td className="px-4 py-2.5">{formatNumber(successCount)} writes</td>
              <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCost(detailed.globalTableCost)}</td>
            </tr>

            {isMulti && (
              <>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white"><Glossary term="Route 53">Route 53</Glossary> DNS & Health Checks</td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">HTTPS Health Probe (10s interval) + Query Vol</td>
                  <td className="px-4 py-2.5">1 probe @ $0.50/mo + queries</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCost(detailed.route53Cost)}</td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">Cross-Region Data Replication</td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">Inter-Region AWS Backbone Transfer</td>
                  <td className="px-4 py-2.5">~$0.02 / GB transfer</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCost(detailed.transferCost)}</td>
                </tr>
              </>
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 font-bold text-slate-900 dark:text-white">
            <tr>
              <td colSpan={3} className="px-4 py-3">Total Estimated Experiment Cost</td>
              <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                {formatCost(detailed.totalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
        <AlertCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Estimated Cost Disclaimer</strong>: Figures are approximations derived from AWS public rate cards for us-east-1 and us-west-2 on-demand services (API GW $1.00/M, SQS $0.40/M, Lambda $0.20/M + arm64 compute, DynamoDB Global Table replicated writes $1.875/M, Route 53 $0.50/mo/probe). Real invoices may vary slightly due to tiered pricing and billing cycle rounding.
        </span>
      </div>
    </div>
  );
};
