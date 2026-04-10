import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getLevelInfo } from '../services/gamification';

type LeaderboardBadge = {
  id: string;
  icon: string;
  label: string;
  description: string;
};

type ProfileBadgeRelation = {
  badges?: LeaderboardBadge | LeaderboardBadge[] | null;
} | null;

type LeaderboardProfile = {
  id: string;
  name?: string | null;
  xp_points?: number | null;
  level?: number | null;
  theme_color?: string | null;
  avatar_url?: string | null;
  user_badges?: ProfileBadgeRelation[] | null;
};

type LeaderboardContract = {
  id: string;
  broker_id?: string | null;
  status?: string | null;
  type?: string | null;
};

type LeaderboardLead = {
  id: string;
  assigned_to?: string | null;
};

type LeaderboardLogProfile = {
  name?: string | null;
} | null;

type GamificationEvent = {
  id: string;
  action_type?: string | null;
  points_awarded?: number | null;
  created_at: string;
  profiles?: LeaderboardLogProfile | LeaderboardLogProfile[] | null;
};

export type RealAgent = {
  id: string;
  name: string;
  avatar: string;
  avatar_url: string | null;
  score: number;
  revenue: number;
  deals: number;
  conversion: number;
  level: number;
  levelTitle: string;
  color: string;
  weeklyData: number[];
  badges: LeaderboardBadge[];
};

export type RealActivity = {
  id: string;
  agentName: string;
  action: string;
  value: string;
  time: string;
  icon: string;
  type: string;
};

const formatRelativeTime = (createdAt: string) => {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours >= 24) {
    return `Há ${Math.floor(diffHours / 24)} dias`;
  }

  if (diffHours > 0) {
    return `Há ${diffHours} horas`;
  }

  return 'Agora mesmo';
};

const extractProfileName = (profiles: GamificationEvent['profiles']) => {
  if (Array.isArray(profiles)) {
    return profiles[0]?.name ?? 'Sistema';
  }

  return profiles?.name ?? 'Sistema';
};

const extractBadges = (relations: LeaderboardProfile['user_badges']) => {
  return (relations || [])
    .flatMap((relation) => {
      const badges = relation?.badges;
      if (!badges) return [];
      return Array.isArray(badges) ? badges : [badges];
    })
    .filter(Boolean);
};

const LEVEL_COLOR_FALLBACKS: Record<string, string> = {
  'text-amber-700': '#b45309',
  'text-slate-500': '#64748b',
  'text-slate-600': '#475569',
  'text-yellow-600': '#ca8a04',
  'text-yellow-700': '#a16207',
  'text-cyan-600': '#0891b2',
  'text-cyan-700': '#0e7490',
  'text-blue-600': '#2563eb',
  'text-blue-700': '#1d4ed8',
  'text-purple-600': '#9333ea',
  'text-rose-600': '#e11d48',
  'text-brand-600': '#2563eb',
};

export function useLeaderboard() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<RealAgent[]>([]);
  const [activities, setActivities] = useState<RealActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboardData = useCallback(async () => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const companyId = user.company_id;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id, name, xp_points, level, theme_color, avatar_url,
          user_badges ( badges ( id, icon, label, description ) )
        `)
        .eq('company_id', companyId)
        .neq('role', 'super_admin');

      if (profilesError) throw profilesError;

      const profiles = (profilesData || []) as LeaderboardProfile[];
      const profileIds = profiles.map((profile) => profile.id);

      let contractsData: LeaderboardContract[] = [];
      if (profileIds.length > 0) {
        const { data, error: contractsError } = await supabase
          .from('contracts')
          .select('id, broker_id, status, type')
          .eq('company_id', companyId)
          .in('broker_id', profileIds);

        if (contractsError) throw contractsError;
        contractsData = (data || []) as LeaderboardContract[];
      }

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, assigned_to')
        .eq('company_id', companyId);

      if (leadsError) throw leadsError;

      let recentEvents: GamificationEvent[] = [];
      if (profileIds.length > 0) {
        const { data, error: eventsError } = await supabase
          .from('gamification_events')
          .select(`
            id,
            action_type,
            points_awarded,
            created_at,
            profiles(name)
          `)
          .in('user_id', profileIds)
          .order('created_at', { ascending: false })
          .limit(20);

        if (eventsError) {
          console.error('Erro ao buscar eventos de gamificação:', eventsError);
        } else {
          recentEvents = (data || []) as GamificationEvent[];
        }
      }

      const processedAgents: RealAgent[] = profiles.map((profile) => {
        const agentContracts = contractsData.filter((contract) => contract.broker_id === profile.id);
        const deals = agentContracts.filter(
          (contract) => contract.status === 'active' || contract.status === 'completed',
        ).length;

        const agentLeads = ((leadsData || []) as LeaderboardLead[]).filter(
          (lead) => lead.assigned_to === profile.id,
        ).length;
        const conversion = agentLeads > 0 ? Math.round((deals / agentLeads) * 100) : 0;

        const badges = extractBadges(profile.user_badges);
        const profileName = profile.name || 'Corretor';
        // Lendo exclusivamente da coluna oficial da gamificação atualizada
        const totalXp = Number(profile.xp_points ?? 0);
        const { currentLevel } = getLevelInfo(totalXp);

        return {
          id: profile.id,
          name: profileName,
          avatar: profile.avatar_url || '',
          avatar_url: profile.avatar_url || null,
          score: totalXp,
          revenue: deals * 1500,
          deals,
          conversion,
          level: currentLevel.level,
          levelTitle: currentLevel.title,
          color: LEVEL_COLOR_FALLBACKS[currentLevel.color] ?? currentLevel.color.replace('text-', '#'),
          weeklyData: [10, 25, 30, 45, 60, 40, 50],
          badges,
        };
      });

      setAgents(processedAgents);

      const processedActivities: RealActivity[] = recentEvents.map((event) => {
        let actionLabel = 'ganhou pontos';
        if (event.action_type === 'deal_closed') actionLabel = 'fechou um negócio';
        else if (event.action_type === 'visit_done') actionLabel = 'realizou uma visita';
        else if (event.action_type === 'proposal_sent') actionLabel = 'enviou uma proposta';
        else if (event.action_type?.includes('lost')) actionLabel = 'perdeu um lead';

        return {
          id: event.id,
          agentName: extractProfileName(event.profiles),
          action: actionLabel,
          value: `${event.points_awarded && event.points_awarded > 0 ? '+' : ''}${event.points_awarded || 0} pts`,
          time: formatRelativeTime(event.created_at),
          icon: event.points_awarded && event.points_awarded > 0 ? '🔥' : '⚠️',
          type: 'xp',
        };
      });

      setActivities(processedActivities);
    } catch (error) {
      console.error('Erro ao buscar dados do Leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.company_id]);

  useEffect(() => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }

    void fetchLeaderboardData();

    const channel = supabase
      .channel(`liga-corretores-${user.company_id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `company_id=eq.${user.company_id}` },
        () => {
          void fetchLeaderboardData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchLeaderboardData, user?.company_id]);

  return { agents, activities, loading, refresh: fetchLeaderboardData };
}
