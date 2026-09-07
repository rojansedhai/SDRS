import React, { useState } from 'react';
import { Zap, Inbox, Database, ArrowRight, CheckCircle2, Play, Loader2, Globe } from 'lucide-react';
import { useExperimentStore } from '../../store/experimentStore';
import type { FailureType } from '../../types/experiment';

interface Scenario {
  id: string;
  title: string;
  icon: React.ElementType;
  accentColor: string;
  iconBg: string;
  description: string;
  simulationDetail: string;
  expectedOutcome: string;
  failureType: FailureType;
  recommendedSLA: string;
  targetRtoSeconds?: number;
  targetRpoEvents?: number;
  regionMode?: 'single-region' | 'multi-region';
}

const scenarios: Scenario[] = [
  {
    id: 'scenario-4',
    title: 'Multi-Region Failover & Recovery',
    icon: Globe,
    accentColor: 'text-teal-500',
    iconBg: 'bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400',
    description: 'Simulates complete primary region outage, Route 53 active-passive DNS failover, secondary workload processing, and failback.',
    simulationDetail: 'Primary region health check returns 503. Route 53 redirects traffic to standby region. Global Tables preserve data replication.',
    expectedOutcome: 'Zero data loss via DynamoDB Global Tables. RTO driven by Route 53 evaluation period + DNS TTL.',
    failureType: 'region-failure',
    recommendedSLA: 'RTO < 60s · RPO = 0 events · 100% Consistency',
    targetRtoSeconds: 60,
    targetRpoEvents: 0,
    regionMode: 'multi-region',
  },
  {
    id: 'scenario-1',
    title: 'Lambda Failure',
    icon: Zap,
    accentColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    description: 'Simulates Lambda concurrency exhaustion (Reserved Concurrency = 0) preventing event processing.',
    simulationDetail: 'Events queue up in SQS. Messages retry with exponential backoff until redrive policy or concurrency restoration.',
    expectedOutcome: 'Zero data loss via SQS buffering. RTO directly proportional to detection + restore delay.',
    failureType: 'lambda-failure',
    recommendedSLA: 'RTO < 30s · RPO < 5s · 100% Consistency',
    targetRtoSeconds: 30,
    targetRpoEvents: 0,
    regionMode: 'single-region',
  },
  {
    id: 'scenario-2',
    title: 'SQS Backlog & Consumer Pause',
    icon: Inbox,
    accentColor: 'text-indigo-500',
    iconBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    description: 'Simulates consumer stalling by disabling Event Source Mapping between SQS and Lambda.',
    simulationDetail: 'Incoming EventBridge messages accumulate safely in SQS without burning DLQ retry attempts.',
    expectedOutcome: 'Queue depth spikes. Re-enabling mapping causes fast batch draining without loss.',
    failureType: 'sqs-backlog',
    recommendedSLA: 'RTO < 45s · Zero Lost Messages',
    targetRtoSeconds: 45,
    targetRpoEvents: 0,
    regionMode: 'single-region',
  },
  {
    id: 'scenario-3',
    title: 'DynamoDB Write Throttling',
    icon: Database,
    accentColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    description: 'Simulates table write throttling with ProvisionedThroughputExceededException.',
    simulationDetail: 'Client retries trigger potential duplicates or DLQ routing. Tests idempotent conditional puts.',
    expectedOutcome: 'Deduplication prevents double writes. Temporary latency spike followed by clean recovery.',
    failureType: 'ddb-throttle',
    recommendedSLA: 'RTO < 60s · Data Consistency > 95%',
    targetRtoSeconds: 60,
    targetRpoEvents: 5,
    regionMode: 'single-region',
  }
];

interface PredefinedExperimentsProps {
  onNavigateToDashboard?: () => void;
}

/**
 * PredefinedExperiments shows a grid of guided scenarios with instant interactive feedback.
 */
export const PredefinedExperiments: React.FC<PredefinedExperimentsProps> = ({ onNavigateToDashboard }) => {
  const { startExperiment, activeExperiment, setRegionMode } = useExperimentStore();
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const failureTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (failureTimerRef.current) {
        clearTimeout(failureTimerRef.current);
      }
    };
  }, []);

  const handleRun = async (scenario: Scenario) => {
    setLaunchingId(scenario.id);
    setNotification(`Initiating "${scenario.title}" — Setting up baseline traffic...`);

    if (scenario.regionMode) {
      setRegionMode(scenario.regionMode);
    }

    // 1. Start the experiment
    await startExperiment(`Scenario: ${scenario.title}`, scenario.failureType, {
      targetRtoSeconds: scenario.targetRtoSeconds,
      targetRpoEvents: scenario.targetRpoEvents,
      regionMode: scenario.regionMode
    });

    // 2. Schedule automatic failure injection after 5 seconds
    if (failureTimerRef.current) {
      clearTimeout(failureTimerRef.current);
    }
    failureTimerRef.current = setTimeout(() => {
      const current = useExperimentStore.getState().activeExperiment;
      if (current && current.status === 'running' && !current.failureType) {
        useExperimentStore.getState().injectFailure(scenario.failureType);
      }
    }, 5000);

    // 3. Show feedback & switch to Dashboard
    setTimeout(() => {
      setNotification(`🚀 Scenario "${scenario.title}" is live! Switching to Dashboard to observe topology...`);
    }, 600);

    setTimeout(() => {
      setLaunchingId(null);
      if (onNavigateToDashboard) {
        onNavigateToDashboard();
      }
    }, 1400);
  };

  const isCurrentActive = (scenario: Scenario) => {
    return activeExperiment?.status === 'running' && activeExperiment.scenario === scenario.failureType;
  };

  return (
    <div className="space-y-6">
      {/* Interactive feedback alert */}
      {notification && (
        <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-medium text-sm">{notification}</span>
          </div>
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1"
            >
              Go to Dashboard <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((s) => {
          const Icon = s.icon;
          const isLaunching = launchingId === s.id;
          const isActive = isCurrentActive(s);

          return (
            <div
              key={s.id}
              className={`
                relative flex flex-col justify-between rounded-2xl border bg-white dark:bg-slate-900 p-6 shadow-sm transition-all duration-300
                ${isActive
                  ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                }
              `}
            >
              <div>
                {/* Header: Icon + Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${s.iconBg} shadow-inner`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {s.regionMode === 'multi-region' ? 'Phase 2' : 'Preset'}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {s.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed line-clamp-3">
                  {s.description}
                </p>

                {/* Simulation Details Box */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 mb-4 space-y-2 border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Failure Mechanism:</span>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 line-clamp-2">{s.simulationDetail}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">Target SLA:</span>
                    <p className="text-slate-500 dark:text-slate-400 text-[10.5px] font-mono">{s.recommendedSLA}</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  disabled={isLaunching || isActive}
                  onClick={() => handleRun(s)}
                  className={`
                    w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all shadow-sm
                    ${isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-default'
                      : isLaunching
                        ? 'bg-indigo-600 text-white cursor-wait'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98]'
                    }
                  `}
                >
                  {isLaunching ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Launching...</span>
                    </>
                  ) : isActive ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Running</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Run Scenario</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
