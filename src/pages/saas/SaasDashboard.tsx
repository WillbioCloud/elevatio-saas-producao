import { useEffect, useState } from 'react';
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { supabase } from '@/lib/supabase';

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function SaasDashboard() {
  const [stats, setStats] = useState([
    { name: 'Total de Clientes Ativos', value: '0', icon: Users, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
    { name: 'Receita Recorrente (MRR)', value: 'R$ 0,00', icon: CreditCard, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
    { name: 'Novos Clientes (Mês)', value: '0', icon: Building2, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
    { name: 'Cancelamentos (Mês)', value: '0', icon: UserMinus, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
  ]);
  const [revenueData, setRevenueData] = useState<{ name: string; revenue: number }[]>([]);
  const [planData, setPlanData] = useState<{ name: string; users: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [{ data: companies, error: companiesError }, { data: payments, error: paymentsError }] = await Promise.all([
          supabase.from('companies').select('*'),
          supabase.from('saas_payments').select('*'),
        ]);

        if (companiesError || paymentsError) throw companiesError || paymentsError;

        const companiesData = companies ?? [];
        const paymentsData = payments ?? [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const activeCustomers = companiesData.filter((c: { active?: boolean }) => c.active === true).length;
        const newCustomersThisMonth = companiesData.filter((c: { created_at?: string }) => {
          if (!c.created_at) return false;
          const d = new Date(c.created_at);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
        const inactiveCustomers = companiesData.filter((c: { active?: boolean }) => c.active === false).length;

        const mrr = paymentsData
          .filter((p: { status?: string; paid_at?: string; reference_month?: string }) => {
            if (p.status !== 'paid') return false;
            const paymentDate = p.paid_at ? new Date(p.paid_at) : p.reference_month ? new Date(p.reference_month) : null;
            if (!paymentDate || Number.isNaN(paymentDate.getTime())) return false;
            return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
          })
          .reduce((sum: number, p: { amount?: number }) => sum + (Number(p.amount) || 0), 0);

        const formattedMrr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrr);

        setStats([
          { name: 'Total de Clientes Ativos', value: activeCustomers.toLocaleString('pt-BR'), icon: Users, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
          { name: 'Receita Recorrente (MRR)', value: formattedMrr, icon: CreditCard, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
          { name: 'Novos Clientes (Mês)', value: newCustomersThisMonth.toLocaleString('pt-BR'), icon: Building2, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
          { name: 'Cancelamentos (Mês)', value: inactiveCustomers.toLocaleString('pt-BR'), icon: UserMinus, change: '0%', changeType: 'positive', description: 'dados em tempo real' },
        ]);

        const planCounts = companiesData
          .filter((c: { active?: boolean }) => c.active === true)
          .reduce((acc: Record<string, number>, c: { plan?: string; plan_status?: string }) => {
            const planName = (c.plan ?? c.plan_status) || 'Sem plano';
            acc[planName] = (acc[planName] || 0) + 1;
            return acc;
          }, {});

        const nextPlanData = Object.entries(planCounts)
          .map(([name, users]) => ({ name, users: Number(users) }))
          .sort((a, b) => b.users - a.users);
        setPlanData(nextPlanData);

        const monthlyRevenueMap = paymentsData
          .filter((p: { status?: string }) => p.status === 'paid')
          .reduce((acc: Record<string, number>, p: { paid_at?: string; reference_month?: string; amount?: number }) => {
            const rawDate = p.paid_at || p.reference_month;
            if (!rawDate) return acc;
            const d = new Date(rawDate);
            if (Number.isNaN(d.getTime())) return acc;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            acc[key] = (acc[key] || 0) + (Number(p.amount) || 0);
            return acc;
          }, {});

        const nextRevenueData = Object.entries(monthlyRevenueMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, revenue]) => {
            const [, month] = key.split('-');
            const monthIndex = Number(month) - 1;
            return { name: `${monthNames[monthIndex]}/${key.slice(0, 4).slice(2)}`, revenue: Number(revenue) };
          });
        setRevenueData(nextRevenueData);
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">A carregar dados do painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Dashboard</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Visão geral do desempenho e faturamento do Elevatio Vendas.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</CardTitle>
              <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-md">
                <stat.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
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
                ) : (
                  <span className="flex items-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-md font-medium">
                    <ArrowDownRight className="mr-1 h-3 w-3" />
                    {stat.change}
                  </span>
                )}
                <span className="ml-2 text-slate-500 dark:text-slate-400">{stat.description}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">Evolução da Receita (MRR)</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">Crescimento do faturamento recorrente ao longo do ano.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$ ${Number(value) / 1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} itemStyle={{ color: '#818cf8' }} formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita']} />
                  <Line type="monotone" dataKey="revenue" stroke="#818cf8" strokeWidth={3} dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">Adesões por Plano</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">Distribuição de clientes ativos nos planos.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#334155', opacity: 0.1 }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} itemStyle={{ color: '#818cf8' }} formatter={(value: number) => [value, 'Clientes']} />
                  <Bar dataKey="users" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
