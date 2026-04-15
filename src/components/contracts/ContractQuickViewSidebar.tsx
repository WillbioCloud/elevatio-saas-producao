import React, { useMemo, useState } from 'react';
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

  const financialSummary = useMemo(() => {
    if (!contract || !Array.isArray(contract.installments)) return { nextDue: null, totalPaid: 0 };
    const installments = Array.isArray(contract.installments) ? contract.installments : [];
    const nextDue = installments
      .filter((item: any) => item.status === 'pending' && item.due_date)
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

    const totalPaid = installments
      .filter((item: any) => item.status === 'paid')
      .reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0);

    return { nextDue, totalPaid };
  }, [contract]);

  const linkedDocs = useMemo(() => {
    const docs = contract?.contract_data?.linked_documents || contract?.contract_data?.documents || [];
    return Array.isArray(docs) ? docs : [];
  }, [contract]);

  const lastSignatureAt = useMemo(() => {
    const signedDates = (Array.isArray(contract.signatures) ? contract.signatures : [])
      .filter((sig: any) => sig.signed_at)
      .map((sig: any) => new Date(sig.signed_at).getTime())
      .filter((value: number) => Number.isFinite(value));

    if (signedDates.length === 0) return null;
    return new Date(Math.max(...signedDates));
  }, [contract]);

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
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/30 bg-white/80 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-300 dark:border-slate-800/70 dark:bg-slate-950/75">
        <div className="flex items-center justify-between p-6 border-b border-white/30 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50/90 text-brand-600 rounded-xl dark:bg-brand-500/15 dark:text-brand-400"><Icons.FileSignature size={20} /></div>
            <div>
              <h2 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">Resumo do Contrato</h2>
              <p className="text-xs text-slate-500">ID: {contract.id?.split('-')[0]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"><Icons.X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20 dark:bg-slate-950/20">
          <div className="flex items-center gap-3"><ContractTypeBadge type={typeKey as ContractTypeKey} /><StatusPill status={statusMap[contract.status] || 'draft'} /></div>

          <div className="space-y-4 rounded-2xl border border-white/40 bg-white/60 p-5 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Imóvel</p><p className="font-medium text-slate-800 dark:text-slate-200">{contract.property?.title || contract.properties?.title || 'Administrativo'}</p></div>
            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cliente (Lead)</p><p className="font-medium text-slate-800 dark:text-slate-200">{contract.lead?.name || contract.leads?.name || contract.tenant_name || 'N/A'}</p></div>
            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700 grid grid-cols-2 gap-4">
              <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Emissão</p><p className="font-medium text-slate-800 dark:text-slate-200">{contract.created_at ? format(new Date(contract.created_at), 'dd/MM/yyyy') : '-'}</p></div>
              <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Valor</p><p className="font-bold text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.contract_value || 0)}</p></div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/40 bg-white/60 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Resumo Financeiro</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/60 p-3">
                <p className="text-xs text-slate-500">Próximo vencimento</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {financialSummary.nextDue?.due_date ? format(new Date(financialSummary.nextDue.due_date), 'dd/MM/yyyy') : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/60 p-3">
                <p className="text-xs text-slate-500">Total pago</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financialSummary.totalPaid)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/40 bg-white/60 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Documentos Vinculados</h3>
            {linkedDocs.length > 0 ? (
              <div className="space-y-2">
                {linkedDocs.map((doc: any, idx: number) => (
                  <button
                    key={`${doc?.url || idx}`}
                    onClick={() => doc?.url && window.open(doc.url, '_blank')}
                    className="w-full flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-700 px-3 py-2 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-200">{doc?.label || doc?.name || `Documento ${idx + 1}`}</span>
                    <Icons.ExternalLink size={14} className="text-slate-400" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sem documentos vinculados.</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/40 bg-white/60 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Histórico Rápido</h3>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p><strong>Criado em:</strong> {contract.created_at ? format(new Date(contract.created_at), 'dd/MM/yyyy HH:mm') : '—'}</p>
              <p><strong>Última assinatura:</strong> {lastSignatureAt ? format(lastSignatureAt, 'dd/MM/yyyy HH:mm') : '—'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/40 bg-white/60 p-4 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
              <div><p className="text-sm font-bold text-slate-800 dark:text-slate-200">Painel de Assinaturas</p><p className="text-xs text-slate-500">Enviar e gerenciar links</p></div>
              <button onClick={() => onOpenSignatures(contract.id)} className="rounded-lg bg-brand-50 p-2 text-brand-600 hover:bg-brand-100 transition-colors"><Icons.FileSignature size={18} /></button>
            </div>

            <div className="rounded-xl border border-white/40 bg-white/60 p-4 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
              <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">Controle de Chaves</p>
              <select value={contract.keys_status || 'na_imobiliaria'} onChange={(e) => handleUpdateKeys(e.target.value)} disabled={loadingAction} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                <option value="na_imobiliaria">Na Imobiliária</option>
                <option value="com_inquilino">Com Inquilino</option>
                <option value="com_proprietario">Com Proprietário</option>
              </select>
            </div>

            <button
              onClick={() => navigate(`/admin/contratos/${contract.id}`)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Gerenciar Completo
            </button>

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
