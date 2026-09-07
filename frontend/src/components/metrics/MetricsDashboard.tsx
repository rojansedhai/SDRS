import React from 'react';
import { useExperimentStore } from '../../store/experimentStore';
import { MetricCard } from './MetricCard';
import {
  Clock,
  ArrowRightLeft,
  RotateCcw,
  Activity,
  CheckCircle,
  XCircle,
  Copy,
  AlertTriangle,
  Shield,
  Timer,
  HardDrive,
  DollarSign,
  Globe,
  Award,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatDuration, formatPercentage, formatCost, formatNumber } from '../../utils/formatters';
import { getMetricStatus } from '../../utils/metrics';

/**
 * MetricsDashboard displays current experiment metrics, RTO/RPO targets vs actuals,
 * an overall resilience score, and primary vs secondary regional traffic breakdown.
 */
export const MetricsDashboard: React.FC = () => {
  const { activeExperiment, regionMode } = useExperimentStore();
  const metrics = activeExperiment?.metrics;

  const displayValue = (val: number | undefined | null, formatter?: (v: number) => string): string => {
    if (val === undefined || val === null) return '--';
    return formatter ? formatter(val) : val.toString();
  };

  const safeStatus = (metricName: string, val: number | undefined): 'good' | 'warning' | 'critical' => {
    if (val === undefined || val === null) return 'good';
    return getMetricStatus(metricName, val);
  };

  const isMulti = activeExperiment?.regionMode === 'multi-region' || regionMode === 'multi-region';
  const targetRtoSec = metrics?.targetRtoSeconds ?? activeExperiment?.targetRtoSeconds ?? 60;
  const targetRpoEvt = metrics?.targetRpoEvents ?? activeExperiment?.targetRpoEvents ?? 0;

  const actualRtoSec = metrics?.rto !== undefined ? Math.round(metrics.rto / 1000) : undefined;
  const actualRpoEvt = metrics?.failedCount ?? 0;

  const rtoPass = actualRtoSec !== undefined ? actualRtoSec <= targetRtoSec : true;
  const rpoPass = actualRpoEvt <= targetRpoEvt;
  const resilienceScore = metrics?.resilienceScore ?? activeExperiment?.resilienceScore ?? 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Resilience & Operational Telemetry
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time telemetry tracking empirical detection, failover, RTO, RPO, and multi-region routing
          </p>
        </div>

        {/* Telemetry Attribution Badge */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            ● Measured Telemetry
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            ◈ Estimated Pricing
          </span>
        </div>
      </div>

      {/* Target-Driven SLA & Resilience Score Banner */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* RTO Target vs Actual */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Timer size={20} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                RTO (Recovery Time)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                  {actualRtoSec !== undefined ? `${actualRtoSec}s` : '--'}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Target: {targetRtoSec}s
                </span>
              </div>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-black tracking-wider uppercase border flex items-center gap-1 ${
            actualRtoSec === undefined
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
              : rtoPass
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
          }`}>
            {actualRtoSec !== undefined && (rtoPass ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />)}
            {actualRtoSec === undefined ? 'PENDING' : (rtoPass ? 'PASS' : 'FAIL')}
          </span>
        </div>

        {/* RPO Target vs Actual */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
              <HardDrive size={20} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                RPO (Data Loss Window)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                  {actualRpoEvt} events
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Target: {targetRpoEvt}
                </span>
              </div>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-black tracking-wider uppercase border flex items-center gap-1 ${
            rpoPass
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
          }`}>
            {rpoPass ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {rpoPass ? 'PASS' : 'FAIL'}
          </span>
        </div>

        {/* Overall Resilience Score */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <Award size={20} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Resilience Score
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                  {resilienceScore}%
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Weighted composite
                </span>
              </div>
            </div>
          </div>
          <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className={`h-full transition-all duration-500 ${
                resilienceScore >= 90 ? 'bg-emerald-500' : (resilienceScore >= 75 ? 'bg-amber-500' : 'bg-rose-500')
              }`}
              style={{ width: `${resilienceScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Multi-Region Ingress Distribution Banner (Visible in Multi-Region Mode) */}
      {isMulti && (
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-xs text-blue-900 dark:text-blue-200">
              Multi-Region Traffic Distribution:
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500"></span>
              <span className="text-slate-600 dark:text-slate-400">Primary (us-east-1):</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatNumber(metrics?.primaryRequests ?? 0)} events
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-500"></span>
              <span className="text-slate-600 dark:text-slate-400">Secondary (us-west-2):</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatNumber(metrics?.secondaryRequests ?? 0)} events
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Telemetry Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard label="Detection Time" value={displayValue(metrics?.detectionTime, formatDuration)} icon={Clock} status={safeStatus('detectionTime', metrics?.detectionTime)} />
        <MetricCard label={isMulti ? "DNS Failover Time" : "Failover Time"} value={displayValue(isMulti ? metrics?.dnsFailoverTime : metrics?.failoverTime, formatDuration)} icon={ArrowRightLeft} status={safeStatus('failoverTime', isMulti ? (metrics?.dnsFailoverTime ?? metrics?.failoverTime) : metrics?.failoverTime)} />
        <MetricCard label="Recovery Time" value={displayValue(metrics?.recoveryTime, formatDuration)} icon={RotateCcw} status={safeStatus('recoveryTime', metrics?.recoveryTime)} />
        <MetricCard label="Total Requests" value={displayValue(metrics?.totalRequests, formatNumber)} icon={Activity} />

        <MetricCard label="Successful" value={displayValue(metrics?.successCount, formatNumber)} icon={CheckCircle} status="good" />
        <MetricCard label="Failed" value={displayValue(metrics?.failedCount, formatNumber)} icon={XCircle} status={metrics?.failedCount ? 'critical' : 'good'} />
        <MetricCard label="Duplicate Events" value={displayValue(metrics?.duplicateCount, formatNumber)} icon={Copy} status={metrics?.duplicateCount ? 'warning' : 'good'} />
        <MetricCard label="Lost Events" value={displayValue(metrics?.lostCount, formatNumber)} icon={AlertTriangle} status={metrics?.lostCount ? 'critical' : 'good'} />

        <MetricCard label="Data Consistency" value={displayValue(metrics?.dataConsistency, formatPercentage)} icon={Shield} status={safeStatus('dataConsistency', metrics?.dataConsistency)} />
        <MetricCard label="RTO (Measured)" value={displayValue(metrics?.rto, formatDuration)} icon={Timer} status={safeStatus('rto', metrics?.rto)} />
        <MetricCard label="RPO (Data Loss)" value={displayValue(metrics?.rpo, formatDuration)} icon={HardDrive} status={safeStatus('rpo', metrics?.rpo)} />
        <MetricCard label="Estimated Cost" value={displayValue(metrics?.estimatedCost, formatCost)} icon={DollarSign} />
      </div>
    </div>
  );
};
