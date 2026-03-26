import React, { useState, useMemo } from 'react';
import { Icons } from '../components/Icons';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { useInvoices } from '../hooks/useInvoices';
import { supabase } from '../lib/supabase';
import InvoiceModal from '../components/InvoiceModal';
import { useToast } from '../contexts/ToastContext';

export default function AdminFinance() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [maxContracts, setMaxContracts] = useState<number | null>(null);
  const [activeRentCount, setActiveRentCount] = useState(0);
  const [loadingPlanLimit, setLoadingPlanLimit] = useState(true);
  const isSuperAdmin = user?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState<'recebimentos' | 'repasses'>('recebimentos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedTenantGroup, setSelectedTenantGroup] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const toggleInvoiceSelection = (invoice: any) => {
    setSelectedInvoices(prev => 
      prev.some(item => item.id === invoice.id) 
        ? prev.filter(item => item.id !== invoice.id) 
        : [...prev, invoice]
    );
  };

  const handleBulkAdvance = async () => {
    if (selectedInvoices.length === 0) return;
    if (!window.confirm(`Deseja dar baixa em ${selectedInvoices.length} fatura(s) selecionada(s)?`)) return;

    setIsProcessingBulk(true);
    try {
      // 1. Atualiza as Invoices para 'paga'
      const invoiceIds = selectedInvoices.map(inv => inv.id);
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'pago' })
        .in('id', invoiceIds);
      
      if (invoiceError) throw invoiceError;

      // 2. Sincroniza as Installments correspondentes
      for (const inv of selectedInvoices) {
        if (inv.contract_id && inv.due_date) {
          await supabase.from('installments')
            .update({ status: 'pago' })
            .eq('contract_id', inv.contract_id)
            .eq('due_date', inv.due_date);
        }
      }

      addToast(`${selectedInvoices.length} fatura(s) adiantada(s)/baixada(s) com sucesso!`, 'success');
      setSelectedInvoices([]);
      // Dispara um evento para o hook useInvoices recarregar os dados (se aplicável) ou força o reload
      window.location.reload(); 
    } catch (error: any) {
      addToast('Erro ao processar baixa em massa: ' + error.message, 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const [isGeneratingBulkLink, setIsGeneratingBulkLink] = useState(false);
  const [bulkPaymentLink, setBulkPaymentLink] = useState<string | null>(null);

  const handleGenerateBulkLink = async () => {
    if (selectedInvoices.length === 0) return;
    setIsGeneratingBulkLink(true);
    
    try {
      const totalAmount = selectedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const leadName = selectedInvoices[0]?.client_name || 'Cliente';
      const contractId = selectedInvoices[0]?.contract_id;

      if (!contractId) throw new Error("Não foi possível identificar o contrato associado a estas faturas.");

      // 1. Busca o asaas_customer_id do cliente associado ao contrato
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select('leads(asaas_customer_id)')
        .eq('id', contractId)
        .single();

      if (contractError) throw new Error("Erro ao buscar dados do cliente: " + contractError.message);
      
      const asaasCustomerId = contractData?.leads?.asaas_customer_id;
      
      if (!asaasCustomerId) {
        throw new Error("Este cliente ainda não possui cadastro no Asaas (asaas_customer_id ausente).");
      }

      // 2. Chama a Edge Function enviando o ID do cliente real
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-asaas-charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          customer: asaasCustomerId,
          customer_id: asaasCustomerId,
          value: totalAmount,
          dueDate: new Date().toISOString().split('T')[0],
          description: `Cobrança Agrupada - ${selectedInvoices.length} parcelas (${leadName})`,
          billingType: 'UNDEFINED'
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erro na Edge Function do Asaas");
      
      // O Asaas costuma retornar a URL do boleto em invoiceUrl, url ou paymentLink
      const finalUrl = data?.invoiceUrl || data?.url || data?.paymentLink;
      
      if (finalUrl) {
        setBulkPaymentLink(finalUrl);
        addToast('Fatura agrupada gerada com sucesso no Asaas!', 'success');
      } else {
        console.error("Resposta do Asaas:", data);
        throw new Error("O Asaas não retornou a URL de pagamento. Verifique os logs.");
      }
    } catch (err: any) {
      console.error('Erro ao gerar cobrança Asaas:', err);
      setBulkPaymentLink(null); // Garante que nenhum link falso seja exibido
      addToast(err.message || 'Erro ao comunicar com o Asaas.', 'error');
    } finally {
      setIsGeneratingBulkLink(false);
    }
  };

  const handleSendBulkWhatsApp = () => {
    if (!bulkPaymentLink) return;
    const totalAmount = selectedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);
    
    const text = encodeURIComponent(`Olá! Segue o link para pagamento do seu acordo de ${selectedInvoices.length} parcela(s) no valor total de ${formattedTotal}:\n\n${bulkPaymentLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    
    setSelectedInvoices([]);
    setBulkPaymentLink(null);
  };

  // Usamos user?.company_id pois é 100% garantido no painel admin
  const { invoices, loading } = useInvoices(user?.company_id);

  React.useEffect(() => {
    let isMounted = true;

    const fetchLimitAndCount = async () => {
      if (!user) return;

      if (isSuperAdmin) {
        if (isMounted) {
          setMaxContracts(null);
          setLoadingPlanLimit(false);
        }
        return;
      }

      if (!user.company_id) {
        if (isMounted) {
          setMaxContracts(0);
          setLoadingPlanLimit(false);
        }
        return;
      }

      setLoadingPlanLimit(true);

      try {
        const { count } = await supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', user.company_id)
          .eq('type', 'rent')
          .eq('status', 'active');

        if (isMounted) setActiveRentCount(count || 0);

        const { data: currentSaasContract } = await supabase
          .from('saas_contracts')
          .select('plan_id, plan_name, companies(plan)')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const planCandidates = [
          currentSaasContract?.plan_id,
          currentSaasContract?.plan_name,
          currentSaasContract?.companies?.plan,
          user.company?.plan
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase());

        const { data: plansData } = await supabase
          .from('saas_plans')
          .select('id, name, max_contracts');

        const matchedPlan = (plansData || []).find((plan) => {
          const planId = String(plan.id || '').toLowerCase();
          const planName = String(plan.name || '').toLowerCase();
          return planCandidates.some((candidate) => candidate === planId || candidate === planName);
        });

        if (isMounted) setMaxContracts(Number(matchedPlan?.max_contracts ?? 0));
      } catch (error) {
        console.error('Erro ao buscar limites no financeiro:', error);
      } finally {
        if (isMounted) setLoadingPlanLimit(false);
      }
    };

    fetchLimitAndCount();

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, user]);

  const contractsUsageLabel = isSuperAdmin
    ? 'Sem limite'
    : loadingPlanLimit
      ? '...'
      : maxContracts === 0
        ? 'Bloqueado'
        : String(maxContracts ?? '--');

  const totalRecebido = invoices.filter(i => i.status === 'pago').reduce((acc, curr) => acc + curr.amount, 0);
  const totalAReceber = invoices.filter(i => i.status === 'pendente').reduce((acc, curr) => acc + curr.amount, 0);
  const totalAtrasado = invoices.filter(i => i.status === 'atrasado').reduce((acc, curr) => acc + curr.amount, 0);

  // Filtro e Ordenação: Pagos vão para o fim, Atrasados/Pendentes ficam no topo, ordenados por data
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.description && invoice.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'todos' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (a.status === 'pago' && b.status !== 'pago') return 1;
    if (a.status !== 'pago' && b.status === 'pago') return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Agrupa as faturas filtradas por Inquilino
  const groupedInvoices = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredInvoices.forEach(inv => {
      const key = inv.client_name;
      if (!groups[key]) {
        groups[key] = {
          client_name: inv.client_name,
          property_title: inv.property?.title || inv.description || 'Cobranças Avulsas',
          invoices: [],
          total_aberto: 0,
          total_pago: 0,
          parcelas_pagas: 0,
        };
      }
      groups[key].invoices.push(inv);
      if (inv.status === 'pago') {
        groups[key].total_pago += inv.amount;
        groups[key].parcelas_pagas += 1;
      } else {
        groups[key].total_aberto += inv.amount;
      }
    });
    return Object.values(groups);
  }, [filteredInvoices]);

  // Faturas do inquilino selecionado
  const selectedTenantInvoices = selectedTenantGroup
    ? filteredInvoices.filter(i => i.client_name === selectedTenantGroup)
    : [];

  const fmt = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleGenerateAsaasLink = async (invoiceId: string) => {
      setGeneratingLinkFor(invoiceId);
      try {
        // 1. Busca a sessão atual para autenticação
        const { data: { session } } = await supabase.auth.getSession();

        // 2. Fetch direto com todos os headers de segurança (apikey evita o 401)
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-asaas-charge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ invoiceId })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na requisição ao Asaas');

        addToast('Boleto gerado com sucesso!', 'success');

        if (data.payment_url) {
          window.open(data.payment_url, '_blank');
        }
      } catch (error: any) {
        console.error('Erro Asaas:', error);
        addToast(error.message || 'Erro ao conectar com o banco Asaas.', 'error');
      } finally {
        setGeneratingLinkFor(null);
      }
    };

  const handleWhatsAppCharge = (invoice: any) => {
    if (!invoice.payment_url) {
      addToast('Gere o link de pagamento primeiro antes de cobrar pelo WhatsApp!', 'error');
      return;
    }
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const dueDate = new Date(invoice.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    const message = `Olá, *${invoice.client_name}*!\n\nA sua cobrança referente a *${invoice.description || 'Aluguel/Taxas'}* no valor de *${formatCurrency(invoice.amount)}* já está disponível.\n\n📅 *Vencimento:* ${dueDate}\n🔗 *Link para pagamento:* ${invoice.payment_url}\n\nQualquer dúvida, estamos à disposição!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm('Tem a certeza que deseja excluir esta cobrança? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      addToast('Cobrança excluída com sucesso!', 'success');
      // O hook useInvoices vai atualizar a lista automaticamente via Realtime
    } catch (error) {
      console.error('Erro ao excluir cobrança:', error);
      addToast('Erro ao excluir a cobrança. Tente novamente.', 'error');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <Icons.Wallet className="text-brand-500" /> Gestão Financeira
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Acompanhe recebimentos de aluguéis e repasses.</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-[#0a0f1c]/80 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
            <Icons.KeyRound size={14} className="text-indigo-500" />
            <span>Locações Ativas: {activeRentCount} / {contractsUsageLabel}</span>
          </div>
        </div>
        {tenant && !tenant.payment_api_key && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm">
            <Icons.AlertTriangle size={18} />
            <span>Configure a chave do Asaas nas <b>Configurações</b> para gerar boletos.</span>
          </div>
        )}
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 bg-emerald-50 dark:bg-emerald-500/10 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 dark:text-slate-400 font-medium">Recebido (Mês)</h3>
              <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Icons.TrendingUp size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{fmt(totalRecebido)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 bg-brand-50 dark:bg-brand-500/10 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 dark:text-slate-400 font-medium">A Receber</h3>
              <div className="bg-brand-100 dark:bg-brand-500/20 p-2 rounded-lg text-brand-600 dark:text-brand-400">
                <Icons.Clock size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{fmt(totalAReceber)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 bg-rose-50 dark:bg-rose-500/10 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 dark:text-slate-400 font-medium">Em Atraso</h3>
              <div className="bg-rose-100 dark:bg-rose-500/20 p-2 rounded-lg text-rose-600 dark:text-rose-400">
                <Icons.AlertCircle size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{fmt(totalAtrasado)}</p>
          </div>
        </div>
      </div>

      {/* TABELA DE COBRANÇAS */}
      <div className="bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-dark-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex bg-slate-100 dark:bg-dark-bg p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('recebimentos')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'recebimentos'
                  ? 'bg-white dark:bg-dark-card text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Recebimentos (Inquilinos)
            </button>
            <button
              onClick={() => setActiveTab('repasses')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'repasses'
                  ? 'bg-white dark:bg-dark-card text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Repasses (Proprietários)
            </button>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-brand-700 transition-colors flex items-center gap-2">
            <Icons.Plus size={16} /> Nova Cobrança
          </button>
        </div>

        {/* BARRA DE PESQUISA E FILTROS */}
        {activeTab === 'recebimentos' && (
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm">
            <div className="relative flex-1 w-full">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por inquilino ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm font-medium text-slate-500 hidden md:block">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendentes</option>
                <option value="pago">Pagos</option>
                <option value="atrasado">Atrasados</option>
              </select>
            </div>
          </div>
        )}

        {/* ÁREA PRINCIPAL: CARDS OU DETALHES */}
        {selectedTenantGroup ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm">
              <div>
                <button onClick={() => setSelectedTenantGroup(null)} className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-bold mb-1 text-sm transition-colors">
                  <Icons.ArrowLeft size={16} /> Voltar para visão geral
                </button>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{selectedTenantGroup}</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Parcelas</p>
                <p className="font-bold text-slate-800 dark:text-white">{selectedTenantInvoices.length}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-dark-border">
                    <tr>
                      <th className="p-4">Descrição</th>
                      <th className="p-4">Valor</th>
                      <th className="p-4">Vencimento</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                    {selectedTenantInvoices.map((invoice) => (
                      <tr key={invoice.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center">
                            {/* Checkbox de Seleção Multipla (Apenas para Pendentes) */}
                            {invoice.status === 'pendente' && (
                              <input 
                                type="checkbox" 
                                checked={selectedInvoices.some(item => item.id === invoice.id)}
                                onChange={() => toggleInvoiceSelection(invoice)}
                                className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer mr-3"
                                title="Selecionar para dar baixa"
                              />
                            )}
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">{invoice.description || 'Cobrança'}</p>
                              <p className="text-xs text-slate-500">{invoice.property?.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-slate-800 dark:text-white">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-400">
                          {new Date(invoice.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                            invoice.status === 'pago' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                            : invoice.status === 'atrasado' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          }`}>
                            {invoice.status === 'pago' ? <Icons.CheckCircle2 size={12} /> : invoice.status === 'atrasado' ? <Icons.AlertCircle size={12} /> : <Icons.Clock size={12} />}
                            {invoice.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {invoice.status === 'pago' && invoice.payment_url ? (
                              <button title="Ver Recibo (Asaas)" onClick={() => window.open(invoice.payment_url, '_blank')} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors bg-brand-50/50 flex items-center gap-1 text-xs font-bold">
                                <Icons.FileText size={16} /> Recibo
                              </button>
                            ) : invoice.status !== 'pago' && (
                              <>
                                {invoice.payment_url ? (
                                  <button title="Abrir Link de Pagamento" onClick={() => window.open(invoice.payment_url, '_blank')} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors bg-brand-50/50">
                                    <Icons.ExternalLink size={16} />
                                  </button>
                                ) : (
                                  <button title="Gerar Boleto/Pix (Asaas)" onClick={() => handleGenerateAsaasLink(invoice.id)} disabled={generatingLinkFor === invoice.id} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50">
                                    {generatingLinkFor === invoice.id ? <Icons.Loader2 size={16} className="animate-spin text-brand-500" /> : <Icons.Link size={16} />}
                                  </button>
                                )}
                                <button title="Cobrar no WhatsApp" onClick={() => handleWhatsAppCharge(invoice)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                  <Icons.MessageCircle size={16} />
                                </button>
                              </>
                            )}
                            <button title="Excluir Cobrança" onClick={() => handleDeleteInvoice(invoice.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                              <Icons.Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {loading ? (
              <div className="col-span-full p-12 text-center text-slate-400">
                <Icons.Loader2 size={32} className="animate-spin mx-auto mb-3" />
                Carregando faturas...
              </div>
            ) : groupedInvoices.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-500 bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-dark-border">
                <Icons.FileText size={48} className="mx-auto mb-4 opacity-20" />
                Nenhuma cobrança encontrada.
              </div>
            ) : groupedInvoices.map((group: any) => (
              <div key={group.client_name} onClick={() => setSelectedTenantGroup(group.client_name)} className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-500/30 transition-all cursor-pointer group flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
                      <Icons.User size={24} />
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Icons.List size={14} /> {group.invoices.length} Parcelas
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1" title={group.client_name}>{group.client_name}</h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Icons.Home size={14} /> {group.property_title}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-dark-border">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Total em aberto</p>
                      <p className="font-bold text-brand-600 dark:text-brand-400 text-lg">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(group.total_aberto)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Status</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{group.parcelas_pagas}/{group.invoices.length} Pagas</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra Flutuante de Ação em Massa */}
      {selectedInvoices.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in border border-slate-700 dark:border-slate-200">
          
          {/* Info Section */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-brand-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 shadow-lg">
              {selectedInvoices.length}
            </div>
            <div>
              <p className="font-bold text-sm md:text-base">Faturas Selecionadas</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 font-medium">
                Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0))}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 w-full md:w-auto justify-end">
            
            {/* Botão de WhatsApp (Só aparece se o link já foi gerado) */}
            {bulkPaymentLink ? (
              <button 
                onClick={handleSendBulkWhatsApp}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-md text-xs md:text-sm grow md:grow-0"
              >
                <Icons.MessageCircle size={16} /> Enviar WhatsApp
              </button>
            ) : (
              /* Botão de Gerar Link Asaas */
              <button 
                onClick={handleGenerateBulkLink}
                disabled={isGeneratingBulkLink || isProcessingBulk}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md text-xs md:text-sm grow md:grow-0 disabled:opacity-50"
              >
                {isGeneratingBulkLink ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Link size={16} />}
                {isGeneratingBulkLink ? 'Gerando...' : 'Gerar Fatura Única'}
              </button>
            )}

            {/* Botão de Baixa Manual (Opcional: Diminuir ênfase visual) */}
            <button 
              onClick={handleBulkAdvance}
              disabled={isProcessingBulk || isGeneratingBulkLink}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-800 border border-slate-600 dark:border-slate-300 rounded-xl font-bold transition-all text-xs md:text-sm shrink-0 disabled:opacity-50"
              title="Apenas marcar como pago no sistema"
            >
              {isProcessingBulk ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.CheckCircle2 size={16} />}
              <span className="hidden sm:inline">Baixa Manual</span>
              <span className="sm:hidden">Baixa</span>
            </button>

            {/* Botão Cancelar */}
            <button 
              onClick={() => { setSelectedInvoices([]); setBulkPaymentLink(null); }}
              className="p-2.5 text-slate-400 hover:text-white dark:text-slate-500 dark:hover:text-slate-800 transition-colors"
              title="Cancelar Seleção"
            >
              <Icons.X size={20} />
            </button>
          </div>

        </div>
      )}

      <InvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // O hook useInvoices já vai atualizar a lista automaticamente via Realtime!
        }}
      />
    </div>
  );
}
