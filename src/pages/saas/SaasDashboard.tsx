import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  UserMinus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '../../../components/ui/skeleton';

export default function SaasDashboard() {
  const [, setClients] = useState<any[]>([]);
  const [contractsList, setContractsList] = useState<any[]>([]);
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
  const [dashboardMetrics, setDashboardMetrics] = useState({
    activeCustomers: 0,
    newCustomersThisMonth: 0,
    churnedContracts: 0,
  });

  const totalMRR = useMemo(() => {
    return contractsList.reduce((acc, contract) => {
      if (contract.status === 'active') {
        return acc + (Number(contract.price) || 0);
      }
      return acc;
    }, 0);
  }, [contractsList]);

  useEffect(() => {
    const formattedMrr = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(totalMRR);

    setStats([
      {
        name: 'Total de Clientes Ativos',
        value: dashboardMetrics.activeCustomers.toString(),
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
        value: dashboardMetrics.newCustomersThisMonth.toString(),
        icon: Building2,
        change: 'Neste mês',
        changeType: 'positive',
        description: 'Entradas recentes'
      },
      {
        name: 'Cancelamentos (Churn)',
        value: dashboardMetrics.churnedContracts.toString(),
        icon: UserMinus,
        change: 'Histórico',
        changeType: dashboardMetrics.churnedContracts > 0 ? 'negative' : 'neutral',
        description: 'Contratos inativos'
      },
    ]);
  }, [dashboardMetrics, totalMRR]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [{ data: companies }, { data: contracts }] = await Promise.all([
          supabase.from('companies').select('id, active, plan, manual_discount_value, manual_discount_type, plan_status, created_at'),
          supabase.from('saas_contracts').select('id, status, plan_name, canceled_at, price')
        ]);

        const companiesData = companies || [];
        const contractsData = contracts || [];
        setClients(companiesData);
        setContractsList(contractsData);

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const activeCustomers = companiesData.filter(c =>
          c.plan_status === 'active' || c.plan_status === 'trial'
        ).length;

        const newCustomersThisMonth = companiesData.filter(c => {
          if (!c.created_at) return false;
          const d = new Date(c.created_at);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        const churnedContracts = contractsData.filter(c => c.status === 'canceled').length;
        const activeContracts = contractsData.filter(c => c.status === 'active');

        setDashboardMetrics({
          activeCustomers,
          newCustomersThisMonth,
          churnedContracts,
        });

        const planCounts = activeContracts.reduce((acc: Record<string, number>, c) => {
          const planName = c.plan_name || 'Desconhecido';
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
      <div className="space-y-8 animate-in fade-in duration-500 p-6 max-w-7xl mx-auto">
        <div><Skeleton className="h-8 w-64 mb-2" /><Skeleton className="h-4 w-80" /></div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Visão Geral</h2>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe a saúde financeira e o crescimento do seu SaaS.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
              <div className="p-2 bg-muted/30 rounded-md">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
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
                  <span className="text-muted-foreground font-medium">{stat.change}</span>
                )}
                <span className="ml-2 text-muted-foreground truncate">{stat.description}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Distribuição de Planos Ativos</CardTitle>
            <CardDescription className="text-muted-foreground">Quais planos trazem mais receita e volume de clientes.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[320px] w-full mt-4">
              {planData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum contrato ativo para gerar gráfico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--popover-foreground))',
                        borderRadius: '8px'
                      }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                      formatter={(value: number) => [value, 'Clientes']}
                    />
                    <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
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