import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

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
  xp?: number | null;
  xp_points?: number | null;
  level?: number | null;
  theme_color?: string | null;
  avatar_url?: string | null;
  user_badges?: ProfileBadgeRelation[] | null;
};

type LeaderboardContract = {
  id: string;
  user_id?: string | null;
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

type LeaderboardLog = {
  id: string;
  action?: string | null;
  amount?: number | null;
  created_at: string;
  profiles?: LeaderboardLogProfile | LeaderboardLogProfile[] | null;
};

export type RealAgent = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  revenue: number;
  deals: number;
  conversion: number;
  level: number;
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

const extractProfileName = (profiles: LeaderboardLog['profiles']) => {
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

export function useLeaderboard() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<RealAgent[]>([]);
  const [activities, setActivities] = useState<RealActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboardData = async () => {
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
          id, name, xp, level, theme_color, avatar_url,
          user_badges ( badges ( id, icon, label, description ) )
        `)
        .eq('company_id', companyId)
        .neq('role', 'super_admin');

      if (profilesError) throw profilesError;

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('id, user_id, broker_id, status, type')
        .eq('company_id', companyId);

      if (contractsError) throw contractsError;

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, assigned_to')
        .eq('company_id', companyId);

      if (leadsError) throw leadsError;

      const { data: xpLogs, error: xpLogsError } = await supabase
        .from('xp_logs')
        .select('id, action, amount, created_at, profiles(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (xpLogsError) throw xpLogsError;

      const processedAgents: RealAgent[] = ((profilesData || []) as LeaderboardProfile[]).map((profile) => {
        const agentContracts = ((contractsData || []) as LeaderboardContract[]).filter(
          (contract) => (contract.user_id ?? contract.broker_id) === profile.id,
        );
        const deals = agentContracts.filter(
          (contract) => contract.status === 'active' || contract.status === 'completed',
        ).length;

        const agentLeads = ((leadsData || []) as LeaderboardLead[]).filter(
          (lead) => lead.assigned_to === profile.id,
        ).length;
        const conversion = agentLeads > 0 ? Math.round((deals / agentLeads) * 100) : 0;

        const badges = extractBadges(profile.user_badges);
        const profileName = profile.name || 'Corretor';

        return {
          id: profile.id,
          name: profileName,
          avatar:
            profile.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=random`,
          score: Number(profile.xp ?? profile.xp_points ?? 0),
          revenue: deals * 1500,
          deals,
          conversion,
          level: profile.level || 1,
          color: profile.theme_color || '#3b82f6',
          weeklyData: [10, 25, 30, 45, 60, 40, 50],
          badges,
        };
      });

      setAgents(processedAgents);

      const processedActivities: RealActivity[] = ((xpLogs || []) as LeaderboardLog[]).map((log) => ({
        id: log.id,
        agentName: extractProfileName(log.profiles),
        action: log.action || 'ganhou experiência',
        value: `+${log.amount ?? 0} XP`,
        time: formatRelativeTime(log.created_at),
        icon: '⚡',
        type: 'xp',
      }));

      setActivities(processedActivities);
    } catch (error) {
      console.error('Erro ao buscar dados do Leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }

    void fetchLeaderboardData();
  }, [user?.company_id]);

  return { agents, activities, loading, refresh: fetchLeaderboardData };
}
