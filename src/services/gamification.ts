import { supabase } from '../lib/supabase';

export const LEVELS = [
  { level: 1, title: 'Iniciante', minXp: 0, color: 'text-slate-500', bg: 'bg-slate-100' },
  { level: 2, title: 'Bronze', minXp: 200, color: 'text-amber-600', bg: 'bg-amber-100' },
  { level: 3, title: 'Prata', minXp: 500, color: 'text-slate-400', bg: 'bg-slate-100' },
  { level: 4, title: 'Ouro', minXp: 1000, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  { level: 5, title: 'Diamante', minXp: 2000, color: 'text-cyan-500', bg: 'bg-cyan-100' },
  { level: 6, title: 'Lenda', minXp: 5000, color: 'text-purple-600', bg: 'bg-purple-100' },
];

export const getLevelInfo = (xp: number) => {
  const currentLevel = [...LEVELS].reverse().find((l) => xp >= l.minXp) || LEVELS[0];
  const nextLevel = LEVELS.find((l) => l.level === currentLevel.level + 1);
  const progress = nextLevel
    ? ((xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
    : 100;

  return { currentLevel, nextLevel, progress: Math.min(Math.max(progress, 0), 100) };
};

export const addXp = async (userId: string, points: number) => {
  if (!userId) return;

  try {
    const { data: profile } = await supabase.from('profiles').select('xp_points').eq('id', userId).single();
    const currentXp = profile?.xp_points || 0;
    const newXp = currentXp + points;

    const { currentLevel } = getLevelInfo(newXp);

    await supabase
      .from('profiles')
      .update({
        xp_points: newXp,
        level: currentLevel.level,
        level_title: currentLevel.title,
      })
      .eq('id', userId);
  } catch (error) {
    console.error('Erro ao adicionar XP:', error);
  }
};