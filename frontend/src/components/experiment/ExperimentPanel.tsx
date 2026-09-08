import React, { useState, useEffect } from 'react';
import { useExperimentStore } from '../../store/experimentStore';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatDuration, formatPercentage } from '../../utils/formatters';
import { Play, Square, RotateCcw, CheckCircle2, AlertTriangle, ShieldCheck, Clock, Timer, HardDrive, ShieldAlert } from 'lucide-react';
import { Glossary } from '../onboarding/GlossaryTooltip';
import type { FailureType } from '../../types/experiment';

interface ExperimentPanelProps {
  onViewHistory?: () => void;
}

const scenarioPresets: Record<string, { title: string; failureType: FailureType; targetRto: number; targetRpo: number; regionMode: 'single-region' | 'multi-region' }> = {
  'lambda-failure': {
    title: 'Lambda Concurrency Zero',
    failureType: 'lambda-failure',
    targetRto: 30,
    targetRpo: 0,
    regionMode: 'single-region'
  },
  'sqs-backlog': {
    title: 'SQS Consumer Stalling',
    failureType: 'sqs-backlog',
    targetRto: 45,
    targetRpo: 0,
    regionMode: 'single-region'
  },
  'ddb-throttle': {
    title: 'DynamoDB Throughput Exhaustion',
    failureType: 'ddb-throttle',
    targetRto: 60,
    targetRpo: 5,
    regionMode: 'single-region'
  },
  'region-failure': {
    title: 'Multi-Region Failover & Recovery',
    failureType: 'region-failure',
    targetRto: 60,
    targetRpo: 0,
    regionMode: 'multi-region'
  },
};

/**
 * ExperimentPanel provides main experiment lifecycle controls with a high-end dev-tool aesthetic.
 */
