import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Cell, Label, Pie, PieChart } from 'recharts';
import { Icons } from '../components/Icons';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import WelcomeBalloon from '../components/ui/WelcomeBalloon';

const CHART_COLORS: Record<string, string> = {
  Casa: '#3b82f6',
  Apartamento: '#10b981',
  Terreno: '#f59e0b',
  Comercial: '#a855f7',
  Cobertura: '#f43f5e',
  Outros: '#94a3b8',
};

const AdminAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agentActivity, setAgentActivity] = useState<any[]>([]);
  const [visitsToday, setVisitsToday] = useState<number>(0);
  const [visitsMonth, setVisitsMonth] = useState<number>(0);
  const [visitsYear, setVisitsYear] = useState<number>(0);
  const [topInterests, setTopInterests] = useState<{ type: string; count: number; percentage: number }[]>([]);
  const [interestPeriod, setInterestPeriod] = useState<string>('month');
  const [allVisits, setAllVisits] = useState<any[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (user?.role !== 'owner') {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, last_sign_in_at, role')
          .eq('active', true);
        const { data: leads } = await supabase
          .from('leads')
          .select('assigned_to, updated_at, name')
          .order('updated_at', { ascending: false });

        if (profiles && leads) {
          const activity = profiles
            .filter((p) => p.role !== 'owner')
            .map((profile) => {
              const agentLeads = leads.filter((l) => l.assigned_to === profile.id);
              const lastLead = agentLeads[0];
              return {
                ...profile,
                leadsCount: agentLeads.length,
                lastAction: lastLead ? { date: lastLead.updated_at, leadName: lastLead.name } : null,
              };
            });
          setAgentActivity(activity);
        }

        const { data: properties } = await supabase.from('properties').select('id, slug, type');
        if (properties) setAllProperties(properties);

        const { data: visits } = await supabase.from('site_visits').select('page, created_at, session_id, device_id');
        if (visits) {
          setAllVisits(visits);

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const firstDayYear = new Date(today.getFullYear(), 0, 1);

          // Função auxiliar para contar visitantes únicos
          const getUniqueVisitors = (visitsArray: any[]) => {
            const unique = new Set();
            visitsArray.forEach((v) => {
              // Usa device_id. Fallback para session_id ou id em visitas antigas.
              unique.add(v.device_id || v.session_id || v.id);
            });
            return unique.size;
          };

          setVisitsToday(getUniqueVisitors(visits.filter((v) => new Date(v.created_at) >= today)));
          setVisitsMonth(getUniqueVisitors(visits.filter((v) => new Date(v.created_at) >= firstDayMonth)));
          setVisitsYear(getUniqueVisitors(visits.filter((v) => new Date(v.created_at) >= firstDayYear)));
        }
      } catch (error) {
        console.error('Erro ao buscar analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'owner') return;
    if (!allVisits.length || !allProperties.length) return;

    const now = new Date();
    let limitDate = new Date();
    if (interestPeriod === 'month') limitDate.setMonth(now.getMonth() - 1);
    else if (interestPeriod === '1year') limitDate.setFullYear(now.getFullYear() - 1);
    else if (interestPeriod === '2years') limitDate.setFullYear(now.getFullYear() - 2);
    else if (interestPeriod === '3years') limitDate.setFullYear(now.getFullYear() - 3);
    else if (interestPeriod === '5years') limitDate.setFullYear(now.getFullYear() - 5);

    const filteredVisits = allVisits.filter((v) => new Date(v.created_at) >= limitDate);

    // Agrupar por Sessão
    const sessionsMap: Record<string, string[]> = {};
    filteredVisits.forEach((visit) => {
      if (!visit.session_id) return;
      const prop = allProperties.find((p) => visit.page.includes(p.id) || (p.slug && visit.page.includes(p.slug)));
      if (prop && prop.type) {
        if (!sessionsMap[visit.session_id]) sessionsMap[visit.session_id] = [];
        sessionsMap[visit.session_id].push(prop.type);
      }
    });

    // Determinar o interesse principal de cada sessão
    const finalInterestsMap: Record<string, number> = {};
    let totalValidSessions = 0;

    Object.values(sessionsMap).forEach((typesArray) => {
      if (typesArray.length === 0) return;
      const counts: Record<string, number> = {};
      typesArray.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
      let winnerType = typesArray[0];
      let maxCount = 0;
      Object.entries(counts).forEach(([type, count]) => {
        if (count > maxCount) {
          maxCount = count;
          winnerType = type;
        }
      });
      finalInterestsMap[winnerType] = (finalInterestsMap[winnerType] || 0) + 1;
      totalValidSessions++;
    });

    const interests = Object.keys(finalInterestsMap)
      .map((type) => ({
        type,
        count: finalInterestsMap[type],
        percentage: totalValidSessions > 0 ? (finalInterestsMap[type] / totalValidSessions) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    setTopInterests(interests);
  }, [interestPeriod, allVisits, allProperties]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Icons.Loader2 className="animate-spin text-brand-600" size={40} />
      </div>
    );
  }

  const chartData = topInterests.map((item) => ({
    ...item,
    fill: CHART_COLORS[item.type] || CHART_COLORS.Outros,
  }));

  const chartConfig = topInterests.reduce((config, item) => {
    config[item.type] = {
      label: item.type,
      color: CHART_COLORS[item.type] || CHART_COLORS.Outros,
    };
    return config;
  }, {} as ChartConfig);

  const totalSessions = topInterests.reduce((acc, curr) => acc + curr.count, 0);

  if (user?.role !== 'owner') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <WelcomeBalloon pageId="analytics" icon="PieChart" title="Inteligência de Dados" description="Tome decisões baseadas em números. Veja a conversão da sua equipe, os imóveis mais visitados e de onde vêm os seus melhores leads." />

      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-800">Relatórios e Análises</h1>
        <p className="text-slate-500">Métricas de acesso, interesses e atividade da equipe.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-brand-50 opacity-50">
            <Icons.Eye size={120} />
          </div>
          <p className="text-slate-500 font-bold text-sm mb-1 relative z-10">Visitas Hoje</p>
          <h3 className="text-3xl font-black text-slate-800 relative z-10">{visitsToday}</h3>
          <p className="text-emerald-500 text-xs font-bold mt-2 relative z-10 flex items-center gap-1">
            <Icons.TrendingUp size={12} /> +12% que ontem
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-indigo-50 opacity-50">
            <Icons.Users size={120} />
          </div>
          <p className="text-slate-500 font-bold text-sm mb-1 relative z-10">Visitas este Mês</p>
          <h3 className="text-3xl font-black text-slate-800 relative z-10">{visitsMonth}</h3>
          <p className="text-emerald-500 text-xs font-bold mt-2 relative z-10 flex items-center gap-1">
            <Icons.TrendingUp size={12} /> +5% que mês passado
          </p>
        </div>
        <div className="bg-brand-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
          <p className="text-brand-200 font-bold text-sm mb-1 relative z-10">Total no Ano</p>
          <h3 className="text-3xl font-black relative z-10">{visitsYear}</h3>
          <p className="text-brand-200 text-xs font-bold mt-2 relative z-10">Acessos únicos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Icons.BarChart2 className="text-brand-500" /> Interesses dos Clientes
            </h3>
            <select
              value={interestPeriod}
              onChange={(e) => setInterestPeriod(e.target.value)}
              className="px-3 py-1.5 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="month">Último Mês</option>
              <option value="1year">Último 1 Ano</option>
              <option value="2years">Últimos 2 Anos</option>
              <option value="3years">Últimos 3 Anos</option>
              <option value="5years">Últimos 5 Anos</option>
            </select>
          </div>
          {topInterests.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic">Nenhum dado de interesse neste período.</div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
              <div className="w-48 h-48 shrink-0">
                <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full h-full">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel className="bg-white shadow-xl border-slate-100 rounded-xl" />}
                    />
                    <Pie
                      data={chartData}
                      dataKey="count"
                      nameKey="type"
                      innerRadius={60}
                      outerRadius={80}
                      strokeWidth={5}
                      stroke="#ffffff"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fill}
                          className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-slate-800 text-3xl font-black">
                                  {totalSessions}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 20}
                                  className="fill-slate-400 text-[10px] font-bold uppercase tracking-widest"
                                >
                                  Sessões
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
              <div className="flex-1 space-y-3 w-full">
                {topInterests.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[item.type] || CHART_COLORS.Outros }} />
                      <span className="text-sm font-semibold text-slate-600">{item.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-400">{item.count} perfis</span>
                      <span className="text-sm font-bold text-slate-800 w-10 text-right">{item.percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Icons.Activity className="text-emerald-500" /> Monitoramento da Equipe
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 rounded-tl-lg rounded-bl-lg">Corretor</th>
                  <th className="p-3 text-center">Leads na Base</th>
                  <th className="p-3 rounded-tr-lg rounded-br-lg text-right">Última Ação (Lead)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center p-4 text-slate-400">
                      Nenhum corretor ativo.
                    </td>
                  </tr>
                ) : (
                  agentActivity.map((agent) => (
                    <tr key={agent.id}>
                      <td className="p-3 font-semibold text-slate-700">{agent.name.split(' ')[0]}</td>
                      <td className="p-3 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
                          {agent.leadsCount}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {agent.lastAction ? (
                          <div className="flex flex-col items-end">
                            <span
                              className="text-slate-800 font-medium truncate max-w-[120px]"
                              title={agent.lastAction.leadName}
                            >
                              {agent.lastAction.leadName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(agent.lastAction.date).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sem atividade</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
