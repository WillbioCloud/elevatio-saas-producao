import React from 'react';
import { format } from 'date-fns';
import { Icons } from '../Icons';
import { StatusPill, StatusType } from '../ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../ui/ContractTypeBadge';
import { cn } from '../../lib/utils';

interface ContractRowProps {
  contract: any;
  onClick: (contract: any) => void;
  onOpenSignatures: (contractId: string) => void;
}

export const ContractRow: React.FC<ContractRowProps> = ({ contract, onClick, onOpenSignatures }) => {
  // Compatível com os dois formatos de relacionamento (original e legado)
  const propertyTitle = contract.properties?.title || contract.property?.title || 'Contrato Administrativo';
  const leadName = contract.leads?.name || contract.lead?.name || contract.tenant_name || contract.buyer_name || 'N/A';

  const statusMap: Record<string, StatusType> = { active: 'active', pending: 'pending', draft: 'draft', archived: 'archived', canceled: 'rejected', ended: 'archived' };
  const statusType = statusMap[contract.status] || 'draft';
  const typeKey = contract.type === 'sale' || contract.type === 'rent' ? contract.type : 'administrative';

  // Usa contagens agregadas da página; fallback em array de assinaturas para retrocompatibilidade
  const fallbackSigs = Array.isArray(contract.signatures) ? contract.signatures : [];
  const sigsCount = contract.signatures_count ?? fallbackSigs.length ?? 0;
  const signedCount = contract.signed_signatures_count ?? fallbackSigs.filter((s: any) => s.status === 'signed').length ?? 0;
  const isFullySigned = sigsCount > 0 && signedCount === sigsCount;

  return (
    <tr
      onClick={() => onClick(contract)}
      className="group cursor-pointer border-b border-slate-100/80 bg-white/50 transition-all duration-200 hover:bg-white hover:shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:bg-slate-800/80"
    >
      <td className="p-4 align-middle">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-transform group-hover:scale-105 dark:bg-slate-800">
            <Icons.FileText size={18} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{propertyTitle}</span>
            <span className="truncate text-xs font-medium text-slate-500">{leadName}</span>
          </div>
        </div>
      </td>

      <td className="hidden p-4 align-middle sm:table-cell">
        <ContractTypeBadge type={typeKey as ContractTypeKey} />
      </td>

      <td className="p-4 align-middle">
        <StatusPill status={statusType} />
      </td>

      <td className="p-4 align-middle hidden lg:table-cell text-center">
        <div className="flex flex-col items-center justify-center">
          {sigsCount > 0 ? (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wide transition-colors',
                isFullySigned
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
              )}
            >
              <Icons.FileSignature size={12} className={isFullySigned ? 'text-emerald-500' : 'text-amber-500'} />
              {signedCount}/{sigsCount}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium italic">Sem assinaturas</span>
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

      <td className="p-4 align-middle text-center">
        <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          {contract.file_url && (
            <button onClick={(e) => { e.stopPropagation(); window.open(contract.file_url, '_blank'); }} className="p-2 text-slate-400 hover:text-brand-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all" title="Ver PDF"><Icons.ExternalLink size={16} /></button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onOpenSignatures(contract.id); }} className="p-2 text-slate-400 hover:text-brand-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all" title="Gerenciar Assinaturas"><Icons.PenTool size={16} /></button>
        </div>
      </td>
    </tr>
  );
};
