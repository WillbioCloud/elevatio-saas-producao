import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../Icons';
import { StatusPill, StatusType } from '../ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../ui/ContractTypeBadge';
import { format } from 'date-fns';

interface Props {
  contract: any;
  isOpen: boolean;
  onClose: () => void;
}

export const ContractQuickViewSidebar: React.FC<Props> = ({ contract, isOpen, onClose }) => {
  const navigate = useNavigate();
  if (!isOpen || !contract) return null;

  const typeKey = contract.type === 'sale' || contract.type === 'rent' ? contract.type : 'administrative';
  const statusMap: Record<string, StatusType> = {
    active: 'active',
    pending: 'pending',
    draft: 'draft',
    archived: 'archived',
    canceled: 'rejected'
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.3)] duration-300 dark:border-slate-800/85 dark:bg-slate-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100/80 p-6 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Icons.FileSignature size={20} />
            </div>
            <div>
              <h2 className="leading-tight text-lg font-semibold text-slate-800 dark:text-white">Resumo do Contrato</h2>
              <p className="text-[11px] text-slate-500">ID: {contract.id?.split('-')[0]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-900/80">
            <ContractTypeBadge type={typeKey as ContractTypeKey} />
            <StatusPill status={statusMap[contract.status] || 'draft'} />
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-100/80 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/80">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Imóvel</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{contract.property?.title || 'Não informado'}</p>
            </div>
            <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Cliente (Lead)</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {contract.lead?.name || contract.tenant_name || contract.buyer_name || 'Não informado'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3 dark:border-slate-700">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Data Início</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : '-'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Valor</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.contract_value || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-100/80 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Ações</p>
            <button
              onClick={() => {
                onClose();
                navigate(`/admin/contratos/${contract.id}`);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-700"
            >
              <Icons.Settings size={18} />
              Ver detalhes completos
            </button>

            {contract.file_url && (
              <button
                onClick={() => window.open(contract.file_url, '_blank')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Icons.ExternalLink size={16} />
                Abrir arquivo do contrato
              </button>
            )}
          </div>
        </div>

        {/* Footer com o "Motor V8" */}
        <div className="border-t border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Use a visão completa para editar cláusulas, assinaturas e histórico financeiro.
          </p>
        </div>
      </div>
    </>
  );
};
