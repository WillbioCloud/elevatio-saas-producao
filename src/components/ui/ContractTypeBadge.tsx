import React from 'react';
import { Building2, FileText, KeyRound } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ContractTypeKey = 'sale' | 'rent' | 'administrative';

const typeConfig: Record<ContractTypeKey, { label: string; icon: React.ReactNode; classes: string }> = {
  sale: {
    label: 'Venda',
    icon: <Building2 size={11} />,
    classes:
      'bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
  },
  rent: {
    label: 'Locação',
    icon: <KeyRound size={11} />,
    classes:
      'bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
  },
  administrative: {
    label: 'Administrativo',
    icon: <FileText size={11} />,
    classes:
      'bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

interface ContractTypeBadgeProps {
  type: ContractTypeKey;
  className?: string;
}

export const ContractTypeBadge: React.FC<ContractTypeBadgeProps> = ({ type, className }) => {
  const config = typeConfig[type] || typeConfig.administrative;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-semibold',
        config.classes,
        className,
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
};