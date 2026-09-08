import React, { useState } from 'react';
import { Rocket, BookOpen, X } from 'lucide-react';
import { useExperimentStore } from '../../store/experimentStore';

export const QUICKSTART_STORAGE_KEY = 'sdrs-quickstart-dismissed';

export interface QuickStartBannerProps {
  onRunScenario: () => void;
  onShowWelcome: () => void;
  className?: string;
}

/**
 * Prominent CTA banner displayed on the dashboard when no experiment is active.
 * Guides new users to run an automated scenario or review foundational concepts.
 */
export const QuickStartBanner: React.FC<QuickStartBannerProps> = ({
  onRunScenario,
  onShowWelcome,
  className = '',
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(QUICKSTART_STORAGE_KEY) === 'true';
      }
    } catch {
      // Gracefully handle storage privacy/quota restrictions
    }
    return false;
  });

  const activeExperiment = useExperimentStore((state) => state.activeExperiment);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(QUICKSTART_STORAGE_KEY, 'true');
      }
    } catch {
      // Gracefully handle storage write errors
    }
  };

  // Hide the banner if an experiment is actively running or if dismissed
  if (activeExperiment || isDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Guided scenario quick start"
      className={`relative overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-5 shadow-sm transition-all animate-fade-in ${className}`.trim()}
    >
      {/* Dismiss Button */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss quick start banner"
        title="Dismiss"
        className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pr-8">
        {/* Left Side: Badge & Informational Text */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm">
            <Rocket className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              First time? Try a guided scenario
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              It runs automatically, injects a real failure, and explains each step of the recovery process.
            </p>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Primary Action */}
          <button
            type="button"
            onClick={onRunScenario}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
          >
            <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Run Guided Scenario</span>
          </button>

          {/* Secondary Action */}
          <button
            type="button"
            onClick={onShowWelcome}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Learn the Concepts</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickStartBanner;
