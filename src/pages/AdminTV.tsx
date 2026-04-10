import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icons';
import { useLeaderboard } from '../hooks/useLeaderboard';

const getAvatarInitial = (name?: string | null) => (name?.trim().charAt(0) || 'C').toUpperCase();

export default function AdminTV() {
  const { agents, activities, loading } = useLeaderboard();
  const [now, setNow] = useState(() => new Date());

  // Mantem o relogio da TV atualizado mesmo sem novas atividades.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // Forca o modo visual escuro ao montar a tela.
  useEffect(() => {
    document.body.style.backgroundColor = '#0f172a';

    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => b.score - a.score);
  }, [agents]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Icons.Loader2 className="animate-spin text-brand-500" size={64} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-slate-900 p-8 font-sans text-white">
      <div className="mb-8 flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-brand-600 p-3 shadow-lg shadow-brand-500/30">
            <Icons.Trophy size={40} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white">Liga dos Corretores</h1>
            <p className="mt-1 flex items-center gap-2 text-xl font-medium text-slate-400">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500"></span>
              Ao Vivo
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-3xl font-black text-slate-200">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="font-medium uppercase tracking-widest text-slate-500">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="flex flex-col overflow-hidden rounded-[40px] border border-slate-700 bg-slate-800/50 shadow-2xl xl:col-span-2">
          <div className="border-b border-slate-700/50 bg-slate-800/80 p-8">
            <h3 className="flex items-center gap-3 text-2xl font-black">
              <Icons.List className="text-brand-400" size={28} />
              Classificação Geral
            </h3>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
                    Pos
                  </th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-widest text-slate-400">
                    Corretor
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
                    Pontos
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
                    Negocios
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
                    % Conv.
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-700/50">
                {sortedAgents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Icons.Trophy size={56} className="mb-4 text-slate-600" />
                        <p className="text-2xl font-bold text-slate-300">Aguardando os primeiros pontos da liga...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAgents.map((agent, index) => (
                    <tr key={agent.id} className="transition-colors hover:bg-slate-700/30">
                      <td className="px-6 py-6 text-center">
                        {index === 0 ? (
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500 text-xl font-black text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                            1º
                          </span>
                        ) : index === 1 ? (
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-300 text-xl font-black text-slate-800 shadow-[0_0_15px_rgba(203,213,225,0.3)]">
                            2º
                          </span>
                        ) : index === 2 ? (
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-xl font-black text-amber-100 shadow-[0_0_15px_rgba(217,119,6,0.4)]">
                            3º
                          </span>
                        ) : (
                          <span className="text-2xl font-black text-slate-500">{index + 1}º</span>
                        )}
                      </td>

                      <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                          {agent.avatar_url ? (
                            <img
                              src={agent.avatar_url}
                              alt={agent.name}
                              className="h-16 w-16 rounded-full border-2 border-slate-600 object-cover shadow-lg"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-700 text-xl font-black text-slate-200 shadow-lg">
                              {getAvatarInitial(agent.name)}
                            </div>
                          )}
                          <div>
                            <p className="text-2xl font-bold text-slate-100">{agent.name}</p>
                            <p className="mt-1 text-sm font-bold uppercase tracking-wider text-brand-400">
                              {agent.levelTitle}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-6 text-center">
                        <span className="text-4xl font-black text-white">{agent.score}</span>
                      </td>

                      <td className="px-6 py-6 text-center">
                        <span className="text-2xl font-bold text-slate-300">{agent.deals}</span>
                      </td>

                      <td className="px-6 py-6 text-center">
                        <span className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xl font-black text-emerald-400">
                          {agent.conversion}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col rounded-[40px] border border-slate-700 bg-slate-800/50 p-8 shadow-2xl">
          <h3 className="mb-8 flex items-center gap-3 text-2xl font-black tracking-tight text-white">
            <Icons.Activity className="text-rose-500" size={32} />
            Radar de atividades
          </h3>

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-4">
            {!activities || activities.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-30">
                <Icons.Radio size={64} className="mb-4 text-slate-500" />
                <p className="text-xl font-bold text-slate-400">Aguardando movimentações...</p>
              </div>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="animate-fade-in flex items-start gap-4 rounded-3xl border border-slate-700/50 bg-slate-800 p-5 shadow-sm"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                      act.value.includes('-')
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {act.value.includes('-') ? <Icons.AlertTriangle size={24} /> : <Icons.TrendingUp size={24} />}
                  </div>

                  <div>
                    <p className="text-lg leading-snug text-slate-300">
                      <span className="font-black text-white">{act.agentName}</span> {act.action}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={`text-xl font-black ${
                          act.value.includes('-') ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {act.value}
                      </span>
                      <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        | {act.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
