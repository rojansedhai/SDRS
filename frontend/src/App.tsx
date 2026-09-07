import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ArchitectureDiagram } from './components/architecture/ArchitectureDiagram';
import { ExperimentPanel } from './components/experiment/ExperimentPanel';
import { FailureControls } from './components/experiment/FailureControls';
import { PredefinedExperiments } from './components/experiment/PredefinedExperiments';
import { ExperimentTimeline } from './components/experiment/ExperimentTimeline';
import { MetricsDashboard } from './components/metrics/MetricsDashboard';
import { TimeSeriesChart } from './components/metrics/TimeSeriesChart';
import { CostEstimator } from './components/metrics/CostEstimator';
import { ExperimentHistory } from './components/history/ExperimentHistory';
import { useExperimentStore } from './store/experimentStore';
import { Zap, RotateCcw, AlertTriangle, Sparkles } from 'lucide-react';
import type { FailureType } from './types/experiment';

/**
 * Main application component for the Serverless Disaster Recovery Simulator.
 * Manages view routing and orchestrates the dashboard layout.
 */
function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const { activeExperiment, metricsHistory, fetchExperiments, fetchMetrics, injectFailure, restoreService, isDemoMode } = useExperimentStore();

  // Fetch experiment history on mount
  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  // Poll metrics while an experiment is running
  useEffect(() => {
    if (!activeExperiment || activeExperiment.status !== 'running') return;

    // Fetch metrics immediately
    fetchMetrics(activeExperiment.experimentId);

    // Poll every 1.5 seconds for real-time responsiveness
    const interval = setInterval(() => {
      fetchMetrics(activeExperiment.experimentId);
    }, 1500);

    return () => clearInterval(interval);
  }, [activeExperiment?.experimentId, activeExperiment?.status, fetchMetrics]);

  const handleViewChange = useCallback((view: string) => {
    setActiveView(view);
  }, []);

  const isScenarioRunning = activeExperiment?.status === 'running' && (
    activeExperiment.name.startsWith('Scenario:') ||
    (!!activeExperiment.scenario && activeExperiment.scenario !== 'custom')
  );
  const isFailureActive = !!activeExperiment?.failureType && !activeExperiment?.recoveredAt;

  return (
    <DashboardLayout activeView={activeView} onViewChange={handleViewChange}>
      {activeView === 'dashboard' && (
        <div className="space-y-6">
          {/* Guided Scenario Live Banner */}
          {isScenarioRunning && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-200 dark:border-indigo-800/80 shadow-sm flex flex-wrap items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Guided Scenario Active
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeExperiment.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {isFailureActive
                      ? `💥 Failure injected (${activeExperiment.failureType}). Observe error rates and failover detection below.`
                      : 'Baseline load running. Automatic failure injection will occur in a few seconds, or trigger immediately below.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isFailureActive && (
                  <button
                    onClick={() => {
                      const targetType = (activeExperiment.scenario || 'lambda-failure') as FailureType;
                      injectFailure(targetType);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                  >
                    <Zap size={14} />
                    <span>Inject Fault Now</span>
                  </button>
                )}

                {isFailureActive && (
                  <button
                    onClick={() => restoreService()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                  >
                    <RotateCcw size={14} />
                    <span>Restore Service</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Architecture Overview */}
          <section aria-label="Architecture Overview">
            <ArchitectureDiagram />
          </section>

          {/* Experiment Controls + Failure Injection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section aria-label="Experiment Controls">
              <ExperimentPanel onViewHistory={() => setActiveView('history')} />
            </section>
            <section aria-label="Failure Injection">
              <FailureControls />
            </section>
          </div>

          {/* Timeline */}
          {activeExperiment && (
            <section aria-label="Experiment Timeline">
              <ExperimentTimeline />
            </section>
          )}

          {/* Metrics */}
          <section aria-label="Metrics Overview">
            <MetricsDashboard />
          </section>

          {/* Time Series Chart */}
          {metricsHistory.length > 0 && (
            <section aria-label="Request Rate Over Time">
              <TimeSeriesChart
                data={metricsHistory}
                title="Request Throughput & Error Rate Over Time"
                height={320}
              />
            </section>
          )}

          {/* Cost Estimator */}
          {activeExperiment && (
            <section aria-label="Cost Estimation">
              <CostEstimator />
            </section>
          )}
        </div>
      )}

      {activeView === 'experiments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Predefined Failure Scenarios
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Curated educational disaster recovery experiments with automatic fault injection and recovery observation.
              </p>
            </div>
            <button
              onClick={() => setActiveView('dashboard')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline self-start sm:self-auto"
            >
              ← Back to Dashboard
            </button>
          </div>

          <PredefinedExperiments onNavigateToDashboard={() => setActiveView('dashboard')} />
        </div>
      )}

      {activeView === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Experiment Audit History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Comparative resilience analytics, RTO/RPO recovery time, and PASS/FAIL compliance logs.
              </p>
            </div>
            <button
              onClick={() => setActiveView('dashboard')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline self-start sm:self-auto"
            >
              ← Back to Dashboard
            </button>
          </div>

          <ExperimentHistory />
        </div>
      )}

      {activeView === 'settings' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight border-b border-slate-200 dark:border-slate-800 pb-4">
            Simulator Configuration
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Environment & Target Stack
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Execution Mode</span>
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {isDemoMode ? '🧪 Simulated Demo (Local)' : '☁️ Live AWS Deployment'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Primary Region</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">us-east-1</span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">API Gateway URL</span>
                    <span className="font-mono text-xs text-slate-900 dark:text-white truncate max-w-[200px]">
                      {import.meta.env.VITE_API_URL || 'Simulated Locally'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">API Security Key</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {import.meta.env.VITE_API_KEY ? '••••••••••••' : 'Default Demo Auth'}
                    </span>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Safety Guardrails
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200 font-semibold">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Strict Non-Destructive Invariant
                  </div>
                  <p>
                    All failure injection actions operate strictly against the SDRS dedicated stack resources. No IAM permissions exist for destructive resource deletion (<code className="text-rose-500">DeleteFunction</code>, <code className="text-rose-500">DeleteQueue</code>, <code className="text-rose-500">DeleteTable</code>).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default App;
