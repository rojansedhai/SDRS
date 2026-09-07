import React from 'react';

export type BadgeStatus = 'healthy' | 'degraded' | 'failed' | 'running' | 'completed' | 'idle' | 'PASS' | 'FAIL';

export interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * StatusBadge component displays a pill badge with a colored dot and status text.
 * @param {StatusBadgeProps} props
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStatusStyles = (s: BadgeStatus) => {
    switch (s) {
      case 'healthy':
      case 'completed':
      case 'PASS':
        return { bg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300', dot: 'bg-emerald-500' };
      case 'degraded':
      case 'running':
        return { bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' };
      case 'failed':
      case 'FAIL':
        return { bg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300', dot: 'bg-rose-500' };
      case 'idle':
      default:
        return { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300', dot: 'bg-slate-500' };
    }
  };

  const getSizeStyles = (s: 'sm' | 'md' | 'lg') => {
    switch (s) {
      case 'sm': return 'px-2 py-0.5 text-xs';
      case 'lg': return 'px-3 py-1.5 text-base';
      case 'md':
      default: return 'px-2.5 py-1 text-sm';
    }
  };

  const styles = getStatusStyles(status);
  const sizeStyles = getSizeStyles(size);

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${styles.bg} ${sizeStyles}`}>
      <span className={`mr-1.5 h-2 w-2 rounded-full ${styles.dot}`} aria-hidden="true"></span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};