export const ExperimentPanel: React.FC<ExperimentPanelProps> = ({ onViewHistory }) => {
  const { activeExperiment, startExperiment, stopExperiment, regionMode, setRegionMode } = useExperimentStore();
  const [experimentName, setExperimentName] = useState('');
  const [scenarioType, setScenarioType] = useState('custom');
  const [rtoTarget, setRtoTarget] = useState(60);
  const [rpoTarget, setRpoTarget] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duration, setDuration] = useState(0);

  const experimentStatus = activeExperiment?.status ?? 'idle';

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (experimentStatus === 'running' && activeExperiment) {
      interval = setInterval(() => {
        const start = activeExperiment.startedAt ? new Date(activeExperiment.startedAt).getTime() : Date.now();
        setDuration(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [experimentStatus, activeExperiment]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStart = async () => {
    const isPredefined = scenarioType !== 'custom' && !!scenarioPresets[scenarioType];
    const preset = isPredefined ? scenarioPresets[scenarioType] : null;

    const effectiveRegionMode = preset ? preset.regionMode : regionMode;
    const defaultName = preset
      ? `Scenario: ${preset.title}`
      : (effectiveRegionMode === 'multi-region' ? 'Multi-Region DR Test' : 'Single-Region Chaos Test');

    const expName = experimentName || defaultName;

    if (preset && preset.regionMode !== regionMode) {
      setRegionMode(preset.regionMode);
    }

    await startExperiment(expName, scenarioType, {
      regionMode: effectiveRegionMode,
      targetRtoSeconds: preset ? preset.targetRto : rtoTarget,
      targetRpoEvents: preset ? preset.targetRpo : rpoTarget,
    });

    // If a predefined scenario was selected, schedule automatic failure injection
    // after 5 seconds of healthy baseline traffic (matching PredefinedExperiments)
    if (preset) {
      setTimeout(() => {
        const currentExp = useExperimentStore.getState().activeExperiment;
        if (currentExp && currentExp.status === 'running' && !currentExp.failureType) {
          useExperimentStore.getState().injectFailure(preset.failureType);
        }
      }, 5000);
    }

    setExperimentName('');
  };

  const handleStop = () => {
    setConfirmOpen(true);
  };

  const renderIdle = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Experiment Name
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            placeholder="e.g. Primary Region Failover Test"
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Initial Scenario
          </label>
          <select
            value={scenarioType}
            onChange={(e) => setScenarioType(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="custom">Custom (Inject faults manually)</option>
            <option value="lambda-failure">Predefined: Lambda Concurrency Zero</option>
            <option value="sqs-backlog">Predefined: SQS Consumer Stalling</option>
            <option value="ddb-throttle">Predefined: DynamoDB Throughput Exhaustion</option>
            <option value="region-failure">💥 Predefined: Primary Region Failure & Route 53 Failover</option>
          </select>
        </div>

        {regionMode === 'multi-region' && (
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                <Glossary term="RTO">Target RTO</Glossary> (Seconds)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={rtoTarget}
                onChange={(e) => setRtoTarget(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                <Glossary term="RPO">Target RPO</Glossary> (Max Lost Events)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rpoTarget}
                onChange={(e) => setRpoTarget(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleStart}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all active:scale-[0.99]"
      >
        <Play size={16} className="fill-current" />
        <span>Start Simulator Experiment</span>
      </button>
    </div>
  );

  const renderRunning = () => {
    const isFaultActive = !!activeExperiment?.failureType && !activeExperiment?.recoveredAt;

    return (
      <div className="space-y-5">
        {/* Experiment Header Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Current Run
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {activeExperiment?.name}
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              RUNNING
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Clock size={13} className="text-indigo-500" />
              <span>Elapsed Duration:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {formatTime(duration)}
              </span>
            </div>

            <div>
              {isFaultActive ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-md">
                  <AlertTriangle size={12} /> Fault Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={12} /> Healthy Flow
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleStop}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-all active:scale-[0.99]"
        >
          <Square size={16} className="fill-current" />
          <span>Stop Experiment & Compile Metrics</span>
        </button>
      </div>
    );
  };

  const renderCompleted = () => {
    const metrics = activeExperiment?.metrics;
    const passed = activeExperiment?.result === 'PASS';

    return (
      <div className="space-y-5">
        {/* Result Evaluation Card */}
        <div className={`p-4 rounded-2xl border ${passed ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {passed ? (
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={20} />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">
                  <ShieldAlert size={20} />
                </div>
              )}
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {passed ? 'Disaster Recovery: PASSED' : 'Disaster Recovery: SLA BREACH'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {passed ? 'System achieved automated recovery within target SLA' : 'Consistency dropped or recovery latency exceeded limits'}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
              {passed ? 'PASS' : 'FAIL'}
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 text-xs pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Timer size={10} /> <Glossary term="RTO">RTO</Glossary>
              </span>
              <span className="font-bold font-mono text-xs text-slate-900 dark:text-white">
                {metrics?.rto !== undefined ? formatDuration(metrics.rto) : '--'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <HardDrive size={10} /> <Glossary term="RPO">RPO</Glossary>
              </span>
              <span className="font-bold font-mono text-xs text-slate-900 dark:text-white">
                {metrics?.rpo !== undefined ? formatDuration(metrics.rpo) : '--'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase">Consistency</span>
              <span className="font-bold font-mono text-xs text-emerald-600 dark:text-emerald-400">
                {metrics?.dataConsistency !== undefined ? formatPercentage(metrics.dataConsistency) : '100%'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={() => useExperimentStore.setState({ activeExperiment: null })}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 px-4 text-sm font-semibold text-white shadow-sm transition-all"
          >
            <RotateCcw size={15} />
            <span>New Experiment</span>
          </button>

          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              View History
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Experiment Controls
        </h2>
        <span className="text-xs font-mono flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
          <span className={`w-1.5 h-1.5 rounded-full ${regionMode === 'multi-region' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
          {regionMode === 'multi-region' ? 'Phase 2: Multi-Region' : 'Phase 1: Single Region'}
        </span>
      </div>

      {(!activeExperiment || experimentStatus === 'idle') && renderIdle()}
      {activeExperiment && experimentStatus === 'running' && renderRunning()}
      {activeExperiment && experimentStatus === 'completed' && renderCompleted()}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Stop Active Experiment"
        description="Are you sure you want to stop the experiment? This will compile final RTO, RPO, and consistency scores and store them in Experiment History."
        confirmLabel="Stop & Finalize"
        variant="danger"
        onConfirm={stopExperiment}
      />
    </div>
  );
};
