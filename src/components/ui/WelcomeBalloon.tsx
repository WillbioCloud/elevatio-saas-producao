import { useEffect, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WelcomeBalloonProps {
  id: string;
  title: string;
  description: string;
  position: string;
}

export function WelcomeBalloon({ id, title, description, position }: WelcomeBalloonProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const storageKey = `seen_balloon_${id}`;

    try {
      if (localStorage.getItem(storageKey)) {
        setIsVisible(false);
        setIsMounted(false);
        return;
      }
    } catch {
      // If storage is blocked, still show the hint for the current session.
    }

    setIsMounted(true);
    const showTimer = window.setTimeout(() => setIsVisible(true), 20);

    return () => {
      window.clearTimeout(showTimer);

      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [id]);

  const handleClose = () => {
    const storageKey = `seen_balloon_${id}`;

    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Storage may be unavailable in restricted browsing modes.
    }

    setIsVisible(false);
    closeTimerRef.current = window.setTimeout(() => setIsMounted(false), 300);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        'fixed z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-amber-200/80 bg-white p-4 text-slate-900 shadow-2xl ring-1 ring-amber-100 transition-opacity duration-300 ease-out',
        'dark:border-amber-400/30 dark:bg-slate-950 dark:text-slate-50 dark:ring-amber-400/20',
        isVisible ? 'opacity-100' : 'opacity-0',
        position
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
            Dica
          </p>
          <h3 className="mt-1 text-base font-semibold leading-tight">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {description}
          </p>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleClose}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              Ok, entendi
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default WelcomeBalloon;
