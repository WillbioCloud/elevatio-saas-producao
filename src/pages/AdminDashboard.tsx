import React, { useMemo, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../components/ui/chart";
import { useAuth } from '../contexts/AuthContext';
import { useLeads } from '../hooks/useLeads';
import { useProperties } from '../hooks/useProperties';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import Loading from '../components/Loading';
import DashboardCalendar from '../components/DashboardCalendar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';

const InfoTooltip = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="ml-2 focus:outline-none flex items-center justify-center">
          <Icons.Info size={15} className="text-slate-400 hover:text-brand-500 transition-colors cursor-help" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" className="bg-slate-900 text-white border-none shadow-xl max-w-xs text-center font-sans">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface Task {
  id: string;
  title: string;
  due_date: string;
  status: 'pending' | 'completed';
  description?: string;
}

const InlineLoading: React.FC = () => (
  <Icons.Loader2 size={18} className="inline-block animate-spin text-slate-400" />
);

// CONFIGURAÇÃO DOS WIDGETS (Tamanhos e Permissões)
const WIDGET_CONFIG = [
  { id: 'vgvTotal', label: 'VGV Total (Histórico)', size: 'col-span-1 md:col-span-2 lg:col-span-1', adminOnly: true },
  { id: 'vgvAnual', label: 'VGV Anual', size: 'col-span-1 md:col-span-2 lg:col-span-1', adminOnly: false },
  { id: 'portfolioVenda', label: 'Portfólio de Vendas', size: 'col-span-1 md:col-span-2 lg:col-span-1', adminOnly: false },
  { id: 'portfolioAluguel', label: 'Portfólio de Aluguel', size: 'col-span-1 md:col-span-2 lg:col-span-1', adminOnly: false },
  { id: 'funil', label: 'Funil de Vendas (Gráfico)', size: 'col-span-1 lg:col-span-2', adminOnly: false },
  { id: 'agenda', label: 'Minha Agenda', size: 'col-span-1 lg:col-span-2', adminOnly: false },
  { id: 'financeiroAdmin', label: 'Caixa e Top Corretor', size: 'col-span-1 lg:col-span-2', adminOnly: true },
  { id: 'calendario', label: 'Calendário de Campanhas', size: 'col-span-1 lg:col-span-2', adminOnly: true },
];

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { leads, loading: leadsLoading } = useLeads();
  const { properties, loading: propsLoading } = useProperties();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  const currentYear = new Date().getFullYear();

  // Estados do Admin (Caixa e Top Corretor)
  const [adminStats, setAdminStats] = useState({
    recebidoMes: 0,
    aReceberMes: 0,
    inadimplencia: 0,
    leadsMes: 0,
    topBroker: { name: 'Ninguém ainda', total: 0 }
  });

  // Motor de Layout Inteligente (Salva no LocalStorage)
  const [layout, setLayout] = useState<{ id: string; visible: boolean }[]>(() => {
    const saved = localStorage.getItem(`dashboard_layout_${user?.id}`);
    if (saved) return JSON.parse(saved);
    return WIDGET_CONFIG.map(w => ({ id: w.id, visible: true }));
  });

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const currentUserId = user.id;

    const initDashboard = async () => {
      setTasksLoading(true);

      try {
        // Busca simples e direta, sem forçar recuperação de sessão
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('status', 'pending')
          .order('due_date', { ascending: true })
          .limit(5);

        if (!error && data && isMounted) setTasks(data);
      } catch (err) {
        console.error('Erro ao buscar tarefas:', err);
      } finally {
        if (isMounted) setTasksLoading(false);
      }

      // --- BUSCA DE INDICADORES DE ALTA GESTÃO (APENAS ADMIN) ---
      if (isAdmin && isMounted) {
        const [instRes, profilesRes, allLeadsRes] = await Promise.all([
          supabase.from('installments').select('*'),
          supabase.from('profiles').select('id, name'),
          supabase.from('leads').select('assigned_to, deal_value, created_at, funnel_step, status')
        ]);

        let rec = 0, arec = 0, inad = 0, leadsM = 0;
        let bestBroker = { name: 'Nenhum', total: 0 };

        if (instRes.data) {
          const now = new Date();
          instRes.data.forEach(inst => {
            const d = new Date(inst.due_date);
            const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            const today = new Date();
            today.setHours(0,0,0,0);
            const isOverdue = d < today && inst.status !== 'paid';

            if (inst.status === 'paid' && isCurrentMonth) rec += Number(inst.amount);
            if (inst.status === 'pending' && isCurrentMonth && !isOverdue) arec += Number(inst.amount);
            if (isOverdue) inad += Number(inst.amount);
          });
        }

        if (allLeadsRes.data && profilesRes.data) {
          const now = new Date();
          const thisMonthLeads = allLeadsRes.data.filter(l => {
            const d = new Date(l.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          leadsM = thisMonthLeads.length;

          const closed = allLeadsRes.data.filter(l => l.funnel_step === 'venda_ganha' || l.status === 'Fechado');
          const brokerSales: Record<string, number> = {};
          closed.forEach(l => {
            if (l.assigned_to) {
              brokerSales[l.assigned_to] = (brokerSales[l.assigned_to] || 0) + (Number(l.deal_value) || 0);
            }
          });

          let maxVal = 0, bestId = null;
          Object.entries(brokerSales).forEach(([id, val]) => {
            if (val > maxVal) { maxVal = val; bestId = id; }
          });

          if (bestId) {
            const b = profilesRes.data.find(p => p.id === bestId);
            if (b) bestBroker = { name: b.name.split(' ')[0], total: maxVal };
          }
        }

        setAdminStats({ recebidoMes: rec, aReceberMes: arec, inadimplencia: inad, leadsMes: leadsM, topBroker: bestBroker });
      }
    };

    initDashboard();

    return () => {
      isMounted = false;
    };
  }, [user?.id, isAdmin]); // DEPENDÊNCIAS BLINDADAS


  const stats = useMemo(() => {
    const myLeads = isAdmin ? leads : leads.filter((l: any) => l.assigned_to === user?.id);
    const myProperties = isAdmin ? properties : properties.filter((p) => p.agent_id === user?.id);

    const closedLeads = myLeads.filter((l) => l.funnel_step === 'venda_ganha' || l.status === 'Fechado');
    const vgvTotal = closedLeads.reduce((acc, lead) => acc + (lead.deal_value || 0), 0);

    const annualLeads = closedLeads.filter((l) => new Date(l.updated_at || new Date()).getFullYear() === currentYear);
    const vgvAnnual = annualLeads.reduce((acc, lead) => acc + (lead.deal_value || 0), 0);

    const salePortfolioCount = myProperties.filter((p) => {
      const normalizedStatus = p.status?.toLowerCase() || '';
      const isActive = !['vendido', 'alugado', 'inativo', 'suspenso'].includes(normalizedStatus);
      return p.listing_type === 'sale' && isActive;
    }).length;
    const rentPortfolioCount = myProperties.filter((p) => {
      const normalizedStatus = p.status?.toLowerCase() || '';
      const isActive = !['vendido', 'alugado', 'inativo', 'suspenso'].includes(normalizedStatus);
      return p.listing_type === 'rent' && isActive;
    }).length;

    const funnel = {
      pre_atendimento: myLeads.filter((l) => l.funnel_step === 'pre_atendimento').length,
      atendimento: myLeads.filter((l) => l.funnel_step === 'atendimento' || !l.funnel_step).length,
      proposta: myLeads.filter((l) => l.funnel_step === 'proposta').length,
      venda_ganha: closedLeads.length,
      perdido: myLeads.filter((l) => l.funnel_step === 'perdido').length,
    };

    return { vgvTotal, vgvAnnual, salePortfolioCount, rentPortfolioCount, funnel };
  }, [leads, properties, isAdmin, user?.id, currentYear]);

  const chartConfig = {
    visitors: { label: 'Leads' },
    pre_atendimento: { label: 'Pré-Atend.', color: '#94a3b8' },
    atendimento: { label: 'Atendimento', color: '#3b82f6' },
    proposta: { label: 'Proposta', color: '#f59e0b' },
    venda_ganha: { label: 'Venda Ganha', color: '#10b981' },
    perdido: { label: 'Perdido', color: '#ef4444' },
  } satisfies ChartConfig;

  const chartData = [
    { step: 'pre_atendimento', label: 'Pré-Atend.', visitors: stats.funnel.pre_atendimento, fill: 'var(--color-pre_atendimento)' },
    { step: 'atendimento', label: 'Atendimento', visitors: stats.funnel.atendimento, fill: 'var(--color-atendimento)' },
    { step: 'proposta', label: 'Proposta', visitors: stats.funnel.proposta, fill: 'var(--color-proposta)' },
    { step: 'venda_ganha', label: 'Venda Ganha', visitors: stats.funnel.venda_ganha, fill: 'var(--color-venda_ganha)' },
    { step: 'perdido', label: 'Perdido', visitors: stats.funnel.perdido, fill: 'var(--color-perdido)' },
  ];

  // AÇÕES DE LAYOUT (Arrastar, Soltar, Ocultar)
  const toggleWidgetVisibility = (id: string) => {
    setLayout(prev => {
      const newLayout = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      localStorage.setItem(`dashboard_layout_${user?.id}`, JSON.stringify(newLayout));
      return newLayout;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWidget(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverWidget(null);
    if (!draggedWidget || draggedWidget === targetId) return;

    setLayout(prev => {
      const newLayout = [...prev];
      const draggedIdx = newLayout.findIndex(w => w.id === draggedWidget);
      const targetIdx = newLayout.findIndex(w => w.id === targetId);
      
      const [movedItem] = newLayout.splice(draggedIdx, 1);
      newLayout.splice(targetIdx, 0, movedItem);
      
      localStorage.setItem(`dashboard_layout_${user?.id}`, JSON.stringify(newLayout));
      return newLayout;
    });
    setDraggedWidget(null);
  };

  // RENDERIZADOR DE COMPONENTES
  const renderWidgetContent = (id: string) => {
    switch(id) {
      case 'vgvTotal': return (
        <div className="h-full bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-xl"><Icons.TrendingUp size={24} className="text-emerald-400" /></div>
              <span className="text-xs font-medium bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">Histórico</span>
            </div>
            <div className="text-slate-400 text-sm mb-1 flex items-center">VGV Total <InfoTooltip text="Soma de todas as vendas fechadas." /></div>
          </div>
          <h3 className="text-2xl font-bold">{leadsLoading ? <InlineLoading /> : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.vgvTotal)}</h3>
        </div>
      );
      case 'vgvAnual': return (
        <div className="h-full bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl"><Icons.CalendarCheck size={24} className="text-blue-600 dark:text-blue-400" /></div>
              <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">{currentYear}</span>
            </div>
            <div className="text-slate-500 dark:text-gray-400 text-sm mb-1 flex items-center">VGV Anual (Fechados) <InfoTooltip text="Valor Geral da suas Vendas do ano atual." /></div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{leadsLoading ? <InlineLoading /> : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.vgvAnnual)}</h3>
        </div>
      );
      case 'portfolioVenda': return (
        <div className="h-full bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl"><Icons.Home size={24} className="text-emerald-600 dark:text-emerald-400" /></div>
            </div>
            <div className="text-slate-500 dark:text-gray-400 text-sm mb-1 flex items-center">Portfólio de Venda <InfoTooltip text="Imóveis ativos para venda." /></div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{propsLoading ? <InlineLoading /> : `${stats.salePortfolioCount} `}{!propsLoading && <span className="text-sm font-normal text-slate-400">Imóveis</span>}</h3>
        </div>
      );
      case 'portfolioAluguel': return (
        <div className="h-full bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl"><Icons.Building size={24} className="text-indigo-600 dark:text-indigo-400" /></div>
            </div>
            <div className="text-slate-500 dark:text-gray-400 text-sm mb-1 flex items-center">Portfólio de Aluguel <InfoTooltip text="Imóveis ativos para locação." /></div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{propsLoading ? <InlineLoading /> : `${stats.rentPortfolioCount} `}{!propsLoading && <span className="text-sm font-normal text-slate-400">Imóveis</span>}</h3>
        </div>
      );
      case 'funil': return (
        <div className="h-full bg-white dark:bg-dark-card p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">Funil de Vendas <InfoTooltip text="Conversão de leads." />{leadsLoading && <span className="ml-2"><InlineLoading /></span>}</h3>
          <div className="flex-1 h-[250px] w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
            {leadsLoading ? <div className="flex h-full items-center justify-center"><InlineLoading /></div> : (
              <div className="min-w-[400px] h-full">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart accessibilityLayer data={chartData} margin={{ top: 30, left: 0, right: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                    <ChartTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} content={<ChartTooltipContent hideLabel className="bg-white border-slate-100 shadow-xl rounded-xl" />} />
                    <Bar dataKey="visitors" radius={[6, 6, 0, 0]} maxBarSize={60}><LabelList dataKey="visitors" position="top" offset={10} className="fill-slate-700 dark:fill-white font-bold text-sm" /></Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </div>
        </div>
      );
      case 'agenda': return (
        <div className="h-full bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Minha Agenda</h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">Próximas</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar max-h-[300px]">
            {tasksLoading ? <div className="flex justify-center py-4"><Loading /></div> : tasks.length === 0 ? (
              <div className="text-center py-8 text-slate-400"><Icons.CheckCircle size={32} className="mx-auto mb-2 opacity-50" /><p>Tudo em dia!</p></div>
            ) : tasks.map((task) => (
              <div key={task.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-l-4 border-indigo-500">
                <p className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">{task.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-gray-400"><Icons.Calendar size={12} />{new Date(task.due_date).toLocaleDateString('pt-BR')} às {new Date(task.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        </div>
      );
      case 'financeiroAdmin': return (
        <div className="h-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-slate-400"><Icons.Trophy size={18} className="text-amber-500" /> <h3 className="font-bold text-slate-700 uppercase text-[10px] md:text-xs tracking-wider">Top Corretor (VGV)</h3></div>
                <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-1 md:mt-2 truncate" title={adminStats.topBroker.name}>{adminStats.topBroker.name}</p>
                <p className="text-xs md:text-sm font-bold text-amber-500 mt-1">{adminStats.topBroker.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="mt-4 md:mt-6 pt-4 border-t border-slate-100 flex justify-between items-end gap-2">
                <div className="min-w-0">
                   <p className="text-[10px] md:text-xs text-slate-400 uppercase font-bold truncate">Novos Leads Este Mês</p>
                   <p className="text-lg md:text-xl font-bold text-slate-700">{adminStats.leadsMes} leads</p>
                </div>
                <Icons.Users size={20} className="text-slate-300 shrink-0 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-slate-400"><Icons.Wallet size={18} className="text-emerald-500" /> <h3 className="font-bold text-slate-700 uppercase text-[10px] md:text-xs tracking-wider">Recebimentos do Mês</h3></div>
                <div className="flex flex-wrap items-end gap-2 mt-1 md:mt-2">
                  <p className="text-2xl md:text-3xl font-bold text-emerald-600 leading-none">{adminStats.recebidoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <span className="text-[9px] md:text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 md:py-1 rounded-full border border-emerald-100 uppercase tracking-wider">Na conta</span>
                </div>
                <p className="text-xs md:text-sm font-bold text-slate-500 mt-2">A receber: {adminStats.aReceberMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="mt-4 md:mt-6 pt-4 border-t border-slate-100 flex justify-between items-center gap-2">
                <div className="min-w-0">
                   <p className="text-[10px] md:text-xs text-red-400 uppercase font-bold truncate">Inadimplência Total</p>
                   <p className="text-base md:text-lg font-bold text-red-500 truncate">{adminStats.inadimplencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <Icons.AlertTriangle size={20} className="text-red-300 shrink-0 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>
      );
      case 'calendario': return (
        <div className="h-full bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border overflow-hidden shadow-sm">
          <DashboardCalendar />
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* HEADER E MODAL DE PERSONALIZAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Olá, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 dark:text-gray-400">Resumo de performance e resultados.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button onClick={() => setShowCustomizer(!showCustomizer)} className="flex items-center justify-center gap-2 bg-white dark:bg-dark-card px-4 py-3 sm:py-2 rounded-xl sm:rounded-lg border border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm font-bold text-sm w-full sm:w-auto">
            <Icons.Settings size={16} /> Personalizar Painel
          </button>
          <div className="hidden md:flex items-center gap-2 bg-white dark:bg-dark-card px-4 py-2 rounded-lg border border-slate-200 dark:border-dark-border shadow-sm">
            <Icons.Calendar size={18} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-gray-300">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {showCustomizer && (
          <div className="absolute top-full left-0 right-0 md:left-auto mt-2 w-full md:w-72 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl z-50 p-4 animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-white text-sm">Widgets Visíveis</h4>
              <button onClick={() => setShowCustomizer(false)} className="text-slate-400 hover:text-slate-700"><Icons.X size={16}/></button>
            </div>
            <div className="space-y-3">
              {WIDGET_CONFIG.map(widget => {
                if (widget.adminOnly && !isAdmin) return null;
                const isVisible = layout.find(w => w.id === widget.id)?.visible ?? false;
                return (
                  <label key={widget.id} className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-slate-600 dark:text-slate-300 font-medium group-hover:text-brand-600 transition-colors">{widget.label}</span>
                    <div className="relative inline-flex items-center">
                      <input type="checkbox" className="sr-only peer" checked={isVisible} onChange={() => toggleWidgetVisibility(widget.id)} />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* GRID DE WIDGETS INTELIGENTE (TETRIS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6" style={{ gridAutoFlow: 'dense' }}>
        {layout.filter(w => w.visible).map((w) => {
          const config = WIDGET_CONFIG.find(c => c.id === w.id);
          if (!config || (config.adminOnly && !isAdmin)) return null;

          return (
            <div
              key={w.id}
              className={`${config.size} relative group cursor-grab active:cursor-grabbing transition-transform duration-200`}
              draggable
              onDragStart={(e) => handleDragStart(e, w.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverWidget(w.id); }}
              onDragLeave={() => setDragOverWidget(null)}
              onDrop={(e) => handleDrop(e, w.id)}
            >
              {/* Indicador visual de arraste */}
              <div className={`h-full transition-all duration-300 ${dragOverWidget === w.id ? 'scale-[1.02] ring-4 ring-brand-500/50 rounded-2xl' : ''} ${draggedWidget === w.id ? 'opacity-40' : 'opacity-100'}`}>
                {/* Ícone para agarrar */}
                <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 p-1.5 bg-slate-100/80 dark:bg-slate-700/80 backdrop-blur-sm rounded-lg text-slate-400 hover:text-brand-500 transition-all cursor-grab shadow-sm">
                  <Icons.GripHorizontal size={16} />
                </div>
                
                {renderWidgetContent(w.id)}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default AdminDashboard;