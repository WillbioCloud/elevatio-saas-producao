import React from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const variants = {
  default:
    'bg-white/60 dark:bg-slate-900/60 border-white/40 dark:border-slate-800/50 shadow-sm shadow-black/[0.02]',
  elevated:
    'bg-white/80 dark:bg-slate-900/80 border-white/50 dark:border-slate-700/50 shadow-lg shadow-black/[0.04]',
  subtle: 'bg-white/30 dark:bg-slate-900/30 border-white/20 dark:border-slate-800/30',
  accent:
    'bg-gradient-to-br from-brand-500/[0.06] to-violet-500/[0.04] border-brand-200/40 dark:border-brand-500/20',
};

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
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
          'hover:bg-white/90 dark:hover:bg-slate-800/90 hover:shadow-xl hover:shadow-black/[0.06] hover:-translate-y-0.5 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

GlassCard.displayName = 'GlassCard';
