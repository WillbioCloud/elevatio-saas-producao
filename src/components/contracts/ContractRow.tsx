import React from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../Icons';
import { StatusPill, StatusType } from '../ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../ui/ContractTypeBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

interface ContractRowProps {
  contract: any;
  onClick: (contract: any) => void;
  onOpenSignatures: (contractId: string) => void;
  onManageContract: (contractId: string) => void;
  onDeleteContract: (contract: any) => void;
}

export const ContractRow: React.FC<ContractRowProps> = ({
  contract,
  onClick,
  onOpenSignatures,
  onManageContract,
  onDeleteContract,
}) => {
  const navigate = useNavigate();
  const propertyTitle = contract.properties?.title || contract.property?.title || 'Contrato Administrativo';
  const leadName = contract.leads?.name || contract.lead?.name || contract.tenant_name || contract.buyer_name || 'N/A';

  const statusMap: Record<string, StatusType> = { active: 'active', pending: 'pending', draft: 'draft', archived: 'archived', canceled: 'rejected', ended: 'archived' };
  const statusType = statusMap[contract.status] || 'draft';
  const typeKey = contract.type === 'sale' || contract.type === 'rent' ? contract.type : 'administrative';

  const fallbackSigs = Array.isArray(contract.signatures) ? contract.signatures : [];
  const sigsCount = contract.signatures_count ?? fallbackSigs.length ?? 0;
  const signedCount = contract.signed_signatures_count ?? fallbackSigs.filter((s: any) => s.status === 'signed').length ?? 0;
  const isFullySigned = sigsCount > 0 && signedCount === sigsCount;

  const explicitContractValue = Number(contract.contract_value ?? 0);
  const fallbackPropertyValue =
    contract.type === 'rent'
      ? Number(contract.properties?.rent_value ?? contract.property?.rent_value ?? 0)
      : Number(contract.properties?.price ?? contract.property?.price ?? 0);
  const contractValue = explicitContractValue > 0 ? explicitContractValue : fallbackPropertyValue;
  const handleDelete = (contractId: string) => {
    if (contractId !== contract.id) return;
    onDeleteContract(contract);
  };

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
        <div className="flex items-center justify-center gap-2">
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
            <span className="text-[11px] text-slate-400 font-medium italic">0/0</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSignatures(contract.id);
            }}
            className="p-2 text-slate-400 hover:text-brand-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            title="Gerenciar Assinaturas"
          >
            <Icons.PenTool size={16} />
          </button>
        </div>
      </td>

      <td className="hidden p-4 align-middle text-sm font-medium text-slate-600 dark:text-slate-400 md:table-cell text-center">
        {contract.created_at ? format(new Date(contract.created_at), 'dd/MM/yyyy') : '-'}
      </td>

      <td className="p-4 align-middle text-right">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contractValue)}
        </span>
      </td>

      <td className="p-4 align-middle text-center" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
              <Icons.MoreVertical size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(contract); }} className="cursor-pointer gap-2 py-2.5 text-slate-700 dark:text-slate-300">
              <Icons.Eye size={16} className="text-slate-400" /> Ver Resumo (Sidebar)
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/contratos/${contract.id}`); onManageContract(contract.id); }} className="cursor-pointer gap-2 py-2.5 text-slate-700 dark:text-slate-300">
              <Icons.Settings size={16} className="text-slate-400" /> Gerenciar Completo
            </DropdownMenuItem>

            {contract.status === 'draft' && (
               <DropdownMenuItem onClick={(e) => { 
                 e.stopPropagation(); 
                 alert('Contrato Aprovado! Adicione a função do Supabase aqui.'); 
               }} className="cursor-pointer gap-2 py-2.5 text-emerald-600 focus:text-emerald-700">
                 <Icons.CheckCircle2 size={16} /> Aprovar Contrato
               </DropdownMenuItem>
            )}

            {contract.file_url && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(contract.file_url, '_blank'); }} className="cursor-pointer gap-2 py-2.5 text-brand-600 focus:text-brand-700">
                <Icons.ExternalLink size={16} /> Visualizar PDF Gerado
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
            
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(contract.id); }} className="cursor-pointer gap-2 py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-500/10">
              <Icons.Trash2 size={16} /> Excluir Contrato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};