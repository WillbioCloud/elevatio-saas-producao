import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getPlanConfig } from '../config/plans';
import Loading from '../components/Loading';
import DashboardCalendar from '../components/DashboardCalendar';
import OnboardingChecklist from '../components/OnboardingChecklist';
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
        <button type="button" className="ml-2 flex cursor-pointer items-center justify-center focus:outline-none">
          <Icons.Info size={15} className="text-slate-400 transition-colors hover:text-brand-500" />
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

type DashboardLayoutItem = {
  id: string;
  visible: boolean;
};

type RecentActivity = {
  id: string;
  action?: string | null;
  amount?: number | null;
  created_at: string;
  profiles?: { name?: string | null } | Array<{ name?: string | null } | null> | null;
};

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

WIDGET_CONFIG.splice(4, 0,
  { id: 'gamification-stats', label: 'Meu Desempenho (Gamificação)', size: 'col-span-1 md:col-span-1 lg:col-span-1', adminOnly: false },
  { id: 'recent-activity', label: 'Feed da Equipe', size: 'col-span-1 md:col-span-1 lg:col-span-1', adminOnly: false },
);

// Define widgets prioritários para corretores/imobiliária
const DEFAULT_WIDGETS = [
  'vgvTotal',
  'vgvAnual',
  'portfolioVenda',
  'portfolioAluguel',
  'funil',
  'agenda',
  'gamification-stats',
  'recent-activity',
];

const getDefaultLayout = (): DashboardLayoutItem[] => (
  WIDGET_CONFIG.map((widget) => ({ id: widget.id, visible: DEFAULT_WIDGETS.includes(widget.id) }))
);

const syncLayoutWithConfig = (savedLayout?: DashboardLayoutItem[] | null): DashboardLayoutItem[] => {
  const defaultLayout = getDefaultLayout();

  if (!savedLayout?.length) {
    return defaultLayout;
  }

  const allowedIds = new Set(WIDGET_CONFIG.map((widget) => widget.id));
  const normalizedSaved = savedLayout.filter((item) => allowedIds.has(item.id));
  const missingItems = defaultLayout.filter(
    (item) => !normalizedSaved.some((savedItem) => savedItem.id === item.id),
  );

  return [...normalizedSaved, ...missingItems];
};

const getRecentActivityName = (profiles: RecentActivity['profiles']) => {
  if (Array.isArray(profiles)) {
    return profiles[0]?.name?.split(' ')[0] || 'Sistema';
  }

  return profiles?.name?.split(' ')[0] || 'Sistema';
};

const getRecentActivityTime = (createdAt: string) => {
  const diffHrs = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));

  if (diffHrs > 24) {
    return `Há ${Math.floor(diffHrs / 24)}d`;
  }

  if (diffHrs > 0) {
    return `Há ${diffHrs}h`;
  }

  return 'Agora';
};

const getRecentActivityActionLabel = (action?: string | null) => {
  if (action === 'deal_closed') return 'fechou um negócio';
  if (action === 'visit_done') return 'realizou uma visita';
  if (action === 'visit_scheduled') return 'agendou uma visita';
  if (action === 'proposal_sent') return 'enviou uma proposta';
  if (action === 'lead_qualified') return 'qualificou um lead';
  if (action?.includes('lost')) return 'perdeu um lead';

  return 'ganhou pontos';
};

const AdminDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const planConfig = getPlanConfig(user?.company?.plan);
  const canAccessFinance = planConfig.features.contractsAndFinance;
  const canAccessGamification = planConfig.features.gamification;
  const { leads, loading: leadsLoading } = useLeads();
  const { properties, loading: propsLoading } = useProperties();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [userGamification, setUserGamification] = useState({ xp: 0, level: 1, rank: 0 });

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
  const [layout, setLayout] = useState<DashboardLayoutItem[]>(() => getDefaultLayout());

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<'dashboard' | 'sidebar' | null>(null);
  const [contractStatus, setContractStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const storageKey = `dashboard_layout_${user.id}`;

    try {
      const savedLayout = localStorage.getItem(storageKey);
      const parsedLayout = savedLayout ? JSON.parse(savedLayout) as DashboardLayoutItem[] : null;
      const nextLayout = syncLayoutWithConfig(parsedLayout);

      setLayout(nextLayout);
      localStorage.setItem(storageKey, JSON.stringify(nextLayout));
    } catch (error) {
      console.warn('Layout do dashboard inválido. Resetando para o padrão.', error);
      const nextLayout = getDefaultLayout();
      setLayout(nextLayout);
      localStorage.setItem(storageKey, JSON.stringify(nextLayout));
    }
  }, [user?.id]);

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
          supabase.from('installments').select('*').eq('company_id', user.company_id),
          supabase.from('profiles').select('id, name').eq('company_id', user.company_id),
          supabase.from('leads').select('assigned_to, deal_value, created_at, funnel_step, status').eq('company_id', user.company_id)
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

      if (!user.company_id && isMounted) {
        setRecentActivities([]);
        setUserGamification({ xp: 0, level: 1, rank: 0 });
      }

      if (user.company_id && isMounted) {
        try {
          const { data: profilesRank, error: profilesRankError } = await supabase
            .from('profiles')
            .select('id, xp_points, level')
            .eq('company_id', user.company_id)
            .order('xp_points', { ascending: false });

          if (profilesRankError) throw profilesRankError;

          const profileIds = (profilesRank || []).map((profile) => profile.id);
          let recentEvents: RecentActivity[] = [];

          if (profileIds.length > 0) {
            const { data: eventsData, error: eventsError } = await supabase
              .from('gamification_events')
              .select(`
                id,
                action:action_type,
                amount:points_awarded,
                created_at,
                profiles(name)
              `)
              .in('user_id', profileIds)
              .order('created_at', { ascending: false })
              .limit(6);

            if (eventsError) throw eventsError;
            recentEvents = (eventsData as RecentActivity[]) || [];
          }

          if (profilesRank && isMounted) {
            const myIndex = profilesRank.findIndex((profile) => profile.id === user.id);
            const myData = profilesRank[myIndex];

            setUserGamification({
              xp: Number(myData?.xp_points || 0),
              level: Number(myData?.level || 1),
              rank: myIndex >= 0 ? myIndex + 1 : 0,
            });
          }

          if (isMounted) {
            setRecentActivities(recentEvents);
          }
        } catch (error) {
          console.error('Erro ao buscar dados de gamificação:', error);

          if (isMounted) {
            setRecentActivities([]);
            setUserGamification({ xp: 0, level: 1, rank: 0 });
          }
        }
      }
    };

    initDashboard();

    return () => {
      isMounted = false;
    };
  }, [user?.id, isAdmin]); // DEPENDÊNCIAS BLINDADAS

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const fetchContractStatus = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.company_id) {
          if (isMounted) {
            setContractStatus(null);
          }
          return;
        }

        const { data: contractData, error: contractError } = await supabase
          .from('saas_contracts')
          .select('status')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (contractError) {
          console.warn('Contrato não encontrado/indisponível. Usando status pendente:', contractError.message);
        }

        setContractStatus(contractData?.status || 'pending');
      } catch (error) {
        console.error('Erro ao buscar status do contrato:', error);
        if (isMounted) {
          setContractStatus(null);
        }
      }
    };

    fetchContractStatus();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const myLeads = isAdmin ? leads : leads.filter((l: any) => l.assigned_to === user?.id);
    const myProperties = isAdmin ? properties : properties.filter((p) => p.agent_id === user?.id);

    // Normaliza status e converte valores numéricos com segurança
    const closedLeads = myLeads.filter((l) => {
      const step = (l.funnel_step || '').toLowerCase();
      const status = (l.status || '').toLowerCase();
      return step === 'venda_ganha' || step === 'ganho' || status === 'fechado' || status === 'ganho';
    });

    const vgvTotal = closedLeads.reduce((acc, lead) => acc + (Number(lead.deal_value) || 0), 0);

    const annualLeads = closedLeads.filter((l) => {
      const dateStr = l.updated_at || l.created_at || new Date().toISOString();
      return new Date(dateStr).getFullYear() === currentYear;
    });
    const vgvAnnual = annualLeads.reduce((acc, lead) => acc + (Number(lead.deal_value) || 0), 0);

    // Normaliza os tipos de listagem (venda/locação) e status do imóvel
    const salePortfolioCount = myProperties.filter((p) => {
      const type = (p.listing_type || p.transaction_type || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const isActive = status === 'active' || status === 'ativo' || status === 'disponível' || status === 'disponivel';
      return (type === 'sale' || type === 'venda') && isActive;
    }).length;

    const rentPortfolioCount = myProperties.filter((p) => {
      const type = (p.listing_type || p.transaction_type || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const isActive = status === 'active' || status === 'ativo' || status === 'disponível' || status === 'disponivel';
      return (type === 'rent' || type === 'locação' || type === 'locacao' || type === 'aluguel') && isActive;
    }).length;

    const funnel = {
      pre_atendimento: myLeads.filter((l) => (l.funnel_step || '').toLowerCase().includes('pre')).length,
      atendimento: myLeads.filter((l) => {
        const step = (l.funnel_step || '').toLowerCase();
        return step === 'atendimento' || step === 'novo' || !step;
      }).length,
      proposta: myLeads.filter((l) => (l.funnel_step || '').toLowerCase().includes('proposta')).length,
      venda_ganha: closedLeads.length,
      perdido: myLeads.filter((l) => {
        const step = (l.funnel_step || '').toLowerCase();
        const status = (l.status || '').toLowerCase();
        return step === 'perdido' || status === 'perdido';
      }).length,
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

  const handleDragStart = (e: React.DragEvent, id: string, source: 'dashboard' | 'sidebar') => {
    setDraggedWidget(id);
    setDragSource(source);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetArea: 'dashboard' | 'sidebar') => {
    e.preventDefault();
    setDragOverWidget(null);
    if (!draggedWidget || draggedWidget === targetId) {
      setDraggedWidget(null);
      setDragSource(null);
      return;
    }

    setLayout(prev => {
      let newLayout = [...prev];
      const draggedIdx = newLayout.findIndex(w => w.id === draggedWidget);
      const targetIdx = newLayout.findIndex(w => w.id === targetId);

      // Drag de sidebar para dashboard: adicionar widget na posição
      if (dragSource === 'sidebar' && targetArea === 'dashboard') {
        if (draggedIdx === -1) {
          // Adiciona widget na posição do drop
          newLayout.splice(targetIdx, 0, { id: draggedWidget, visible: true });
        } else {
          // Já existe, só reordena e garante visível
          const [movedItem] = newLayout.splice(draggedIdx, 1);
          newLayout.splice(targetIdx, 0, { ...movedItem, visible: true });
        }
      }
      // Drag de dashboard para sidebar: oculta widget
      else if (dragSource === 'dashboard' && targetArea === 'sidebar') {
        if (draggedIdx !== -1) {
          newLayout[draggedIdx] = { ...newLayout[draggedIdx], visible: false };
        }
      }
      // Drag dentro do dashboard: reordena
      else if (dragSource === 'dashboard' && targetArea === 'dashboard') {
        if (draggedIdx !== -1) {
          const [movedItem] = newLayout.splice(draggedIdx, 1);
          newLayout.splice(targetIdx, 0, movedItem);
        }
      }
      localStorage.setItem(`dashboard_layout_${user?.id}`, JSON.stringify(newLayout));
      return newLayout;
    });
    setDraggedWidget(null);
    setDragSource(null);
  };

  const handleActivatePlan = () => {
    navigate('/admin/config');
  };

  // --- CLASSES CSS PREMIUM COMPARTILHADAS ---
  const glassCardClasses = "h-full bg-white/80 dark:bg-[#0a0f1c]/80 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col justify-between transition-all hover:shadow-md";

  const renderWidgetContent = (id: string) => {
    switch(id) {
      case 'vgvTotal': return (
        <div className="h-full bg-gradient-to-br from-[#0c1445] via-[#0f2460] to-[#1a3a7a] p-4 md:p-5 rounded-2xl md:rounded-3xl text-white shadow-[0_8px_30px_rgba(12,20,69,0.3)] flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-sky-400/20 blur-2xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl"><Icons.TrendingUp size={24} className="text-sky-300" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-sky-500/20 text-sky-300 px-3 py-1 rounded-full border border-sky-500/20">Histórico</span>
            </div>
            <div className="text-sky-100/70 text-sm mb-1 flex items-center font-medium">VGV Total <InfoTooltip text="Soma de todas as vendas fechadas." /></div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold font-serif tracking-tight relative z-10">{leadsLoading ? <InlineLoading /> : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.vgvTotal)}</h3>
        </div>
      );
      case 'vgvAnual': return (
        <div className={glassCardClasses}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-500/10 rounded-2xl"><Icons.CalendarCheck size={24} className="text-sky-600 dark:text-sky-400" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full">{currentYear}</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm mb-1 flex items-center font-medium">VGV Anual <InfoTooltip text="Valor Geral de Vendas do ano atual." /></div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-slate-800 dark:text-white">{leadsLoading ? <InlineLoading /> : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.vgvAnnual)}</h3>
        </div>
      );
      case 'portfolioVenda': return (
        <div className={glassCardClasses}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl"><Icons.Home size={24} className="text-emerald-600 dark:text-emerald-400" /></div>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm mb-1 flex items-center font-medium">Portfólio de Venda <InfoTooltip text="Imóveis ativos para venda." /></div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-slate-800 dark:text-white">{propsLoading ? <InlineLoading /> : `${stats.salePortfolioCount} `}{!propsLoading && <span className="text-base font-sans font-medium text-slate-400">Imóveis</span>}</h3>
        </div>
      );
      case 'portfolioAluguel': return (
        <div className={glassCardClasses}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl"><Icons.Building size={24} className="text-indigo-600 dark:text-indigo-400" /></div>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm mb-1 flex items-center font-medium">Portfólio de Aluguel <InfoTooltip text="Imóveis ativos para locação." /></div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-slate-800 dark:text-white">{propsLoading ? <InlineLoading /> : `${stats.rentPortfolioCount} `}{!propsLoading && <span className="text-base font-sans font-medium text-slate-400">Imóveis</span>}</h3>
        </div>
      );
      case 'gamification-stats': return (
        <div className="h-5/6 rounded-2xl md:rounded-3xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-3 md:p-4 shadow-sm dark:border-slate-800 dark:from-brand-950/20 dark:to-slate-900">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <Icons.Trophy size={20} className="text-brand-500" />
            Meu Desempenho
          </h3>
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="relative mb-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-brand-500 bg-white text-2xl shadow-lg dark:border-brand-400 dark:bg-slate-800">
                {userGamification.level > 10 ? '👑' : userGamification.level > 5 ? '⭐' : '🚀'}
              </div>
              <div className="absolute -bottom-2 -right-2 rounded-full border-2 border-white bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:border-slate-800">
                Lvl {userGamification.level}
              </div>
            </div>
            <h4 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">{userGamification.xp} XP</h4>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Pontuação Total</p>

            <div className="mt-4 w-full rounded-2xl border border-slate-100 bg-white p-3 md:p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Meu Ranking Geral</span>
                <span className="text-lg font-black text-brand-600 dark:text-brand-400">
                  {userGamification.rank > 0 ? `${userGamification.rank}º Lugar` : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
      case 'recent-activity': return (
        <div className="h-5/6 rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <Icons.Activity size={20} className="text-brand-500" />
            Feed da Equipe
          </h3>
          <div className="space-y-3">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Icons.Zap size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-white">{getRecentActivityName(act.profiles)}</span>{' '}
                    {getRecentActivityActionLabel(act.action)}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-400">{getRecentActivityTime(act.created_at)}</span>
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">+{act.amount ?? 0} XP</span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivities.length === 0 && (
              <p className="text-center text-sm text-slate-500">Nenhuma atividade recente.</p>
            )}
          </div>
        </div>
      );
      case 'funil': return (
        <div className="h-5/6 bg-white/80 dark:bg-[#0a0f1c]/80 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none flex flex-col">
          <h3 className="text-sm md:text-base font-bold font-serif text-slate-800 dark:text-white mb-3 flex items-center">Funil de Vendas <InfoTooltip text="Conversão de leads." />{leadsLoading && <span className="ml-2"><InlineLoading /></span>}</h3>
          <div className="flex-1 h-[170px] md:h-[210px] w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-1">
            {leadsLoading ? <div className="flex h-full items-center justify-center"><InlineLoading /></div> : (
              <div className="min-w-[400px] h-full">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart accessibilityLayer data={chartData} margin={{ top: 30, left: 0, right: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/5" />
                    <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                    <ChartTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} content={<ChartTooltipContent hideLabel className="bg-[#0c1445] text-white border-white/10 shadow-2xl rounded-xl" />} />
                    <Bar dataKey="visitors" radius={[6, 6, 0, 0]} maxBarSize={60}><LabelList dataKey="visitors" position="top" offset={10} className="fill-slate-700 dark:fill-slate-300 font-bold text-sm" /></Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </div>
        </div>
      );
      case 'agenda': return (
        <div className="h-full bg-white/80 dark:bg-[#0a0f1c]/80 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base md:text-lg font-bold font-serif text-slate-800 dark:text-white">Minha Agenda</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full">Próximas</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar max-h-[300px] pr-2">
            {tasksLoading ? <div className="flex justify-center py-4"><Loading /></div> : tasks.length === 0 ? (
              <div className="text-center py-8 text-slate-400"><Icons.CheckCircle size={32} className="mx-auto mb-2 opacity-30" /><p className="font-medium text-sm">Tudo em dia!</p></div>
            ) : tasks.map((task) => (
              <div key={task.id} className="p-4 bg-slate-50/50 dark:bg-white/[0.02] rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <p className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">{task.title}</p>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400"><Icons.Calendar size={14} className="text-brand-500" />{new Date(task.due_date).toLocaleDateString('pt-BR')} às {new Date(task.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        </div>
      );
      case 'financeiroAdmin': return (
        <div className="h-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white/80 dark:bg-[#0a0f1c]/80 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none relative overflow-hidden flex flex-col transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            {!canAccessGamification && (
              <div className="absolute inset-0 bg-white/60 dark:bg-[#0a0f1c]/60 z-20 flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-[#0c1445] border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-300 mb-3 md:mb-4 shadow-xl">
                  <Icons.Lock size={24} className="md:w-8 md:h-8" />
                </div>
                <h3 className="text-base md:text-lg font-bold font-serif text-slate-800 dark:text-white mb-2">Gamificação</h3>
              </div>
            )}

            <div className={!canAccessGamification ? 'opacity-30 pointer-events-none select-none flex-1 flex flex-col justify-between' : 'flex-1 flex flex-col justify-between'}>
              <div>
                <div className="flex items-center gap-2 mb-3 text-slate-400 dark:text-slate-500"><Icons.Trophy size={18} className="text-amber-500" /> <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] md:text-xs tracking-widest">Top Corretor (VGV)</h3></div>
                <p className="text-xl md:text-2xl font-bold font-serif text-slate-800 dark:text-white mt-1 md:mt-2 truncate" title={adminStats.topBroker.name}>{adminStats.topBroker.name}</p>
                <p className="text-xs md:text-sm font-bold text-amber-500 mt-1">{adminStats.topBroker.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="mt-4 md:mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-end gap-2">
                <div className="min-w-0">
                   <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 uppercase font-bold truncate tracking-wider">Novos Leads Mês</p>
                   <p className="text-lg md:text-xl font-bold font-serif text-slate-700 dark:text-slate-200 mt-1">{adminStats.leadsMes} leads</p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl">
                  <Icons.Users size={20} className="text-slate-400 dark:text-slate-300 shrink-0 md:w-5 md:h-5" />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-[#0a0f1c]/80 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none relative overflow-hidden flex flex-col transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            {!canAccessFinance && (
              <div className="absolute inset-0 bg-white/60 dark:bg-[#0a0f1c]/60 z-20 flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-[#0c1445] border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-300 mb-3 md:mb-4 shadow-xl">
                  <Icons.Lock size={24} className="md:w-8 md:h-8" />
                </div>
                <h3 className="text-base md:text-lg font-bold font-serif text-slate-800 dark:text-white mb-2">Financeiro</h3>
              </div>
            )}

            <div className={!canAccessFinance ? 'opacity-30 pointer-events-none select-none flex-1 flex flex-col justify-between' : 'flex-1 flex flex-col justify-between'}>
              <div>
                <div className="flex items-center gap-2 mb-3 text-slate-400 dark:text-slate-500"><Icons.Wallet size={18} className="text-emerald-500" /> <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] md:text-xs tracking-widest">Recebimentos Mês</h3></div>
                <div className="flex flex-wrap items-end gap-2 mt-1 md:mt-2">
                  <p className="text-xl md:text-2xl font-bold font-serif text-emerald-600 dark:text-emerald-400 leading-none">{adminStats.recebidoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">A receber: {adminStats.aReceberMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="mt-4 md:mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center gap-2">
                <div className="min-w-0">
                   <p className="text-[10px] md:text-xs text-rose-400 uppercase font-bold truncate tracking-widest">Inadimplência</p>
                   <p className="text-base md:text-lg font-bold font-serif text-rose-500 truncate mt-1">{adminStats.inadimplencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl">
                  <Icons.AlertTriangle size={20} className="text-rose-400 shrink-0 md:w-5 md:h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
      case 'calendario': return (
        <div className="h-full bg-white/80 dark:bg-[#0a0f1c]/80 rounded-3xl border border-slate-200/60 dark:border-white/5 overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none">
          <DashboardCalendar />
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* HEADER E PAINEL DE WIDGETS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-white tracking-tight">Olá, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Resumo de performance e resultados da sua imobiliária.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button onClick={() => setShowCustomizer(true)} className="flex items-center justify-center gap-2 bg-white dark:bg-dark-card px-4 py-3 sm:py-2 rounded-xl sm:rounded-lg border border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm font-bold text-sm w-full sm:w-auto">
            <Icons.Plus size={16} /> Adicionar widget
          </button>
          <div className="hidden md:flex items-center gap-2 bg-white dark:bg-dark-card px-4 py-2 rounded-lg border border-slate-200 dark:border-dark-border shadow-sm">
            <Icons.Calendar size={18} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-gray-300">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* PAINEL LATERAL FLUTUANTE PREMIUM */}
        {showCustomizer && (
          <div className="fixed top-2 right-2 bottom-2 z-50 w-full max-w-xs sm:max-w-sm md:max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-4 animate-fade-in" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800 dark:text-white text-base">Widgets disponíveis</h4>
              <button onClick={() => setShowCustomizer(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><Icons.X size={18}/></button>
            </div>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {WIDGET_CONFIG.map(widget => {
                if (widget.adminOnly && !isAdmin) return null;
                const isVisible = layout.find(w => w.id === widget.id)?.visible ?? false;
                if (isVisible) return null; // Só mostra widgets ocultos
                return (
                  <div
                    key={widget.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-3 bg-slate-50/60 dark:bg-white/5 cursor-grab"
                    draggable
                    onDragStart={e => handleDragStart(e, widget.id, 'sidebar')}
                    onDragOver={e => { e.preventDefault(); setDragOverWidget(widget.id); }}
                    onDrop={e => handleDrop(e, widget.id, 'sidebar')}
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800">
                      {widget.id === 'vgvTotal' && <Icons.TrendingUp size={22} className="text-sky-400" />}
                      {widget.id === 'vgvAnual' && <Icons.CalendarCheck size={22} className="text-sky-600 dark:text-sky-400" />}
                      {widget.id === 'portfolioVenda' && <Icons.Home size={22} className="text-emerald-600 dark:text-emerald-400" />}
                      {widget.id === 'portfolioAluguel' && <Icons.Building size={22} className="text-indigo-600 dark:text-indigo-400" />}
                      {widget.id === 'funil' && <Icons.BarChart2 size={22} className="text-fuchsia-500" />}
                      {widget.id === 'agenda' && <Icons.Calendar size={22} className="text-cyan-500" />}
                      {widget.id === 'financeiroAdmin' && <Icons.Wallet size={22} className="text-emerald-500" />}
                      {widget.id === 'calendario' && <Icons.Calendar size={22} className="text-slate-500" />}
                      {widget.id === 'gamification-stats' && <Icons.Trophy size={22} className="text-amber-500" />}
                      {widget.id === 'recent-activity' && <Icons.Activity size={22} className="text-brand-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-700 dark:text-white text-sm truncate">{widget.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {widget.id === 'vgvTotal' && 'Soma de todas as vendas fechadas.'}
                        {widget.id === 'vgvAnual' && 'VGV do ano atual.'}
                        {widget.id === 'portfolioVenda' && 'Imóveis ativos para venda.'}
                        {widget.id === 'portfolioAluguel' && 'Imóveis ativos para locação.'}
                        {widget.id === 'funil' && 'Conversão de leads.'}
                        {widget.id === 'agenda' && 'Suas tarefas e compromissos.'}
                        {widget.id === 'financeiroAdmin' && 'Recebimentos, leads e top corretor.'}
                        {widget.id === 'calendario' && 'Campanhas e eventos.'}
                        {widget.id === 'gamification-stats' && 'Seu desempenho na gamificação.'}
                        {widget.id === 'recent-activity' && 'Atividades recentes da equipe.'}
                      </div>
                    </div>
                    <span className="ml-2 px-3 py-1 rounded-lg font-bold text-xs bg-brand-500 text-white">Arraste para adicionar</span>
                  </div>
                );
              })}
              {/* Área de drop para remover widgets da dashboard */}
              <div
                className="mt-6 flex items-center justify-center h-16 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 text-xs font-bold"
                onDragOver={e => { e.preventDefault(); setDragOverWidget('sidebar-drop'); }}
                onDrop={e => handleDrop(e, 'sidebar-drop', 'sidebar')}
              >
                Arraste aqui para remover widget
              </div>
            </div>
          </div>
        )}
      </div>

      <OnboardingChecklist />

      {(contractStatus === 'expired' || contractStatus === 'canceled') && (
        <div className="relative overflow-hidden rounded-2xl border border-red-400/60 bg-red-900/90 p-5 shadow-xl shadow-red-950/30">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.2),transparent_45%)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-200">
                <Icons.AlertCircle size={16} className="text-red-200" />
                Assinatura Inativa
              </p>
              <h2 className="mt-1 text-lg font-bold text-white">Assinatura Inativa</h2>
              <p className="mt-1 text-sm text-red-100">A sua assinatura expirou ou foi cancelada. Regularize o seu plano para continuar a usar o CRM.</p>
            </div>

            <button
              type="button"
              onClick={handleActivatePlan}
              className="inline-flex items-center justify-center rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400"
            >
              Regularizar Pagamento
            </button>
          </div>
        </div>
      )}

      {/* GRID DE WIDGETS INTELIGENTE (TETRIS) */}
      <div className="mt-4 md:mt-6 rounded-[28px] border border-slate-200/70 bg-slate-100/80 p-3 md:p-4 lg:p-5 dark:border-white/5 dark:bg-[#060b16]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6" style={{ gridAutoFlow: 'dense' }}>
        {layout.filter(w => w.visible).map((w) => {
          const config = WIDGET_CONFIG.find(c => c.id === w.id);
          if (!config || (config.adminOnly && !isAdmin)) return null;

          return (
            <div
              key={w.id}
              className={`${config.size} relative group cursor-pointer transition-transform duration-200`}
              draggable
              onDragStart={(e) => handleDragStart(e, w.id, 'dashboard')}
              onDragOver={(e) => { e.preventDefault(); setDragOverWidget(w.id); }}
              onDragLeave={() => setDragOverWidget(null)}
              onDrop={(e) => handleDrop(e, w.id, 'dashboard')}
            >
              {/* Indicador visual de arraste */}
              <div className={`h-full transition-all duration-300 ${dragOverWidget === w.id ? 'scale-[1.02] ring-4 ring-brand-500/50 rounded-2xl' : ''} ${draggedWidget === w.id ? 'opacity-40' : 'opacity-100'}`}>
                {/* Ícone para agarrar */}
                <div className="absolute top-4 right-4 z-20 cursor-pointer rounded-lg bg-slate-100/80 p-1.5 text-slate-400 opacity-0 shadow-sm transition-all hover:text-brand-500 group-hover:opacity-100 dark:bg-slate-700/80">
                  <Icons.GripHorizontal size={16} />
                </div>
                {renderWidgetContent(w.id)}
              </div>
            </div>
          );
        })}
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
