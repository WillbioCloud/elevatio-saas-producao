import React from 'react';
import { cn } from '../../lib/utils';
import { GlassCard } from './GlassCard';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'default' | 'emerald' | 'blue' | 'amber' | 'red' | 'violet' | 'brand';
  compact?: boolean;
}

const colorMap = {
  default: {
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    value: 'text-slate-800 dark:text-white',
    trend: 'text-slate-500',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-400',
    trend: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    icon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-400',
    trend: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-400',
    trend: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    icon: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    value: 'text-red-700 dark:text-red-400',
    trend: 'text-red-600 dark:text-red-400',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
    value: 'text-violet-700 dark:text-violet-400',
    trend: 'text-violet-600 dark:text-violet-400',
  },
  brand: {
    icon: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
    value: 'text-brand-700 dark:text-brand-400',
    trend: 'text-brand-600 dark:text-brand-400',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  trend,
  color = 'default',
  compact = false,
}) => {
  const colors = colorMap[color];

  return (
    <GlassCard hoverable className="group h-full">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-3 flex items-start justify-between">
          <div className={cn('rounded-xl p-2.5 transition-transform group-hover:scale-110', colors.icon)}>
            {icon}
          </div>
          {trend && (
            <span className={cn('text-[11px] font-semibold tabular-nums', colors.trend)}>
              {trend.value > 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </span>
          )}
        </div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p
          className={cn(
            'font-semibold tabular-nums tracking-tight',
            compact ? 'text-xl' : 'text-2xl',
            colors.value,
          )}
        >
          {value}
        </p>
      </div>
    </GlassCard>
  );
};