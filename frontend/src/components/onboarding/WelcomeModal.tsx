import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Rocket, Shield, Zap } from 'lucide-react';

export const ONBOARDED_STORAGE_KEY = 'sdrs-onboarded';

export interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateToExperiments: () => void;
}

/**
 * 3-step onboarding walkthrough modal for first-time SDRS users.
 */
export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  open,
  onClose,
  onNavigateToExperiments,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Reset step whenever modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
    }
  }, [open]);

  const markOnboarded = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
      }
    } catch {
      // Gracefully handle storage quota or privacy restrictions
    }
  }, []);

  const handleClose = useCallback(() => {
    markOnboarded();
    onClose();
  }, [markOnboarded, onClose]);

  const handleRunGuidedScenario = useCallback(() => {
    markOnboarded();
    onNavigateToExperiments();
    onClose();
  }, [markOnboarded, onNavigateToExperiments, onClose]);

  const handleExploreDashboard = useCallback(() => {
    markOnboarded();
    onClose();
  }, [markOnboarded, onClose]);

  // Handle escape key to dismiss
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close welcome modal"
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step 1: Welcome to SDRS */}
        {currentStep === 1 && (
          <div className="flex flex-col items-center text-center animate-fade-in">
            <div className="relative w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
              <Shield className="w-8 h-8" />
              <span
                className="absolute -bottom-1 -right-1 text-xl select-none"
                role="img"
                aria-label="shield"
              >
                🛡️
              </span>
            </div>

            <h2
              id="welcome-modal-title"
              className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight"
            >
              Welcome to SDRS
            </h2>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              The Serverless Disaster Recovery Simulator lets you safely break a serverless AWS
              pipeline — and watch it recover in real time. No real infrastructure damage. No risk.
              Just hands-on chaos engineering.
            </p>

            <div className="mt-5 w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800">
              <p className="text-xs font-mono text-slate-600 dark:text-slate-400 text-center leading-relaxed">
                Built with API Gateway → EventBridge → SQS → Lambda → DynamoDB
              </p>
            </div>

            <div className="w-full flex items-center justify-between mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Skip tour
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: How It Works */}
        {currentStep === 2 && (
          <div className="flex flex-col items-center text-center animate-fade-in">
            <div className="relative w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800/80 flex items-center justify-center text-amber-500 mb-4 shadow-sm">
              <Zap className="w-8 h-8 fill-amber-500/20" />
              <span
                className="absolute -bottom-1 -right-1 text-xl select-none"
                role="img"
                aria-label="lightning"
              >
                ⚡
              </span>
            </div>

            <h2
              id="welcome-modal-title"
              className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight"
            >
              Three Simple Steps
            </h2>

            {/* Three Visual Cards */}
            <div className="w-full space-y-2.5 mt-5 text-left">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3 transition-colors">
                <span className="text-lg flex-shrink-0 leading-none pt-0.5" role="img" aria-label="Start">
                  🟢
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Start an Experiment
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                    Launch baseline traffic to establish healthy metrics
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3 transition-colors">
                <span className="text-lg flex-shrink-0 leading-none pt-0.5" role="img" aria-label="Inject Failure">
                  💥
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Inject a Failure
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                    Break something — throttle Lambda, disable queues, or fail an entire region
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3 transition-colors">
                <span className="text-lg flex-shrink-0 leading-none pt-0.5" role="img" aria-label="Observe Recovery">
                  📊
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Observe Recovery
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                    Watch real-time RTO, RPO, failover detection, and resilience scoring
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Running in Demo Mode? Everything is simulated locally — no AWS account needed.
            </p>

            <div className="w-full flex items-center justify-between mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Get Started */}
        {currentStep === 3 && (
          <div className="flex flex-col items-center text-center animate-fade-in">
            <div className="relative w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
              <Rocket className="w-8 h-8" />
              <span
                className="absolute -bottom-1 -right-1 text-xl select-none"
                role="img"
                aria-label="rocket"
              >
                🚀
              </span>
            </div>

            <h2
              id="welcome-modal-title"
              className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight"
            >
              Ready to Break Things?
            </h2>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Choose your path to begin exploring serverless resilience and disaster recovery.
            </p>

            <div className="w-full space-y-3 mt-6">
              <button
                type="button"
                onClick={handleRunGuidedScenario}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-sm shadow-md hover:shadow-indigo-500/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Run a Guided Scenario →</span>
              </button>

              <button
                type="button"
                onClick={handleExploreDashboard}
                className="w-full py-2.5 px-5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-all active:scale-[0.99] flex items-center justify-center"
              >
                <span>Explore the Dashboard</span>
              </button>
            </div>

            <div className="w-full flex items-center justify-start mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous step</span>
              </button>
            </div>
          </div>
        )}

        {/* Step Indicator Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {[1, 2, 3].map((step) => {
            const isActive = currentStep === step;
            return (
              <button
                key={step}
                type="button"
                onClick={() => setCurrentStep(step)}
                aria-label={`Go to step ${step}`}
                aria-current={isActive ? 'step' : undefined}
                className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900 ${
                  isActive
                    ? 'w-6 bg-indigo-600 dark:bg-indigo-500'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
