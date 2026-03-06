import React, { useEffect, useState } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  UserMinus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { PLANS } from '../../config/plans';

export default function SaasDashboard() {
  const [stats, setStats] = useState([
    {
      name: 'Total de Clientes Ativos',
      value: '0',
      icon: Users,
      change: '-',
      changeType: 'neutral' as const,
      description: 'Trial e Ativos'
    },
    {
      name: 'Receita Recorrente (MRR)',
      value: 'R$ 0,00',
      icon: CreditCard,
      change: '-',
      changeType: 'neutral' as const,
      description: 'Baseado em contratos ativos'
    },
    {
      name: 'Novos Clientes (Mês)',
      value: '0',
      icon: Building2,
      change: '-',
      changeType: 'neutral' as const,
      description: 'Criados este mês'
    },
    {
      name: 'Cancelamentos (Churn)',
      value: '0',
      icon: UserMinus,
      change: '-',
      changeType: 'neutral' as const,
      description: 'Contratos cancelados'
    },
  ]);

  const [planData, setPlanData] = useState<{ name: string; users: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [{ data: companies }, { data: contracts }] = await Promise.all([
          supabase.from('companies').select('id, plan_status, created_at'),
          supabase.from('saas_contracts').select('id, status, plan_name, canceled_at')
        ]);

        const companiesData = companies || [];
        const contractsData = contracts || [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 1. Clientes Ativos (Active ou Trial)
        const activeCustomers = companiesData.filter(c => 
          c.plan_status === 'active' || c.plan_status === 'trial'
        ).length;

        // 2. Novos Clientes no Mês Atual
        const newCustomersThisMonth = companiesData.filter(c => {
          if (!c.created_at) return false;
          const d = new Date(c.created_at);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        // 3. Cancelamentos (Churn)
        const churnedContracts = contractsData.filter(c => c.status === 'canceled').length;

        // 4. Cálculo de MRR (Soma dos preços dos planos ATIVOS)
        let mrr = 0;
        const activeContracts = contractsData.filter(c => c.status === 'active');
        
        activeContracts.forEach(contract => {
          // Busca o preço no arquivo de configuração
          const planDef = PLANS.find(p => p.id === contract.plan_name);
          if (planDef) {
            mrr += planDef.priceMensal; // Usa o preço mensal
          }
        });

        const formattedMrr = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(mrr);

        setStats([
          {
            name: 'Total de Clientes Ativos',
            value: activeCustomers.toString(),
            icon: Users,
            change: '+100%',
            changeType: 'positive',
            description: 'Trial e Ativos'
          },
          {
            name: 'Receita Recorrente (MRR)',
            value: formattedMrr,
            icon: CreditCard,
            change: 'MRR Vitalício',
            changeType: 'positive',
            description: 'Assinaturas consolidadas'
          },
          {
            name: 'Novos Clientes (Mês)',
            value: newCustomersThisMonth.toString(),
            icon: Building2,
            change: 'Neste mês',
            changeType: 'positive',
            description: 'Entradas recentes'
          },
          {
            name: 'Cancelamentos (Churn)',
            value: churnedContracts.toString(),
            icon: UserMinus,
            change: 'Histórico',
            changeType: churnedContracts > 0 ? 'negative' : 'neutral',
            description: 'Contratos inativos'
          },
        ]);

        // 5. Dados para o Gráfico de Planos (Adesão por Plano)
        const planCounts = activeContracts.reduce((acc: Record<string, number>, c) => {
          const planName = c.plan_name || 'Desconhecido';
          // Capitaliza o nome do plano
          const formattedName = planName.charAt(0).toUpperCase() + planName.slice(1);
          acc[formattedName] = (acc[formattedName] || 0) + 1;
          return acc;
        }, {});

        const nextPlanData = Object.entries(planCounts)
          .map(([name, users]) => ({ name, users: Number(users) }))
          .sort((a, b) => b.users - a.users);

        setPlanData(nextPlanData);
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Dashboard SaaS</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Carregando métricas da empresa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Visão Geral</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Acompanhe a saúde financeira e o crescimento do seu SaaS.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</CardTitle>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-md">
                <stat.icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{stat.value}</div>
              <p className="flex items-center text-xs mt-2">
                {stat.changeType === 'positive' ? (
                  <span className="flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md font-medium">
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                    {stat.change}
                  </span>
                ) : stat.changeType === 'negative' ? (
                  <span className="flex items-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-md font-medium">
                    <ArrowDownRight className="mr-1 h-3 w-3" />
                    {stat.change}
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">{stat.change}</span>
                )}
                <span className="ml-2 text-slate-500 dark:text-slate-400 truncate">{stat.description}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">Distribuição de Planos Ativos</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">Quais planos trazem mais receita e volume de clientes.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[320px] w-full mt-4">
              {planData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">
                  Nenhum contrato ativo para gerar gráfico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#334155', opacity: 0.1 }}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        color: '#f8fafc',
                        borderRadius: '8px'
                      }}
                      itemStyle={{ color: '#818cf8' }}
                      formatter={(value: number) => [value, 'Clientes']}
                    />
                    <Bar dataKey="users" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
