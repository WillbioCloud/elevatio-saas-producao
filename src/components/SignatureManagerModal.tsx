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
  initialSigner?: { name: string; email: string; role: string };
}

type SignatureStatus = 'pending' | 'signed' | 'rejected';

interface SignatureRecord {
  id: string;
  contract_id?: string;
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

export default function SignatureManagerModal({
  contractId,
  companyId,
  onClose,
}: SignatureManagerModalProps) {
  const { addToast } = useToast();
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [autoSigners, setAutoSigners] = useState<NewSignerState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newSigner, setNewSigner] = useState<NewSignerState>(INITIAL_SIGNER);
  const isGeneratingRef = React.useRef(false);
  const [suggestedSigners, setSuggestedSigners] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const loadSignatures = async (): Promise<SignatureRecord[]> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_signatures')
        .select('id, token, signer_name, signer_email, signer_role, status, signed_at')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });

      if (error) {
        addToast('Erro ao carregar assinaturas', 'error');
        return [];
      }

      const nextSignatures = (data as SignatureRecord[] | null) ?? [];
      setSignatures(nextSignatures);

      // Se não há assinaturas geradas, aciona o Scanner para procurar no texto
      if (!data || data.length === 0) {
        await scanContractForSigners(contractId, companyId);
      }

      return nextSignatures;
    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSignature = async (signatureId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este signatário? O link atual deixará de funcionar.')) return;

    try {
      const { error } = await supabase
        .from('contract_signatures')
        .delete()
        .eq('id', signatureId);

      if (error) throw error;

      addToast('Signatário removido com sucesso.', 'success');
      void loadSignatures();
    } catch (err) {
      console.error('Erro ao deletar assinatura:', err);
      addToast('Erro ao remover signatário.', 'error');
    }
  };

  useEffect(() => {
    if (contractId) {
      void loadSignatures();
    }
  }, [contractId]);

  useEffect(() => {
    if (!contractId) return;

    const channel = supabase
      .channel(`signatures_ui_${contractId}`)
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'contract_signatures',
          filter: `contract_id=eq.${contractId}`
        },
        (payload: any) => {
          // Se o status acabou de mudar para 'signed', dispara a notificação
          if (payload.eventType === 'UPDATE' && payload.new.status === 'signed' && payload.old.status !== 'signed') {
            addToast(`${payload.new.signer_name} assinou o documento!`, 'success');
          }
          
          void loadSignatures();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contractId]);

  const scanContractForSigners = async (contractId: string, companyId: string) => {
    setIsScanning(true);
    try {
      const { data: contractData, error } = await supabase
        .from('contracts')
        .select('html_content, contract_data')
        .eq('id', contractId)
        .single();

      if (error || !contractData?.html_content) {
        console.error('Erro na query do contrato:', error);
        return;
      }

      const html = contractData.html_content.toLowerCase();
      const cData = typeof contractData.contract_data === 'string' 
        ? JSON.parse(contractData.contract_data) 
        : (contractData.contract_data || {});
        
      const docType = cData.document_type || '';
      const isAdminDoc = ['proposal_buy', 'intermed_sale', 'intermediacao', 'intermed_rent', 'visit_control', 'keys_receipt'].includes(docType);

      const suggestions: Omit<SignatureRecord, 'id' | 'token' | 'signed_at'>[] = [];

      // 1. DADOS BASE DOS CLIENTES
      if (cData.owner_name) {
        suggestions.push({ contract_id: contractId, signer_name: cData.owner_name, signer_email: cData.owner_email || '', signer_role: 'Proprietário', status: 'pending' });
      } else if (cData.landlord_name) {
        suggestions.push({ contract_id: contractId, signer_name: cData.landlord_name, signer_email: cData.landlord_email || '', signer_role: 'Locador', status: 'pending' });
      }

      // NUNCA sugere Locatário/Comprador se for contrato administrativo (ex: Captação)
      if (!isAdminDoc) {
        if (cData.tenant_name) {
          suggestions.push({ contract_id: contractId, signer_name: cData.tenant_name, signer_email: cData.tenant_email || '', signer_role: 'Locatário', status: 'pending' });
        }
        if (cData.buyer_name) {
          suggestions.push({ contract_id: contractId, signer_name: cData.buyer_name, signer_email: cData.buyer_email || '', signer_role: 'Comprador', status: 'pending' });
        }
      }

      if (cData.guarantor_name) {
        suggestions.push({ contract_id: contractId, signer_name: cData.guarantor_name, signer_email: cData.guarantor_email || '', signer_role: 'Fiador', status: 'pending' });
      }

      // 2. CORRETOR OU IMOBILIÁRIA (Apenas para Documentos Administrativos)
      if (isAdminDoc) {
        const repType = cData.representation_type || 'corretor';
        const repRole = repType === 'imobiliaria' ? 'Imobiliária' : 'Corretor';
        
        // Em vez de buscar no HTML, se for doc administrativo, já sugere o intermediador
        suggestions.push({
          contract_id: contractId,
          signer_name: cData.broker_name || repRole,
          signer_email: cData.broker_email || '',
          signer_role: repRole,
          status: 'pending'
        });
      }

      // 3. TESTEMUNHAS (Se houver tag no HTML)
      if (html.includes('testemunha 1') || html.includes('{{assinatura_testemunha_1}}')) {
        suggestions.push({ contract_id: contractId, signer_name: 'Testemunha 1', signer_email: '', signer_role: 'Testemunha', status: 'pending' });
      }
      if (html.includes('testemunha 2') || html.includes('{{assinatura_testemunha_2}}')) {
        suggestions.push({ contract_id: contractId, signer_name: 'Testemunha 2', signer_email: '', signer_role: 'Testemunha', status: 'pending' });
      }

      // 4. ATUALIZAR ESTADO (AGUARDAR APROVAÇÃO DO USUÁRIO)
      if (suggestions.length > 0) {
        // Busca as assinaturas que já existem no banco para este contrato
        const { data: existing } = await supabase
          .from('contract_signatures')
          .select('signer_role, signer_name')
          .eq('contract_id', contractId);
        
        // Cria uma chave única combinando Role + Nome para evitar duplicatas de Testemunhas
        const existingKeys = existing?.map(e => `${e.signer_role}:${e.signer_name}`) || [];
        
        const toSuggest = suggestions
          .filter(s => !existingKeys.includes(`${s.signer_role}:${s.signer_name}`));
        
        if (toSuggest.length > 0) {
          setSuggestedSigners(toSuggest);
        }
      }
    } catch (err) {
      console.error('Erro ao ler contrato:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApproveSuggestions = async () => {
    setIsAdding(true);
    const payloads = suggestedSigners.map(s => ({
      ...s,
      token: crypto.randomUUID(),
      company_id: companyId
    }));
    const { data, error } = await supabase.from('contract_signatures').insert(payloads).select();
    if (!error && data) {
      setSignatures(data as SignatureRecord[]);
      setSuggestedSigners([]);
      addToast('Links gerados com sucesso!', 'success');
    }
    setIsAdding(false);
  };

  const handleGenerateBulk = async () => {
    setIsGeneratingBulk(true);
    try {
      const payloads = autoSigners.map(signer => ({
        token: crypto.randomUUID(),
        status: 'pending',
        contract_id: contractId,
        company_id: companyId,
        signer_name: signer.name.trim(),
        signer_email: signer.email.trim().toLowerCase(),
        signer_role: signer.role,
      }));

      const { error } = await supabase.from('contract_signatures').insert(payloads);
      if (error) throw error;

      addToast(`${payloads.length} link(s) gerado(s) com sucesso!`, 'success');
      setAutoSigners([]);
      await loadSignatures();
    } catch (error) {
      console.error('Erro ao gerar links em lote:', error);
      addToast('Erro ao gerar links automáticos.', 'error');
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleAddSigner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdding(true);

    try {
      const { error } = await supabase.from('contract_signatures').insert([{
        token: crypto.randomUUID(),
        status: 'pending',
        contract_id: contractId,
        company_id: companyId,
        signer_name: newSigner.name.trim(),
        signer_email: newSigner.email.trim().toLowerCase(),
        signer_role: newSigner.role,
      }]);

      if (error) throw error;

      setNewSigner(INITIAL_SIGNER);
      setShowManualAdd(false);
      addToast('Link de assinatura gerado com sucesso!', 'success');
      await loadSignatures();
    } catch (error) {
      console.error('Erro ao adicionar signatário:', error);
      addToast('Erro ao adicionar signatário.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const copyToClipboard = async (token: string | null) => {
    if (!token) return;
    try {
      const link = `${window.location.origin}/assinar/${token}`;
      await navigator.clipboard.writeText(link);
      addToast('Link copiado! Cole no WhatsApp do cliente.', 'success');
    } catch (error) {
      addToast('Não foi possível copiar o link.', 'error');
    }
  };

  const renderSignatureCard = (sig: SignatureRecord) => (
    <div key={sig.id} className="group flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors sm:flex-row sm:items-center">
      <div className="flex gap-4 items-center">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${sig.status === 'signed' ? 'bg-emerald-100 text-emerald-600' : sig.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
          {sig.status === 'signed' ? <Icons.Check size={20} /> : sig.status === 'rejected' ? <Icons.X size={20} /> : <Icons.Clock size={20} />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{sig.signer_name}</span>
            <Badge variant="secondary" className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] uppercase font-bold text-slate-600 border border-slate-200">
              {sig.signer_role}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{sig.signer_email}</p>
          {sig.status === 'signed' && sig.signed_at && (
            <p className="mt-1 text-[11px] font-medium text-emerald-600">
              Assinado em {formatSignedDate(sig.signed_at)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge
          variant={sig.status === 'signed' ? 'default' : sig.status === 'rejected' ? 'destructive' : 'secondary'}
          className={
            sig.status === 'signed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none' :
            sig.status === 'rejected' ? 'bg-red-100 text-red-700 hover:bg-red-100 border-none' :
            'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none'
          }
        >
          {sig.status === 'signed' ? 'Assinado' : sig.status === 'rejected' ? 'Recusado' : 'Pendente'}
        </Badge>

        <button
          onClick={() => handleDeleteSignature(sig.id)}
          className="text-slate-400 hover:text-red-500 transition-colors p-1"
          title="Remover Signatário"
        >
          <Icons.Trash size={18} />
        </button>

        {sig.status === 'pending' && (
          <Button variant="outline" size="sm" className="h-8 gap-2 hover:bg-slate-50" onClick={() => void copyToClipboard(sig.token)}>
            <Icons.Copy size={14} /> Copiar Link
          </Button>
        )}
      </div>
    </div>
  );

  const mainSigners = signatures.filter(sig => sig.signer_role?.toLowerCase() !== 'testemunha');
  const witnessSigners = signatures.filter(sig => sig.signer_role?.toLowerCase() === 'testemunha');

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto font-['DM_Sans'] antialiased">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative z-10 flex min-h-full items-start justify-center p-4 pt-16 sm:items-center sm:pt-4">
        <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Icons.PenTool className="text-brand-600" size={20} />
              Gestão de Assinaturas
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Gere e acompanhe os links de assinatura digital deste contrato.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700">
            <Icons.X size={20} />
          </Button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Icons.Loader2 className="animate-spin text-brand-500" size={32} />
            </div>
          ) : (
            <>
              {/* Secção 1: Signatários Detectados Automaticamente */}
              {autoSigners.length > 0 && (
                <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                        <Icons.Sparkles size={16} className="text-blue-600" />
                        Signatários Identificados
                      </h3>
                      <p className="text-xs text-blue-700/80 mt-1">
                        Encontramos {autoSigners.length} pessoa(s) no seu contrato que ainda não possuem link.
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateBulk}
                      disabled={isGeneratingBulk}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
                    >
                      {isGeneratingBulk ? <Icons.Loader2 size={16} className="animate-spin mr-2" /> : <Icons.Link size={16} className="mr-2" />}
                      Gerar {autoSigners.length} Link(s)
                    </Button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {autoSigners.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Icons.User size={14} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                          <p className="text-xs text-slate-500 truncate">{s.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Secção 2: Links Gerados */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-wider text-slate-500">
                    Links Ativos ({signatures.length})
                  </h3>
                  {!showManualAdd && (
                    <Button variant="outline" size="sm" onClick={() => setShowManualAdd(true)} className="text-xs h-8">
                      <Icons.Plus size={14} className="mr-1.5" /> Adicionar Extra
                    </Button>
                  )}
                </div>

                {signatures.length === 0 ? (
                  <div className="text-center py-8">
                    {suggestedSigners.length > 0 ? (
                      <div className="animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                          <Icons.Sparkles size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Signatários Identificados</h3>
                        <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                          O nosso sistema escaneou o contrato e encontrou <b>{suggestedSigners.length}</b> pessoa(s) que precisam assinar. Deseja gerar os links?
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left space-y-2">
                          {suggestedSigners.map((s, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <span className="font-semibold text-slate-700">{s.signer_role}</span>
                              <span className="text-slate-500">{s.signer_name || 'Nome pendente'}</span>
                            </div>
                          ))}
                        </div>
                        <Button 
                          onClick={handleApproveSuggestions} 
                          disabled={isAdding} 
                          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold h-12 text-base shadow-lg shadow-brand-500/20"
                        >
                          {isAdding ? <Icons.Loader2 className="animate-spin mr-2" /> : <Icons.Link className="mr-2" />}
                          Gerar {suggestedSigners.length} Links
                        </Button>
                      </div>
                    ) : (
                      <>
                        {isScanning ? (
                          <div className="flex flex-col items-center text-slate-500">
                            <Icons.Loader2 className="animate-spin mb-2" size={32} />
                            Escaneando documento...
                          </div>
                        ) : (
                          <div className="text-slate-500">
                            <Icons.Users className="mx-auto mb-3 opacity-20" size={48} />
                            Nenhum signatário detetado. Crie manualmente abaixo.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Signatários Principais</h4>
                        <span className="text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 px-2 py-0.5 rounded-full">Obrigatórios para liberação</span>
                      </div>
                      <div className="space-y-3">
                        {mainSigners.length > 0 ? (
                          mainSigners.map((sig) => renderSignatureCard(sig))
                        ) : (
                          <p className="text-sm text-slate-500 italic">Nenhum signatário principal adicionado.</p>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Testemunhas</h4>
                        <span className="text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full">Secundários</span>
                      </div>
                      <div className="space-y-3">
                        {witnessSigners.length > 0 ? (
                          witnessSigners.map((sig) => renderSignatureCard(sig))
                        ) : (
                          <p className="text-sm text-slate-500 italic">Nenhuma testemunha adicionada.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>

              {/* Secção 3: Adição Manual */}
              {showManualAdd && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 mt-6 relative overflow-hidden">
                  <Button variant="ghost" size="icon" onClick={() => setShowManualAdd(false)} className="absolute top-2 right-2 h-6 w-6 rounded-full text-slate-400">
                    <Icons.X size={14} />
                  </Button>
                  <form onSubmit={handleAddSigner} className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Adicionar Signatário Extra</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Papel</label>
                        <select
                          value={newSigner.role}
                          onChange={(e) => setNewSigner({ ...newSigner, role: e.target.value })}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Nome Completo</label>
                        <Input
                          required
                          placeholder="Ex: João da Silva"
                          value={newSigner.name}
                          onChange={(e) => setNewSigner({ ...newSigner, name: e.target.value })}
                          className="h-10 rounded-lg"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">E-mail</label>
                        <Input
                          type="email"
                          required
                          placeholder="Ex: joao@email.com"
                          value={newSigner.email}
                          onChange={(e) => setNewSigner({ ...newSigner, email: e.target.value })}
                          className="h-10 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button type="submit" disabled={isAdding} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white">
                        {isAdding ? <><Icons.Loader2 className="animate-spin mr-2" size={16} /> Gerando...</> : <><Icons.Plus className="mr-2" size={16} /> Gerar Link Extra</>}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
