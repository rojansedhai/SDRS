import React, { useState } from 'react';
import { Zap, Inbox, Database, Globe, Radio, RotateCcw, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';
import { useExperimentStore } from '../../store/experimentStore';
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { FailureType } from '../../types/experiment';

interface FailureOption {
  type: FailureType;
  icon: React.ElementType;
  name: string;
  description: string;
  awsApi: string;
  isRegional?: boolean;
}

const failures: FailureOption[] = [
  {
    type: 'lambda-failure',
    icon: Zap,
    name: 'Lambda Failure',
    description: 'Set reserved concurrency to 0',
    awsApi: 'PutFunctionConcurrency=0',
  },
  {
    type: 'sqs-backlog',
    icon: Inbox,
    name: 'SQS Backlog',
    description: 'Pause consumer Event Source Mapping',
    awsApi: 'UpdateEventSourceMapping(Enabled=false)',
  },
  {
    type: 'ddb-throttle',
    icon: Database,
    name: 'DynamoDB Throttle',
    description: 'Simulate write capacity exhaustion',
    awsApi: 'ProvisionedThroughputExceededException',
  },
  {
    type: 'api-failure',
    icon: Globe,
    name: 'API Failure',
    description: 'Return HTTP 500 from Gateway routes',
    awsApi: 'HttpApi 500 Internal Error Simulation',
  },
  {
    type: 'eventbridge-failure',
    icon: Radio,
    name: 'EventBridge Failure',
    description: 'Disable event routing rule to SQS',
    awsApi: 'DisableRule(EventBridgeToSQSRule)',
  },
  {
    type: 'region-failure',
    icon: Flame,
    name: '💥 Fail Primary Region',
    description: 'Simulate primary region outage triggering Route 53 DNS failover',
    awsApi: 'Route 53 Active-Passive Failover (us-east-1 -> us-west-2)',
    isRegional: true,
  },
];

/**
 * FailureControls provides safe, non-destructive failure injection controls.
 */
export const FailureControls: React.FC = () => {
  const { activeExperiment, injectFailure, restoreService, isDemoMode, regionMode, setRegionMode } = useExperimentStore();
  const [selectedFailure, setSelectedFailure] = useState<FailureType | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleInject = (type: FailureType) => {
    setSelectedFailure(type);
    setConfirmOpen(true);
  };

  const confirmInject = () => {
    if (selectedFailure) {
      if (selectedFailure === 'region-failure' && regionMode !== 'multi-region') {
        setRegionMode('multi-region');
      }
      injectFailure(selectedFailure);
    }
  };

  const isRunning = activeExperiment?.status === 'running';
  const activeFailureType = activeExperiment?.failureType;
  const isFaultActive = !!activeFailureType && !activeExperiment?.recoveredAt;
  const activeFaultObj = failures.find((f) => f.type === activeFailureType);

  const isRegionalSelected = selectedFailure === 'region-failure';

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Failure Injection
        </h2>
        {isDemoMode ? (
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800">
            Demo Sandbox
          </span>
        ) : (
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1">
            <AlertTriangle size={11} /> Live AWS Resources
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Simulate real failure conditions in a controlled, non-destructive manner. All operations target only SDRS resources and are strictly reversible.
      </p>

      {/* Prominent Active Failure Alert & Immediate Restore Bar */}
      {isFaultActive && activeFaultObj && (
        <div className="mb-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-400 dark:border-rose-800 shadow-sm animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300">
                <Flame size={16} className="animate-pulse" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                  Active Fault: {activeFaultObj.name}
                </h4>
                <p className="text-xs text-rose-700 dark:text-rose-400 font-mono">
                  {activeFaultObj.awsApi}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-rose-600 text-white animate-pulse">
              INJECTED
            </span>
          </div>

          <button
            onClick={() => restoreService()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 px-4 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.99]"
          >
            <RotateCcw size={16} />
            <span>Restore Service Now (Initiate Failback & Healing)</span>
          </button>
        </div>
      )}

      {/* Inactive or Not-Running Banner */}
      {!isRunning && (
        <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <ShieldCheck size={16} className="text-slate-400 shrink-0" />
          <span>Start an experiment in the left panel to enable live failure injection controls.</span>
        </div>
      )}

      {/* Grid of Failure Types */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {failures.map((f) => {
          const isActive = activeFailureType === f.type;
          const Icon = f.icon;

          return (
            <button
              key={f.type}
              disabled={!isRunning || (isFaultActive && !isActive)}
              onClick={() => (isActive ? restoreService() : handleInject(f.type))}
              className={`
                group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all
                ${f.isRegional ? 'border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/20' : ''}
                ${isActive
                  ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 disabled:opacity-40 disabled:hover:bg-transparent'
                }
              `}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`p-2 rounded-lg ${isActive ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300' : (f.isRegional ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{f.name}</span>
                      {f.isRegional && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                          Phase 2
                        </span>
                      )}
                    </span>
                    {isActive ? (
                      <span className="rounded-full bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-600 dark:text-rose-300 animate-pulse">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        Inject →
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {f.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 block truncate">
                  {f.awsApi}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isRegionalSelected ? 'Confirm Regional Disaster Recovery Experiment' : `Inject ${failures.find((f) => f.type === selectedFailure)?.name}`}
        description={
          isRegionalSelected
            ? '⚠️ This experiment will intentionally disrupt the SDRS test environment. It will degrade the Primary Region (us-east-1) health check endpoint, causing Route 53 to initiate automated DNS failover to the Secondary Region (us-west-2).'
            : `Are you sure you want to inject this failure into the simulator? ${!isDemoMode ? 'This will invoke AWS APIs against your deployed stack resources.' : 'This will simulate an outage condition in the pipeline.'}`
        }
        confirmLabel={isRegionalSelected ? 'Fail Primary Region Now' : 'Inject Fault'}
        variant="danger"
        onConfirm={confirmInject}
      />
    </div>
  );
};
