import React from 'react';
import { format } from 'date-fns';
import { Icons } from '../Icons';
import { StatusPill, StatusType } from '../ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../ui/ContractTypeBadge';
import { cn } from '../../lib/utils';

interface ContractRowProps {
  contract: any;
  onClick: (contract: any) => void;
}

export const ContractRow: React.FC<ContractRowProps> = ({ contract, onClick }) => {
  const propertyTitle = contract.property?.title || 'Imóvel Removido';
  const leadName = contract.lead?.name || contract.tenant_name || contract.buyer_name || 'N/A';

  // Mapeamento de status do banco para a UI
  const statusMap: Record<string, StatusType> = {
    active: 'active',
    pending: 'pending',
    draft: 'draft',
    archived: 'archived',
    canceled: 'rejected',
    ended: 'archived'
  };

  const statusType = statusMap[contract.status] || 'draft';
  const sigs = contract.signatures || [];
  const sigsCount = sigs.length;
  const signedCount = sigs.filter((s: any) => s.status === 'signed').length;
  const isFullySigned = sigsCount > 0 && signedCount === sigsCount;
  const typeKey = contract.type === 'sale' || contract.type === 'rent' ? contract.type : 'administrative';

  return (
    <tr
      onClick={() => onClick(contract)}
      className="group cursor-pointer border-b border-slate-100 bg-white/40 transition-all duration-300 hover:bg-white dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:bg-slate-800/80"
    >
      <td className="p-4 align-middle">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-white/70 text-slate-500 transition-all duration-300 group-hover:scale-[1.03] group-hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-400">
            <Icons.FileText size={18} />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{propertyTitle}</span>
            <span className="truncate text-xs text-slate-500">{leadName}</span>
          </div>
        </div>
      </td>
      <td className="hidden p-4 align-middle sm:table-cell">
        <ContractTypeBadge type={typeKey as ContractTypeKey} />
      </td>
      <td className="p-4 align-middle">
        <StatusPill status={statusType} />
      </td>

      {/* Coluna de Assinaturas */}
      <td className="p-4 align-middle hidden lg:table-cell">
        <div className="flex flex-col items-center justify-center">
          {sigsCount > 0 ? (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                isFullySigned
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                  : 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              )}
            >
              <Icons.FileSignature size={12} className={isFullySigned ? 'text-emerald-500' : 'text-slate-400'} />
              {signedCount}/{sigsCount}
            </div>
          ) : (
            <span className="text-[10px] font-medium italic text-slate-400">Sem assinaturas</span>
          )}
        </div>
      </td>

      <td className="hidden p-4 align-middle text-sm font-medium text-slate-600 dark:text-slate-400 md:table-cell text-center">
        {contract.created_at ? format(new Date(contract.created_at), 'dd/MM/yyyy') : '-'}
      </td>

      <td className="p-4 align-middle text-right">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.contract_value || 0)}
        </span>
      </td>

      {/* Coluna de Ações Rápidas */}
      <td className="p-4 align-middle">
        <div className="flex items-center justify-center gap-1.5">
          {contract.file_url && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(contract.file_url, '_blank');
              }}
              className="rounded-md border border-transparent p-2 text-slate-400 transition-all duration-200 hover:border-slate-200 hover:bg-slate-100 hover:text-brand-500 dark:hover:border-slate-700 dark:hover:bg-slate-800"
              title="Visualizar PDF"
            >
              <Icons.ExternalLink size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(contract);
            }}
            className="rounded-md border border-transparent p-2 text-slate-400 transition-all duration-200 hover:border-slate-200 hover:bg-slate-100 hover:text-brand-500 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            title="Ver Detalhes"
          >
            <Icons.Eye size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};