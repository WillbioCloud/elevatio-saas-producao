import React from 'react';
import { Icons } from '../Icons';
import { StatusPill, StatusType } from '../ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../ui/ContractTypeBadge';
import { format } from 'date-fns';

interface ContractRowProps {
  contract: any;
  onClick: (contract: any) => void;
}

export const ContractRow: React.FC<ContractRowProps> = ({ contract, onClick }) => {
  const propertyTitle = contract.properties?.title || 'Imóvel Removido';
  const leadName = contract.leads?.name || contract.tenant_name || contract.buyer_name || 'N/A';

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
  const typeKey = contract.type === 'sale' || contract.type === 'rent' ? contract.type : 'administrative';

  return (
    <tr
      onClick={() => onClick(contract)}
      className="group cursor-pointer border-b border-slate-100 bg-white/40 transition-all duration-200 hover:bg-white dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:bg-slate-800/80"
    >
      <td className="p-4 align-middle">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-transform group-hover:scale-105 dark:bg-slate-800">
            <Icons.FileText size={18} />
          </div>
          <div className="flex min-w-0 flex-col">
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
      <td className="hidden p-4 align-middle text-sm font-medium text-slate-600 dark:text-slate-400 md:table-cell">
        {contract.created_at ? format(new Date(contract.created_at), 'dd/MM/yyyy') : '-'}
      </td>
      <td className="p-4 align-middle text-right">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.contract_value || 0)}
        </span>
      </td>
      <td className="p-4 align-middle text-right text-slate-400 transition-colors group-hover:text-brand-500">
        <Icons.ChevronRight size={18} className="inline-block" />
      </td>
    </tr>
  );
};
