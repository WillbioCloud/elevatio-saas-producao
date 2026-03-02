import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import UpgradePromo from '../components/UpgradePromo';
import { PLAN_CONFIG, PlanType } from '../config/plans';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const AdminContracts: React.FC = () => {
  const { user } = useAuth();
  const userPlan = (user?.company?.plan as PlanType) || 'free';
  const canAccessContracts = PLAN_CONFIG[userPlan].features.contractsAndFinance;

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = searchParams.get('tab') || 'geral';
  
  // Estado para controlar a abertura do modal
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [viewContractData, setViewContractData] = useState<any | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<any[]>([]);
  const [showOverdue, setShowOverdue] = useState(false);
  const [contractTab, setContractTab] = useState<'pending' | 'active' | 'archived'>('active');

  if (!canAccessContracts) {
    return (
      <div className="pb-10 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-slate-800">Contratos e Recebíveis</h1>
          <p className="text-sm text-slate-500">Gestão de vendas, locações e acompanhamento de parcelas.</p>
        </div>
        <UpgradePromo
          title="Módulo de Contratos e Finanças"
          description="Automatize as suas vendas, gira comissões, emita faturas e acompanhe a inadimplência num painel inteligente exclusivo."
          minPlan="Business"
          icon="FileSignature"
        />
      </div>
    );
  }


  const fetchContracts = async () => {
    setLoading(true);
    const [contractsRes, installmentsRes] = await Promise.all([
      supabase.from('contracts').select('*, lead:leads(name), property:properties(title)').order('created_at', { ascending: false }),
      supabase.from('installments').select('*').order('due_date', { ascending: true })
    ]);

    if (contractsRes.error) console.error('Erro contratos:', contractsRes.error);
    else if (contractsRes.data) setContracts(contractsRes.data);

    if (installmentsRes.error) console.error('Erro parcelas:', installmentsRes.error);
    else if (installmentsRes.data) setInstallments(installmentsRes.data);

    setLoading(false);
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const handleDeleteContract = async (id: string) => {
    if (window.confirm('CUIDADO: Deseja excluir permanentemente este contrato e todas as suas parcelas?')) {
      try {
        // 1. Deleta as parcelas (filhas) primeiro
        const { error: instError } = await supabase.from('installments').delete().eq('contract_id', id);
        if (instError) throw new Error('Erro ao deletar parcelas: ' + instError.message);

        // 2. Deleta o contrato (pai)
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

    installments.forEach(inst => {
      const dueDate = new Date(inst.due_date);
      const isCurrentMonth = dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;

      // Zera a hora para não dar falso positivo de atraso no dia de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = dueDate < today && inst.status !== 'paid';

      if (inst.status === 'paid' && isCurrentMonth) recebidoMes += Number(inst.amount);
      if (inst.status === 'pending' && isCurrentMonth && !isOverdue) aReceberMes += Number(inst.amount);
      if (isOverdue) inadimplencia += Number(inst.amount);
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
        return due >= today && due <= limite14Dias; // Apenas próximos 14 dias
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 10) // Aumentamos para 10 itens já que o período é curto
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

    return { recebidoMes, aReceberMes, inadimplencia, proximos, atrasados };
  }, [installments, contracts]);

  const salesContracts = contracts.filter((c) => c.type === 'sale');
  const rentContracts = contracts.filter((c) => c.type === 'rent');

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">
            Contratos e Recebíveis
          </h1>
          <p className="text-sm text-slate-500">
            Gestão de vendas, locações e acompanhamento de parcelas.
          </p>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsRentModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">
            <Icons.Plus size={16} /> Novo Aluguel
          </button>
          
          {/* Botão que abre o modal */}
          <button 
            onClick={() => setIsSaleModalOpen(true)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-700 transition-colors shadow-sm"
          >
            <Icons.Plus size={16} /> Nova Venda
          </button>
        </div>
      </div>

      {/* Navegação Interna (Tabs) */}
      <div className="flex gap-6 border-b border-slate-200 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setTab('geral')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            currentTab === 'geral' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icons.LayoutDashboard size={18} /> Visão Geral
        </button>
        <button
          onClick={() => setTab('vendas')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            currentTab === 'vendas' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icons.Building size={18} /> Vendas (Recebíveis)
        </button>
        <button
          onClick={() => setTab('alugueis')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            currentTab === 'alugueis' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icons.KeyRound size={18} /> Locações Ativas
        </button>
      </div>

      {/* CONTEÚDO DA ABA GERAL */}
      {currentTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">

          {/* Coluna Esquerda: Métricas Financeiras */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {loading ? (
               <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center min-h-[300px]"><Icons.Loader2 className="animate-spin text-brand-500" size={32} /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card: Recebido no Mês */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Icons.TrendingUp size={64} className="text-emerald-500"/></div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Recebido (Este Mês)</p>
                    <h3 className="text-3xl font-bold text-slate-800">{dashboardStats.recebidoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                  </div>

                  {/* Card: A Receber no Mês */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Icons.Clock size={64} className="text-blue-500"/></div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">A Receber (Este Mês)</p>
                    <h3 className="text-3xl font-bold text-slate-800">{dashboardStats.aReceberMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                  </div>
                </div>

                {/* Card: Inadimplência Expansível */}
                <div onClick={() => setShowOverdue(!showOverdue)} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col cursor-pointer hover:border-red-300 transition-colors relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Icons.AlertTriangle size={14}/> Inadimplência Total <Icons.ChevronDown size={14} className={`transition-transform ml-1 ${showOverdue ? 'rotate-180' : ''}`} />
                      </p>
                    </div>
                    <h3 className="text-2xl font-bold text-red-600">{dashboardStats.inadimplencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                  </div>

                  {showOverdue && (
                    <div className="absolute top-[100%] left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-red-100 z-50 p-2 max-h-[300px] overflow-y-auto cursor-default" onClick={e => e.stopPropagation()}>
                      {dashboardStats.atrasados.map(inst => (
                        <div key={inst.id} className="flex justify-between items-center p-3 border-b border-red-50 hover:bg-red-50 transition-colors">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{inst.contract?.lead?.name || 'Cliente'}</p>
                            <p className="text-[10px] text-slate-500">{new Date(inst.due_date).toLocaleDateString('pt-BR')} • {inst.contract?.property?.title}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-red-600">{Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            <button onClick={() => navigate(`/admin/contratos/${inst.contract_id}`)} className="p-2 bg-white border border-slate-200 rounded text-slate-400 hover:text-red-600"><Icons.ArrowRight size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

          </div>

          {/* Coluna Direita: Próximos Vencimentos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Icons.Calendar size={18} className="text-brand-500" />
              <h3 className="font-bold text-slate-800">Próximos Vencimentos</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-10"><Icons.Loader2 className="animate-spin text-slate-300" /></div>
              ) : dashboardStats.proximos.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 px-4">
                  <Icons.CheckCircle size={32} className="text-emerald-400 mb-3" />
                  <p className="text-sm font-bold text-slate-700">Tudo limpo!</p>
                  <p className="text-xs text-slate-500 mt-1">Nenhuma parcela a vencer nos próximos dias.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {dashboardStats.proximos.map(inst => (
                    <div key={inst.id} className="p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100 flex items-center justify-between group">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {inst.contract?.lead?.name || 'Cliente'}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {inst.contract?.property?.title || 'Contrato'}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-600">{new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded">{Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/admin/contratos/${inst.contract_id}`)}
                        className="p-2 text-slate-300 hover:text-brand-600 hover:bg-white rounded-lg transition-all shadow-sm opacity-0 group-hover:opacity-100"
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
            <h2 className="text-lg font-bold text-slate-800">Contratos de Venda</h2>
          </div>

          <div className="space-y-4 animate-fade-in">
            <div className="flex gap-2 mb-4 bg-white p-2 rounded-xl border border-slate-200 w-fit shadow-sm">
              <button onClick={() => setContractTab('active')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'active' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}>Ativos / Vigentes</button>
              <button onClick={() => setContractTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'pending' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}>Pendentes</button>
              <button onClick={() => setContractTab('archived')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'archived' ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}>Arquivados</button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Imóvel</th>
                      <th className="p-4">Valor</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm text-slate-600">
                    {contracts.filter(c => {
                      if (contractTab === 'active') return c.status === 'active';
                      if (contractTab === 'pending') return c.status === 'pending';
                      if (contractTab === 'archived') return c.status === 'canceled' || c.status === 'archived';
                      return true;
                    }).map((contract) => (
                      <tr key={contract.id} className="hover:bg-slate-50">
                        <td className="p-4 font-semibold">{contract.lead?.name || 'Não informado'}</td>
                        <td className="p-4">{contract.property?.title || 'Não informado'}</td>
                        <td className="p-4 font-bold text-slate-700">{Number(contract.type === 'rent' ? contract.rent_value : contract.sale_total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* Botão de Ver Detalhes */}
                            <button onClick={() => navigate(`/admin/contratos/${contract.id}`)} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg bg-white border border-slate-200 shadow-sm" title="Ver Detalhes (Gestão)"><Icons.Eye size={16} /></button>

                            {/* NOVO: Botão de Ver Formulário Original */}
                            <button onClick={() => setViewContractData(contract)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg bg-white border border-slate-200 shadow-sm" title="Ver Formulário Original"><Icons.FileText size={16} /></button>
                            
                            {/* Botão de Aprovar (APENAS ADMIN) */}
                            {contract.status === 'pending' && user?.role === 'admin' && (
                               <button onClick={async () => {
                                 if(window.confirm('Aprovar este contrato?')) {
                                   await supabase.from('contracts').update({status: 'active'}).eq('id', contract.id);
                                   fetchContracts();
                                 }
                               }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg bg-white border border-slate-200 shadow-sm" title="Aprovar Contrato"><Icons.CheckCircle size={16} /></button>
                            )}

                            {/* Botões de Arquivar e Excluir (APENAS ADMIN) */}
                            {user?.role === 'admin' && (
                              <>
                                <button onClick={() => handleArchiveContract(contract.id, contract.status)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg bg-white border border-slate-200 shadow-sm" title={contract.status === 'archived' ? 'Reativar' : 'Arquivar'}><Icons.Archive size={16} /></button>
                                <button onClick={() => handleDeleteContract(contract.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg bg-white border border-red-100 shadow-sm" title="Excluir"><Icons.Trash2 size={16} /></button>
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
            <h2 className="text-lg font-bold text-slate-800">Contratos de Locação</h2>
          </div>

          <div className="space-y-4 animate-fade-in"> 
            {/* Sub-abas de Locação */}
            <div className="flex gap-2 mb-4 bg-white p-2 rounded-xl border border-slate-200 w-fit shadow-sm"> 
              <button onClick={() => setContractTab('active')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'active' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>Ativos / Vigentes</button>
              <button onClick={() => setContractTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'pending' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}>Pendentes</button>
              <button onClick={() => setContractTab('archived')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${contractTab === 'archived' ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}>Arquivados</button>
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><Icons.Loader2 className="animate-spin text-indigo-500" size={32} /></div>
            ) : rentContracts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4">
                  <Icons.KeyRound size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Nenhuma locação</h3>
                <p className="text-slate-500 mt-2 mb-6 max-w-md">Registre os contratos de aluguel para acompanhar mensalidades, garantias e reajustes.</p>
                <button onClick={() => setIsRentModalOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2">
                  <Icons.Plus size={20} /> Novo Contrato de Locação
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                        <th className="p-4">Imóvel & Locatário</th>
                        <th className="p-4">Vencimento Contrato</th>
                        <th className="p-4 text-right">Aluguel Mensal</th>
                        <th className="p-4 text-center">Garantia</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
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
                          <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-slate-800">{contract.property?.title || 'Imóvel Excluído'}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Icons.User size={12}/> {contract.lead?.name || 'Cliente Excluído'}</p>
                            </td>
                            <td className="p-4 text-slate-600">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</td>
                            <td className="p-4 text-right font-bold text-slate-800">
                              {Number(contract.rent_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="p-4 text-center text-xs font-medium text-slate-500 uppercase">
                              {contract.rent_guarantee_type.replace('_', ' ')}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => navigate(`/admin/contratos/${contract.id}`)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg bg-white border border-slate-200 shadow-sm" title="Ver Detalhes (Gestão)"><Icons.Eye size={16} /></button>

                                {/* NOVO: Botão de Ver Formulário Original */}
                                <button onClick={() => setViewContractData(contract)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg bg-white border border-slate-200 shadow-sm" title="Ver Formulário Original"><Icons.FileText size={16} /></button>
                                
                                {contract.status === 'pending' && user?.role === 'admin' && (
                                   <button onClick={async () => {
                                     if(window.confirm('Aprovar este contrato?')) {
                                       await supabase.from('contracts').update({status: 'active'}).eq('id', contract.id);
                                       fetchContracts();
                                     }
                                   }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg bg-white border border-slate-200 shadow-sm" title="Aprovar Contrato"><Icons.CheckCircle size={16} /></button>
                                )}

                                {user?.role === 'admin' && (
                                  <>
                                    <button onClick={() => handleArchiveContract(contract.id, contract.status)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg bg-white border border-slate-200 shadow-sm" title={contract.status === 'archived' ? 'Reativar' : 'Arquivar'}><Icons.Archive size={16} /></button>
                                    <button onClick={() => handleDeleteContract(contract.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg bg-white border border-red-100 shadow-sm" title="Excluir"><Icons.Trash2 size={16} /></button>
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