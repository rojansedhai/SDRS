import { create } from 'zustand';
import { Experiment, FailureType, TimelineEvent } from '../types/experiment';
import { MetricSnapshot } from '../types/metrics';
import { ServiceStatus, ServiceType, ServiceRole } from '../types/architecture';
import {
  simulateFailure,
  simulateRecovery,
  generateMockTimeline,
  mockExperiments,
  createInitialMetrics,
  createInitialHistory
} from '../services/mockData';
import { calculateEstimatedCost } from '../utils/cost';
import * as api from '../services/api';

interface ExperimentState {
  experiments: Experiment[];
  activeExperiment: Experiment | null;
  serviceStatuses: Record<ServiceType, ServiceStatus>;
  secondaryServiceStatuses: Record<string, ServiceStatus>;
  serviceRoles: { primary: ServiceRole; secondary: ServiceRole };
  failoverActive: boolean;
  regionMode: 'single-region' | 'multi-region';
  metricsHistory: MetricSnapshot[];
  isLoading: boolean;
  isDemoMode: boolean;

  // Actions
  setRegionMode: (mode: 'single-region' | 'multi-region') => void;
  startExperiment: (
    name: string,
    scenario?: string,
    options?: {
      targetRtoSeconds?: number;
      targetRpoEvents?: number;
      regionMode?: 'single-region' | 'multi-region';
      primaryRegion?: string;
      secondaryRegion?: string;
    }
  ) => Promise<void>;
  stopExperiment: () => Promise<void>;
  injectFailure: (type: FailureType) => Promise<void>;
  restoreService: () => Promise<void>;
  fetchExperiments: () => Promise<void>;
  fetchMetrics: (id: string) => Promise<void>;
  setServiceStatus: (service: ServiceType, status: ServiceStatus) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
  updateMetrics: (snapshot: MetricSnapshot) => void;
}

