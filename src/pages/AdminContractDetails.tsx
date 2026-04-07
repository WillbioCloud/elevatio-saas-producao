import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { appendSignatureManifest, injectSignatureStamps } from '../utils/contractGenerator';

const AdminContractDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [contract, setContract] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);
  const [generatedInvoices, setGeneratedInvoices] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'finance' | 'vistoria'>('finance');
  const [vistoriaList, setVistoriaList] = useState<any[]>([]);
  const [savingVistoria, setSavingVistoria] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [isInstallmentsExpanded, setIsInstallmentsExpanded] = useState(false);

  const [keysStatus, setKeysStatus] = useState('na_imobiliaria');
  const [keysNotes, setKeysNotes] = useState('');
  const [isUpdatingKeys, setIsUpdatingKeys] = useState(false);

  const handlePayInstallment = async (installmentId: string, dueDate: string) => {
    if (!window.confirm('Confirmar o recebimento desta parcela?')) return;
    try {
      // Atualiza a installment
      const { error } = await supabase.from('installments').update({ status: 'pago' }).eq('id', installmentId);
      if (error) throw error;

      // Atualiza a invoice correspondente no financeiro (se já estiver sincronizada)
      await supabase.from('invoices').update({ status: 'pago' })
        .eq('contract_id', contract?.id)
        .eq('due_date', dueDate);

      alert('Parcela baixada com sucesso no contrato e no financeiro!');
      fetchContractData(); // Recarrega os dados
    } catch (err: any) {
      alert('Erro ao dar baixa: ' + err.message);
    }
  };

  const handleFinalizeContract = async () => {
    if (!window.confirm('Tem certeza que deseja encerrar este contrato? O contrato será arquivado e o imóvel voltará a ficar "Disponível" no sistema.')) return;

    setFinalizing(true);
    try {
      // 1. Arquiva o contrato
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .update({ status: 'archived' })
        .eq('id', id)
        .select();

      if (contractError) throw contractError;
      if (!contractData || contractData.length === 0) throw new Error('Acesso negado: O contrato não pôde ser atualizado. Verifique as permissões (RLS).');

      // 2. Libera o imóvel (Volta para Disponível)
      if (contract.property_id) {
        const { error: propError } = await supabase
          .from('properties')
          .update({ status: 'Disponível' })
          .eq('id', contract.property_id);

        if (propError) throw new Error('Erro ao atualizar o status do imóvel: ' + propError.message);
      }

      // 3. LIMPEZA FINANCEIRA: Remove as parcelas e faturas futuras/pendentes
      await supabase.from('installments').delete().eq('contract_id', id).eq('status', 'pending');
      await supabase.from('invoices').delete().eq('contract_id', id).eq('status', 'pendente');

      alert('Contrato encerrado! O imóvel está disponível e as cobranças futuras foram canceladas.');
      fetchContractData();
      navigate('/admin/contratos?tab=archived');
    } catch (error: any) {
      alert('Erro ao finalizar: ' + error.message);
    } finally {
      setFinalizing(false);
    }
  };

  const fetchContractData = async () => {
    setLoading(true);
    
    let contractQuery = supabase
      .from('contracts')
      .select(`
        *,
        lead:leads!contracts_lead_id_fkey(*),
        property:properties(*),
        broker:profiles!contracts_broker_id_fkey(*)
      `)
      .eq('id', id);
    
    // Multi-Tenant: Filtra por company_id se não for admin
    if (user?.role !== 'admin' && user?.company_id) {
      contractQuery = contractQuery.eq('company_id', user.company_id);
    }
    
    const { data: contractData } = await contractQuery.single();

    if (contractData) {
      setContract(contractData);
      setVistoriaList(contractData.vistoria_items || []);
      setKeysStatus(contractData.keys_status || 'na_imobiliaria');
      setKeysNotes(contractData.keys_notes || '');
    }

    let installmentsQuery = supabase
      .from('installments')
      .select('*')
      .eq('contract_id', id)
      .order('due_date', { ascending: true });
    
    if (user?.role !== 'admin' && user?.company_id) {
      installmentsQuery = installmentsQuery.eq('company_id', user.company_id);
    }

    const { data: installmentsData } = await installmentsQuery;

    if (installmentsData) setInstallments(installmentsData);

    let invoicesQuery = supabase
      .from('invoices')
      .select('id')
      .eq('contract_id', id);
      
    if (user?.role !== 'admin' && user?.company_id) {
      invoicesQuery = invoicesQuery.eq('company_id', user.company_id);
    }

    const { data: invoicesData } = await invoicesQuery;
    if (invoicesData) setGeneratedInvoices(invoicesData);
    setLoading(false);
  };

  const handleViewPdf = async () => {
    if (!contract?.id) return;

    try {
      addToast('Gerando documento...', 'info');

      const { data: fullContract, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contract.id)
        .single();

      if (error) throw error;
      if (!fullContract) throw new Error('Contrato não encontrado.');

      // Busca a imagem estática direto do banco com certeza absoluta
      let adminUrl = '';
      let companyName = '';
      if (user?.company_id) {
        const { data: companyInfo } = await supabase
          .from('companies')
          .select('name, admin_signature_url')
          .eq('id', user.company_id)
          .single();
        if (companyInfo?.admin_signature_url) {
          adminUrl = companyInfo.admin_signature_url;
        }
        if (companyInfo?.name) {
          companyName = companyInfo.name;
        }
      }

      // Busca as assinaturas separadamente
      const { data: signatures } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('contract_id', fullContract.id);

      let finalHtml = fullContract.html_content || fullContract.content || '';
      const safeSignatures = signatures || [];

      // SEMPRE roda o injetor para limpar as tags ou injetar a imagem estática
      finalHtml = await injectSignatureStamps(finalHtml, safeSignatures, adminUrl);

      // O manifesto só roda se houver assinaturas digitais
      if (safeSignatures.length > 0) {
        finalHtml = appendSignatureManifest(
          finalHtml,
          {
            name: companyName || null,
            admin_signature_url: adminUrl || null,
          },
          safeSignatures
        );
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Contrato - ${fullContract.id}</title>
              <style>
                @page { margin: 20mm; }
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f1f5f9; }
                .contract-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .no-print { text-align: center; margin-bottom: 20px; padding: 15px; background: #e2e8f0; border-radius: 8px; }
                .print-btn { background: #0f172a; color: white; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; }
                .print-btn:hover { background: #1e293b; }
                @media print {
                  body { padding: 0; background: white; }
                  .contract-container { box-shadow: none; padding: 0; max-width: 100%; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body>
              <div class="no-print">
                <button class="print-btn" onclick="window.print()">Imprimir / Salvar como PDF</button>
              </div>
              <div class="contract-container">
                ${finalHtml}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      addToast('Erro ao abrir o PDF.', 'error');
    }
  };

  useEffect(() => {
    if (id) fetchContractData();
  }, [id]);

  const updateVistoriaItem = (index: number, field: string, value: any) => {
    const newList = [...vistoriaList];
    newList[index] = { ...newList[index], [field]: value };
    setVistoriaList(newList);
  };

  const handleSaveVistoria = async () => {
    setSavingVistoria(true);
    const { error } = await supabase
      .from('contracts')
      .update({ vistoria_items: vistoriaList })
      .eq('id', id);

    if (error) alert('Erro ao salvar vistoria.');
    else alert('Vistoria salva com sucesso!');
    setSavingVistoria(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Icons.Loader2 className="animate-spin text-brand-500" size={40} /></div>;
  if (!contract) return <div className="p-10 text-center text-slate-500 dark:text-slate-400">Contrato não encontrado.</div>;

  const isRent = contract.type === 'rent';
  const isCash = contract.sale_is_cash;

  const totalRepairCost = vistoriaList.reduce((acc, item) => acc + (Number(item.repair_cost) || 0), 0);
  const pendingInstallments = installments.filter(i => i.status !== 'paid' && i.status !== 'pago');
  const remainingBalance = pendingInstallments.reduce((acc, i) => acc + Number(i.amount), 0);
  const remainingCount = pendingInstallments.length;

  const handleGenerateInvoices = async () => {
    const duration = installments.length;

    if (!contract || contract.type !== 'rent' || duration === 0) {
      alert('Contrato inválido ou sem parcelas geradas para converter em faturas.');
      return;
    }

    if (generatedInvoices.length > 0) {
      alert('Este contrato já possui faturas sincronizadas no financeiro!');
      return;
    }

    setIsGeneratingInvoices(true);
    try {
      const invoicesToInsert = installments.map((inst, index) => {
        return {
          company_id: contract.company_id,
          property_id: contract.property_id,
          contract_id: contract.id,
          client_name: contract.lead?.name || 'Inquilino',
          description: `Aluguel - Parcela ${index + 1}/${duration}`,
          amount: inst.amount,
          due_date: inst.due_date,
          status: inst.status === 'pago' ? 'pago' : 'pendente',
        };
      });

      const { error } = await supabase.from('invoices').insert(invoicesToInsert);
      if (error) {
        console.error("Erro do Supabase:", error);
        throw new Error(error.message);
      }

      alert(`${duration} faturas geradas com sucesso no Financeiro!`);
      fetchContractData();
    } catch (error: any) {
      console.error('Erro ao gerar faturas:', error);
      alert('Erro ao gerar faturas: ' + error.message);
    } finally {
      setIsGeneratingInvoices(false);
    }
  };

  const handleUpdateKeys = async () => {
    setIsUpdatingKeys(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ keys_status: keysStatus, keys_notes: keysNotes })
        .eq('id', contract.id);
      if (error) throw error;
      addToast('Status das chaves atualizado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao atualizar chaves:', error);
      addToast('Erro ao atualizar as chaves.', 'error');
    } finally {
      setIsUpdatingKeys(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-full border border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors shadow-sm" title="Voltar para a tela anterior">
            <Icons.ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-800 dark:text-white">
                Contrato #{contract.id.split('-')[0].toUpperCase()}
              </h1>
              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${isRent ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' : 'bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'}`}>
                {isRent ? 'Locação' : 'Venda'} {isCash && '- À VISTA'}
              </span>
              {contract.status === 'archived' && (
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                  Encerrado
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Imóvel: {contract.property?.title}</p>
          </div>
        </div>
        <button
          onClick={handleViewPdf}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-700 text-white font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
        >
          <Icons.FileText size={18} />
          Ver Documento (PDF)
        </button>

      </div>

      {/* INTEGRAÇÃO FINANCEIRA */}
      {contract.type === 'rent' && (
        <div className={`relative overflow-hidden rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border transition-all duration-500 ${generatedInvoices.length > 0 ? 'bg-white/50 dark:bg-[#0a0f1c]/50 border-slate-200 dark:border-white/5 shadow-sm' : 'bg-gradient-to-br from-indigo-50 to-brand-50 dark:from-indigo-950/20 dark:to-brand-950/20 border-indigo-100 dark:border-indigo-500/20 shadow-[0_8px_30px_rgba(79,70,229,0.06)]'}`}>

          {/* Brilho de Fundo (Apenas quando não sincronizado) */}
          {generatedInvoices.length === 0 && (
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/10 dark:bg-brand-500/20 rounded-full blur-3xl pointer-events-none"></div>
          )}

          <div className="relative z-10">
            <h3 className={`text-xl font-bold flex items-center gap-2 ${generatedInvoices.length > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-indigo-900 dark:text-indigo-300'}`}>
              {generatedInvoices.length > 0 ? <Icons.CheckCircle2 className="text-emerald-500" size={24} /> : <Icons.Network className="text-indigo-600 dark:text-indigo-400" size={24} />}
              {generatedInvoices.length > 0 ? 'Sincronização Ativa' : 'Integração Financeira'}
            </h3>
            <p className={`mt-2 text-sm max-w-md leading-relaxed ${generatedInvoices.length > 0 ? 'text-slate-500' : 'text-indigo-700/80 dark:text-indigo-300/80'}`}>
              {generatedInvoices.length > 0
                ? `Excelente! Este contrato já possui ${generatedInvoices.length} faturas ativas e automatizadas no seu painel financeiro.`
                : 'Automatize suas cobranças. Transforme as parcelas deste contrato em faturas gerenciáveis no painel financeiro da sua imobiliária.'}
            </p>
          </div>

          <div className="relative z-10 w-full md:w-auto shrink-0">
            <button
              onClick={handleGenerateInvoices}
              disabled={isGeneratingInvoices || installments.length === 0 || generatedInvoices.length > 0}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all duration-300 ${
                generatedInvoices.length > 0
                  ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200/50 dark:border-white/5'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_8px_30px_rgba(79,70,229,0.25)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.4)] hover:-translate-y-1'
              }`}
            >
              {isGeneratingInvoices ? (
                <Icons.Loader2 size={20} className="animate-spin" />
              ) : generatedInvoices.length > 0 ? (
                <Icons.Check size={20} />
              ) : (
                <Icons.ArrowRightLeft size={20} />
              )}

              {isGeneratingInvoices
                ? 'Sincronizando...'
                : generatedInvoices.length > 0
                  ? 'Faturas Sincronizadas'
                  : `Sincronizar ${installments.length} Faturas`}
            </button>
          </div>
        </div>
      )}

      {/* CARDS DE RESUMO GERAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Cliente e Prazos */}
        <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-400 dark:text-slate-500">
              <Icons.User size={16} /> <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase">Cliente</h3>
            </div>
            <p className="font-bold font-serif text-lg text-slate-800 dark:text-white">{contract.lead?.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{contract.lead?.phone}</p>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Início</p>
              <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
            </div>
            {contract.end_date && (
              <div className="text-right">
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Vencimento</p>
                <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card Financeiro Principal */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-center gap-2 mb-4 text-slate-400 dark:text-slate-500">
            <Icons.DollarSign size={16} /> <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase">Extrato do Contrato</h3>
          </div>
          
          {isRent ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Aluguel Base</p>
                <p className="font-bold font-serif text-xl text-indigo-600 dark:text-indigo-400">{Number(contract.rent_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Condomínio</p>
                <p className="font-bold font-serif text-lg text-slate-700 dark:text-slate-300">{Number(contract.condo_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">IPTU</p>
                <p className="font-bold font-serif text-lg text-slate-700 dark:text-slate-300">{Number(contract.iptu_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Garantia</p>
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300 mt-1 uppercase">{String(contract.rent_guarantee_type).replace('_', ' ')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-slate-100 dark:border-white/5 pb-4">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Valor Total do Imóvel</p>
                  <p className="font-bold font-serif text-3xl text-emerald-600 dark:text-emerald-400">{Number(contract.sale_total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                {isCash ? (
                  <div className="text-right">
                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-end"><Icons.CheckCircle size={14}/> Pago à vista</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{contract.sale_payment_method}</p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Saldo Devedor (Faltante)</p>
                    <p className="font-bold font-serif text-2xl text-amber-500">{remainingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Faltam {remainingCount} parcela(s)</p>
                  </div>
                )}
              </div>
              
              {!isCash && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 dark:bg-white/[0.02] p-4 rounded-xl">
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Sinal / Entrada</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.sale_down_payment || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Financiamento</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.sale_financing_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Consórcio</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.sale_consortium_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Permuta</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.permutation_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS (RECEBÍVEIS X VISTORIA) */}
      <div className="flex gap-6 border-b border-slate-200/60 dark:border-white/5">
        <button
          onClick={() => setActiveTab('finance')}
          className={`pb-4 px-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'finance' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Icons.List size={18} /> Parcelas e Recebíveis
        </button>
        {isRent && (
          <button
            onClick={() => setActiveTab('vistoria')}
            className={`pb-4 px-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'vistoria' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icons.CheckSquare size={18} /> Vistoria e Avarias
          </button>
        )}
      </div>

      {/* ABA: FINANCEIRO */}
      {activeTab === 'finance' && (
        <>
          {installments.length === 0 ? (
            <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden animate-fade-in">
              <div className="p-10 text-center">
                <Icons.Receipt className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma parcela gerada.</p>
                {isCash && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-bold">A venda foi à vista, não há parcelas futuras.</p>}
              </div>
            </div>
          ) : (
            <>
              {/* CRONOGRAMA DE PARCELAS - CARD EXPANSÍVEL */}
              {installments.length > 0 && (
                <div className="mt-8 bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-dark-border overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-100 dark:border-dark-border flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Icons.Calendar size={20} className="text-brand-500" />
                      Cronograma de Pagamentos
                    </h3>
                    <span className="bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-3 py-1 rounded-full text-xs font-bold">
                      {installments.length} Parcelas
                    </span>
                  </div>

                  <div className="p-6">
                    {/* A PRIMEIRA PARCELA (DESTAQUE) */}
                    <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 dark:from-brand-900/40 dark:to-indigo-900/40 rounded-2xl p-1 shadow-lg mb-4">
                      <div className="absolute -top-3 left-6 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm z-10">
                        Pagamento no Ato (Caução + Aluguel)
                      </div>
                      <div className="bg-white dark:bg-[#0a0f1c] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 relative z-0">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <Icons.DollarSign className="text-emerald-600 dark:text-emerald-400" size={24} />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500 font-medium">1ª Parcela • Vence em {new Date(installments[0].due_date).toLocaleDateString('pt-BR')}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installments[0].amount)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                          {installments[0].status === 'pago' || installments[0].status === 'paid' ? (
                            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-lg font-bold text-sm border border-emerald-200 dark:border-emerald-800">
                              <Icons.CheckCircle2 size={18} /> Parcela Paga
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePayInstallment(installments[0].id, installments[0].due_date)}
                              className="w-full md:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                              <Icons.Check size={18} /> Dar Baixa Agora
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BOTÃO EXPANDIR DEMAIS PARCELAS */}
                    {installments.length > 1 && (
                      <button
                        onClick={() => setIsInstallmentsExpanded(!isInstallmentsExpanded)}
                        className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-600 transition-colors bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl"
                      >
                        {isInstallmentsExpanded ? <Icons.ChevronUp size={18} /> : <Icons.ChevronDown size={18} />}
                        {isInstallmentsExpanded ? 'Ocultar Mensalidades Seguintes' : `Ver as outras ${installments.length - 1} Mensalidades`}
                      </button>
                    )}

                    {/* DEMAIS PARCELAS (ACORDEÃO) */}
                    {isInstallmentsExpanded && installments.length > 1 && (
                      <div className="mt-4 space-y-3 animate-fade-in">
                        {installments.slice(1).map((inst, index) => (
                          <div key={inst.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-dark-border bg-slate-50/50 dark:bg-dark-card hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3 mb-3 sm:mb-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                                {index + 2}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                  Mensalidade Normal
                                </p>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Icons.Calendar size={12} /> Vence em: {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.amount)}
                              </span>
                              {inst.status === 'pago' || inst.status === 'paid' ? (
                                <span className="text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1"><Icons.Check size={12}/> Pago</span>
                              ) : (
                                <span className="text-xs font-bold px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendente</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ABA: VISTORIA (APENAS ALUGUEL) */}
      {activeTab === 'vistoria' && isRent && (
        <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold font-serif text-slate-800 dark:text-white">Checklist de Saída (Vistoria)</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Marque avarias encontradas no final do contrato para deduzir do Caução.</p>
            </div>
            <div className="text-right bg-white dark:bg-[#0a0f1c] p-3 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Total a Deduzir</p>
              <p className="text-xl font-bold font-serif text-red-500">
                {totalRepairCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {vistoriaList.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-slate-50/50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5">
                <div className="md:col-span-5 font-bold font-serif text-slate-700 dark:text-slate-300">{item.item}</div>
                
                <div className="md:col-span-4 flex items-center gap-3">
                  <select 
                    value={item.status} 
                    onChange={(e) => updateVistoriaItem(idx, 'status', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none ${
                      item.status === 'ok' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                    }`}
                  >
                    <option value="ok">✅ Inteiro / Sem Avarias</option>
                    <option value="damaged">❌ Avariado / Sujo</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">R$</span>
                    <input 
                      type="number" 
                      value={item.repair_cost}
                      disabled={item.status === 'ok'}
                      onChange={(e) => updateVistoriaItem(idx, 'repair_cost', Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c] text-slate-800 dark:text-white outline-none focus:border-brand-500 text-sm disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-white/5"
                      placeholder="Custo..."
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-6 mt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
              <button 
                onClick={handleSaveVistoria}
                disabled={savingVistoria}
                className="bg-gradient-to-r from-brand-600 to-sky-500 hover:shadow-lg text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {savingVistoria ? 'Salvando...' : 'Salvar Vistoria'} <Icons.Save size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GESTÃO DE CHAVES */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Icons.Key size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Gestão de Chaves</h2>
            <p className="text-sm text-slate-500">Controlo de entrega/devolução</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Localização Atual</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setKeysStatus('na_imobiliaria')}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${keysStatus === 'na_imobiliaria' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-white/5 dark:text-slate-400'}`}
              >
                <Icons.Building size={16} /> Na Imobiliária (Quadro)
              </button>
              <button
                onClick={() => setKeysStatus('com_inquilino')}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${keysStatus === 'com_inquilino' ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-white/5 dark:text-slate-400'}`}
              >
                <Icons.UserCheck size={16} /> Entregues ao Inquilino
              </button>
              <button
                onClick={() => setKeysStatus('devolvidas')}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${keysStatus === 'devolvidas' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-white/5 dark:text-slate-400'}`}
              >
                <Icons.Archive size={16} /> Devolvidas (Rescisão)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Observações (Cópias, comandos, etc.)</label>
            <textarea
              value={keysNotes}
              onChange={(e) => setKeysNotes(e.target.value)}
              placeholder="Ex: Entregue 2 cópias da porta principal e 1 comando da garagem."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none text-sm min-h-[100px] resize-none"
            />
          </div>
          <button
            onClick={handleUpdateKeys}
            disabled={isUpdatingKeys || (keysStatus === contract.keys_status && keysNotes === (contract.keys_notes || ''))}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdatingKeys ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.Save size={18} />}
            Salvar Registo de Chaves
          </button>
        </div>
      </div>

      {contract.status !== 'archived' && (
        <div className="mt-12 p-6 rounded-3xl border border-red-200/50 dark:border-red-500/10 bg-red-50/50 dark:bg-red-500/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-red-800 dark:text-red-400 font-bold flex items-center gap-2">
                <Icons.AlertTriangle size={18} /> Zona de Perigo: Encerrar Contrato
              </h3>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1 max-w-xl">
                Ao encerrar, este contrato será arquivado e deixará de contar no limite do seu plano. O imóvel associado voltará imediatamente para o status "Disponível".
              </p>
            </div>
            <button
              onClick={handleFinalizeContract}
              disabled={finalizing}
              className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all disabled:opacity-50 shadow-sm shrink-0 whitespace-nowrap flex items-center gap-2"
            >
              {finalizing ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.Archive size={18} />}
              {finalizing ? 'Processando...' : 'Dar Baixa no Contrato'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminContractDetails;
