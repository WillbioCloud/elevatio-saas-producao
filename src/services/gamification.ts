import { supabase } from '../lib/supabase';

// --- 1. SISTEMA DE LIGAS (RANKS) ---
export const LIGAS = [
  { level: 1, title: 'Bronze III', minXp: 0, color: 'text-amber-700', bg: 'bg-amber-100/50' },
  { level: 2, title: 'Bronze II', minXp: 150, color: 'text-amber-700', bg: 'bg-amber-100' },
  { level: 3, title: 'Bronze I', minXp: 300, color: 'text-amber-700', bg: 'bg-amber-200' },

  { level: 4, title: 'Prata III', minXp: 600, color: 'text-slate-500', bg: 'bg-slate-100' },
  { level: 5, title: 'Prata II', minXp: 1000, color: 'text-slate-500', bg: 'bg-slate-200' },
  { level: 6, title: 'Prata I', minXp: 1500, color: 'text-slate-600', bg: 'bg-slate-300' },

  { level: 7, title: 'Ouro III', minXp: 2200, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  { level: 8, title: 'Ouro II', minXp: 3000, color: 'text-yellow-600', bg: 'bg-yellow-200' },
  { level: 9, title: 'Ouro I', minXp: 4000, color: 'text-yellow-700', bg: 'bg-yellow-300' },

  { level: 10, title: 'Platina III', minXp: 5500, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  { level: 11, title: 'Platina II', minXp: 7000, color: 'text-cyan-600', bg: 'bg-cyan-200' },
  { level: 12, title: 'Platina I', minXp: 9000, color: 'text-cyan-700', bg: 'bg-cyan-300' },

  { level: 13, title: 'Diamante III', minXp: 12000, color: 'text-blue-600', bg: 'bg-blue-100' },
  { level: 14, title: 'Diamante II', minXp: 15000, color: 'text-blue-600', bg: 'bg-blue-200' },
  { level: 15, title: 'Diamante I', minXp: 20000, color: 'text-blue-700', bg: 'bg-blue-300' },

  { level: 16, title: 'Elite', minXp: 30000, color: 'text-purple-600', bg: 'bg-purple-100' },
  { level: 17, title: 'Lenda', minXp: 50000, color: 'text-rose-600', bg: 'bg-rose-100' },
  { level: 18, title: 'Ícone', minXp: 100000, color: 'text-brand-600', bg: 'bg-brand-100' },
] as const;

// Compatibilidade temporária para componentes ainda não refatorados.
export const LEVELS = LIGAS;

// --- 2. TABELA DE AÇÕES E PONTUAÇÕES ---
export const ACTIONS = {
  // Atividade Básica (Peso Baixo)
  LOGIN_DIARIO: { id: 'login', points: 2, limitPerDay: 1 },
  RESPONDER_LEAD: { id: 'reply_lead', points: 3, limitPerDay: 5 },
  CONCLUIR_TAREFA: { id: 'task_done', points: 3, limitPerDay: 10 },
  CADASTRAR_IMOVEL: { id: 'new_property', points: 8, limitPerDay: 5 },

  // Avanço Comercial (Peso Médio)
  LEAD_QUALIFICADO: { id: 'lead_qualified', points: 10 },
  VISITA_AGENDADA: { id: 'visit_scheduled', points: 12 },
  VISITA_REALIZADA: { id: 'visit_done', points: 18 },
  PROPOSTA_ENVIADA: { id: 'proposal_sent', points: 22 },
  NEGOCIACAO: { id: 'negotiation', points: 25 },

  // Penalidades Leves
  LEAD_PERDIDO_SEM_MOTIVO: { id: 'lead_lost_no_reason', points: -8 },
  OPORTUNIDADE_ABANDONADA: { id: 'lead_abandoned', points: -12 },
} as const;

// --- 3. CALCULADORA INTELIGENTE DE FECHAMENTO ---
export const calculateDealPoints = (
  type: 'venda' | 'locacao',
  propertyMultiplier = 1.0,
  leadScoreMultiplier = 1.0,
  opsQualityMultiplier = 1.0
) => {
  const base = type === 'venda' ? 300 : 120;
  return Math.round(base * propertyMultiplier * leadScoreMultiplier * opsQualityMultiplier);
};

export const getLevelInfo = (xp: number) => {
  const currentLevel = [...LIGAS].reverse().find((l) => xp >= l.minXp) || LIGAS[0];
  const nextLevel = LIGAS.find((l) => l.level === currentLevel.level + 1);
  const progress = nextLevel
    ? ((xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
    : 100;

  return { currentLevel, nextLevel, progress: Math.min(Math.max(progress, 0), 100) };
};

// --- 4. REGISTRO DE EVENTOS E ESCUDO ANTI-FARMING ---
export const addGamificationEvent = async (
  userId: string,
  actionId: string,
  points: number,
  entityId?: string,
  metadata?: any
) => {
  if (!userId) return false;

  try {
    // 1. CHECAGEM ANTI-FARMING (Regras de Integridade)

    // Regra A: Evitar pontuação duplicada para o mesmo Lead na mesma Etapa
    // (ex: não pode ganhar pontos de "Visita" duas vezes para o mesmo Lead)
    if (entityId && ['visit_done', 'visit_scheduled', 'proposal_sent', 'lead_qualified'].includes(actionId)) {
      const { data: existingEvent } = await supabase
        .from('gamification_events')
        .select('id')
        .eq('user_id', userId)
        .eq('action_type', actionId)
        .eq('entity_id', entityId)
        .limit(1)
        .maybeSingle();

      if (existingEvent) {
        console.warn(`[Anti-Farming] Pontuação bloqueada: O corretor já pontuou a ação ${actionId} para esta entidade.`);
        return false;
      }
    }

    // Regra B: Limites Diários para Ações Básicas de Baixo Valor
    const actionConfig = Object.values(ACTIONS).find((a) => a.id === actionId) as { limitPerDay?: number } | undefined;

    if (actionConfig && actionConfig.limitPerDay) {
      // Pega a data de hoje à meia-noite
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('gamification_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action_type', actionId)
        .gte('created_at', todayStart.toISOString());

      if (count !== null && count >= actionConfig.limitPerDay) {
        console.warn(`[Anti-Farming] Pontuação bloqueada: Limite diário de ${actionConfig.limitPerDay} atingido para ${actionId}.`);
        return false;
      }
    }

    // 2. SE PASSOU NO ANTI-FARMING, REGISTRA O EVENTO
    const { error: eventError } = await supabase.from('gamification_events').insert([{
      user_id: userId,
      action_type: actionId,
      entity_id: entityId,
      points_awarded: points,
      base_points: points,
      multipliers: metadata,
    }]);

    if (eventError) throw eventError;

    // 3. ATUALIZA O PERFIL (XP E LIGA)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('xp_points')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    if (profile) {
      const newXp = (profile.xp_points || 0) + points;
      const levelInfo = getLevelInfo(newXp);

      const { error: updateError } = await supabase.from('profiles').update({
        xp_points: newXp,
        level: levelInfo.currentLevel.level,
        level_title: levelInfo.currentLevel.title,
      }).eq('id', userId);

      if (updateError) throw updateError;
    }

    return true;
  } catch (error) {
    console.error('Erro ao registrar evento de gamificação:', error);
    return false;
  }
};

// Retrocompatibilidade (Para não quebrar partes antigas do sistema enquanto refatoramos)
export const addXp = async (userId: string, amount: number, actionName = 'legacy_xp') => {
  return addGamificationEvent(userId, actionName, amount);
};
