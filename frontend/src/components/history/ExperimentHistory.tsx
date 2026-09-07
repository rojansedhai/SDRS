import React, { useState } from 'react';
import { useExperimentStore } from '../../store/experimentStore';
import { formatTimestamp, formatDuration, formatPercentage } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { ExperimentComparisonModal } from './ExperimentComparisonModal';
import { ArrowRightLeft } from 'lucide-react';
import type { Experiment } from '../../types/experiment';

type SortKey = 'name' | 'startedAt' | 'duration' | 'rto' | 'rpo' | 'result';

/**
 * ExperimentHistory displays a sortable table of past experiments and allows
 * side-by-side experiment comparison.
 */
export const ExperimentHistory: React.FC = () => {
  const { experiments } = useExperimentStore();
  const [sortKey, setSortKey] = useState<SortKey>('startedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Filter to only completed experiments
  const completedExperiments = experiments.filter(e => e.status === 'completed' || e.status === 'failed' || e.result !== null);

  if (completedExperiments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-sm">
        <p className="text-slate-500 dark:text-slate-400">No experiments yet. Start your first experiment!</p>
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const getSortValue = (exp: Experiment, key: SortKey): number | string => {
    switch (key) {
      case 'name': return exp.name;
      case 'startedAt': return exp.startedAt ? new Date(exp.startedAt).getTime() : 0;
      case 'duration': {
        if (!exp.startedAt || !exp.stoppedAt) return 0;
        return new Date(exp.stoppedAt).getTime() - new Date(exp.startedAt).getTime();
      }
      case 'rto': return exp.metrics?.rto ?? 0;
      case 'rpo': return exp.metrics?.rpo ?? 0;
      case 'result': return exp.result === 'PASS' ? 1 : 0;
      default: return 0;
    }
  };

  const sortedExperiments = [...completedExperiments].sort((a, b) => {
    const valA = getSortValue(a, sortKey);
    const valB = getSortValue(b, sortKey);
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 inline-block">{sortAsc ? '↑' : '↓'}</span>;
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Completed Run History
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {completedExperiments.length} past experiments logged
          </p>
        </div>

        {completedExperiments.length >= 2 && (
          <button
            onClick={() => setCompareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-[0.98]"
          >
            <ArrowRightLeft size={13} />
            <span>Compare Experiments</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('name')}>
                Experiment Name {renderSortIndicator('name')}
              </th>
              <th className="px-4 py-3 font-medium">Scenario</th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('startedAt')}>
                Started {renderSortIndicator('startedAt')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('duration')}>
                Duration {renderSortIndicator('duration')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('rto')}>
                RTO {renderSortIndicator('rto')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('rpo')}>
                RPO {renderSortIndicator('rpo')}
              </th>
              <th className="px-4 py-3 font-medium">Failed Events</th>
              <th className="px-4 py-3 font-medium">Consistency</th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('result')}>
                Result {renderSortIndicator('result')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {sortedExperiments.map((exp) => {
              const start = exp.startedAt ? new Date(exp.startedAt).getTime() : 0;
              const end = exp.stoppedAt ? new Date(exp.stoppedAt).getTime() : start;
              const durMs = end - start;

              return (
                <tr key={exp.experimentId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-default">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{exp.name}</span>
                    {exp.regionMode === 'multi-region' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        Multi-Region
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{exp.scenario}</td>
                  <td className="px-4 py-3">{exp.startedAt ? formatTimestamp(exp.startedAt) : '--'}</td>
                  <td className="px-4 py-3">{formatDuration(durMs)}</td>
                  <td className="px-4 py-3">{formatDuration(exp.metrics?.rto ?? 0)}</td>
                  <td className="px-4 py-3">{formatDuration(exp.metrics?.rpo ?? 0)}</td>
                  <td className="px-4 py-3">{exp.metrics?.failedCount ?? 0}</td>
                  <td className="px-4 py-3">{formatPercentage(exp.metrics?.dataConsistency ?? 100)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={exp.result === 'PASS' ? 'PASS' : 'FAIL'} size="sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ExperimentComparisonModal
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        experiments={completedExperiments}
      />
    </div>
  );
};
