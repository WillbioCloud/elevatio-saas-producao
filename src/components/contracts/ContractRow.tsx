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
      className="group cursor-pointer border-b border-slate-100/80 bg-white/30 transition-all duration-200 hover:bg-white/55 dark:border-slate-800/60 dark:bg-slate-900/20 dark:hover:bg-slate-800/60"
    >
      <td className="p-5 align-middle">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <ContractTypeBadge type={typeKey as ContractTypeKey} />
            <StatusPill status={statusType} />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white/70 text-slate-500 dark:border-slate-700/80 dark:bg-slate-800/70 dark:text-slate-400">
              <Icons.FileText size={14} />
            </div>
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{leadName}</p>
          </div>
          <p className="truncate text-xs text-slate-500">{propertyTitle}</p>
        </div>
      </td>
      <td className="hidden p-4 align-middle sm:table-cell" />
      <td className="hidden p-4 align-middle lg:table-cell" />

      {/* Coluna de Assinaturas */}
      <td className="p-5 align-middle hidden lg:table-cell">
        <div className="flex flex-col items-center justify-center">
          {sigsCount > 0 ? (
            <div
              className={cn(
                'inline-flex min-w-[148px] items-center justify-center gap-1.5 rounded-full border px-3 py-[6px] text-[11px] font-medium transition-colors',
                isFullySigned
                  ? 'border-emerald-100 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-amber-100 bg-amber-50/85 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
              )}
            >
              <Icons.FileSignature size={12} className={isFullySigned ? 'text-emerald-500' : 'text-amber-500'} />
              {isFullySigned ? 'Assinado' : 'Aguardando'}
            </div>
          ) : (
            <span className="text-[10px] font-medium italic text-slate-400">Sem assinaturas</span>
          )}
          {sigsCount > 0 && (
            <span className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{signedCount}/{sigsCount}</span>
          )}
        </div>
      </td>

      <td className="hidden p-5 align-middle md:table-cell text-center">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          {contract.type === 'rent' ? 'Vencimento' : 'Criado em'}
        </p>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {contract.created_at ? format(new Date(contract.created_at), 'dd/MM/yyyy') : '-'}
        </p>
      </td>

      <td className="p-5 align-middle text-right">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          {contract.type === 'rent' ? 'Mensal' : 'Valor total'}
        </p>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.contract_value || 0)}
        </span>
      </td>

      {/* Coluna de Ações Rápidas */}
      <td className="p-5 align-middle">
        <div className="flex items-center justify-end gap-1.5">
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
          <Icons.ChevronRight size={15} className="ml-1 text-slate-300 transition-colors group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
        </div>
      </td>
    </tr>
  );
};
