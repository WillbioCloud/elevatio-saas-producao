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

const getDefaultLayout = (): DashboardLayoutItem[] => (
  WIDGET_CONFIG.map((widget) => ({ id: widget.id, visible: true }))
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

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const planConfig = getPlanConfig(user?.company?.plan);
  const canAccessFinance = planConfig.features.contractsAndFinance;
  const canAccessGamification = planConfig.features.gamification;
  const { leads, loading: leadsLoading } = useLeads();
  const { properties, loading: propsLoading } = useProperties();
  const userPlan = user?.company?.plan;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [userGamification, setUserGamification] = useState({ xp: 0, level: 1, rank: 0 });

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
  const [layout, setLayout] = useState<DashboardLayoutItem[]>(() => getDefaultLayout());

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [trialDaysLeft] = useState(0);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [trialTimeLeft, setTrialTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

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
    if (!user || user.role === 'super_admin' || userPlan !== 'free' || !trialExpiresAt) {
      setTrialTimeLeft(null);
      return;
    }

    const expireDate = new Date(trialExpiresAt);

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = expireDate.getTime() - now;

      if (difference <= 0) {
        setTrialTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }

      setTrialTimeLeft({
        d: Math.floor(difference / (1000 * 60 * 60 * 24)),
        h: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((difference % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const timer = window.setInterval(calculateTimeLeft, 1000);

    return () => window.clearInterval(timer);
  }, [user, userPlan, trialExpiresAt]);

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

      if (!user.company_id && isMounted) {
        setRecentActivities([]);
        setUserGamification({ xp: 0, level: 1, rank: 0 });
      }

      if (user.company_id && isMounted) {
        try {
          const { data: xpLogs, error: xpLogsError } = await supabase
            .from('xp_logs')
            .select('id, action, amount, created_at, profiles(name)')
            .eq('company_id', user.company_id)
            .order('created_at', { ascending: false })
            .limit(6);

          if (xpLogsError) throw xpLogsError;

          if (isMounted) {
            setRecentActivities((xpLogs as RecentActivity[]) || []);
          }

          const { data: profilesRank, error: profilesRankError } = await supabase
            .from('profiles')
            .select('id, xp, level')
            .eq('company_id', user.company_id)
            .order('xp', { ascending: false });

          if (profilesRankError) throw profilesRankError;

          if (profilesRank && isMounted) {
            const myIndex = profilesRank.findIndex((profile) => profile.id === user.id);
            const myData = profilesRank[myIndex];

            setUserGamification({
              xp: Number(myData?.xp || 0),
              level: Number(myData?.level || 1),
              rank: myIndex >= 0 ? myIndex + 1 : 0,
            });
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

    const fetchTrialStatus = async () => {
      try {
        // Puxa o company_id e também a data de criação da empresa como "Plano B"
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('company_id, companies(created_at)')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.company_id) {
          if (isMounted) {
            setContractStatus(null);
            setTrialExpiresAt(null);
          }
          return;
        }

        const { data: contract, error: contractError } = await supabase
          .from('saas_contracts')
          .select('status, created_at')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (contractError) {
          console.warn('Contrato não encontrado/indisponível. Aplicando fallback de trial:', contractError.message);
        }

        // Fallback: Se não houver contrato, assume que é um usuário novo no período de teste (pending)
        const currentStatus = contract?.status || 'pending';
        const startDate = contract?.created_at || (profile as any).companies?.created_at || new Date().toISOString();

        setContractStatus(currentStatus);

        if (currentStatus === 'pending') {
          const trialEnd = new Date(startDate);
          trialEnd.setDate(trialEnd.getDate() + 7);
          setTrialExpiresAt(trialEnd.toISOString());
          return;
        }

        setTrialExpiresAt(null);
      } catch (error) {
        console.error('Erro ao buscar status do contrato:', error);
        if (isMounted) {
          setContractStatus(null);
          setTrialExpiresAt(null);
        }
      }
    };

    fetchTrialStatus();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const myLeads = isAdmin ? leads : leads.filter((l: any) => l.assigned_to === user?.id);
    const myProperties = isAdmin ? properties : properties.filter((p) => p.agent_id === user?.id);

    const closedLeads = myLeads.filter((l) => l.funnel_step === 'venda_ganha' || l.status === 'Fechado');
    const vgvTotal = closedLeads.reduce((acc, lead) => acc + (lead.deal_value || 0), 0);

    const annualLeads = closedLeads.filter((l) => new Date(l.updated_at || new Date()).getFullYear() === currentYear);
    const vgvAnnual = annualLeads.reduce((acc, lead) => acc + (lead.deal_value || 0), 0);

    const salePortfolioCount = myProperties.filter((p) => p.listing_type === 'sale' && p.status === 'active').length;
    const rentPortfolioCount = myProperties.filter((p) => p.listing_type === 'rent' && p.status === 'active').length;

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

  const handleActivatePlan = () => {
    navigate('/admin/config');
  };

  const handleStartTour = () => {
    localStorage.setItem('trimoveis-product-tour-pending', 'true');
    localStorage.removeItem('trimoveis-product-tour-completed');
    window.dispatchEvent(new Event('trimoveis:start-product-tour'));
  };

  // --- CLASSES CSS PREMIUM COMPARTILHADAS ---
  const glassCardClasses = "h-full bg-white/80 dark:bg-[#0a0f1c]/80 p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none flex flex-col justify-between transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]";

  const renderWidgetContent = (id: string) => {
    switch(id) {
      case 'vgvTotal': return (
        <div className="h-full bg-gradient-to-br from-[#0c1445] via-[#0f2460] to-[#1a3a7a] p-6 rounded-3xl text-white shadow-[0_8px_30px_rgba(12,20,69,0.3)] flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-sky-400/20 blur-2xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl"><Icons.TrendingUp size={24} className="text-sky-300" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-sky-500/20 text-sky-300 px-3 py-1 rounded-full border border-sky-500/20">Histórico</span>
            </div>
            <div className="text-sky-100/70 text-sm mb-1 flex items-center font-medium">VGV Total <InfoTooltip text="Soma de todas as vendas fechadas." /></div>
          </div>
          <h3 className="text-3xl font-bold font-serif tracking-tight relative z-10">{leadsLoading ? <InlineLoading /> : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.vgvTotal)}</h3>
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
          <h3 className="text-3xl font-bold font-serif tracking-tight text-slate-800 dark:text-white">{leadsLoading ? <InlineLoading /> : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.vgvAnnual)}</h3>
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
          <h3 className="text-3xl font-bold font-serif tracking-tight text-slate-800 dark:text-white">{propsLoading ? <InlineLoading /> : `${stats.salePortfolioCount} `}{!propsLoading && <span className="text-base font-sans font-medium text-slate-400">Imóveis</span>}</h3>
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
          <h3 className="text-3xl font-bold font-serif tracking-tight text-slate-800 dark:text-white">{propsLoading ? <InlineLoading /> : `${stats.rentPortfolioCount} `}{!propsLoading && <span className="text-base font-sans font-medium text-slate-400">Imóveis</span>}</h3>
        </div>
      );
      case 'gamification-stats': return (
        <div className="h-full rounded-3xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm dark:border-slate-800 dark:from-brand-950/20 dark:to-slate-900">
          <h3 className="mb-6 flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <Icons.Trophy size={20} className="text-brand-500" />
            Meu Desempenho
          </h3>
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="relative mb-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-brand-500 bg-white text-3xl shadow-lg dark:border-brand-400 dark:bg-slate-800">
                {userGamification.level > 10 ? '👑' : userGamification.level > 5 ? '⭐' : '🚀'}
              </div>
              <div className="absolute -bottom-2 -right-2 rounded-full border-2 border-white bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:border-slate-800">
                Lvl {userGamification.level}
              </div>
            </div>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">{userGamification.xp} XP</h4>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Pontuação Total</p>

            <div className="mt-6 w-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
        <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-6 flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <Icons.Activity size={20} className="text-brand-500" />
            Feed da Equipe
          </h3>
          <div className="space-y-4">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Icons.Zap size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-white">{getRecentActivityName(act.profiles)}</span>{' '}
                    {act.action}
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
        <div className="h-full bg-white/80 dark:bg-[#0a0f1c]/80 p-4 md:p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none flex flex-col">
          <h3 className="text-lg font-bold font-serif text-slate-800 dark:text-white mb-4 flex items-center">Funil de Vendas <InfoTooltip text="Conversão de leads." />{leadsLoading && <span className="ml-2"><InlineLoading /></span>}</h3>
          <div className="flex-1 h-[250px] w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
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
        <div className="h-full bg-white/80 dark:bg-[#0a0f1c]/80 p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold font-serif text-slate-800 dark:text-white">Minha Agenda</h3>
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
          <div className="bg-white/80 dark:bg-[#0a0f1c]/80 p-5 md:p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none relative overflow-hidden flex flex-col transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
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
                <p className="text-2xl md:text-3xl font-bold font-serif text-slate-800 dark:text-white mt-1 md:mt-2 truncate" title={adminStats.topBroker.name}>{adminStats.topBroker.name}</p>
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
          <div className="bg-white/80 dark:bg-[#0a0f1c]/80 p-5 md:p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none relative overflow-hidden flex flex-col transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
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
                  <p className="text-2xl md:text-3xl font-bold font-serif text-emerald-600 dark:text-emerald-400 leading-none">{adminStats.recebidoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
      
      {/* HEADER E MODAL DE PERSONALIZAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-white tracking-tight">Olá, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Resumo de performance e resultados da sua imobiliária.</p>
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

      {userPlan === 'free' && trialTimeLeft && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm dark:border-amber-700/30 dark:from-amber-950/40 dark:to-orange-950/40">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl"></div>

          <div className="relative z-10 flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner dark:bg-amber-900/50 dark:text-amber-400">
                <Icons.Clock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-amber-50">
                  O seu período de teste está a terminar!
                </h3>
                <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-slate-600 dark:text-amber-200/80">
                  Aproveite as funcionalidades completas do Elevatio Vendas. Escolha um plano para não perder o acesso ao CRM, Site e Gestão Financeira.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-3 sm:items-end">
              <div className="flex items-center gap-2 font-mono">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-black text-amber-600 shadow-sm dark:bg-slate-900 dark:text-amber-400">{String(trialTimeLeft.d).padStart(2, '0')}</div>
                  <span className="mt-1 text-[10px] font-bold uppercase text-slate-500">Dias</span>
                </div>
                <span className="pb-4 text-xl font-black text-amber-600/50">:</span>
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-black text-amber-600 shadow-sm dark:bg-slate-900 dark:text-amber-400">{String(trialTimeLeft.h).padStart(2, '0')}</div>
                  <span className="mt-1 text-[10px] font-bold uppercase text-slate-500">Hrs</span>
                </div>
                <span className="pb-4 text-xl font-black text-amber-600/50">:</span>
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-black text-amber-600 shadow-sm dark:bg-slate-900 dark:text-amber-400">{String(trialTimeLeft.m).padStart(2, '0')}</div>
                  <span className="mt-1 text-[10px] font-bold uppercase text-slate-500">Min</span>
                </div>
                <span className="pb-4 text-xl font-black text-amber-600/50">:</span>
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-black text-red-500 shadow-sm dark:bg-slate-900 dark:text-red-400">{String(trialTimeLeft.s).padStart(2, '0')}</div>
                  <span className="mt-1 text-[10px] font-bold uppercase text-red-500/70">Seg</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/admin/config?tab=assinatura')}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-white shadow-lg transition-all hover:bg-amber-600 hover:shadow-amber-500/25 active:scale-95"
              >
                <Icons.CreditCard size={18} />
                <span>Escolher um Plano</span>
                <div className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {false && userPlan === 'free' && trialTimeLeft && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm dark:border-amber-700/30 dark:from-amber-950/40 dark:to-orange-950/40">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl"></div>
          <div className="relative z-10 flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner dark:bg-amber-900/50 dark:text-amber-400">
                <Icons.Clock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-amber-50">
                  O seu período de teste está a terminar!
                Você está no período de teste
              </h3>
              <h2 className="mt-1 text-lg font-bold text-white">
                {trialDaysLeft > 0
                  ? `Faltam ${trialDaysLeft} dias para o seu teste gratuito terminar.`
                  : 'O seu período de teste acabou hoje!'}
              </h2>
              <p className="mt-1 text-sm text-amber-100/90">Ative o plano definitivo para manter o acesso completo ao CRM sem interrupções.</p>
            </div>

            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleActivatePlan}
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-orange-700 shadow-lg shadow-orange-950/20 transition hover:bg-orange-50"
              >
                Ativar Plano Definitivo
              </button>
              <button
                type="button"
                onClick={handleStartTour}
                className="inline-flex items-center justify-center rounded-xl border border-amber-100/80 bg-orange-500/30 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-500/40"
              >
                Iniciar Tour
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6" style={{ gridAutoFlow: 'dense' }}>
        {layout.filter(w => w.visible).map((w) => {
          const config = WIDGET_CONFIG.find(c => c.id === w.id);
          if (!config || (config.adminOnly && !isAdmin)) return null;

          return (
            <div
              key={w.id}
              className={`${config.size} relative group cursor-pointer transition-transform duration-200`}
              draggable
              onDragStart={(e) => handleDragStart(e, w.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverWidget(w.id); }}
              onDragLeave={() => setDragOverWidget(null)}
              onDrop={(e) => handleDrop(e, w.id)}
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
  );
};

export default AdminDashboard;
