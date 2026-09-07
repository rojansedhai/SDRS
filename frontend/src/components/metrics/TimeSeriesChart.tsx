import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MetricSnapshot } from '../../types/metrics';
import { useTheme } from '../../hooks/useTheme';

export interface TimeSeriesChartProps {
  data: MetricSnapshot[];
  title: string;
  height?: number;
}

/**
 * TimeSeriesChart displays a timeline area chart of experiment metrics.
 * @param {TimeSeriesChartProps} props
 */
export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ data, title, height = 300 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const formatXAxis = (tickItem: number) => {
    const d = new Date(tickItem);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <h3 className="mb-4 text-lg font-medium text-slate-900 dark:text-white">{title}</h3>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorDuplicate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
            <XAxis dataKey="timestamp" tickFormatter={formatXAxis} stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={12} tickMargin={8} />
            <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={12} tickFormatter={(val) => Math.floor(val).toString()} />
            <Tooltip
              contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#0f172a' }}
              labelFormatter={(label) => formatXAxis(label as number)}
            />
            <Legend />
            <Area type="monotone" dataKey="successCount" name="Successful" stroke="#10b981" fillOpacity={1} fill="url(#colorSuccess)" />
            <Area type="monotone" dataKey="failedCount" name="Failed" stroke="#f43f5e" fillOpacity={1} fill="url(#colorFailed)" />
            <Area type="monotone" dataKey="duplicateCount" name="Duplicate" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDuplicate)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
