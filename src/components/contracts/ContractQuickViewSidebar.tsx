import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Icons } from '../Icons';
import { StatusPill, StatusType } from '../ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../ui/ContractTypeBadge';
import { cn } from '../../lib/utils';

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
    if (!window.confirm('Tem certeza que deseja encerrar e arquivar este contrato? A ação não pode ser desfeita.')) return;
    setLoadingAction(true);
    await supabase.from('contracts').update({ status: 'archived' }).eq('id', contract.id);
    if (contract.property_id) await supabase.from('properties').update({ status: 'available' }).eq('id', contract.property_id);
    onRefresh();
    onClose();
    setLoadingAction(false);
  };

  const typeKey = contract.type === 'sale' || contract.type === 'rent' ? contract.type : 'administrative';
  const statusMap: Record<string, StatusType> = { active: 'active', pending: 'pending', draft: 'draft', archived: 'archived', canceled: 'rejected' };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:border-slate-800 dark:bg-slate-950">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl dark:bg-brand-500/10 dark:text-brand-400"><Icons.FileSignature size={20} /></div>
            <div>
              <h2 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">Resumo do Contrato</h2>
              <p className="text-xs text-slate-500">ID: {contract.id?.split('-')[0]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><Icons.X size={20} /></button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-3"><ContractTypeBadge type={typeKey as ContractTypeKey} /><StatusPill status={statusMap[contract.status] || 'draft'} /></div>

          {/* DADOS BÁSICOS */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
            <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Imóvel</p><p className="font-medium text-slate-800 dark:text-slate-200">{contract.property?.title || 'Administrativo'}</p></div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cliente (Lead)</p><p className="font-medium text-slate-800 dark:text-slate-200">{contract.lead?.name || contract.tenant_name || 'N/A'}</p></div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
              <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Emissão</p><p className="font-medium text-slate-800 dark:text-slate-200">{contract.created_at ? format(new Date(contract.created_at), 'dd/MM/yyyy') : '-'}</p></div>
              <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Valor</p><p className="font-bold text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.contract_value || 0)}</p></div>
            </div>
          </div>

          {/* MOTOR DE ACÕES (O que faltava na versão da outra IA) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div><p className="text-sm font-bold text-slate-800 dark:text-slate-200">Painel de Assinaturas</p><p className="text-xs text-slate-500">Enviar e gerenciar links</p></div>
              <button onClick={() => onOpenSignatures(contract.id)} className="rounded-lg bg-brand-50 p-2 text-brand-600 hover:bg-brand-100 transition-colors"><Icons.FileSignature size={18} /></button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">Controle de Chaves</p>
              <select value={contract.keys_status || 'na_imobiliaria'} onChange={(e) => handleUpdateKeys(e.target.value)} disabled={loadingAction} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                <option value="na_imobiliaria">Na Imobiliária</option>
                <option value="com_inquilino">Com Inquilino</option>
                <option value="com_proprietario">Com Proprietário</option>
              </select>
            </div>

            {contract.status !== 'archived' && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                <p className="mb-2 text-sm font-bold text-red-800 dark:text-red-400 flex items-center gap-2"><Icons.AlertTriangle size={16}/> Zona de Perigo</p>
                <button onClick={handleFinalizeContract} disabled={loadingAction} className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                  {loadingAction ? 'Processando...' : 'Encerrar Contrato'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
