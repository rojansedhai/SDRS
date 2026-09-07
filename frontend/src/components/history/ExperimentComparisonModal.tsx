import React, { useState } from 'react';
import { X, ArrowRightLeft, Award, ShieldCheck, Timer, HardDrive, Copy, AlertTriangle } from 'lucide-react';
import type { Experiment } from '../../types/experiment';
import { formatDuration, formatPercentage, formatCost } from '../../utils/formatters';

interface ExperimentComparisonModalProps {
  open: boolean;
  onClose: () => void;
  experiments: Experiment[];
}

export const ExperimentComparisonModal: React.FC<ExperimentComparisonModalProps> = ({
  open,
  onClose,
  experiments
}) => {
  const completed = experiments.filter((e) => e.status === 'completed' || e.result !== null);

  const [expAId, setExpAId] = useState<string>(completed[0]?.experimentId || '');
  const [expBId, setExpBId] = useState<string>(completed[1]?.experimentId || completed[0]?.experimentId || '');

  if (!open) return null;

  const expA = completed.find((e) => e.experimentId === expAId) || completed[0];
  const expB = completed.find((e) => e.experimentId === expBId) || completed[1] || completed[0];

  const metricsA = expA?.metrics;
  const metricsB = expB?.metrics;

  const comparisonRows = [
    {
      label: 'RTO (Recovery Time)',
      icon: Timer,
      valA: metricsA?.rto !== undefined ? formatDuration(metricsA.rto) : '--',
      valB: metricsB?.rto !== undefined ? formatDuration(metricsB.rto) : '--',
      better: (metricsA?.rto ?? 999999) < (metricsB?.rto ?? 999999) ? 'A' : ((metricsB?.rto ?? 999999) < (metricsA?.rto ?? 999999) ? 'B' : 'TIE')
    },
    {
      label: 'RPO (Data Loss Window)',
      icon: HardDrive,
      valA: metricsA?.rpo !== undefined ? formatDuration(metricsA.rpo) : '--',
      valB: metricsB?.rpo !== undefined ? formatDuration(metricsB.rpo) : '--',
      better: (metricsA?.rpo ?? 999999) < (metricsB?.rpo ?? 999999) ? 'A' : ((metricsB?.rpo ?? 999999) < (metricsA?.rpo ?? 999999) ? 'B' : 'TIE')
    },
    {
      label: 'Failed Events',
      icon: AlertTriangle,
      valA: metricsA?.failedCount ?? 0,
      valB: metricsB?.failedCount ?? 0,
      better: (metricsA?.failedCount ?? 0) < (metricsB?.failedCount ?? 0) ? 'A' : ((metricsB?.failedCount ?? 0) < (metricsA?.failedCount ?? 0) ? 'B' : 'TIE')
    },
    {
      label: 'Duplicate Events',
      icon: Copy,
      valA: metricsA?.duplicateCount ?? 0,
      valB: metricsB?.duplicateCount ?? 0,
      better: (metricsA?.duplicateCount ?? 0) < (metricsB?.duplicateCount ?? 0) ? 'A' : ((metricsB?.duplicateCount ?? 0) < (metricsA?.duplicateCount ?? 0) ? 'B' : 'TIE')
    },
    {
      label: 'Data Consistency',
      icon: ShieldCheck,
      valA: metricsA?.dataConsistency !== undefined ? formatPercentage(metricsA.dataConsistency) : '--',
      valB: metricsB?.dataConsistency !== undefined ? formatPercentage(metricsB.dataConsistency) : '--',
      better: (metricsA?.dataConsistency ?? 0) > (metricsB?.dataConsistency ?? 0) ? 'A' : ((metricsB?.dataConsistency ?? 0) > (metricsA?.dataConsistency ?? 0) ? 'B' : 'TIE')
    },
    {
      label: 'Resilience Score',
      icon: Award,
      valA: `${expA?.resilienceScore ?? metricsA?.resilienceScore ?? 95}%`,
      valB: `${expB?.resilienceScore ?? metricsB?.resilienceScore ?? 95}%`,
      better: (expA?.resilienceScore ?? 95) > (expB?.resilienceScore ?? 95) ? 'A' : ((expB?.resilienceScore ?? 95) > (expA?.resilienceScore ?? 95) ? 'B' : 'TIE')
    },
    {
      label: 'Region Mode',
      icon: ArrowRightLeft,
      valA: expA?.regionMode === 'multi-region' ? 'Multi-Region' : 'Single-Region',
      valB: expB?.regionMode === 'multi-region' ? 'Multi-Region' : 'Single-Region',
      better: 'N/A'
    },
    {
      label: 'Estimated Cost',
      icon: Award,
      valA: formatCost(metricsA?.estimatedCost ?? 0),
      valB: formatCost(metricsB?.estimatedCost ?? 0),
      better: (metricsA?.estimatedCost ?? 0) < (metricsB?.estimatedCost ?? 0) ? 'A' : ((metricsB?.estimatedCost ?? 0) < (metricsA?.estimatedCost ?? 0) ? 'B' : 'TIE')
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Compare Resiliency Experiments
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Experiment Selectors */}
        <div className="grid grid-cols-2 gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
              Experiment A (Baseline)
            </label>
            <select
              value={expA?.experimentId}
              onChange={(e) => setExpAId(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500"
            >
              {completed.map((e) => (
                <option key={e.experimentId} value={e.experimentId}>
                  {e.name} ({e.scenario})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
              Experiment B (Comparison)
            </label>
            <select
              value={expB?.experimentId}
              onChange={(e) => setExpBId(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500"
            >
              {completed.map((e) => (
                <option key={e.experimentId} value={e.experimentId}>
                  {e.name} ({e.scenario})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-y-auto flex-1 p-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400 font-mono">
                <th className="py-2.5 px-3">Metric</th>
                <th className="py-2.5 px-3 text-indigo-700 dark:text-indigo-300">Experiment A</th>
                <th className="py-2.5 px-3 text-purple-700 dark:text-purple-300">Experiment B</th>
                <th className="py-2.5 px-3 text-center">Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {comparisonRows.map((row, idx) => {
                const Icon = row.icon;
                return (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Icon size={14} className="text-slate-400" />
                      <span>{row.label}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {row.valA}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {row.valB}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {row.better === 'A' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Exp A
                        </span>
                      ) : row.better === 'B' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Exp B
                        </span>
                      ) : row.better === 'TIE' ? (
                        <span className="text-slate-400 text-[10px] font-mono">Tie</span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-mono">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-sm transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
