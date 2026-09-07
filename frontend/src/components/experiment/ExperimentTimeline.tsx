import React from 'react';
import { useExperimentStore } from '../../store/experimentStore';
import { formatTimestamp } from '../../utils/formatters';
import type { TimelineEvent } from '../../types/experiment';
import {
  Play,
  ShieldCheck,
  AlertOctagon,
  Search,
  ArrowRightCircle,
  RotateCcw,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Globe
} from 'lucide-react';

const eventIcons: Record<TimelineEvent['type'], React.ElementType> = {
  start: Play,
  normal: ShieldCheck,
  failure: AlertOctagon,
  detection: Search,
  'healthcheck-failed': AlertTriangle,
  failover: ArrowRightCircle,
  'secondary-active': Globe,
  recovery: RotateCcw,
  failback: ShieldCheck,
  stop: CheckCircle2,
};

const eventColors: Record<TimelineEvent['type'], { dot: string; badge: string; text: string; bg: string }> = {
  start: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
  },
  normal: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
  },
  failure: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
  },
  detection: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
  },
  'healthcheck-failed': {
    dot: 'bg-rose-600',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50/80 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800',
  },
  failover: {
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
    text: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900',
  },
  'secondary-active': {
    dot: 'bg-cyan-500',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
    text: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900',
  },
  recovery: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
  },
  failback: {
    dot: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
  },
  stop: {
    dot: 'bg-slate-600',
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800',
  },
};

/**
 * ExperimentTimeline displays timeline milestones in a clear, spacious chronological card sequence.
 */
export const ExperimentTimeline: React.FC = () => {
  const { activeExperiment } = useExperimentStore();

  if (!activeExperiment || !activeExperiment.timeline || activeExperiment.timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
        <p className="text-slate-400 dark:text-slate-500 text-sm">No timeline events recorded yet.</p>
      </div>
    );
  }

  const { timeline } = activeExperiment;
  const startTime = timeline[0]?.timestamp ? new Date(timeline[0].timestamp).getTime() : Date.now();

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Incident & Recovery Timeline
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chronological audit of failure detection, Route 53 failover, secondary activation, and failback milestones
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
          {timeline.length} {timeline.length === 1 ? 'Milestone' : 'Milestones'}
        </span>
      </div>

      <div className="w-full overflow-x-auto pb-2 pt-1">
        <div className="min-w-max flex items-stretch gap-3">
          {timeline.map((event: TimelineEvent, idx: number) => {
            const Icon = eventIcons[event.type] || Circle;
            const colors = eventColors[event.type] || eventColors.normal;
            const eventTime = new Date(event.timestamp).getTime();
            const elapsedFromStart = Math.max(0, Math.floor((eventTime - startTime) / 1000));

            return (
              <div
                key={`${event.type}-${idx}`}
                className={`
                  relative flex flex-col justify-between w-60 rounded-xl border p-3.5 shadow-sm transition-all
                  ${colors.bg}
                `}
              >
                <div>
                  {/* Top Bar: Icon + Step + Relative Time */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className={colors.text} />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Step {idx + 1}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300">
                      +{elapsedFromStart}s
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white mb-1 leading-snug">
                    {event.label}
                  </h4>

                  {/* Description */}
                  {event.description && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* Footer: Exact Timestamp */}
                <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>{formatTimestamp(event.timestamp)}</span>
                  <span className={`h-2 w-2 rounded-full ${colors.dot}`}></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