const isDemo = import.meta.env.VITE_DEMO_MODE !== 'false';

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  experiments: isDemo ? mockExperiments : [],
  activeExperiment: null,
  regionMode: 'multi-region',
  failoverActive: false,
  serviceRoles: {
    primary: 'active',
    secondary: 'standby'
  },
  serviceStatuses: {
    'api-gateway': 'healthy',
    eventbridge: 'healthy',
    sqs: 'healthy',
    lambda: 'healthy',
    dynamodb: 'healthy',
    route53: 'healthy',
    'dynamodb-global': 'healthy'
  },
  secondaryServiceStatuses: {
    'api-gateway': 'healthy',
    eventbridge: 'healthy',
    sqs: 'healthy',
    lambda: 'healthy'
  },
  metricsHistory: isDemo ? createInitialHistory() : [],
  isLoading: false,
  isDemoMode: isDemo,

  setRegionMode: (mode) => set({ regionMode: mode }),

  startExperiment: async (name, scenario = 'custom', options = {}) => {
    set({ isLoading: true });
    const targetRtoSeconds = options.targetRtoSeconds ?? 60;
    const targetRpoEvents = options.targetRpoEvents ?? 0;
    const mode = options.regionMode || get().regionMode;
    const isMulti = mode === 'multi-region';

    try {
      if (get().isDemoMode) {
        const initialMetrics = createInitialMetrics(isMulti);
        initialMetrics.targetRtoSeconds = targetRtoSeconds;
        initialMetrics.targetRpoEvents = targetRpoEvents;
        const initialHistory = createInitialHistory();

        const newExp: Experiment = {
          experimentId: `exp-${Date.now()}`,
          name,
          scenario,
          status: 'running',
          startedAt: new Date().toISOString(),
          region: options.primaryRegion || 'us-east-1',
          primaryRegion: options.primaryRegion || 'us-east-1',
          secondaryRegion: options.secondaryRegion || 'us-west-2',
          regionMode: mode,
          targetRtoSeconds,
          targetRpoEvents,
          resilienceScore: 100,
          result: null,
          metrics: initialMetrics,
          timeline: [
            generateMockTimeline('start', isMulti
              ? 'Multi-Region experiment initialized with Route 53 Active-Passive routing'
              : 'Experiment initialized and baseline load running'),
            generateMockTimeline('normal', isMulti
              ? 'Primary (us-east-1) ACTIVE, Secondary (us-west-2) STANDBY; Global Tables in sync'
              : 'All serverless components healthy')
          ]
        };

        set({
          activeExperiment: newExp,
          regionMode: mode,
          failoverActive: false,
          serviceRoles: { primary: 'active', secondary: 'standby' },
          serviceStatuses: simulateRecovery(),
          secondaryServiceStatuses: {
            'api-gateway': 'healthy',
            eventbridge: 'healthy',
            sqs: 'healthy',
            lambda: 'healthy'
          },
          metricsHistory: initialHistory,
          isLoading: false
        });
      } else {
        const result = await api.startExperiment(name, scenario, {
          regionMode: mode,
          primaryRegion: options.primaryRegion || 'us-east-1',
          secondaryRegion: options.secondaryRegion || 'us-west-2',
          targetRtoSeconds,
          targetRpoEvents
        });
        set({
          activeExperiment: result,
          regionMode: mode,
          isLoading: false
        });
      }
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  stopExperiment: async () => {
    const active = get().activeExperiment;
    if (!active) return;
    set({ isLoading: true });

    try {
      if (get().isDemoMode) {
        const now = new Date().toISOString();
        const finalMetrics = active.metrics ? { ...active.metrics } : createInitialMetrics();
        const rtoTargetMs = (finalMetrics.targetRtoSeconds ?? 60) * 1000;
        const rpoTarget = finalMetrics.targetRpoEvents ?? 0;

        const rtoPass = finalMetrics.rto !== undefined ? finalMetrics.rto <= rtoTargetMs : true;
        const rpoPass = finalMetrics.failedCount <= rpoTarget;
        finalMetrics.rtoPass = rtoPass;
        finalMetrics.rpoPass = rpoPass;

        const passed = rtoPass && rpoPass && (finalMetrics.dataConsistency ?? 100) >= 95;

        const completedExp: Experiment = {
          ...active,
          status: 'completed',
          stoppedAt: now,
          result: passed ? 'PASS' : 'FAIL',
          metrics: finalMetrics,
          resilienceScore: finalMetrics.resilienceScore ?? 95,
          timeline: [
            ...active.timeline,
            generateMockTimeline('stop', 'Experiment stopped and final resiliency metrics compiled')
          ]
        };

        set(state => ({
          activeExperiment: completedExp,
          experiments: [completedExp, ...state.experiments.filter(e => e.experimentId !== completedExp.experimentId)],
          serviceStatuses: simulateRecovery(),
          failoverActive: false,
          serviceRoles: { primary: 'active', secondary: 'standby' },
          isLoading: false
        }));
      } else {
        const result = await api.stopExperiment(active.experimentId);
        set(state => ({
          activeExperiment: result,
          experiments: [result, ...state.experiments.filter(e => e.experimentId !== result.experimentId)],
          isLoading: false
        }));
      }
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  injectFailure: async (type) => {
    const active = get().activeExperiment;
    if (!active) return;

    if (get().isDemoMode) {
      const now = new Date().toISOString();
      const updatedStatuses = simulateFailure(type);
      const updatedTimeline = [
        ...active.timeline,
        generateMockTimeline(
          'failure',
          type === 'region-failure'
            ? 'Primary Region (us-east-1) outage simulated; health check degraded'
            : `Fault injected into ${type}`
        )
      ];

      set({
        serviceStatuses: updatedStatuses,
        failoverActive: false,
        activeExperiment: {
          ...active,
          failureType: type,
          failureInjectedAt: now,
          detectedAt: undefined,
          failoverStartedAt: undefined,
          recoveredAt: undefined,
          timeline: updatedTimeline
        }
      });
    } else {
      await api.injectFailure(active.experimentId, type);
      set({
        serviceStatuses: simulateFailure(type),
        activeExperiment: {
          ...active,
          failureType: type,
          failureInjectedAt: new Date().toISOString()
        }
      });
    }
  },

  restoreService: async () => {
    const active = get().activeExperiment;
    if (!active) return;

    if (get().isDemoMode) {
      const now = Date.now();
      const injectedAt = active.failureInjectedAt ? new Date(active.failureInjectedAt).getTime() : now - 15000;
      const detectedAt = active.detectedAt ? new Date(active.detectedAt).getTime() : injectedAt + 1800;

      const recoveryTime = Math.max(1000, now - injectedAt);
      const rto = Math.max(500, now - detectedAt);
      const isRegional = active.failureType === 'region-failure';
      const rpo = isRegional ? 0 : Math.floor(Math.random() * 1500 + 2000);

      const currentMetrics = active.metrics ? { ...active.metrics } : createInitialMetrics();
      currentMetrics.recoveryTime = recoveryTime;
      currentMetrics.rto = rto;
      currentMetrics.rpo = rpo;

      const rtoTargetMs = (currentMetrics.targetRtoSeconds ?? 60) * 1000;
      currentMetrics.rtoPass = rto <= rtoTargetMs;
      currentMetrics.rpoPass = currentMetrics.failedCount <= (currentMetrics.targetRpoEvents ?? 0);

      const updatedTimeline = [...active.timeline];
      if (isRegional) {
        updatedTimeline.push(
          generateMockTimeline('normal', 'Primary region health check returned HTTP 200 OK'),
          generateMockTimeline('failback', 'Route 53 DNS failback completed; Primary region ACTIVE')
        );
      } else {
        updatedTimeline.push(
          generateMockTimeline('recovery', 'Normal traffic restored; automatic retry queue drained')
        );
      }

      set({
        serviceStatuses: simulateRecovery(),
        failoverActive: false,
        serviceRoles: { primary: 'active', secondary: 'standby' },
        activeExperiment: {
          ...active,
          failureType: undefined,
          recoveredAt: new Date(now).toISOString(),
          metrics: currentMetrics,
          timeline: updatedTimeline
        }
      });
    } else {
      await api.restoreService(active.experimentId);
      set({
        serviceStatuses: simulateRecovery(),
        failoverActive: false,
        serviceRoles: { primary: 'active', secondary: 'standby' },
        activeExperiment: {
          ...active,
          failureType: undefined,
          recoveredAt: new Date().toISOString()
        }
      });
    }
  },

  fetchExperiments: async () => {
    if (get().isDemoMode) {
      if (get().experiments.length === 0) {
        set({ experiments: mockExperiments });
      }
      return;
    }
    set({ isLoading: true });
    try {
      const experiments = await api.listExperiments();
      set({ experiments, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  fetchMetrics: async (id) => {
    if (get().isDemoMode) {
      const active = get().activeExperiment;
      if (!active || active.status !== 'running') return;

      const now = Date.now();
      const current = active.metrics ? { ...active.metrics } : createInitialMetrics();
      const failureType = active.failureType;
      const isInFailure = !!failureType && !active.recoveredAt;
      const isMulti = active.regionMode === 'multi-region' || get().regionMode === 'multi-region';

      const newReqs = Math.floor(Math.random() * 8) + 14;
      let newFailed = 0;
      let newDuplicates = 0;
      let newLost = 0;
      let primaryAdd = newReqs;
      let secondaryAdd = 0;

      const updatedTimeline = [...active.timeline];
      let detectedAt = active.detectedAt;
      let failoverStartedAt = active.failoverStartedAt;

      if (isInFailure && active.failureInjectedAt) {
        const elapsed = now - new Date(active.failureInjectedAt).getTime();

        if (failureType === 'region-failure') {
          // Stage 1: Detection at ~1.5s
          if (!detectedAt && elapsed >= 1500) {
            detectedAt = new Date(now).toISOString();
            current.detectionTime = elapsed;
            updatedTimeline.push(
              generateMockTimeline('detection', 'Route 53 health check probe returned 503 from us-east-1')
            );
          }

          // Stage 2: Health Check Failed at ~3.0s
          if (elapsed >= 3000 && !updatedTimeline.some(t => t.type === 'healthcheck-failed')) {
            updatedTimeline.push(
              generateMockTimeline('healthcheck-failed', 'Health Check threshold exceeded (3/3). Primary marked UNHEALTHY')
            );
          }

          // Stage 3: Failover Started at ~4.5s
          if (!failoverStartedAt && elapsed >= 4500) {
            failoverStartedAt = new Date(now).toISOString();
            current.dnsFailoverTime = elapsed;
            current.failoverTime = elapsed - 1500;
            updatedTimeline.push(
              generateMockTimeline('failover', 'Route 53 DNS failover initiated; switching CNAME to us-west-2')
            );
            set({
              failoverActive: true,
              serviceRoles: { primary: 'standby', secondary: 'active' }
            });
          }

          // Stage 4: Secondary Active at ~6.0s
          if (elapsed >= 6000 && !updatedTimeline.some(t => t.type === 'secondary-active')) {
            current.secondaryActivationTime = elapsed;
            updatedTimeline.push(
              generateMockTimeline('secondary-active', 'Secondary Region (us-west-2) is ACTIVE and ingesting 100% traffic')
            );
          }

          // Regional traffic distribution and packet loss
          if (elapsed < 4500) {
            // Before failover completes, requests sent to primary fail
            newFailed = Math.round(newReqs * 0.7);
            primaryAdd = newReqs;
            secondaryAdd = 0;
          } else {
            // After failover completes, traffic routed cleanly to secondary!
            newFailed = 0;
            primaryAdd = 0;
            secondaryAdd = newReqs;
          }
        } else {
          // Standard single-component failures
          if (!detectedAt && elapsed >= 1500) {
            detectedAt = new Date(now).toISOString();
            current.detectionTime = elapsed;
            updatedTimeline.push(
              generateMockTimeline('detection', `CloudWatch alarm: elevated error rates on ${failureType}`)
            );
          }

          switch (failureType) {
            case 'lambda-failure':
              newFailed = Math.round(newReqs * 0.9);
              break;
            case 'ddb-throttle':
              newFailed = Math.round(newReqs * 0.45);
              newDuplicates = Math.floor(Math.random() * 3);
              break;
            case 'sqs-backlog':
              newFailed = Math.round(newReqs * 0.25);
              break;
            case 'api-failure':
            case 'eventbridge-failure':
              newFailed = newReqs;
              break;
          }
        }
      }

      const newSuccess = Math.max(0, newReqs - newFailed);
      current.totalRequests += newReqs;
      current.successCount += newSuccess;
      current.failedCount += newFailed;
      current.duplicateCount += newDuplicates;
      current.lostCount += newLost;
      current.primaryRequests = (current.primaryRequests || 0) + primaryAdd;
      current.secondaryRequests = (current.secondaryRequests || 0) + secondaryAdd;

      // Recalculate data consistency
      const consistentEvents = Math.max(0, current.totalRequests - current.failedCount - current.duplicateCount - current.lostCount);
      current.dataConsistency = current.totalRequests > 0
        ? Math.max(0, Math.round((consistentEvents / current.totalRequests) * 10000) / 100)
        : 100;

      // Recalculate resilience score
      const rtoTargetMs = (current.targetRtoSeconds ?? 60) * 1000;
      let rtoScore = 30;
      if (current.rto) {
        rtoScore = current.rto <= rtoTargetMs ? 30 : Math.max(0, 30 - Math.round(((current.rto - rtoTargetMs) / rtoTargetMs) * 30));
      }
      const rpoScore = current.failedCount <= (current.targetRpoEvents ?? 0) ? 30 : Math.max(0, 30 - current.failedCount * 2);
      const consistencyScore = Math.round((current.dataConsistency / 100) * 30);
      const errorScore = Math.max(0, Math.round((1 - (current.failedCount / Math.max(1, current.totalRequests))) * 10));
      current.resilienceScore = Math.max(0, Math.min(100, rtoScore + rpoScore + consistencyScore + errorScore));

      // Update estimated cost
      current.estimatedCost = calculateEstimatedCost({
        apiRequests: current.totalRequests,
        lambdaInvocations: current.totalRequests,
        lambdaDurationMs: current.totalRequests * 120,
        sqsRequests: current.totalRequests * 2,
        dynamodbReads: current.totalRequests,
        dynamodbWrites: current.successCount,
        eventbridgeEvents: current.totalRequests,
        isMultiRegion: isMulti,
        primaryRequests: current.primaryRequests,
        secondaryRequests: current.secondaryRequests
      });

      const snapshot: MetricSnapshot = {
        timestamp: new Date(now).toISOString(),
        totalRequests: current.totalRequests,
        successCount: newSuccess,
        failedCount: newFailed,
        duplicateCount: newDuplicates,
        lostCount: newLost,
        primaryRequests: current.primaryRequests,
        secondaryRequests: current.secondaryRequests,
        avgLatency: isInFailure ? (failureType === 'region-failure' && !get().failoverActive ? 850 : 180) : 95,
        p95Latency: isInFailure ? (failureType === 'region-failure' && !get().failoverActive ? 1600 : 320) : 190,
        queueDepth: failureType === 'sqs-backlog' ? Math.min(250, 20 + current.failedCount) : 1,
        errorRate: newReqs > 0 ? Math.round((newFailed / newReqs) * 100) : 0,
      };

      const newHistory = [...get().metricsHistory.slice(-29), snapshot];

      set({
        activeExperiment: {
          ...active,
          detectedAt,
          failoverStartedAt,
          metrics: current,
          timeline: updatedTimeline
        },
        metricsHistory: newHistory
      });
      return;
    }

    try {
      const active = get().activeExperiment;
      if (active && active.status === 'running') {
        // In live AWS mode, send ongoing workload events so pipeline throughput and outages are active
        try {
          const isMulti = active.regionMode === 'multi-region' || get().regionMode === 'multi-region';
          const targetRegion = (isMulti && get().failoverActive) ? (active.secondaryRegion || 'us-west-2') : (active.primaryRegion || 'us-east-1');
          await api.generateEvents(id, 10, { region: targetRegion });
        } catch (genErr) {
          // Failure to generate during simulated API failure is expected
          console.warn('Live event generation notice:', genErr);
        }
      }

      const response = await api.getMetrics(id);
      set(state => ({
        activeExperiment: state.activeExperiment
          ? { ...state.activeExperiment, metrics: response.current }
          : null,
        metricsHistory: response.history || []
      }));
    } catch (error) {
      console.error(error);
    }
  },

  setServiceStatus: (service, status) => set(state => ({
    serviceStatuses: { ...state.serviceStatuses, [service]: status }
  })),

  addTimelineEvent: (event) => set(state => ({
    activeExperiment: state.activeExperiment
      ? { ...state.activeExperiment, timeline: [...state.activeExperiment.timeline, event] }
      : null
  })),

  updateMetrics: (snapshot) => set(state => ({
    metricsHistory: [...state.metricsHistory, snapshot].slice(-50)
  }))
}));
