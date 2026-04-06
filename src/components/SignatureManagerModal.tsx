import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SignatureManagerModalProps {
  contractId: string;
  companyId: string;
  onClose: () => void;
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

const ROLE_OPTIONS = ['Locador', 'Locatario', 'Fiador', 'Testemunha', 'Vendedor', 'Comprador'] as const;

const INITIAL_SIGNER: NewSignerState = {
  name: '',
  email: '',
  role: 'Locatario',
};

const formatSignedDate = (value: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR');
};

export default function SignatureManagerModal({
  contractId,
  companyId,
  onClose,
}: SignatureManagerModalProps) {
  const { addToast } = useToast();
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSigner, setNewSigner] = useState<NewSignerState>(INITIAL_SIGNER);

  useEffect(() => {
    const initModal = async () => {
      const { data: contract } = await supabase
        .from('contracts')
        .select('*, lead:leads!contracts_lead_id_fkey(*)')
        .eq('id', contractId)
        .single();

      if (contract?.lead) {
        setNewSigner({
          name: contract.lead.name || '',
          email: contract.lead.email || '',
          role: contract.type === 'sale' ? 'Comprador' : 'Locatario'
        });
      }

      await fetchSignatures();
    };

    void initModal();
  }, [contractId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const fetchSignatures = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('contract_signatures')
        .select('id, token, signer_name, signer_email, signer_role, status, signed_at')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setSignatures((data as SignatureRecord[] | null) ?? []);
    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error);
      addToast('Erro ao carregar assinaturas.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSigner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdding(true);

    try {
      const token = crypto.randomUUID();

      const { error } = await supabase.from('contract_signatures').insert([
        {
          token,
          status: 'pending',
          contract_id: contractId,
          company_id: companyId,
          signer_name: newSigner.name.trim(),
          signer_email: newSigner.email.trim().toLowerCase(),
          signer_role: newSigner.role,
        },
      ]);

      if (error) {
        throw error;
      }

      setNewSigner(INITIAL_SIGNER);
      addToast('Link de assinatura gerado com sucesso!', 'success');
      await fetchSignatures();
    } catch (error) {
      console.error('Erro ao adicionar signatario:', error);
      addToast('Erro ao adicionar signatario.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const copyToClipboard = async (token: string | null) => {
    if (!token) {
      addToast('Este signatario ainda nao possui um link valido.', 'error');
      return;
    }

    try {
      const link = `${window.location.origin}/assinar/${token}`;
      await navigator.clipboard.writeText(link);
      addToast('Link copiado! Cole no WhatsApp do cliente.', 'success');
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      addToast('Nao foi possivel copiar o link.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 font-['DM_Sans'] antialiased">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Gerenciar Assinaturas
            </h2>
            <p className="text-sm text-slate-500">
              Acompanhe ou solicite novas assinaturas digitais.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icons.X size={18} />
          </Button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
              Status das Assinaturas
            </h3>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Icons.Loader2 className="animate-spin text-slate-300" size={24} />
              </div>
            ) : signatures.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                <p className="text-sm text-slate-500">Nenhum signatario adicionado ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {signatures.map((signature) => (
                  <div
                    key={signature.id}
                    className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {signature.signer_name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600"
                        >
                          {signature.signer_role}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{signature.signer_email}</p>
                      {signature.status === 'signed' && signature.signed_at && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Assinado em {formatSignedDate(signature.signed_at)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {signature.status === 'signed' ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-emerald-600">
                          <Icons.CheckCircle2 size={14} />
                          <span className="text-xs font-semibold">Assinado</span>
                        </div>
                      ) : signature.status === 'rejected' ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-red-100 bg-red-50 px-2.5 py-1 text-red-600">
                          <Icons.XCircle size={14} />
                          <span className="text-xs font-semibold">Recusado</span>
                        </div>
                      ) : (
                        <>
                          <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600">
                            Pendente
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                            onClick={() => void copyToClipboard(signature.token)}
                            title="Copiar Link"
                          >
                            <Icons.Link size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="w-full border-t border-slate-100" />

          <form onSubmit={handleAddSigner} className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
              Adicionar Signatario
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <select
                  value={newSigner.role}
                  onChange={(event) =>
                    setNewSigner((current) => ({ ...current, role: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <Input
                  type="text"
                  required
                  placeholder="Nome completo"
                  value={newSigner.name}
                  onChange={(event) =>
                    setNewSigner((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>

              <div className="sm:col-span-3">
                <Input
                  type="email"
                  required
                  placeholder="E-mail"
                  value={newSigner.email}
                  onChange={(event) =>
                    setNewSigner((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isAdding}
              className="h-10 w-full gap-2 bg-slate-900 text-sm font-medium text-white shadow-sm hover:bg-slate-900/90"
            >
              {isAdding ? (
                <>
                  <Icons.Loader2 className="animate-spin" size={16} />
                  Gerando link...
                </>
              ) : (
                <>
                  <Icons.Plus size={16} />
                  Gerar Link de Assinatura
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
