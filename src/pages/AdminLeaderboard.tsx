import React, { useState } from 'react';
import { Icons } from '../components/Icons';
import { cn } from '../lib/utils';
import { useLeaderboard, RealAgent } from '../hooks/useLeaderboard';

type Period = 'week' | 'month' | 'quarter';
type Metric = 'score' | 'revenue' | 'deals' | 'conversion';

const metricLabels: Record<Metric, string> = {
  score: 'Pontuação',
  revenue: 'Receita',
  deals: 'Negócios',
  conversion: 'Conversão',
};

const periodDescriptions: Record<Period, string> = {
  week: 'últimos 7 dias',
  month: 'último mês',
  quarter: 'último trimestre',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPeriodAdjustedAgent(agent: RealAgent, period: Period): RealAgent {
  if (period === 'month') {
    return agent;
  }

  const weeklyAverage = agent.weeklyData.reduce((sum, value) => sum + value, 0) / agent.weeklyData.length;
  const momentum = 1 + (weeklyAverage - 60) / 500;
  const scoreMultiplier = period === 'week' ? 0.32 : 2.85;
  const revenueMultiplier = period === 'week' ? 0.3 : 2.9;
  const dealsMultiplier = period === 'week' ? 0.35 : 2.7;
  const conversionDelta = period === 'week' ? Math.round((weeklyAverage - 60) / 8) : Math.round((weeklyAverage - 60) / 12) + 2;

  return {
    ...agent,
    score: Math.round(agent.score * scoreMultiplier * momentum),
    revenue: Math.round(agent.revenue * revenueMultiplier * momentum),
    deals: Math.max(1, Math.round(agent.deals * dealsMultiplier * momentum)),
    conversion: clamp(agent.conversion + conversionDelta, 5, 95),
  };
}

function formatValue(agent: RealAgent, metric: Metric) {
  if (metric === 'score') return `${agent.score.toLocaleString('pt-BR')} pts`;
  if (metric === 'revenue') return `R$ ${(agent.revenue / 1_000_000).toFixed(2)}M`;
  if (metric === 'deals') return `${agent.deals} neg.`;
  if (metric === 'conversion') return `${agent.conversion}%`;
  return '';
}

function getRawValue(agent: RealAgent, metric: Metric): number {
  if (metric === 'score') return agent.score;
  if (metric === 'revenue') return agent.revenue;
  if (metric === 'deals') return agent.deals;
  if (metric === 'conversion') return agent.conversion;
  return 0;
}

const rankStyles = [
  {
    card: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-700/50',
    medal: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-amber-200/50',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-700/50',
  },
  {
    card: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-800/40 dark:to-zinc-800/40 border-slate-200 dark:border-slate-700',
    medal: 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 shadow-slate-200/50',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
  {
    card: 'bg-gradient-to-br from-orange-50 via-amber-50/50 to-yellow-50/50 dark:from-orange-900/20 dark:to-amber-900/10 border-orange-200/50 dark:border-orange-800/40',
    medal: 'bg-gradient-to-br from-orange-300 to-orange-400 text-white shadow-orange-200/50',
    text: 'text-orange-800 dark:text-orange-400',
    border: 'border-orange-200/50 dark:border-orange-800/40',
  },
];

const podiumOrder = [1, 0, 2];

export default function AdminLeaderboard() {
  const { agents, activities, loading } = useLeaderboard();
  const [period, setPeriod] = useState<Period>('month');
  const [metric, setMetric] = useState<Metric>('score');

  const agentsForPeriod = agents.map((agent) => getPeriodAdjustedAgent(agent, period));
  const sortedAgents = [...agentsForPeriod].sort((a, b) => getRawValue(b, metric) - getRawValue(a, metric));
  const top3 = sortedAgents.slice(0, 3);
  const others = sortedAgents.slice(3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Icons.Loader2 className="animate-spin text-brand-500" size={48} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900 dark:text-white">
            <Icons.Trophy className="text-brand-500" size={32} />
            Leaderboard
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Ranking por {metricLabels[metric].toLowerCase()} nos {periodDescriptions[period]}.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(['week', 'month', 'quarter'] as Period[]).map((selectedPeriod) => (
              <button
                key={selectedPeriod}
                onClick={() => setPeriod(selectedPeriod)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200',
                  period === selectedPeriod
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                )}
              >
                {selectedPeriod === 'week' ? 'Semana' : selectedPeriod === 'month' ? 'Mês' : 'Trimestre'}
              </button>
            ))}
          </div>

          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="score">Pontuação XP</option>
            <option value="revenue">Receita Gerada</option>
            <option value="deals">Negócios Fechados</option>
            <option value="conversion">Taxa de Conversão</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <div className="grid grid-cols-1 items-end gap-6 pt-8 md:grid-cols-3">
            {podiumOrder.map((orderIndex) => {
              const agent = top3[orderIndex];

              if (!agent) return null;

              const rankIndex = orderIndex;
              const style = rankStyles[rankIndex];
              const isFirst = rankIndex === 0;

              return (
                <div
                  key={agent.id}
                  className={cn(
                    'relative flex flex-col items-center rounded-3xl border p-6 text-center shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
                    style.card,
                    isFirst ? 'z-10 shadow-lg md:-mt-8 md:scale-105' : '',
                  )}
                >
                  <div
                    className={cn(
                      'absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-xl font-black shadow-lg dark:border-slate-800',
                      style.medal,
                    )}
                  >
                    {rankIndex + 1}
                  </div>

                  <div className="relative mb-4 mt-2">
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className={cn(
                        'rounded-full border-4 border-white object-cover shadow-md dark:border-slate-800',
                        isFirst ? 'h-24 w-24' : 'h-20 w-20',
                      )}
                    />
                    <div className="absolute -bottom-2 -right-2 rounded-full border-2 border-white bg-slate-900 px-2 py-1 text-[10px] font-bold text-white dark:border-slate-800 dark:bg-slate-700">
                      Lvl {agent.level}
                    </div>
                  </div>

                  <h3 className={cn('mb-1 font-bold text-slate-900 dark:text-white', isFirst ? 'text-xl' : 'text-lg')}>
                    {agent.name}
                  </h3>
                  <div className={cn('mb-4 text-2xl font-black', style.text)}>{formatValue(agent, metric)}</div>

                  <div className={cn('w-full border-t pt-4', style.border)}>
                    <div className="flex justify-center gap-2">
                      {agent.badges.slice(0, 3).map((badge) => (
                        <div
                          key={badge.id}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-lg shadow-sm dark:bg-black/20"
                          title={badge.label}
                        >
                          {badge.icon}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-6 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-white">Restante da Equipe</h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {others.map((agent, index) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:p-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 text-center font-bold text-slate-400">{index + 4}&ordm;</div>

                    <div className="relative">
                      <img src={agent.avatar} alt={agent.name} className="h-12 w-12 rounded-full object-cover" />
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">{agent.name}</h4>
                      <div className="mt-1 flex gap-1">
                        {agent.badges.map((badge) => (
                          <span key={badge.id} title={badge.label} className="text-xs">
                            {badge.icon}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black text-slate-800 dark:text-white">{formatValue(agent, metric)}</div>
                    <div className="text-xs font-semibold text-slate-400">Nível {agent.level}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 flex items-center gap-2 font-bold text-slate-800 dark:text-white">
              <Icons.Activity size={20} className="text-brand-500" />
              Atividade Recente
            </h3>

            <div className="space-y-6">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-lg shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {activity.icon}
                  </div>

                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-bold text-slate-900 dark:text-white">{activity.agentName}</span>{' '}
                      {activity.action}{' '}
                      <span className="font-bold text-brand-600 dark:text-brand-400">{activity.value}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
