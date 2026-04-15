import React from 'react';
import { cn } from '../../lib/utils';

export type StatusType = 'active' | 'pending' | 'archived' | 'overdue' | 'signed' | 'rejected' | 'draft';
const statusConfig: Record<StatusType, { label: string; classes: string; dot: string }> = {
  active:   { label: 'Ativo',     classes: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500' },
  pending:  { label: 'Pendente',  classes: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500' },
  archived: { label: 'Arquivado', classes: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
  overdue:  { label: 'Atrasado',  classes: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400', dot: 'bg-red-500' },
  signed:   { label: 'Assinado',  classes: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500' },
  rejected: { label: 'Recusado',  classes: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400', dot: 'bg-red-500' },
  draft:    { label: 'Rascunho',  classes: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
};

export const StatusPill: React.FC<{ status: StatusType; className?: string }> = ({ status, className }) => {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', config.classes, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', config.dot)} />{config.label}
    </span>
  );
};