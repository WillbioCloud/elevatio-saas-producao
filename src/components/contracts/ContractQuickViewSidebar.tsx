import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Icons } from '../Icons';
import { StatusPill, StatusType } from '../ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../ui/ContractTypeBadge';

interface Props {
  contract: any;
  isOpen: boolean;
  onClose: () => void;
  onOpenSignatures: (contractId: string) => void;
  onRefresh: () => void;
}

export const ContractQuickViewSidebar: React.FC<Props> = ({ contract, isOpen, onClose, onOpenSignatures, onRefresh }) => {
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState(false);

  if (!isOpen || !contract) return null;

  const handleUpdateKeys = async (newStatus: string) => {
    setLoadingAction(true);
    await supabase.from('contracts').update({ keys_status: newStatus }).eq('id', contract.id);
    onRefresh();
    setLoadingAction(false);
  };

  const handleFinalizeContract = async () => {
    if (!window.confirm('Tem certeza que deseja encerrar e arquivar este contrato?')) return;
    setLoadingAction(true);
    await supabase.from('contracts').update({ status: 'archived' }).eq('id', contract.id);
    if (contract.property_id) await supabase.from('properties').update({ status: 'available' }).eq('id', contract.property_id);
    onRefresh();
    onClose();
    setLoadingAction(false);
  };

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
      <div className="animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl duration-300 dark:border-slate-800 dark:bg-slate-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Icons.FileSignature size={20} />
            </div>
            <div>
              <h2 className="leading-tight text-lg font-bold text-slate-800 dark:text-white">Resumo do Contrato</h2>
              <p className="text-xs text-slate-500">ID: {contract.id?.split('-')[0]}</p>
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
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <ContractTypeBadge type={typeKey as ContractTypeKey} />
            <StatusPill status={statusMap[contract.status] || 'draft'} />
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Imóvel</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{contract.property?.title || 'N/A'}</p>
            </div>
            <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente (Lead)</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {contract.lead?.name || contract.tenant_name || contract.buyer_name || 'N/A'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3 dark:border-slate-700">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Data Início</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : '-'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Valor</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.contract_value || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* PAINEL DE CONTROLE RÁPIDO (Trazido dos Detalhes) */}
          <div className="space-y-4">
            {/* 1. Assinaturas */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Assinaturas</p>
                <p className="text-xs text-slate-500">Gerenciar envios</p>
              </div>
              <button onClick={() => onOpenSignatures(contract.id)} className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors">
                <Icons.FileSignature size={18} />
              </button>
            </div>

            {/* 2. Controle de Chaves */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Controle de Chaves</p>
              <select
                value={contract.keys_status || 'na_imobiliaria'}
                onChange={(e) => handleUpdateKeys(e.target.value)}
                disabled={loadingAction}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm"
              >
                <option value="na_imobiliaria">Na Imobiliária</option>
                <option value="com_inquilino">Com Inquilino</option>
                <option value="com_proprietario">Com Proprietário</option>
              </select>
            </div>

            {/* 3. Zona de Perigo */}
            {contract.status !== 'archived' && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl p-4">
                <p className="text-sm font-bold text-red-800 dark:text-red-400 mb-2">Zona de Perigo</p>
                <button
                  onClick={handleFinalizeContract}
                  disabled={loadingAction}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {loadingAction ? 'Processando...' : 'Encerrar Contrato'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer com o "Motor V8" */}
        <div className="border-t border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            onClick={() => {
              onClose();
              navigate(`/admin/contratos/${contract.id}`);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-bold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-700"
          >
            <Icons.Settings size={18} />
            Gerenciar Contrato Completo
          </button>
        </div>
      </div>
    </>
  );
};
