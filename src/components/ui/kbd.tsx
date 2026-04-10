import * as React from 'react';
import { cn } from '@/lib/utils';

const Kbd = React.forwardRef<HTMLElement, React.ComponentProps<'kbd'>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-semibold text-slate-500 shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Kbd.displayName = 'Kbd';

export { Kbd };
