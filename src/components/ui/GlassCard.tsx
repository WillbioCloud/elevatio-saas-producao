import React from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const variants = {
  default:
    'bg-white/52 dark:bg-slate-900/52 border-white/55 dark:border-slate-800/55 shadow-[0_10px_25px_rgba(15,23,42,0.04)]',
  elevated:
    'bg-white/68 dark:bg-slate-900/70 border-white/65 dark:border-slate-700/55 shadow-[0_18px_40px_rgba(15,23,42,0.07)]',
  subtle: 'bg-white/38 dark:bg-slate-900/38 border-white/45 dark:border-slate-800/40',
  accent:
    'bg-gradient-to-br from-brand-500/[0.06] to-violet-500/[0.04] border-brand-200/40 dark:border-brand-500/20',
};

const paddings = {
  none: '',
  sm: 'p-2.5',
  md: 'p-4',
  lg: 'p-5',
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', padding = 'md', hoverable = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border backdrop-blur-2xl transition-all duration-300',
        variants[variant],
        paddings[padding],
        hoverable &&
          'hover:bg-white/70 dark:hover:bg-slate-800/80 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

GlassCard.displayName = 'GlassCard';
