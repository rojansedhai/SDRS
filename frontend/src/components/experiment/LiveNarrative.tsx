import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useExperimentStore } from '../../store/experimentStore';

interface LiveNarrativeProps {
  className?: string;
}

interface NarrativeState {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  text: string;
}

export const LiveNarrative: React.FC<LiveNarrativeProps> = ({ className = '' }) => {
  const { activeExperiment, failoverActive, regionMode } = useExperimentStore();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const getNarrative = (): NarrativeState => {
    // 1. No experiment active
    if (!activeExperiment || activeExperiment.status === 'idle') {
      return {
        icon: Lightbulb,
        iconBg: 'bg-slate-100 dark:bg-slate-800',
        iconColor: 'text-slate-500 dark:text-slate-400',
        borderColor: 'border-slate-200/80 dark:border-slate-800',
        cardBg: 'bg-slate-50/60 dark:bg-slate-900/60',
        badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
        badgeText: 'Idle',
        label: 'System Standby',
        text: 'Start an experiment to see a live play-by-play of what happens when you break \u2014 and fix \u2014 a serverless system.',
      };
    }

    // 2. Service restored
    if (activeExperiment.recoveredAt) {
      const rtoMs = activeExperiment.metrics?.rto ?? activeExperiment.metrics?.recoveryTime ?? 0;
      const rtoVal = rtoMs / 1000;
      const rtoSec = Number.isInteger(rtoVal) ? rtoVal : +rtoVal.toFixed(1);
      const targetRto = activeExperiment.targetRtoSeconds ?? activeExperiment.metrics?.targetRtoSeconds ?? 60;

      const rpo = activeExperiment.metrics?.lostCount ?? 0;
      const targetRpo = activeExperiment.targetRpoEvents ?? activeExperiment.metrics?.targetRpoEvents ?? 0;

      const rtoPass = activeExperiment.metrics?.rtoPass ?? (rtoVal <= targetRto);
      const rpoPass = activeExperiment.metrics?.rpoPass ?? (rpo <= targetRpo);
      const passed = activeExperiment.result === 'PASS' || (rtoPass && rpoPass);
      const passFailSummary = passed ? 'Targets met (PASS).' : 'Targets missed (FAIL).';

      const dataLossNarrative = rpo === 0
        ? `0 events were lost during the outage (your RPO target was ${targetRpo}). SQS buffered messages safely during the disruption and drained them upon recovery.`
        : `${rpo} events were lost during the outage (your RPO target was ${targetRpo}).`;

      return {
        icon: CheckCircle2,
        iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        borderColor: 'border-emerald-300 dark:border-emerald-700/80',
        cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        badgeText: 'Restored',
        label: 'Recovery Complete',
        text: `Service restored! Recovery took ${rtoSec}s (your RTO target was ${targetRto}s). ${dataLossNarrative} ${passFailSummary}`,
      };
    }

    // 3. Region failure
    if (activeExperiment.failureType === 'region-failure') {
      if (failoverActive) {
        return {
          icon: RefreshCw,
          iconBg: 'bg-blue-100 dark:bg-blue-950/60',
          iconColor: 'text-blue-600 dark:text-blue-400',
          borderColor: 'border-blue-300 dark:border-blue-700/80',
          cardBg: 'bg-blue-50/40 dark:bg-blue-950/20',
          badgeBg: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          badgeText: 'Failover Active',
          label: 'Traffic Re-routed',
          text: 'Route 53 has detected 3 consecutive health check failures and initiated DNS failover. All traffic is now routing to the secondary region (us-west-2). DynamoDB Global Tables ensure the secondary region has the same data \u2014 zero data loss during failover.',
        };
      }

      return {
        icon: AlertTriangle,
        iconBg: 'bg-amber-100 dark:bg-amber-950/60',
        iconColor: 'text-amber-600 dark:text-amber-400',
        borderColor: 'border-amber-300 dark:border-amber-700/80',
        cardBg: 'bg-amber-50/40 dark:bg-amber-950/20',
        badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        badgeText: 'Regional Outage',
        label: 'Health Check Failing',
        text: 'The primary region (us-east-1) is returning 503 errors. Route 53 health checks are detecting the failure \u2014 once 3 consecutive checks fail (every 10 seconds), DNS failover will be triggered to redirect traffic to us-west-2.',
      };
    }

    // 4. Lambda failure
    if (activeExperiment.failureType === 'lambda-failure') {
      return {
        icon: AlertTriangle,
        iconBg: 'bg-rose-100 dark:bg-rose-950/60',
        iconColor: 'text-rose-600 dark:text-rose-400',
        borderColor: 'border-rose-300 dark:border-rose-700/80',
        cardBg: 'bg-rose-50/40 dark:bg-rose-950/20',
        badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        badgeText: 'Lambda Throttled',
        label: 'Concurrency 0',
        text: 'Lambda concurrency has been set to 0 \u2014 no function instances can execute. SQS is now buffering all incoming messages. No data is lost because SQS retains messages for up to 14 days. Error rate has spiked because no events are being processed.',
      };
    }

    // 5. SQS backlog
    if (activeExperiment.failureType === 'sqs-backlog') {
      return {
        icon: AlertTriangle,
        iconBg: 'bg-rose-100 dark:bg-rose-950/60',
        iconColor: 'text-rose-600 dark:text-rose-400',
        borderColor: 'border-rose-300 dark:border-rose-700/80',
        cardBg: 'bg-rose-50/40 dark:bg-rose-950/20',
        badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        badgeText: 'ESM Disabled',
        label: 'Queue Backlog',
        text: "The Event Source Mapping (ESM) between SQS and Lambda has been disabled. Lambda has no trigger \u2014 it doesn't know there are messages waiting. Messages are accumulating in the queue. Queue depth is growing.",
      };
    }

    // 6. DynamoDB throttle
    if (activeExperiment.failureType === 'ddb-throttle') {
      return {
        icon: AlertTriangle,
        iconBg: 'bg-rose-100 dark:bg-rose-950/60',
        iconColor: 'text-rose-600 dark:text-rose-400',
        borderColor: 'border-rose-300 dark:border-rose-700/80',
        cardBg: 'bg-rose-50/40 dark:bg-rose-950/20',
        badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        badgeText: 'DynamoDB Throttle',
        label: 'Write Rejections',
        text: 'DynamoDB is rejecting writes with ProvisionedThroughputExceededException. Lambda functions are receiving errors when trying to save processed events. SQS will retry these messages automatically thanks to its visibility timeout.',
      };
    }

    // 7. API failure
    if (activeExperiment.failureType === 'api-failure') {
      return {
        icon: AlertTriangle,
        iconBg: 'bg-rose-100 dark:bg-rose-950/60',
        iconColor: 'text-rose-600 dark:text-rose-400',
        borderColor: 'border-rose-300 dark:border-rose-700/80',
        cardBg: 'bg-rose-50/40 dark:bg-rose-950/20',
        badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        badgeText: 'HTTP 500 Outage',
        label: 'Ingress Blocked',
        text: 'API Gateway is returning HTTP 500 errors on all routes. No new events are entering the pipeline. Downstream services (EventBridge, SQS, Lambda) are idle because they have nothing to process.',
      };
    }

    // 8. EventBridge failure
    if (activeExperiment.failureType === 'eventbridge-failure') {
      return {
        icon: AlertTriangle,
        iconBg: 'bg-rose-100 dark:bg-rose-950/60',
        iconColor: 'text-rose-600 dark:text-rose-400',
        borderColor: 'border-rose-300 dark:border-rose-700/80',
        cardBg: 'bg-rose-50/40 dark:bg-rose-950/20',
        badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        badgeText: 'Rule Disabled',
        label: 'Silent Event Drop',
        text: 'The EventBridge routing rule to SQS has been disabled. Events are being accepted by API Gateway and published to EventBridge, but they are not being forwarded to SQS. Events are being dropped silently.',
      };
    }

    // 9. Baseline running (experiment active, no failure injected)
    return {
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-300 dark:border-emerald-700/80',
      cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      badgeText: 'Healthy Baseline',
      label: 'Normal Flow',
      text: 'All services are healthy. The pipeline is processing events across API Gateway \u2192 EventBridge \u2192 SQS \u2192 Lambda \u2192 DynamoDB. This is your normal operating baseline. Inject a failure to see how the system responds.',
    };
  };

  const narrative = getNarrative();
  const IconComponent = narrative.icon;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 ${narrative.borderColor} ${narrative.cardBg} ${className}`}
      aria-label="Live Narrative"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-base select-none" role="img" aria-label="Magnifying glass">
            🔍
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                What's Happening
              </h3>
              <span
                className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${narrative.badgeBg}`}
              >
                {narrative.badgeText}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live system narration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {regionMode === 'multi-region' && activeExperiment && (
            <span className="hidden md:inline-flex text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {failoverActive ? 'Secondary (us-west-2)' : 'Primary (us-east-1)'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/20"
            aria-label={isExpanded ? 'Collapse narration' : 'Expand narration'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Narrative Content */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
          <div
            key={narrative.text}
            className="flex items-start gap-3 animate-fade-in transition-opacity duration-300"
          >
            <div
              className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${narrative.iconBg} ${narrative.iconColor}`}
            >
              <IconComponent size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {narrative.label}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {narrative.text}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveNarrative;
