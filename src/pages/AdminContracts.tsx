import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Icons } from '../components/Icons';
import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const AdminContracts: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTab = searchParams.get('tab') || 'geral';
  const isSuperAdmin = user?.role === 'super_admin';
  const directUserPlan = typeof (user as { plan?: string } | null)?.plan === 'string'
    ? (user as { plan?: string }).plan ?? ''
    : '';
  
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [viewContractData, setViewContractData] = useState<any | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<any[]>([]);
  const [showOverdue, setShowOverdue] = useState(false);
  const [contractTab, setContractTab] = useState<'pending' | 'active' | 'archived'>('active');
  const [maxContracts, setMaxContracts] = useState<number | null>(null);
  const [loadingPlanLimit, setLoadingPlanLimit] = useState(true);

  const fetchContracts = async () => {
    if (!user) return;
    setLoading(true);
    
    // Multi-Tenant: Filtra por company_id se não for super admin
    let contractsQuery = supabase.from('contracts').select('*, lead:leads(name), property:properties(title)');
    let installmentsQuery = supabase.from('installments').select('*');
    
    if (!isSuperAdmin && user.company_id) {
      contractsQuery = contractsQuery.eq('company_id', user.company_id);
      installmentsQuery = installmentsQuery.eq('company_id', user.company_id);
    }
    
    const [contractsRes, installmentsRes] = await Promise.all([
      contractsQuery.order('created_at', { ascending: false }),
      installmentsQuery.order('due_date', { ascending: true })
    ]);

    if (contractsRes.error) console.error('Erro contratos:', contractsRes.error);
    else if (contractsRes.data) setContracts(contractsRes.data);

    if (installmentsRes.error) console.error('Erro parcelas:', installmentsRes.error);
    else if (installmentsRes.data) setInstallments(installmentsRes.data);

    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchContracts();
    }
  }, [user?.company_id, user?.role]);

  useEffect(() => {
    let isMounted = true;

    const fetchPlanLimit = async () => {
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
        const { data: currentSaasContract, error: contractError } = await supabase
          .from('saas_contracts')
          .select('plan_id, plan_name, companies(plan)')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (contractError) {
          console.error('Erro ao buscar contrato SaaS atual:', contractError);
        }

        const planCandidates = [
          currentSaasContract?.plan_id,
          currentSaasContract?.plan_name,
          currentSaasContract?.companies?.plan,
          user.company?.plan,
          directUserPlan,
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase());

        if (planCandidates.length === 0) {
          if (isMounted) setMaxContracts(0);
          return;
        }

        const { data: plansData, error: plansError } = await supabase
          .from('saas_plans')
          .select('id, name, max_contracts');

        if (plansError) throw plansError;

        const matchedPlan = (plansData || []).find((plan) => {
          const planId = String(plan.id || '').toLowerCase();
          const planName = String(plan.name || '').toLowerCase();
          return planCandidates.some((candidate) => candidate === planId || candidate === planName);
        });

        if (isMounted) {
          setMaxContracts(Number(matchedPlan?.max_contracts ?? 0));
        }
      } catch (error) {
        console.error('Erro ao buscar limite de contratos do plano:', error);
        if (isMounted) {
          setMaxContracts(0);
        }
      } finally {
        if (isMounted) {
          setLoadingPlanLimit(false);
        }
      }
    };

    fetchPlanLimit();

    return () => {
      isMounted = false;
    };
  }, [directUserPlan, isSuperAdmin, user?.company?.plan, user?.company_id, user?.id]);

  const handleDeleteContract = async (id: string) => {
    if (window.confirm('CUIDADO: Deseja excluir permanentemente este contrato e todas as suas parcelas?')) {
      try {
        const { error: instError } = await supabase.from('installments').delete().eq('contract_id', id);
        if (instError) throw new Error('Erro ao deletar parcelas: ' + instError.message);

        const { error: contractError } = await supabase.from('contracts').delete().eq('id', id);
        if (contractError) throw new Error('Erro ao deletar contrato: ' + contractError.message);

        fetchContracts();
      } catch (error: any) {
        console.error('Falha na exclusão:', error);
        alert(error.message || 'Falha ao excluir o contrato. Verifique as permissões.');
      }
    }
  };

  const handleArchiveContract = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived';
    if (window.confirm(`Deseja ${currentStatus === 'archived' ? 'reativar' : 'arquivar'} este contrato?`)) {
      await supabase.from('contracts').update({ status: newStatus }).eq('id', id);
      fetchContracts();
    }
  };

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let recebidoMes = 0;
    let aReceberMes = 0;
    let inadimplencia = 0;
    let vgvAno = 0;
    let mrrAtivo = 0;
    let contratosVendaAtivos = 0;
    let contratosLocacaoAtivos = 0;

    installments.forEach(inst => {
      const dueDate = new Date(inst.due_date);
      const isCurrentMonth = dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = dueDate < today && inst.status !== 'paid';

      if (inst.status === 'paid' && isCurrentMonth) recebidoMes += Number(inst.amount);
      if (inst.status === 'pending' && isCurrentMonth && !isOverdue) aReceberMes += Number(inst.amount);
      if (isOverdue) inadimplencia += Number(inst.amount);
    });

    contracts.forEach(contract => {
      const createdDate = new Date(contract.created_at);
      const isCurrentYear = createdDate.getFullYear() === currentYear;

      if (contract.status === 'active') {
        if (contract.type === 'sale') {
          if (isCurrentYear) vgvAno += Number(contract.sale_total_value || 0);
          contratosVendaAtivos++;
        } else if (contract.type === 'rent') {
          mrrAtivo += Number(contract.rent_value || 0);
          contratosLocacaoAtivos++;
        }
      }
    });

    const limite14Dias = new Date();
    limite14Dias.setDate(limite14Dias.getDate() + 14);
    limite14Dias.setHours(23, 59, 59, 999);

    const proximos = installments
      .filter(inst => {
        if (inst.status === 'paid') return false;
        const due = new Date(inst.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return due >= today && due <= limite14Dias;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 10)
      .map(inst => {
        const contract = contracts.find(c => c.id === inst.contract_id);
        return { ...inst, contract };
      });

    const atrasados = installments
      .filter(inst => inst.status !== 'paid' && new Date(inst.due_date) < new Date(new Date().setHours(0,0,0,0)))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .map(inst => {
        const contract = contracts.find(c => c.id === inst.contract_id);
        return { ...inst, contract };
      });

    const chartData = [
      { name: 'Vendas', value: contratosVendaAtivos, color: '#0ea5e9' },
      { name: 'Locações', value: contratosLocacaoAtivos, color: '#8b5cf6' },
    ];

    const totalEsperado = recebidoMes + aReceberMes + inadimplencia;
    const saudeFinanceira = totalEsperado > 0 ? (((recebidoMes + aReceberMes) / totalEsperado) * 100).toFixed(1) : 100;

    return { recebidoMes, aReceberMes, inadimplencia, proximos, atrasados, vgvAno, mrrAtivo, chartData, saudeFinanceira };
  }, [installments, contracts]);

  const salesContracts = contracts.filter((c) => c.type === 'sale');
  const rentContracts = contracts.filter((c) => c.type === 'rent');
  const activeContractsCount = useMemo(
    () => contracts.filter((contract) => contract.status === 'active').length,
    [contracts]
  );
  const contractsUsageLabel = isSuperAdmin
    ? 'Sem limite'
    : loadingPlanLimit
      ? '...'
      : maxContracts === 0
        ? 'Bloqueado'
        : String(maxContracts ?? '--');

  const handleOpenContractModal = (type: 'sale' | 'rent') => {
    if (loadingPlanLimit) {
      alert('Estamos carregando os limites do seu plano. Tente novamente em alguns segundos.');
      return;
    }

    if (!isSuperAdmin && maxContracts === 0) {
      alert('O seu plano atual não inclui o módulo de Gestão de Contratos. Faça o upgrade para desbloquear.');
      return;
    }

    if (!isSuperAdmin && typeof maxContracts === 'number' && activeContractsCount >= maxContracts) {
      alert(`Você atingiu o limite de contratos ativos do seu plano (${maxContracts}). Faça o upgrade para criar novos contratos.`);
      return;
    }

    if (type === 'rent') {
      setIsRentModalOpen(true);
      return;
    }

    setIsSaleModalOpen(true);
  };

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-800 dark:text-white">
            Contratos e Recebíveis
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão de vendas, locações e acompanhamento de parcelas.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-[#0a0f1c]/80 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
            <Icons.FileText size={14} className="text-brand-500" />
            <span>Contratos: {activeContractsCount} / {contractsUsageLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleOpenContractModal('rent')}
            className="inline-flex items-center gap-2 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-sm">
            <Icons.Plus size={16} /> Novo Aluguel
          </button>
          
          <button 
            onClick={() => handleOpenContractModal('sale')}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-sky-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:shadow-lg transition-all shadow-sm"
          >
            <Icons.Plus size={16} /> Nova Venda
          </button>
        </div>
      </div>

      {/* Navegação Interna (Tabs) */}
      <div className="flex gap-6 border-b border-slate-200/60 dark:border-white/5 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setTab('geral')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            currentTab === 'geral' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Icons.LayoutDashboard size={18} /> Visão Geral
        </button>
        <button
          onClick={() => setTab('vendas')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            currentTab === 'vendas' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Icons.Building size={18} /> Vendas (Recebíveis)
        </button>
        <button
          onClick={() => setTab('alugueis')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            currentTab === 'alugueis' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Icons.KeyRound size={18} /> Locações Ativas
        </button>
      </div>

      {/* CONTEÚDO DA ABA GERAL */}
      {currentTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">

          {/* Coluna Esquerda: Métricas Financeiras e Gráficos */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {loading ? (
               <div className="flex-1 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none flex items-center justify-center min-h-[300px]"><Icons.Loader2 className="animate-spin text-brand-500" size={32} /></div>
            ) : (
              <>
                {/* Linha 1: 4 Cards de Métricas Core */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Card: VGV */}
                  <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-4 relative overflow-hidden flex flex-col justify-between hover:border-sky-300 dark:hover:border-sky-500/30 transition-colors">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Icons.Building size={12}/> VGV do Ano
                    </p>
                    <h3 className="text-xl md:text-2xl font-bold font-serif text-slate-800 dark:text-white truncate">
                      {dashboardStats.vgvAno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                  </div>

                  {/* Card: MRR */}
                  <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-4 relative overflow-hidden flex flex-col justify-between hover:border-violet-300 dark:hover:border-violet-500/30 transition-colors">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Icons.KeyRound size={12}/> MRR (Ativos)
                    </p>
                    <h3 className="text-xl md:text-2xl font-bold font-serif text-slate-800 dark:text-white truncate">
                      {dashboardStats.mrrAtivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                  </div>

                  {/* Card: Recebido no Mês */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-500/10 rounded-3xl border border-emerald-200 dark:border-emerald-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-4 relative overflow-hidden flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Icons.TrendingUp size={12}/> Recebido (Mês)
                    </p>
                    <h3 className="text-xl md:text-2xl font-bold font-serif text-emerald-600 dark:text-emerald-400 truncate">
                      {dashboardStats.recebidoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                  </div>

                  {/* Card: A Receber no Mês */}
                  <div className="bg-blue-50/50 dark:bg-blue-500/10 rounded-3xl border border-blue-200 dark:border-blue-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-4 relative overflow-hidden flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Icons.Clock size={12}/> A Receber (Mês)
                    </p>
                    <h3 className="text-xl md:text-2xl font-bold font-serif text-blue-600 dark:text-blue-400 truncate">
                      {dashboardStats.aReceberMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                  </div>
                </div>

                {/* Linha 2: Gráfico e Controle de Inadimplência */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gráfico de Carteira */}
                  <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-5 flex flex-col">
                    <h3 className="text-sm font-bold font-serif text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                      <Icons.PieChart size={16} className="text-brand-500" /> Distribuição da Carteira
                    </h3>
                    <div className="flex-1 min-h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardStats.chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {dashboardStats.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value: number) => [`${value} contratos ativos`, 'Quantidade']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                      {dashboardStats.chartData.map(item => (
                        <div key={item.name} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{item.name} ({item.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Box de Análise de Risco */}
                  <div className="flex flex-col gap-4">
                    {/* Saúde Financeira (Adimplência) */}
                    <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-5 flex items-center justify-between h-auto">
                      <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Saúde da Carteira</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Taxa de Adimplência Geral</p>
                      </div>
                      <div className={`text-3xl font-bold font-serif ${Number(dashboardStats.saudeFinanceira) >= 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {dashboardStats.saudeFinanceira}%
                      </div>
                    </div>

                    {/* Inadimplência Expansível */}
                    <div onClick={() => setShowOverdue(!showOverdue)} className="bg-red-50/50 dark:bg-red-500/10 rounded-3xl border border-red-200 dark:border-red-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-5 flex flex-col cursor-pointer hover:border-red-300 dark:hover:border-red-500/30 transition-colors relative flex-1 justify-center">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Icons.AlertTriangle size={14}/> Inadimplência Total <Icons.ChevronDown size={14} className={`transition-transform ml-1 ${showOverdue ? 'rotate-180' : ''}`} />
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Parcelas vencidas (Histórico)</p>
                        </div>
                        <h3 className="text-2xl font-bold font-serif text-red-600 dark:text-red-400">
                          {dashboardStats.inadimplencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                      </div>

                      {showOverdue && (
                        <div className="absolute top-[100%] left-0 right-0 mt-2 bg-white dark:bg-[#0a0f1c] rounded-xl shadow-2xl border border-red-100 dark:border-red-500/20 z-50 p-2 max-h-[250px] overflow-y-auto cursor-default" onClick={e => e.stopPropagation()}>
                          {dashboardStats.atrasados.length === 0 ? (
                            <p className="text-center text-sm text-slate-500 dark:text-slate-400 p-4">Excelente! Nenhum contrato atrasado.</p>
                          ) : dashboardStats.atrasados.map(inst => (
                            <div key={inst.id} className="flex justify-between items-center p-3 border-b border-red-50 dark:border-red-500/10 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors">
                              <div>
                                <p className="text-sm font-bold font-serif text-slate-800 dark:text-white">{inst.contract?.lead?.name || 'Cliente'}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(inst.due_date).toLocaleDateString('pt-BR')} • {inst.contract?.property?.title}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-red-600 dark:text-red-400">{Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                <button onClick={() => navigate(`/admin/contratos/${inst.contract_id}`)} className="p-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded text-slate-400 hover:text-red-600"><Icons.ArrowRight size={14} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Coluna Direita: Próximos Vencimentos */}
          <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center gap-2">
              <Icons.Calendar size={18} className="text-brand-500" />
              <h3 className="font-bold font-serif text-slate-800 dark:text-white">Próximos Vencimentos</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-10"><Icons.Loader2 className="animate-spin text-slate-300" /></div>
              ) : dashboardStats.proximos.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 px-4">
                  <Icons.CheckCircle size={32} className="text-emerald-400 mb-3" />
                  <p className="text-sm font-bold font-serif text-slate-700 dark:text-slate-300">Tudo limpo!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Nenhuma parcela a vencer nos próximos dias.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {dashboardStats.proximos.map(inst => (
                    <div key={inst.id} className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/5 flex items-center justify-between group">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold font-serif text-slate-800 dark:text-white truncate">
                          {inst.contract?.lead?.name || 'Cliente'}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {inst.contract?.property?.title || 'Contrato'}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 rounded">{Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/admin/contratos/${inst.contract_id}`)}
                        className="p-2 text-slate-300 hover:text-brand-600 hover:bg-white dark:hover:bg-white/5 rounded-lg transition-all shadow-sm opacity-0 group-hover:opacity-100"
                        title="Ver Contrato"
                      >
                        <Icons.ArrowRight size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA VENDAS */}
      {currentTab === 'vendas' && (
        <div className="animate-fade-in space-y-4">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-bold font-serif text-slate-800 dark:text-white">Contratos de Venda</h2>
          </div>

          <div className="space-y-4 animate-fade-in">
            <div className="flex gap-2 mb-4 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl p-2 rounded-xl border border-slate-200/60 dark:border-white/5 w-fit shadow-sm">
              <button onClick={() => setContractTab('active')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'active' ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Ativos / Vigentes</button>
              <button onClick={() => setContractTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'pending' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Pendentes</button>
              <button onClick={() => setContractTab('archived')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'archived' ? 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Arquivados</button>
            </div>

            <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Imóvel</th>
                      <th className="p-4">Valor</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5 text-sm text-slate-600 dark:text-slate-300">
                    {salesContracts.filter(c => {
                      if (contractTab === 'active') return c.status === 'active';
                      if (contractTab === 'pending') return c.status === 'pending';
                      if (contractTab === 'archived') return c.status === 'canceled' || c.status === 'archived';
                      return true;
                    }).map((contract) => (
                      <tr key={contract.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="p-4 font-semibold font-serif">{contract.lead?.name || 'Não informado'}</td>
                        <td className="p-4">{contract.property?.title || 'Não informado'}</td>
                        <td className="p-4 font-bold font-serif text-slate-700 dark:text-slate-200">{Number(contract.sale_total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => navigate(`/admin/contratos/${contract.id}`)} className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title="Ver Detalhes (Gestão)"><Icons.Eye size={16} /></button>
                            <button onClick={() => setViewContractData(contract)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title="Ver Formulário Original"><Icons.FileText size={16} /></button>
                            
                            {contract.status === 'pending' && user?.role === 'admin' && (
                               <button onClick={async () => {
                                 if(window.confirm('Aprovar este contrato?')) {
                                   await supabase.from('contracts').update({status: 'active'}).eq('id', contract.id);
                                   fetchContracts();
                                 }
                               }} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title="Aprovar Contrato"><Icons.CheckCircle size={16} /></button>
                            )}

                            {user?.role === 'admin' && (
                              <>
                                <button onClick={() => handleArchiveContract(contract.id, contract.status)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title={contract.status === 'archived' ? 'Reativar' : 'Arquivar'}><Icons.Archive size={16} /></button>
                                <button onClick={() => handleDeleteContract(contract.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg bg-white dark:bg-dark-card border border-red-100 dark:border-red-500/20 shadow-sm" title="Excluir"><Icons.Trash2 size={16} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA ALUGUÉIS */}
      {currentTab === 'alugueis' && (
        <div className="animate-fade-in space-y-4"> 
          <div className="flex justify-between items-end mb-4"> 
            <h2 className="text-lg font-bold font-serif text-slate-800 dark:text-white">Contratos de Locação</h2>
          </div>

          <div className="space-y-4 animate-fade-in"> 
            <div className="flex gap-2 mb-4 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl p-2 rounded-xl border border-slate-200/60 dark:border-white/5 w-fit shadow-sm"> 
              <button onClick={() => setContractTab('active')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'active' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Ativos / Vigentes</button>
              <button onClick={() => setContractTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'pending' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Pendentes</button>
              <button onClick={() => setContractTab('archived')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'archived' ? 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Arquivados</button>
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><Icons.Loader2 className="animate-spin text-indigo-500" size={32} /></div>
            ) : rentContracts.length === 0 ? (
              <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none p-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-500 mb-4">
                  <Icons.KeyRound size={40} />
                </div>
                <h3 className="text-xl font-bold font-serif text-slate-800 dark:text-white">Nenhuma locação</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 max-w-md">Registre os contratos de aluguel para acompanhar mensalidades, garantias e reajustes.</p>
                <button onClick={() => handleOpenContractModal('rent')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2">
                  <Icons.Plus size={20} /> Novo Contrato de Locação
                </button>
              </div>
            ) : (
              <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                        <th className="p-4">Imóvel & Locatário</th>
                        <th className="p-4">Vencimento Contrato</th>
                        <th className="p-4 text-right">Aluguel Mensal</th>
                        <th className="p-4 text-center">Garantia</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                      {rentContracts.filter(c => {
                        if (contractTab === 'active') return c.status === 'active';
                        if (contractTab === 'pending') return c.status === 'pending';
                        if (contractTab === 'archived') return c.status === 'canceled' || c.status === 'archived';
                        return true;
                      }).length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum contrato encontrado nesta categoria.</td></tr>
                      ) : (
                        rentContracts.filter(c => {
                          if (contractTab === 'active') return c.status === 'active';
                          if (contractTab === 'pending') return c.status === 'pending';
                          if (contractTab === 'archived') return c.status === 'canceled' || c.status === 'archived';
                          return true;
                        }).map((contract) => (
                          <tr key={contract.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <td className="p-4">
                              <p className="font-bold font-serif text-slate-800 dark:text-white">{contract.property?.title || 'Imóvel Excluído'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"><Icons.User size={12}/> {contract.lead?.name || 'Cliente Excluído'}</p>
                            </td>
                            <td className="p-4 text-slate-600 dark:text-slate-300">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</td>
                            <td className="p-4 text-right font-bold font-serif text-slate-800 dark:text-white">
                              {Number(contract.rent_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="p-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                              {contract.rent_guarantee_type?.replace('_', ' ')}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => navigate(`/admin/contratos/${contract.id}`)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title="Ver Detalhes (Gestão)"><Icons.Eye size={16} /></button>
                                <button onClick={() => setViewContractData(contract)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title="Ver Formulário Original"><Icons.FileText size={16} /></button>
                                
                                {contract.status === 'pending' && user?.role === 'admin' && (
                                   <button onClick={async () => {
                                     if(window.confirm('Aprovar este contrato?')) {
                                       await supabase.from('contracts').update({status: 'active'}).eq('id', contract.id);
                                       fetchContracts();
                                     }
                                   }} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title="Aprovar Contrato"><Icons.CheckCircle size={16} /></button>
                                )}

                                {user?.role === 'admin' && (
                                  <>
                                    <button onClick={() => handleArchiveContract(contract.id, contract.status)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm" title={contract.status === 'archived' ? 'Reativar' : 'Arquivar'}><Icons.Archive size={16} /></button>
                                    <button onClick={() => handleDeleteContract(contract.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg bg-white dark:bg-dark-card border border-red-100 dark:border-red-500/20 shadow-sm" title="Excluir"><Icons.Trash2 size={16} /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modais */}
      <SaleContractModal 
        isOpen={isSaleModalOpen || (viewContractData?.type === 'sale')} 
        contractData={viewContractData?.type === 'sale' ? viewContractData : undefined}
        onClose={() => { setIsSaleModalOpen(false); setViewContractData(null); }} 
        onSuccess={() => {
          alert('Contrato de venda salvo com sucesso!');
          fetchContracts();
        }} 
      />

      <RentContractModal 
        isOpen={isRentModalOpen || (viewContractData?.type === 'rent')} 
        contractData={viewContractData?.type === 'rent' ? viewContractData : undefined}
        onClose={() => { setIsRentModalOpen(false); setViewContractData(null); }} 
        onSuccess={() => {
          alert('Contrato de locação salvo com sucesso!');
          fetchContracts();
        }} 
      />

    </div>
  );
};

export default AdminContracts;
