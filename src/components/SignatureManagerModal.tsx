import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from './ui/StatusPill';

interface SignatureManagerModalProps {
  contractId: string;
  companyId: string;
  onClose: () => void;
  initialSigner?: { name: string; email: string; role: string };
}

type SignatureStatus = 'pending' | 'signed' | 'rejected';

interface SignatureRecord {
  id: string;
  token: string | null;
  signer_name: string;
  signer_email: string;
  signer_role: string;
  status: SignatureStatus;
  signed_at: string | null;
}

interface NewSignerState {
  name: string;
  email: string;
  role: string;
}

const ROLE_OPTIONS = ['Locador', 'Locatário', 'Fiador', 'Testemunha', 'Vendedor', 'Comprador', 'Proprietário', 'Imobiliária'] as const;

const INITIAL_SIGNER: NewSignerState = {
  name: '',
  email: '',
  role: 'Testemunha',
};

const formatSignedDate = (value: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR');
};

export default function SignatureManagerModal({ contractId, companyId, onClose }: SignatureManagerModalProps) {
  const { addToast } = useToast();
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSigner, setNewSigner] = useState<NewSignerState>(INITIAL_SIGNER);

  const fetchSignatures = async (): Promise<SignatureRecord[]> => {
    try {
      const { data, error } = await supabase
        .from('contract_signatures')
        .select('id, token, signer_name, signer_email, signer_role, status, signed_at')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const nextSignatures = (data as SignatureRecord[] | null) ?? [];
      setSignatures(nextSignatures);
      return nextSignatures;
    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error);
      return [];
    }
  };

  useEffect(() => {
    const initModal = async () => {
      setIsLoading(true);
      await fetchSignatures();
      setIsLoading(false);
    };

    void initModal();
  }, [contractId]);

  const handleAddSigner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdding(true);

    try {
      const { error } = await supabase.from('contract_signatures').insert([
        {
          token: crypto.randomUUID(),
          status: 'pending',
          contract_id: contractId,
          company_id: companyId,
          signer_name: newSigner.name.trim(),
          signer_email: newSigner.email.trim().toLowerCase(),
          signer_role: newSigner.role,
        },
      ]);

      if (error) throw error;

      setNewSigner(INITIAL_SIGNER);
      addToast('Link de assinatura gerado com sucesso!', 'success');
      await fetchSignatures();
    } catch (error) {
      console.error('Erro ao adicionar signatário:', error);
      addToast('Erro ao adicionar signatário.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const copySignatureLink = async (token: string | null) => {
    if (!token) return;
    try {
      const link = `${window.location.origin}/assinar/${token}`;
      await navigator.clipboard.writeText(link);
      addToast('Link copiado! Cole no WhatsApp do cliente.', 'success');
    } catch (error) {
      addToast('Não foi possível copiar o link.', 'error');
    }
  };

  const handleDeleteSignature = async (signatureId: string) => {
    try {
      const { error } = await supabase.from('contract_signatures').delete().eq('id', signatureId);
      if (error) throw error;
      addToast('Assinante removido com sucesso.', 'success');
      await fetchSignatures();
    } catch (error) {
      console.error('Erro ao remover signatário:', error);
      addToast('Erro ao remover signatário.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-white/20 shadow-2xl backdrop-blur-xl animate-in zoom-in-95">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Icons.FileSignature size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Assinaturas Eletrônicas</h2>
              <p className="text-sm text-slate-500">Contrato: {contractId.split('-')[0]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30 dark:bg-slate-950/30 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-brand-500">
              <Icons.Loader2 size={40} className="animate-spin mb-4" />
              <p className="text-sm font-medium">Carregando assinantes...</p>
            </div>
          ) : (
            <>
              {/* LISTA DE ASSINANTES */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Icons.Users size={18} className="text-slate-400" /> Participantes do Contrato
                </h3>

                {signatures.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/50">
                    <p className="text-slate-500">Nenhum assinante cadastrado ainda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {signatures.map((sig) => (
                      <div
                        key={sig.id}
                        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="mb-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{sig.signer_name}</p>
                              <Badge variant="outline" className="mt-1 text-[10px] bg-slate-50">
                                {sig.signer_role}
                              </Badge>
                            </div>
                            <StatusPill status={sig.status} />
                          </div>
                          <p className="mt-3 text-xs text-slate-500 truncate">{sig.signer_email}</p>
                        </div>

                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                          {sig.status === 'pending' ? (
                            <button
                              onClick={() => copySignatureLink(sig.token)}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-50 py-2 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-400"
                            >
                              <Icons.Link size={14} /> Copiar Link
                            </button>
                          ) : (
                            <div className="flex flex-1 items-center justify-center gap-2 py-2 text-xs font-medium text-emerald-600">
                              <Icons.CheckCircle2 size={14} /> {formatSignedDate(sig.signed_at)}
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteSignature(sig.id)}
                            disabled={isAdding || sig.status === 'signed'}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors"
                            title="Remover Assinante"
                          >
                            <Icons.Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ADICIONAR NOVO ASSINANTE */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Icons.UserPlus size={18} className="text-brand-500" /> Novo Assinante
                </h3>
                <form onSubmit={handleAddSigner} className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-bold text-slate-500">Papel</label>
                    <select
                      value={newSigner.role}
                      onChange={(e) => setNewSigner({ ...newSigner, role: e.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-bold text-slate-500">Nome Completo</label>
                    <Input
                      required
                      placeholder="Ex: João da Silva"
                      value={newSigner.name}
                      onChange={(e) => setNewSigner({ ...newSigner, name: e.target.value })}
                      className="h-11 rounded-xl bg-slate-50"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="mb-1 block text-xs font-bold text-slate-500">E-mail</label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        required
                        placeholder="Ex: joao@email.com"
                        value={newSigner.email}
                        onChange={(e) => setNewSigner({ ...newSigner, email: e.target.value })}
                        className="h-11 rounded-xl bg-slate-50"
                      />
                      <Button
                        type="submit"
                        disabled={isAdding}
                        className="h-11 rounded-xl bg-brand-600 px-5 text-white hover:bg-brand-700"
                      >
                        {isAdding ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Plus size={18} />}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
