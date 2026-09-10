import React, { useState } from 'react';
import { Shield, Sun, Moon, Activity, Cloud, Key, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useExperimentStore } from '../../store/experimentStore';
import { getAuthToken, setAuthToken, isTokenExpired, getTokenDetails, loginWithCognito } from '../../services/api';

/**
 * Top header bar with real-time status telemetry, JWT auth modal, and theme toggle.
 */
export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, activeExperiment } = useExperimentStore();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState(getAuthToken());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('testuser@sdrs.internal');
  const [passwordInput, setPasswordInput] = useState('');

  const isRunning = activeExperiment?.status === 'running';
  const currentToken = getAuthToken();
  const tokenDetails = getTokenDetails(currentToken);
  const isExpired = isTokenExpired(currentToken);
  const hasToken = !!currentToken && !isExpired;

  const handleSaveToken = () => {
    setAuthToken(tokenInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsAuthOpen(false);
    }, 800);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput) {
      setLoginError('Please enter your Cognito account password.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const newToken = await loginWithCognito(usernameInput.trim(), passwordInput);
      setTokenInput(newToken);
      setPasswordInput('');
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setIsAuthOpen(false);
      }, 1000);
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
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
              onClick={() => {
                setTokenInput(getAuthToken());
                setIsAuthOpen(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border transition-all ${
                hasToken
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : currentToken && isExpired
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse'
              }`}
              title={hasToken ? `JWT Active (Expires in ~${tokenDetails?.exp ? Math.max(0, Math.round((tokenDetails.exp - Date.now() / 1000) / 60)) : 0}m)` : 'Configure Cognito JWT Bearer Token'}
            >
              <Key size={12} />
              <span>{hasToken ? 'JWT Active' : currentToken && isExpired ? 'Token Expired' : 'Auth Required'}</span>
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
                <span>Cognito JWT Authentication</span>
              </div>
              <button
                onClick={() => setIsAuthOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When connected to live AWS (<code className="text-indigo-600 dark:text-indigo-400">VITE_DEMO_MODE=false</code>), API Gateway HTTP routes require an authoritative Cognito Bearer Token.
            </p>

            {/* Cognito Authentication Form */}
            <form onSubmit={handleLogin} className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                Cognito User Authentication
              </span>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Username / Email:
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="testuser@sdrs.internal"
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Password:
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter account password"
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-500/20"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Signing in to Cognito...</span>
                  </>
                ) : (
                  <>
                    <Key size={13} />
                    <span>Sign In to Acquire Token</span>
                  </>
                )}
              </button>
            </form>

            {loginError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Token Status Info */}
            {tokenDetails && (
              <div className={`p-2.5 rounded-lg text-xs border ${
                isExpired
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              }`}>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span>Status: {isExpired ? '⚠️ EXPIRED' : '✅ ACTIVE'}</span>
                  {tokenDetails.exp && (
                    <span>
                      {isExpired
                        ? `Expired at ${new Date(tokenDetails.exp * 1000).toLocaleTimeString()}`
                        : `Expires ~${Math.max(0, Math.round((tokenDetails.exp - Date.now() / 1000) / 60))}m`}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Or Paste Custom ID / Access Token:
              </label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="eyJraWQiOi..."
                rows={3}
                className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
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
                  Close
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
