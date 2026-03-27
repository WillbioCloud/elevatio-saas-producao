import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from '../components/Icons';
import { cn } from '../lib/utils';

type Period = 'week' | 'month' | 'quarter';
type Metric = 'score' | 'revenue' | 'deals' | 'conversion';

type Badge = { id: string; icon: string; label: string; description: string };

type BadgeShowcase = Badge & {
  agentName: string;
  agentColor: string;
  agentInitials: string;
};

type RealAgent = {
  id: string;
  name: string;
  role: string;
  initials: string;
  avatar: string;
  score: number;
  totalXp: number;
  revenue: number;
  deals: number;
  totalLeads: number;
  conversion: number;
  level: number;
  levelTitle: string;
  color: string;
  weeklyData: number[];
  badges: Badge[];
  rankChange: number;
  streak: number;
};

type RealActivity = {
  id: string;
  agentId?: string;
  agentName: string;
  agentInitials: string;
  agentColor: string;
  action: string;
  value: string;
  time: string;
  icon: string;
};

const METRIC_LABELS: Record<Metric, string> = {
  score: 'XP',
  revenue: 'Receita',
  deals: 'Negócios',
  conversion: 'Conversão',
};

const PERIOD_LABELS: Record<Period, string> = {
  week: 'esta semana',
  month: 'este mês',
  quarter: 'este trimestre',
};

const PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];
const LEVELS = ['Iniciante', 'Bronze', 'Prata', 'Ouro', 'Diamante', 'Lenda', 'Mestre'];

const rankStyles = [
  {
    card: 'border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:border-amber-700/50 dark:from-amber-900/20 dark:to-orange-900/20',
    medal: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white',
    ring: 'ring-4 ring-amber-300 ring-offset-2 ring-offset-white dark:ring-offset-slate-950',
    number: 'text-amber-600 dark:text-amber-400',
  },
  {
    card: 'border-slate-200 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:border-slate-700 dark:from-slate-800/60 dark:to-slate-900',
    medal: 'bg-gradient-to-br from-slate-400 to-gray-500 text-white',
    ring: 'ring-4 ring-slate-300 ring-offset-2 ring-offset-white dark:ring-offset-slate-950',
    number: 'text-slate-600 dark:text-slate-300',
  },
  {
    card: 'border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:border-orange-800/40 dark:from-orange-900/20 dark:to-amber-900/10',
    medal: 'bg-gradient-to-br from-orange-400 to-amber-500 text-white',
    ring: 'ring-4 ring-orange-300 ring-offset-2 ring-offset-white dark:ring-offset-slate-950',
    number: 'text-orange-600 dark:text-orange-400',
  },
];

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function getPeriodStart(period: Period) {
  const date = new Date();
  date.setDate(date.getDate() - (period === 'week' ? 7 : period === 'month' ? 30 : 90));
  return date;
}

function getLevelTitle(level: number, explicit?: string | null) {
  if (explicit) return explicit;
  return LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))] ?? 'Equipe';
}

function getRawValue(agent: RealAgent, metric: Metric) {
  if (metric === 'score') return agent.score;
  if (metric === 'revenue') return agent.revenue;
  if (metric === 'deals') return agent.deals;
  if (metric === 'conversion') return agent.conversion;
  return 0;
}

