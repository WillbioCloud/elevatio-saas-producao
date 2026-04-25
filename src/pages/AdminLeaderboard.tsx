import React, { useMemo } from 'react';
import { Icons } from '../components/Icons';
import Loading from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { getLevelInfo } from '../services/gamification';
import WelcomeBalloon from '../components/ui/WelcomeBalloon';

const getAvatarInitial = (name?: string | null) => (name?.trim().charAt(0) || 'C').toUpperCase();

export default function AdminLeaderboard() {
  const { user } = useAuth();
  const { agents, activities, loading } = useLeaderboard();

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => b.score - a.score);
  }, [agents]);

  const myIndex = sortedAgents.findIndex((agent) => agent.id === user?.id);

  const me =
    myIndex !== -1
      ? sortedAgents[myIndex]
      : {
          id: user?.id || 'me',
          name: user?.name || 'Você',
          avatar: user?.avatar_url || '',
          avatar_url: user?.avatar_url || null,
          score: 0,
          deals: 0,
          conversion: 0,
        };

  const displayIndex = myIndex !== -1 ? myIndex : sortedAgents.length;
  const targetToBeat = displayIndex > 0 ? sortedAgents[displayIndex - 1] : null;
  const myLevelInfo = getLevelInfo(me.score);

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      <WelcomeBalloon pageId="leaderboard" icon="Trophy" title="Ranking de Campeões" description="A gamificação que acelera as vendas! Corretores que atendem rápido e fecham contratos ganham pontos, sobem de nível e dominam o pódio." />

      {/* HEADER DA TEMPORADA */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-800">
            <Icons.Trophy className="text-brand-600" />
            Liga dos Corretores
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Temporada Atual • Encerra em 30 dias</p>
        </div>

        <button
          onClick={() => window.open('/admin/tv', '_blank')}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          title="Abrir Ranking na TV"
        >
          <Icons.Maximize size={18} />
          Modo TV (Ao Vivo)
        </button>
      </div>

      {/* PAINEL PRESCRITIVO DO CORRETOR */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 to-[#0a0f1c] p-4 md:p-6 shadow-xl">
          <div className="absolute -right-4 -top-4 opacity-10">
            <Icons.Award size={140} />
          </div>

          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-4">
              {me.avatar_url ? (
                <img
                  src={me.avatar_url}
                  alt={me.name}
                  className="h-16 w-16 rounded-full border-4 border-slate-700/50 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-700/50 bg-slate-800 text-xl font-black text-slate-300 shadow-lg">
                  {getAvatarInitial(me.name)}
                </div>
              )}
              <div>
                <h3 className="text-lg md:text-xl font-black text-white">{me.name}</h3>
                <div
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${myLevelInfo.currentLevel.bg} ${myLevelInfo.currentLevel.color}`}
                >
                  <Icons.Shield size={12} /> {myLevelInfo.currentLevel.title}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Posição</p>
              <p className="text-4xl font-black text-white">{displayIndex + 1}º</p>
            </div>
          </div>

          <div className="relative z-10 mt-6">
            {targetToBeat ? (
              <>
                <p className="mb-2 text-sm text-slate-300">
                  Faltam <strong className="text-white">{targetToBeat.score - me.score + 1} pontos</strong> para
                  ultrapassar <strong className="text-white">{targetToBeat.name}</strong>.
                </p>
                <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-1000"
                    style={{ width: `${Math.min((me.score / (targetToBeat.score || 1)) * 100, 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm font-bold text-emerald-400">🏆 Você é o Líder da Temporada!</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-black uppercase tracking-tight text-slate-800">
              <Icons.Target className="text-brand-500" /> Próximas Ações de Alto Valor
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="group cursor-pointer rounded-2xl border border-amber-100 bg-amber-50 p-4 transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 transition-transform group-hover:scale-110">
                <Icons.Calendar size={20} />
              </div>
              <h4 className="text-sm font-bold leading-tight text-amber-900">Agendar Visitas Quentes</h4>
              <p className="mb-3 mt-1 text-xs text-amber-700/70">Avançar leads para visitação é o melhor caminho.</p>
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-600">
                +12 pts / cada
              </span>
            </div>

            <div className="group cursor-pointer rounded-2xl border border-blue-100 bg-blue-50 p-4 transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-transform group-hover:scale-110">
                <Icons.FileText size={20} />
              </div>
              <h4 className="text-sm font-bold leading-tight text-blue-900">Enviar Proposta</h4>
              <p className="mb-3 mt-1 text-xs text-blue-700/70">Leads com visita feita aguardam sua proposta.</p>
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-600">
                +22 pts / cada
              </span>
            </div>

            <div className="group cursor-pointer rounded-2xl border border-brand-100 bg-brand-50 p-4 transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 transition-transform group-hover:scale-110">
                <Icons.DollarSign size={20} />
              </div>
              <h4 className="text-sm font-bold leading-tight text-brand-900">Focar no Fechamento</h4>
              <p className="mb-3 mt-1 text-xs text-brand-700/70">Imóveis estratégicos rendem bônus enorme.</p>
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-600">
                Até +600 pts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA INFERIOR: TABELA + RADAR/MISSÕES */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* COLUNA ESQUERDA: Tabela do Campeonato (Ocupa 2/3 da tela) */}
        <div className="xl:col-span-2 bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
              <Icons.List size={20} className="text-brand-600" /> Classificação Geral
            </h3>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="p-3 md:p-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-16 text-center">
                    Pos
                  </th>
                  <th className="p-3 md:p-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Corretor
                  </th>
                  <th className="p-3 md:p-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    Pontos
                  </th>
                  <th className="p-3 md:p-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    Negócios
                  </th>
                  <th className="p-3 md:p-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    % Conv.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAgents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Icons.Trophy size={48} className="text-slate-200 mb-3" />
                        <p className="text-sm font-bold text-slate-500">A temporada acabou de começar!</p>
                        <p className="text-xs">Nenhum corretor pontuou ainda. Seja o primeiro a fechar negócio.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAgents.map((agent, index) => {
                    const isMe = agent.id === user?.id;

                    return (
                      <tr
                        key={agent.id}
                        className={`transition-colors hover:bg-slate-50 ${isMe ? 'bg-brand-50/30' : ''}`}
                      >
                        <td className="p-3 md:p-4 text-center">
                          {index === 0 ? (
                            <span className="inline-flex w-7 h-7 md:w-8 md:h-8 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 font-black text-xs md:text-sm shadow-sm border border-yellow-200">
                              1º
                            </span>
                          ) : index === 1 ? (
                            <span className="inline-flex w-7 h-7 md:w-8 md:h-8 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-black text-xs md:text-sm shadow-sm border border-slate-300">
                              2º
                            </span>
                          ) : index === 2 ? (
                            <span className="inline-flex w-7 h-7 md:w-8 md:h-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-black text-xs md:text-sm shadow-sm border border-amber-200">
                              3º
                            </span>
                          ) : (
                            <span className="text-slate-500 font-bold">{index + 1}º</span>
                          )}
                        </td>
                        <td className="p-3 md:p-4">
                          <div className="flex items-center gap-3">
                            {agent.avatar_url ? (
                              <img
                                src={agent.avatar_url}
                                alt={agent.name}
                                className="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-sm"
                              />
                            ) : (
                              <div className="flex w-10 h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-black text-slate-500 shadow-sm">
                                {getAvatarInitial(agent.name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className={`truncate font-bold text-xs md:text-sm ${isMe ? 'text-brand-700' : 'text-slate-800'}`}>
                                {agent.name}{' '}
                                {isMe && (
                                  <span className="text-[10px] bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded ml-2 uppercase border border-brand-200">
                                    Você
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{agent.levelTitle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 md:p-4 text-center">
                          <span className="font-black text-slate-800 text-lg">{agent.score}</span>
                        </td>
                        <td className="p-3 md:p-4 text-center">
                          <span className="font-bold text-slate-600">{agent.deals}</span>
                        </td>
                        <td className="p-3 md:p-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100">
                            {agent.conversion}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUNA DIREITA: Radar e Missões (Ocupa 1/3 da tela) */}
        <div className="space-y-6">
          {/* CARD: Missões da Rodada */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-md text-white relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-20">
              <Icons.Target size={120} />
            </div>
            <div className="relative z-10">
              <h3 className="text-base font-black flex items-center gap-2 uppercase tracking-tight text-indigo-100 mb-4">
                <Icons.Flame className="text-orange-500" /> Missões da Semana
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-white">Operação Limpa</span>
                    <span className="text-indigo-300">+50 pts</span>
                  </div>
                  <p className="text-[10px] text-indigo-200/70 mb-2">
                    Zere todos os leads atrasados até sexta-feira.
                  </p>
                  <div className="w-full bg-indigo-950/50 rounded-full h-1.5 border border-indigo-500/20">
                    <div
                      className="bg-gradient-to-r from-orange-400 to-orange-500 h-1.5 rounded-full"
                      style={{ width: '40%' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-white">Hat-Trick de Visitas</span>
                    <span className="text-indigo-300">+40 pts</span>
                  </div>
                  <p className="text-[10px] text-indigo-200/70 mb-2">Realize 3 visitas na mesma semana (1/3).</p>
                  <div className="w-full bg-indigo-950/50 rounded-full h-1.5 border border-indigo-500/20">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-500 h-1.5 rounded-full"
                      style={{ width: '33%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD: Radar da Liga (Live Feed) */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm p-4 md:p-6 flex flex-col h-[400px]">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4 tracking-tight">
              <Icons.Activity className="text-rose-500" /> Radar ao Vivo
            </h3>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {!activities || activities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <Icons.Radio size={32} className="mb-2 text-slate-400" />
                  <p className="text-xs font-bold text-slate-500">Radar silencioso...</p>
                </div>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="flex gap-3 items-start animate-fade-in">
                    <div
                      className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        act.value.includes('-') ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-600'
                      }`}
                    >
                      {act.icon === '🔥' ? <Icons.TrendingUp size={14} /> : <Icons.AlertTriangle size={14} />}
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-700 leading-tight">
                        <span className="font-bold text-slate-900">{act.agentName}</span> {act.action}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[11px] font-black ${
                            act.value.includes('-') ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {act.value}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">• {act.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
