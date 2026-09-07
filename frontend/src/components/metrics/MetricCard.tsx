import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  status?: 'good' | 'warning' | 'critical';
  description?: string;
}

/**
 * MetricCard displays a single metric with icon, value and status.
 * @param {MetricCardProps} props
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon: Icon,
  status = 'good',
  description
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'critical': return 'bg-rose-500';
      case 'warning': return 'bg-amber-500';
      case 'good': default: return 'bg-emerald-500';
    }
  };

  return (
    <div className="group relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} aria-hidden="true"></div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
        {unit && <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
      {description && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
  );
};