function formatCurrencyCompact(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatValue(agent: RealAgent, metric: Metric) {
  if (metric === 'score') return `${agent.score.toLocaleString('pt-BR')} pts`;
  if (metric === 'revenue') return formatCurrencyCompact(agent.revenue);
  if (metric === 'deals') return `${agent.deals} neg.`;
  if (metric === 'conversion') return `${agent.conversion}%`;
  return '';
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

function getEventPoints(type?: string | null) {
  const map: Record<string, number> = { status_change: 150, note: 30, call: 50, call_log: 50, whatsapp: 40, visit: 80, system: 20 };
  return map[type ?? ''] ?? 35;
}

function getEventAction(type?: string | null, description?: string | null) {
  const text = description ?? '';
  if (text.includes('VENDA FECHADA') || text.includes('Venda Fechada') || text.includes('venda_ganha')) return 'fechou negócio';
  if (type === 'note') return 'registrou uma nota';
  if (type === 'call' || type === 'call_log') return 'realizou uma ligação';
  if (type === 'whatsapp') return 'enviou um WhatsApp';
  if (type === 'status_change') return 'atualizou uma etapa';
  return 'teve uma nova atividade';
}

function isClosedLead(lead: any) {
  return lead?.funnel_step === 'venda_ganha' || lead?.status === 'Fechado' || lead?.status === 'Venda Fechada' || lead?.status === 'Venda Ganha';
}

function extractBadges(relations: any[] | null | undefined): Badge[] {
  return (relations || []).flatMap((relation) => {
    const badge = relation?.badges;
    if (!badge) return [];
    return Array.isArray(badge) ? badge : [badge];
  }).filter(Boolean);
}

function buildWeeklyData(events: any[], agentId: string) {
  const data = new Array(8).fill(0);
  const now = Date.now();
  for (const event of events) {
    if (event?.created_by !== agentId || !event?.created_at) continue;
    const diffDays = Math.floor((now - new Date(event.created_at).getTime()) / 86400000);
    if (diffDays < 0 || diffDays > 55) continue;
    const index = 7 - Math.min(Math.floor(diffDays / 7), 7);
    data[index] += getEventPoints(event.type);
  }
  return data;
}

function computeStreak(weeklyData: number[]) {
  let streak = 0;
  for (let index = weeklyData.length - 1; index >= 0; index -= 1) {
    if (weeklyData[index] > 0) streak += 1;
    else break;
  }
  return streak;
}

function computeRankChange(weeklyData: number[]) {
  const recent = weeklyData.slice(-2).reduce((sum, value) => sum + value, 0);
  const previous = weeklyData.slice(-4, -2).reduce((sum, value) => sum + value, 0);
  const diff = recent - previous;
  if (Math.abs(diff) < 20) return 0;
  if (diff > 120) return 2;
  if (diff > 0) return 1;
  if (diff < -120) return -2;
  return -1;
}

function getPeriodScore(totalXp: number, weeklyData: number[], period: Period) {
  const week = weeklyData.at(-1) ?? 0;
  const month = weeklyData.slice(-4).reduce((sum, value) => sum + value, 0);
  if (period === 'week') return week > 0 ? week : Math.round(totalXp * 0.15);
  if (period === 'month') return month > 0 ? month : Math.round(totalXp * 0.55);
  return totalXp;
}

function mergeBadges(primary: Badge[], secondary: Badge[]) {
  const map = new Map<string, Badge>();
  [...primary, ...secondary].forEach((badge) => badge?.id && map.set(badge.id, badge));
  return [...map.values()];
}

function computeAutoBadges(agent: RealAgent): Badge[] {
  const badges: Badge[] = [];
  if (agent.deals >= 8) badges.push({ id: 'top-closer', label: 'Top Closer', icon: '🏆', description: 'Fechou 8 ou mais negócios.' });
  if (agent.conversion >= 60) badges.push({ id: 'conv-king', label: 'Conversão Alta', icon: '🎯', description: 'Passou de 60% de conversão.' });
  if (agent.revenue >= 1_000_000) badges.push({ id: 'rev-master', label: 'Receita Forte', icon: '💰', description: 'Ultrapassou R$ 1M em receita.' });
  if (agent.totalLeads >= 20) badges.push({ id: 'lead-magnet', label: 'Lead Magnet', icon: '🧲', description: 'Atendeu 20 ou mais leads.' });
  if (agent.streak >= 3) badges.push({ id: 'streak', label: 'Em Chamas', icon: '🔥', description: 'Manteve 3 semanas seguidas com atividade.' });
  if (agent.totalXp >= 5000) badges.push({ id: 'xp-master', label: 'XP Master', icon: '⭐', description: 'Ultrapassou 5.000 de XP.' });
  return badges;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800', className)} />;
}

function MiniSparkline({ scores, color }: { scores: number[]; color: string }) {
  const max = Math.max(...scores, 1);
  const min = Math.min(...scores);
  const range = max - min || 1;
  const points = scores.map((value, index) => {
    const x = (index / Math.max(scores.length - 1, 1)) * 92;
    const y = 34 - ((value - min) / range) * 28 - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={92} height={34} viewBox="0 0 92 34" className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <polygon points={`0,34 ${points.join(' ')} 92,34`} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RankChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span className="text-xs font-medium text-slate-400">—</span>;
  if (change > 0) return <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><Icons.ChevronUp size={12} />+{change}</span>;
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-rose-500"><Icons.ChevronDown size={12} />{change}</span>;
}

function PodiumCard({ agent, position, metric, onClick }: { agent: RealAgent; position: 0 | 1 | 2; metric: Metric; onClick: () => void }) {
  const style = rankStyles[position];
  const sizes = ['h-24 w-24', 'h-20 w-20', 'h-20 w-20'];
  const heights = ['h-40', 'h-32', 'h-28'];
  return (
    <button type="button" onClick={onClick} className={cn('group flex flex-col items-center gap-3 text-center transition-transform hover:-translate-y-1', position === 0 ? '' : 'md:mt-10')}>
      {position === 0 && <div className="text-2xl">👑</div>}
      <div className="relative">
        <img src={agent.avatar} alt={agent.name} className={cn('rounded-full object-cover shadow-lg', sizes[position], style.ring)} />
        <div className={cn('absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black shadow-md', style.medal)}>
          {position + 1}
        </div>
        {agent.streak >= 3 && <div className="absolute -top-1 -right-1 text-base">🔥</div>}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{agent.name.split(' ')[0]}</p>
        <p className="mt-0.5 text-xs text-slate-400">{agent.levelTitle}</p>
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">{formatValue(agent, metric)}</p>
        <p className="text-xs font-medium text-slate-400">{METRIC_LABELS[metric]}</p>
      </div>
      <div className="flex items-center gap-3 text-center">
        <div><p className="text-sm font-bold text-slate-700 dark:text-slate-200">{agent.deals}</p><p className="text-xs text-slate-400">neg.</p></div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div><p className="text-sm font-bold text-slate-700 dark:text-slate-200">{agent.conversion}%</p><p className="text-xs text-slate-400">conv.</p></div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div><p className="text-sm font-bold text-slate-700 dark:text-slate-200">{agent.totalLeads}</p><p className="text-xs text-slate-400">leads</p></div>
      </div>
      <MiniSparkline scores={agent.weeklyData} color={agent.color} />
      <div className="flex flex-wrap items-center justify-center gap-1">
        {agent.badges.slice(0, 3).map((badge) => <span key={badge.id} className="text-base" title={badge.description}>{badge.icon}</span>)}
      </div>
      <div className={cn('flex w-full items-center justify-center rounded-t-2xl border-2 border-b-0', heights[position], style.card)}>
        <span className={cn('text-3xl font-black', style.number)}>#{position + 1}</span>
      </div>
    </button>
  );
}

function AgentDetailPanel({ agent, rank, onClose }: { agent: RealAgent; rank: number; onClose: () => void }) {
  const maxWeekly = Math.max(...agent.weeklyData, 1);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-white p-6 shadow-sm dark:border-brand-900/30 dark:bg-slate-900">
      <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full opacity-10" style={{ background: agent.color }} />
      <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
        <Icons.X size={14} />
      </button>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col items-center gap-2 lg:w-48">
          <img src={agent.avatar} alt={agent.name} className="h-20 w-20 rounded-2xl object-cover shadow-lg" />
          <div className="text-center">
            <p className="font-bold text-slate-900 dark:text-white">{agent.name}</p>
            <p className="text-xs text-slate-400">{agent.levelTitle}</p>
          </div>
          <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: agent.color, backgroundColor: `${agent.color}20` }}>#{rank} no ranking</div>
          {agent.streak > 0 && <div className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">🔥 {agent.streak} semanas seguidas</div>}
        </div>
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'XP no período', value: agent.score.toLocaleString('pt-BR') },
              { label: 'Negócios', value: agent.deals.toString() },
              { label: 'Leads', value: agent.totalLeads.toString() },
              { label: 'Conversão', value: `${agent.conversion}%` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <p className="text-lg font-black text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/10">
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{formatCurrencyCompact(agent.revenue)}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">Receita estimada do período</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Evolução semanal de XP</p>
            <div className="flex h-20 items-end gap-1.5">
              {agent.weeklyData.map((score, index) => {
                const height = (score / maxWeekly) * 100;
                return (
                  <div key={`${agent.id}-${index}`} className="flex h-full flex-1 flex-col items-center gap-1">
                    <div className="flex h-[80%] w-full items-end">
                      <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(height, 4)}%`, background: index === agent.weeklyData.length - 1 ? agent.color : `${agent.color}66` }} />
                    </div>
                    <span className="text-[9px] text-slate-400">S{index + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="lg:w-56">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Conquistas</p>
          <div className="space-y-2">
            {agent.badges.length > 0 ? agent.badges.map((badge) => (
              <div key={badge.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-lg">{badge.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{badge.label}</p>
                  <p className="text-[10px] leading-tight text-slate-400">{badge.description}</p>
                </div>
              </div>
            )) : <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-800">Ainda sem badges neste período.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLeaderboard() {
  const { user } = useAuth();
  // --- Lógica do Modo TV ---
  const tvModeRef = useRef<HTMLDivElement>(null);
  const [isTvMode, setIsTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!isTvMode) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isTvMode]);

  useEffect(() => {
    const handleFsChange = () => { if (!document.fullscreenElement) setIsTvMode(false); };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleTvMode = () => {
    if (!isTvMode) {
      tvModeRef.current?.requestFullscreen?.();
      setIsTvMode(true);
    } else {
      document.exitFullscreen?.();
      setIsTvMode(false);
    }
  };
  // -------------------------
  const [agents, setAgents] = useState<RealAgent[]>([]);
  const [activities, setActivities] = useState<RealActivity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [metric, setMetric] = useState<Metric>('score');

  const fetchLeaderboardData = async (manualRefresh = false) => {
    if (!user?.company_id) {
      setAgents([]);
      setActivities([]);
      setLoading(false);
      return;
    }

    if (manualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const companyId = user.company_id;
      const periodStart = getPeriodStart(period);
      const eventsStart = new Date();
      eventsStart.setDate(eventsStart.getDate() - 56);

      const [profilesResult, leadsResult, eventsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            id, name, role, xp, xp_points, level, level_title, theme_color, avatar_url,
            user_badges ( badges ( id, icon, label, description ) )
          `)
          .eq('company_id', companyId)
          .neq('role', 'super_admin'),
        supabase
          .from('leads')
          .select('id, assigned_to, funnel_step, status, deal_value, created_at')
          .eq('company_id', companyId)
          .gte('created_at', periodStart.toISOString()),
        supabase
          .from('timeline_events')
          .select('id, type, description, created_at, created_by')
          .eq('company_id', companyId)
          .gte('created_at', eventsStart.toISOString())
          .order('created_at', { ascending: false }),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (eventsResult.error) throw eventsResult.error;

      const profiles = profilesResult.data || [];
      const leads = leadsResult.data || [];
      const events = eventsResult.data || [];

      const processedAgents: RealAgent[] = profiles.map((profile: any, index) => {
        const name = profile.name || 'Usuário';
        const weeklyData = buildWeeklyData(events, profile.id);
        const totalXp = Number(profile.xp_points ?? profile.xp ?? 0);
        const agentLeads = leads.filter((lead: any) => lead.assigned_to === profile.id);
        const closedLeads = agentLeads.filter(isClosedLead);
        const revenue = closedLeads.reduce((sum: number, lead: any) => sum + Number(lead.deal_value || 0), 0);
        const conversion = agentLeads.length > 0 ? Math.round((closedLeads.length / agentLeads.length) * 100) : 0;

        const baseAgent: RealAgent = {
          id: profile.id,
          name,
          role: profile.role || 'corretor',
          initials: getInitials(name),
          avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          score: getPeriodScore(totalXp, weeklyData, period),
          totalXp,
          revenue,
          deals: closedLeads.length,
          totalLeads: agentLeads.length,
          conversion,
          level: profile.level || 1,
          levelTitle: getLevelTitle(profile.level || 1, profile.level_title),
          color: profile.theme_color || PALETTE[index % PALETTE.length],
          weeklyData,
          badges: [],
          rankChange: computeRankChange(weeklyData),
          streak: computeStreak(weeklyData),
        };

        baseAgent.badges = mergeBadges(extractBadges(profile.user_badges), computeAutoBadges(baseAgent));
        return baseAgent;
      });

      const agentMap = new Map(processedAgents.map((agent) => [agent.id, agent]));
      const processedActivities: RealActivity[] = events.slice(0, 10).map((event: any) => {
        const agent = agentMap.get(event.created_by);
        const points = getEventPoints(event.type);
        return {
          id: event.id,
          agentId: agent?.id,
          agentName: agent?.name || 'Sistema',
          agentInitials: agent?.initials || 'SY',
          agentColor: agent?.color || '#64748b',
          action: getEventAction(event.type, event.description),
          value: `+${points} pts`,
          time: timeAgo(event.created_at),
          icon: event.type === 'status_change' ? '📌' : event.type === 'whatsapp' ? '💬' : event.type === 'call' || event.type === 'call_log' ? '📞' : '⚡',
        };
      });

      setAgents(processedAgents);
      setActivities(processedActivities);
      if (selectedId && !processedAgents.some((agent) => agent.id === selectedId)) setSelectedId(null);
    } catch (error) {
      console.error('Erro ao buscar dados do leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user?.company_id) {
      setAgents([]);
      setActivities([]);
      setLoading(false);
      return;
    }
    void fetchLeaderboardData();
  }, [user?.company_id, period]);

  useEffect(() => {
    if (!isTvMode || document.fullscreenElement || !tvModeRef.current?.requestFullscreen) return;
    void tvModeRef.current.requestFullscreen().catch(() => {
      setIsTvMode(false);
    });
  }, [isTvMode]);

  const sortedAgents = [...agents].sort((a, b) => getRawValue(b, metric) - getRawValue(a, metric));
  const podiumAgents = sortedAgents.length >= 3 ? [sortedAgents[1], sortedAgents[0], sortedAgents[2]] : sortedAgents.slice(0, 3);
  const otherAgents = sortedAgents.slice(3);
  const selectedAgent = sortedAgents.find((agent) => agent.id === selectedId) ?? null;
  const maxValue = sortedAgents.length > 0 ? getRawValue(sortedAgents[0], metric) : 1;
  const badges: BadgeShowcase[] = sortedAgents.flatMap((agent) => agent.badges.map((badge) => ({ ...badge, agentName: agent.name.split(' ')[0], agentColor: agent.color, agentInitials: agent.initials }))).slice(0, 8);
  const teamVGV = agents.reduce((sum, agent) => sum + agent.revenue, 0);
  const teamStats = [
    { label: 'XP da equipe', value: sortedAgents.reduce((sum, agent) => sum + agent.score, 0).toLocaleString('pt-BR'), hint: `Acumulado em ${PERIOD_LABELS[period]}`, icon: <Icons.Trophy size={22} className="text-violet-600 dark:text-violet-400" />, classes: 'border-violet-100 bg-violet-50 dark:border-violet-900/30 dark:bg-violet-900/10' },
    { label: 'Leads captados', value: sortedAgents.reduce((sum, agent) => sum + agent.totalLeads, 0).toLocaleString('pt-BR'), hint: 'Volume de atendimento', icon: <Icons.Users size={22} className="text-blue-600 dark:text-blue-400" />, classes: 'border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10' },
    { label: 'Negócios fechados', value: sortedAgents.reduce((sum, agent) => sum + agent.deals, 0).toLocaleString('pt-BR'), hint: 'Conversões do período', icon: <Icons.Target size={22} className="text-emerald-600 dark:text-emerald-400" />, classes: 'border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10' },
    { label: 'Receita estimada', value: formatCurrencyCompact(teamVGV), hint: 'Baseada em leads ganhos', icon: <Icons.BadgeDollarSign size={22} className="text-amber-600 dark:text-amber-400" />, classes: 'border-amber-100 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10' },
  ];

  if (loading) {
    return (
      <div className="space-y-6 rounded-3xl bg-slate-50 p-6 dark:bg-slate-950">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><Skeleton className="mb-3 h-7 w-56" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><Skeleton className="mb-4 h-10 w-10 rounded-2xl" /><Skeleton className="mb-2 h-7 w-24" /><Skeleton className="h-4 w-32" /></div>)}</div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="flex flex-col items-center gap-3"><Skeleton className="h-20 w-20 rounded-full" /><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-20" /><Skeleton className="h-24 w-full" /></div>)}</div></div>
      </div>
    );
  }

  if (!sortedAgents.length) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="mb-4 text-5xl">🏆</div>
          <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">Nenhum membro apareceu no ranking ainda</h2>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Assim que a equipe começar a gerar atividade e vendas, o leaderboard ganha vida.</p>
          <button type="button" onClick={() => void fetchLeaderboardData(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"><Icons.RefreshCw size={16} />Atualizar</button>
        </div>
      </div>
    );
  }

  // =========================================
  // ============= MODO TV (FULLSCREEN) ======
  // =========================================
  if (isTvMode) {
    const teamVgv = agents.reduce((sum, a) => sum + a.revenue, 0);
    const sortedForTv = [...agents].sort((a, b) => b.revenue - a.revenue);
    const tvTop3 = sortedForTv.slice(0, 3);

    return (
      <div ref={tvModeRef} className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-slate-950 p-8 font-sans text-white select-none">
        <div className="mb-10 flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <span className="relative flex h-6 w-6">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex h-6 w-6 rounded-full bg-red-600"></span>
            </span>
            <h1 className="text-5xl font-black uppercase tracking-widest text-white">
              Liderança <span className="text-brand-500">Ao Vivo</span>
            </h1>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase">VGV Total da Equipe</p>
              <p className="text-4xl font-black text-emerald-400">
                {teamVgv >= 1000000 ? `R$ ${(teamVgv / 1000000).toFixed(2)}M` : `R$ ${(teamVgv / 1000).toFixed(0)}K`}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-black/40 px-6 py-3 text-5xl font-extralight text-slate-300">
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button type="button" onClick={toggleTvMode} className="text-slate-600 hover:text-white"><Icons.X size={48} /></button>
          </div>
        </div>

        <div className="grid flex-grow grid-cols-3 items-end gap-8 pb-8">
          {[tvTop3[1], tvTop3[0], tvTop3[2]].map((agent, i) => {
            if (!agent) return <div key={i} />;
            const isFirst = i === 1;
            const rank = isFirst ? 1 : i === 0 ? 2 : 3;
            const height = isFirst ? 'h-[105%]' : 'h-[85%]';
            const borderColors = isFirst ? 'border-amber-500/50' : rank === 2 ? 'border-slate-400/50' : 'border-orange-500/50';
            const bgColors = isFirst ? 'bg-amber-950/20' : rank === 2 ? 'bg-slate-900/40' : 'bg-orange-950/20';

            return (
              <div key={agent.id} className={cn("relative flex flex-col items-center rounded-[40px] border p-8 text-center", height, borderColors, bgColors)}>
                <div className="absolute top-6 right-8 text-8xl font-black opacity-10">{rank}</div>

                {agent.avatar ? (
                  <img src={agent.avatar} alt={agent.name} className={cn("mb-6 rounded-full border-4 object-cover shadow-2xl", isFirst ? "h-44 w-44" : "h-36 w-36", agent.role === 'admin' ? "border-brand-500" : "border-slate-700")} />
                ) : (
                  <div className={cn("mb-6 flex items-center justify-center rounded-full border-4 font-black text-white shadow-2xl", isFirst ? "h-44 w-44 text-5xl" : "h-36 w-36 text-4xl", agent.role === 'admin' ? "border-brand-500" : "border-slate-700")} style={{ backgroundColor: agent.color }}>
                    {agent.initials}
                  </div>
                )}

                <h3 className={cn("flex items-center gap-2 font-black text-white", isFirst ? "text-4xl" : "text-3xl")}>
                  {agent.name.split(' ')[0]} {agent.role === 'admin' && <Icons.Shield size={24} className="text-brand-500" />}
                </h3>
                <p className="mt-2 text-xl font-bold" style={{ color: agent.color }}>NÍVEL {agent.level}</p>

                <div className="mt-auto w-full space-y-2">
                  <p className="text-sm font-bold uppercase text-slate-500">VGV Mensal</p>
                  <p className={cn("rounded-2xl border border-white/5 bg-black/40 py-4 font-black tracking-tighter", isFirst ? "text-6xl text-amber-400" : rank === 2 ? "text-5xl text-slate-300" : "text-5xl text-orange-400")}>
                    {agent.revenue >= 1000000 ? `R$ ${(agent.revenue / 1000000).toFixed(2)}M` : `R$ ${(agent.revenue / 1000).toFixed(0)}K`}
                  </p>
                  <p className="text-2xl font-bold text-slate-300">{agent.deals} negócios</p>
                </div>
              </div>
            );
          })}
        </div>

        {sortedForTv.length > 3 && (
          <div className="mt-auto grid grid-cols-2 gap-6 border-t border-slate-800 pt-6">
             {sortedForTv.slice(3, 5).map((agent, index) => (
               <div key={agent.id} className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-center gap-5">
                    <div className="w-16 text-center text-5xl font-black text-slate-700">{index + 4}º</div>
                    {agent.avatar ? (
                      <img src={agent.avatar} alt={agent.name} className="h-16 w-16 rounded-full border-2 border-slate-700 object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-700 text-xl font-black text-white" style={{ backgroundColor: agent.color }}>
                        {agent.initials}
                      </div>
                    )}
                    <div>
                      <h4 className="flex items-center gap-2 text-2xl font-bold text-white">{agent.name} {agent.role === 'admin' && <Icons.Shield size={16} className="text-brand-500" />}</h4>
                      <p className="font-semibold" style={{ color: agent.color }}>Nível {agent.level}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-slate-300 tracking-tight">
                      {agent.revenue >= 1000000 ? `R$ ${(agent.revenue / 1000000).toFixed(2)}M` : `R$ ${(agent.revenue / 1000).toFixed(0)}K`}
                    </p>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-black text-slate-900 dark:text-white md:text-3xl">
              <Icons.Trophy className="text-brand-500" size={30} />
              Leaderboard da Equipe
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Ranking vivo com mais contexto de performance, atividade e conquistas da equipe inteira.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Botão Modo TV */}
            <button 
              type="button"
              onClick={toggleTvMode}
              title="Ativar Modo TV"
              className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-400"
            >
              <Icons.Maximize size={20} />
            </button>

            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(['week', 'month', 'quarter'] as Period[]).map((option) => (
                <button key={option} type="button" onClick={() => setPeriod(option)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200', period === option ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
                  {option === 'week' ? 'Semana' : option === 'month' ? 'Mês' : 'Trimestre'}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(Object.keys(METRIC_LABELS) as Metric[]).map((option) => (
                <button key={option} type="button" onClick={() => setMetric(option)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200', metric === option ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
                  {METRIC_LABELS[option]}
                </button>
              ))}
            </div>

            <button type="button" onClick={() => void fetchLeaderboardData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {refreshing ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.RefreshCw size={16} />}
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {teamStats.map((stat) => (
          <div key={stat.label} className={cn('rounded-3xl border p-5 shadow-sm', stat.classes)}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm dark:bg-slate-950/40">{stat.icon}</div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{stat.label}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Pódio</h2>
                <p className="mt-1 text-sm text-slate-400">Top {Math.min(3, sortedAgents.length)} em {PERIOD_LABELS[period]}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />Dados reais da equipe</div>
            </div>

            <div className="grid gap-5 md:grid-cols-3 md:items-end">
              {podiumAgents.map((agent) => {
                if (!agent) return null;
                const rank = sortedAgents.indexOf(agent) as 0 | 1 | 2;
                return <PodiumCard key={agent.id} agent={agent} position={rank} metric={metric} onClick={() => setSelectedId((current) => current === agent.id ? null : agent.id)} />;
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Ranking completo</h2>
                <p className="mt-1 text-xs text-slate-400">{sortedAgents.length} participantes ranqueados</p>
              </div>
            </div>

            <div className="hidden grid-cols-12 gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 md:grid">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Membro</div>
              <div className="col-span-2">{METRIC_LABELS[metric]}</div>
              <div className="col-span-1">Neg.</div>
              <div className="col-span-1">Conv.</div>
              <div className="col-span-2">Tendência</div>
              <div className="col-span-1">Badges</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedAgents.map((agent, index) => {
                const rank = index + 1;
                const percent = maxValue > 0 ? (getRawValue(agent, metric) / maxValue) * 100 : 0;
                return (
                  <button key={agent.id} type="button" onClick={() => setSelectedId((current) => current === agent.id ? null : agent.id)} className={cn('grid w-full gap-4 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 md:grid-cols-12 md:items-center md:px-6', selectedId === agent.id ? 'bg-brand-50/60 dark:bg-brand-900/10' : '')}>
                    <div className="flex items-center gap-2 md:col-span-1"><span className="text-base font-bold text-slate-400">#{rank}</span><RankChangeIndicator change={agent.rankChange} /></div>
                    <div className="flex items-center gap-3 md:col-span-4">
                      <img src={agent.avatar} alt={agent.name} className="h-11 w-11 rounded-full object-cover shadow-sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5"><p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{agent.name}</p>{agent.role === 'admin' && <Icons.Shield size={12} className="text-brand-500" />}</div>
                        <p className="truncate text-xs text-slate-400">{agent.levelTitle}</p>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatValue(agent, metric)}</p>
                      <div className="mt-1 h-1.5 w-28 max-w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${percent}%`, background: agent.color }} /></div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-1">{agent.deals}</div>
                    <div className="md:col-span-1"><span className={cn('text-sm font-semibold', agent.conversion >= 55 ? 'text-emerald-600' : agent.conversion >= 35 ? 'text-amber-500' : 'text-slate-500')}>{agent.conversion}%</span></div>
                    <div className="flex items-center gap-2 md:col-span-2"><MiniSparkline scores={agent.weeklyData} color={agent.color} /></div>
                    <div className="flex items-center gap-1 md:col-span-1">{agent.badges.length > 0 ? agent.badges.slice(0, 3).map((badge) => <span key={badge.id} className="text-sm" title={badge.description}>{badge.icon}</span>) : <span className="text-xs text-slate-300">—</span>}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedAgent && <AgentDetailPanel agent={selectedAgent} rank={sortedAgents.findIndex((agent) => agent.id === selectedAgent.id) + 1} onClose={() => setSelectedId(null)} />}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><Icons.Activity size={18} className="text-brand-500" />Atividade recente</h3>
            {activities.length === 0 ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma atividade recente encontrada.</p> : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <button key={activity.id} type="button" onClick={() => activity.agentId && setSelectedId(activity.agentId)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm" style={{ background: activity.agentColor }}>{activity.agentInitials}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-900 dark:text-white">{activity.agentName.split(' ')[0]}</span> {activity.action}</p>
                      <p className="mt-1 text-xs text-slate-400">{activity.time}</p>
                    </div>
                    <div className="rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-600 dark:bg-brand-900/20 dark:text-brand-400">{activity.value}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><Icons.Award size={18} className="text-brand-500" />Conquistas do período</h3>
            {badges.length === 0 ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma conquista destravada neste período.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {badges.map((badge) => (
                  <div key={`${badge.id}-${badge.agentName}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                    <span className="text-2xl">{badge.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{badge.label}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: badge.agentColor }}>{badge.agentInitials[0]}</div>
                        <span className="truncate text-xs text-slate-400">{badge.agentName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
