import React, { useState } from 'react';
import { Shield, Sun, Moon, Activity, Cloud, Key, X, Check } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useExperimentStore } from '../../store/experimentStore';
import { getAuthToken, setAuthToken } from '../../services/api';

/**
 * Top header bar with real-time status telemetry, JWT auth modal, and theme toggle.
 */
export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, activeExperiment } = useExperimentStore();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState(getAuthToken());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const isRunning = activeExperiment?.status === 'running';

  const handleSaveToken = () => {
    setAuthToken(tokenInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsAuthOpen(false);
    }, 800);
  };

  return (
    <>
      <header className="h-16 border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur-md dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-50 transition-colors">
        <div className="flex items-center space-x-3.5">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-2.5 rounded-xl text-white shadow-md shadow-indigo-500/20">
            <Shield size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                SDRS
              </h1>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                v1.1-secure
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block font-medium">
              Serverless Disaster Recovery Simulator
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Active Experiment or Standby Status Badge */}
          {isRunning ? (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 animate-pulse">
              <Activity size={13} className="text-rose-500" />
              <span className="truncate max-w-[200px]">{activeExperiment?.name}</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <Cloud size={13} className="text-slate-400" />
              <span>us-east-1 Standby</span>
            </div>
          )}

          {/* Demo Mode Badge */}
          {isDemoMode ? (
            <span className="px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 rounded-full">
              Demo Mode
            </span>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border transition-all ${
                tokenInput
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse'
              }`}
              title="Configure Cognito JWT Bearer Token"
            >
              <Key size={12} />
              <span>{tokenInput ? 'JWT Active' : 'Auth Required'}</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* JWT Auth Modal */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                <Key className="text-indigo-600" size={18} />
                <span>API Gateway JWT Authentication</span>
              </div>
              <button
                onClick={() => setIsAuthOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When connected to live AWS (<code className="text-indigo-600 dark:text-indigo-400">VITE_DEMO_MODE=false</code>), all mutation and data retrieval endpoints require a valid Cognito JWT Bearer Token (<code className="text-indigo-600 dark:text-indigo-400">Authorization: Bearer &lt;token&gt;</code>).
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cognito ID / Access Token:
              </label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="eyJraWQiOi..."
                rows={4}
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setTokenInput('');
                  setAuthToken('');
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
              >
                Clear Token
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveToken}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/30"
                >
                  {savedSuccess ? <Check size={14} /> : null}
                  <span>{savedSuccess ? 'Saved!' : 'Save Token'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
