import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from '../components/Icons';
// Importação direta para garantir que os ícones dos botões não fiquem undefined
import { ChevronDown, Plus, Building2, KeyRound, FileText, Search, Loader2 } from 'lucide-react';

// UI Components
import { GlassCard } from '../components/ui/GlassCard';
import { MetricCard } from '../components/ui/MetricCard';
import { ContractRow } from '../components/contracts/ContractRow';
import { ContractQuickViewSidebar } from '../components/contracts/ContractQuickViewSidebar';

// Modais (Importações Default rigorosas)
import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import AdministrativeContractModal from '../components/AdministrativeContractModal';
import SignatureManagerModal from '../components/SignatureManagerModal';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import { RadialProgress } from '../components/ui/RadialProgress';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ContractSignatureRow {
  contract_id: string | null;
  status: 'pending' | 'signed' | 'rejected' | null;
}
interface ContractSignatureSummary {
  signatures_count: number;
  pending_signatures_count: number;
  signed_signatures_count: number;
  rejected_signatures_count: number;
}
type ContractWithSignatureState = any & ContractSignatureSummary;

const EMPTY_SIGNATURE_SUMMARY: ContractSignatureSummary = {
  signatures_count: 0,
  pending_signatures_count: 0,
  signed_signatures_count: 0,
  rejected_signatures_count: 0,
};

type ViewMode = 'all' | 'sale' | 'rent' | 'administrative';
type StatusFilter = 'active' | 'pending' | 'archived' | 'all';

// ─── Formatação ───────────────────────────────────────────────────────────────
const currency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return currency(v);
};

const cn = (...classes: (string | boolean | undefined | null)[]) =>
  classes.filter(Boolean).join(' ');

// ─── Helper ───────────────────────────────────────────────────────────────────
const getMonthRange = () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    monthStartISO: monthStart.toISOString().split('T')[0],
    monthEndISO: monthEnd.toISOString().split('T')[0],
  };
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AdminContracts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  // ── Estado de dados ──
  const [contracts, setContracts] = useState<ContractWithSignatureState[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filtros ──
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // ── Modais ──
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [signatureModalState, setSignatureModalState] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // ── UI ──
  const [showOverduePanel, setShowOverduePanel] = useState(false);

  // ── Busca de dados ────────────────────────────────────────────────────────
  const fetchContracts = async () => {
    if (!user) return;
    setLoading(true);

    const { monthStartISO, monthEndISO } = getMonthRange();

    let contractsQuery = supabase.from('contracts').select(`
      *,
      lead:leads!contracts_lead_id_fkey(name, email),
      property:properties(*),
      broker:profiles!contracts_broker_id_fkey(*)
    `);

    // Busca TODOS os installments (para gráfico mensal)
    let installmentsQuery = supabase
      .from('installments')
      .select('*')
      .in('status', ['paid', 'pending']);

    let signaturesQuery = supabase.from('contract_signatures').select('contract_id, status');

    if (!isSuperAdmin && user.company_id) {
      contractsQuery = contractsQuery.eq('company_id', user.company_id);
      installmentsQuery = installmentsQuery.eq('company_id', user.company_id);
      signaturesQuery = signaturesQuery.eq('company_id', user.company_id);
    }

    try {
      const [contractsRes, installmentsRes, signaturesRes] = await Promise.all([
        contractsQuery.order('created_at', { ascending: false }),
        installmentsQuery.order('due_date', { ascending: true }),
        signaturesQuery,
      ]);

      if (!contractsRes.error && contractsRes.data) {
        const signatureRows = (signaturesRes.data as ContractSignatureRow[] | null) ?? [];
        const signatureSummaryByContract = signatureRows.reduce<Record<string, ContractSignatureSummary>>(
          (acc, sig) => {
            if (!sig.contract_id) return acc;
            const summary = acc[sig.contract_id] ?? { ...EMPTY_SIGNATURE_SUMMARY };
            summary.signatures_count += 1;
            if (sig.status === 'signed') {
              summary.signed_signatures_count += 1;
            } else {
              summary.pending_signatures_count += 1;
              if (sig.status === 'rejected') summary.rejected_signatures_count += 1;
            }
            acc[sig.contract_id] = summary;
            return acc;
          },
          {}
        );

        const validContracts = contractsRes.data.filter(
          (c: any) => c.contract_data?.document_type !== 'intermediacao'
        );

        const hydratedContracts = validContracts.map((contract: any) => ({
          ...contract,
          properties: contract.properties || contract.property || null,
          leads: contract.leads || contract.lead || null,
          ...(signatureSummaryByContract[contract.id] ?? EMPTY_SIGNATURE_SUMMARY),
        }));

        setContracts(hydratedContracts);
      }

      if (!installmentsRes.error && installmentsRes.data) {
        setInstallments(installmentsRes.data);
      }
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchContracts();
  }, [user]);

  // ── Métricas calculadas ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeContracts = contracts.filter((c) => c.status === 'active');
    const activeRentContracts = activeContracts.filter((c) => c.type === 'rent');
    const activeRentCount = activeRentContracts.length;

    // VGV: soma de vendas ativas criadas neste ano
    const vgv = activeContracts
      .filter((c) => c.type === 'sale' && new Date(c.created_at).getFullYear() === cy)
      .reduce((sum, c) => sum + (Number(c.sale_total_value || c.contract_value) || 0), 0);

    // MRR: soma de valores mensais de locações ativas
    const mrr = activeRentContracts.reduce(
      (sum, c) => sum + (Number(c.rent_value || c.contract_value) || 0),
      0
    );

    // Received/receivable do mês corrente
    let recebido = 0, aReceber = 0, inadimplencia = 0;
    installments.forEach((i) => {
      const due = new Date(i.due_date);
      const isCM = due.getMonth() === cm && due.getFullYear() === cy;
      const isOverdue = due < today && i.status !== 'paid';
      if (i.status === 'paid' && isCM) recebido += Number(i.amount);
      if (i.status === 'pending' && isCM && !isOverdue) aReceber += Number(i.amount);
      if (isOverdue) inadimplencia += Number(i.amount);
    });

    // Saúde financeira
    const totalEsperado = recebido + aReceber + inadimplencia;
    const saude =
      totalEsperado > 0
        ? Number((((recebido + aReceber) / totalEsperado) * 100).toFixed(1))
        : 100;

    // Próximos vencimentos (14 dias)
    const limite14 = new Date();
    limite14.setDate(limite14.getDate() + 14);
    limite14.setHours(23, 59, 59, 999);
    const proximos = installments
      .filter((i) => {
        if (i.status === 'paid') return false;
        const d = new Date(i.due_date);
        return d >= today && d <= limite14;
      })
      .slice(0, 8);

    // Atrasados
    const atrasados = installments
      .filter((i) => i.status !== 'paid' && new Date(i.due_date) < today)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    // Dados mensais para gráfico (6 meses)
    const monthlyData: { month: string; recebido: number; aReceber: number }[] = [];
    for (let m = 0; m < 6; m++) {
      const date = new Date(cy, cm - 5 + m);
      const monthName = date
        .toLocaleString('pt-BR', { month: 'short' })
        .replace('.', '');
      let rec = 0, ar = 0;
      installments.forEach((i) => {
        const d = new Date(i.due_date);
        if (d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear()) {
          if (i.status === 'paid') rec += Number(i.amount);
          else ar += Number(i.amount);
        }
      });
      monthlyData.push({
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        recebido: rec,
        aReceber: ar,
      });
    }

    const vendas = activeContracts.filter((c) => c.type === 'sale').length;
    const locacoes = activeRentCount;

    return {
      vgv, mrr, recebido, aReceber, inadimplencia, saude,
      proximos, atrasados, monthlyData, vendas, locacoes,
      active: activeContracts.length,
      total: contracts.length,
      activeRentCount,
    };
  }, [contracts, installments]);

  const activeContractsLimit = 50;

  // ── Filtros de contratos ──────────────────────────────────────────────────
  const filteredContracts = useMemo(() => {
    let list = contracts;

    if (viewMode === 'sale') list = list.filter((c) => c.type === 'sale');
    else if (viewMode === 'rent') list = list.filter((c) => c.type === 'rent');
    else if (viewMode === 'administrative')
      list = list.filter((c) => !['sale', 'rent'].includes(c.type));

    if (statusFilter === 'active') list = list.filter((c) => c.status === 'active');
    else if (statusFilter === 'pending')
      list = list.filter((c) => c.status === 'pending' || c.status === 'draft');
    else if (statusFilter === 'archived')
      list = list.filter((c) => ['archived', 'ended'].includes(c.status));

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          (c.properties?.title || '').toLowerCase().includes(q) ||
          (c.leads?.name || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [contracts, viewMode, statusFilter, searchTerm]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDeleteContract = async (contract: any) => {
    if (!window.confirm('Deseja realmente excluir este contrato?')) return;
    const { error } = await supabase.from('contracts').delete().eq('id', contract.id);
    if (error) { console.error('Erro ao excluir contrato:', error); return; }
    await fetchContracts();
  };

  // ── View mode config ──────────────────────────────────────────────────────
  const viewModes: { key: ViewMode; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'Todos', icon: <Icons.LayoutGrid size={13} />, count: contracts.length },
    { key: 'sale', label: 'Vendas', icon: <Icons.Building2 size={13} />, count: contracts.filter((c) => c.type === 'sale').length },
    { key: 'rent', label: 'Locações', icon: <Icons.KeyRound size={13} />, count: contracts.filter((c) => c.type === 'rent').length },
    { key: 'administrative', label: 'Administrativos', icon: <Icons.FileText size={13} />, count: contracts.filter((c) => !['sale', 'rent'].includes(c.type)).length },
  ];

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'active', label: 'Ativos' },
    { key: 'pending', label: 'Pendentes' },
    { key: 'archived', label: 'Arquivados' },
    { key: 'all', label: 'Todos' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative animate-in fade-in pb-12">

      {/* Orbs de atmosfera */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-100/25 blur-3xl dark:bg-indigo-900/10" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-violet-100/20 blur-3xl dark:bg-violet-900/10" />
        <div className="absolute bottom-0 right-1/3 w-[350px] h-[350px] rounded-full bg-sky-100/20 blur-3xl dark:bg-sky-900/10" />
      </div>

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Contratos
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Gerencie vendas, locações e documentos administrativos
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Indicador de uso */}
          <GlassCard padding="none" className="px-3 py-2 flex items-center gap-2.5 min-w-[160px]">
            <RadialProgress
              value={(stats.activeRentCount / 10) * 100}
              size={32}
              strokeWidth={3}
              color={stats.activeRentCount < 10 ? '#6366f1' : '#ef4444'}
              trackColor="rgba(0,0,0,0.06)"
            >
              <span className="text-[8px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                {stats.activeRentCount}
              </span>
            </RadialProgress>
            <div className="text-[11px]">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Locações</p>
              <p className="text-slate-400 tabular-nums">{stats.activeRentCount}/10</p>
            </div>
          </GlassCard>

          <div className="relative">
            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all">
              <Plus size={18} /> Novo Contrato <ChevronDown size={16} />
            </button>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <button onClick={() => { setIsSaleModalOpen(true); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg dark:bg-sky-500/10"><Building2 size={16} /></div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Compra e Venda</span>
                  </button>
                  <button onClick={() => { setIsRentModalOpen(true); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="p-1.5 bg-violet-100 text-violet-600 rounded-lg dark:bg-violet-500/10"><KeyRound size={16} /></div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Locação</span>
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                  <button onClick={() => { setIsAdminModalOpen(true); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg dark:bg-slate-800"><FileText size={16} /></div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Documento Administrativo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── MÉTRICAS (6 cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <MetricCard label="VGV do Ano"    value={shortCurrency(stats.vgv)}          icon={<Icons.Building2 size={17} />}      color="default"  compact />
        <MetricCard label="MRR Ativo"     value={shortCurrency(stats.mrr)}          icon={<Icons.KeyRound size={17} />}       color="violet"   compact />
        <MetricCard label="Recebido"      value={shortCurrency(stats.recebido)}     icon={<Icons.TrendingUp size={17} />}     color="emerald"  compact />
        <MetricCard label="A Receber"     value={shortCurrency(stats.aReceber)}     icon={<Icons.Clock size={17} />}          color="blue"     compact />
        <MetricCard label="Inadimplência" value={shortCurrency(stats.inadimplencia)} icon={<Icons.AlertTriangle size={17} />} color="red"      compact />

        {/* Saúde Financeira */}
        <div onClick={() => setShowOverduePanel((v) => !v)} className="cursor-pointer">
          <GlassCard hoverable className="h-full flex flex-col items-center justify-center py-3">
            <RadialProgress
              value={stats.saude}
              size={54}
              strokeWidth={5}
              color={stats.saude >= 90 ? '#10b981' : stats.saude >= 70 ? '#f59e0b' : '#ef4444'}
              trackColor="rgba(0,0,0,0.06)"
            >
              <span className={cn(
                'text-[13px] font-bold tabular-nums',
                stats.saude >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                stats.saude >= 70 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-600 dark:text-red-400'
              )}>
                {stats.saude}%
              </span>
            </RadialProgress>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-2">Saúde</p>
          </GlassCard>
        </div>
      </div>

      {/* ── GRÁFICO + VENCIMENTOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">

        {/* Gráfico de área */}
        <GlassCard variant="elevated" padding="lg" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Fluxo Financeiro</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Recebido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> A Receber
              </span>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.13} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => shortCurrency(v)}
                  width={62}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: 12, border: 'none',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    background: 'rgba(255,255,255,0.95)',
                    fontSize: 12,
                  }}
                  formatter={(value: any) => [
                    typeof value === 'number' ? currency(value as number) : String(value),
                  ]}
                />
                <Area type="monotone" dataKey="recebido" stroke="#10b981" strokeWidth={2} fill="url(#gradRec)" dot={false} name="Recebido" />
                <Area type="monotone" dataKey="aReceber" stroke="#60a5fa" strokeWidth={2} fill="url(#gradAR)" dot={false} name="A Receber" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Próximos vencimentos */}
        <GlassCard variant="elevated" padding="none" className="lg:col-span-2 flex flex-col overflow-hidden" style={{ maxHeight: 340 }}>
          <div className="px-5 py-3.5 border-b border-slate-100/80 dark:border-slate-800/60 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                <Icons.Calendar size={14} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Vencimentos</h3>
              <span className="text-[11px] text-slate-400">(14 dias)</span>
            </div>
            {stats.atrasados.length > 0 && (
              <button
                onClick={() => setShowOverduePanel((v) => !v)}
                className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                {stats.atrasados.length} atrasados
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {stats.proximos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 p-3 mb-3">
                  <Icons.CheckCircle2 size={18} className="text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tudo em dia!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Nenhuma parcela próxima</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
                {stats.proximos.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {item.payer_name || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {item.due_date ? new Date(item.due_date).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {currency(Number(item.amount || 0))}
                      </span>
                      <Icons.ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* ── PAINEL DE INADIMPLÊNCIA (expansível) ── */}
      {showOverduePanel && stats.atrasados.length > 0 && (
        <div className="mb-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <GlassCard padding="none" className="border-red-200/50 dark:border-red-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-red-50/60 dark:bg-red-500/10 border-b border-red-100/50 dark:border-red-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icons.AlertTriangle size={14} className="text-red-500" />
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Parcelas em Atraso ({stats.atrasados.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-red-600 dark:text-red-400 tabular-nums">
                  Total: {currency(stats.inadimplencia)}
                </span>
                <button
                  onClick={() => setShowOverduePanel(false)}
                  className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Icons.X size={14} className="text-red-400" />
                </button>
              </div>
            </div>
            <div className="max-h-[220px] overflow-y-auto divide-y divide-red-50 dark:divide-red-500/10">
              {stats.atrasados.map((item) => {
                const daysLate = Math.floor(
                  (new Date().getTime() - new Date(item.due_date).getTime()) / 86400000
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                        {item.payer_name || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Venceu em {new Date(item.due_date).toLocaleDateString('pt-BR')}
                        <span className="ml-1.5 text-red-500 font-semibold">· {daysLate}d atraso</span>
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
                      {currency(Number(item.amount || 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── LISTA UNIFICADA DE CONTRATOS ── */}
      <GlassCard variant="elevated" padding="none" className="overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-100/80 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center gap-3 bg-white/40 dark:bg-slate-900/40">

          {/* Chips de tipo com contadores */}
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto pb-0.5 scrollbar-none">
            {viewModes.map((vm) => (
              <button
                key={vm.key}
                onClick={() => setViewMode(vm.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all whitespace-nowrap',
                  viewMode === vm.key
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {vm.icon}
                {vm.label}
                <span className={cn(
                  'tabular-nums rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                  viewMode === vm.key
                    ? 'bg-white/20 dark:bg-black/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                )}>
                  {vm.count}
                </span>
              </button>
            ))}
          </div>

          {/* Status + busca */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 p-0.5">
              {statusFilters.map((sf) => (
                <button
                  key={sf.key}
                  onClick={() => setStatusFilter(sf.key)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all',
                    statusFilter === sf.key
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  )}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-40 rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 pl-8 pr-3 py-2 text-[12px] text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Header da tabela — desktop */}
        <div className="hidden md:grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-2.5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100/50 dark:border-slate-800/40">
          {['Contrato', 'Tipo', 'Status', 'Assinaturas', 'Data', ''].map((h, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sr-only">
              <tr>
                <th>Contrato</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Assinaturas</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-500 mb-2" size={28} />
                    <p className="text-sm text-slate-400">Carregando contratos...</p>
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="inline-flex rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 mb-4">
                      <Icons.FileText size={26} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Nenhum contrato encontrado
                    </p>
                    <p className="text-[12px] text-slate-400 mt-1 max-w-xs mx-auto">
                      {searchTerm
                        ? 'Tente buscar com outros termos'
                        : 'Crie seu primeiro contrato usando o botão acima'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    onClick={(c) => { setSelectedContract(c); setIsSidebarOpen(true); }}
                    onOpenSignatures={(id) =>
                      setSignatureModalState({ contractId: id, companyId: user?.company_id })
                    }
                    onManageContract={(id) => navigate(`/admin/contratos/${id}`)}
                    onDeleteContract={handleDeleteContract}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredContracts.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100/80 dark:border-slate-800/40 bg-slate-50/30 dark:bg-slate-900/20 flex items-center justify-between">
            <p className="text-[11px] text-slate-400 tabular-nums">
              {filteredContracts.length} contrato{filteredContracts.length !== 1 ? 's' : ''} encontrado{filteredContracts.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                {stats.vendas} venda{stats.vendas !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                {stats.locacoes} locaç{stats.locacoes !== 1 ? 'ões' : 'ão'}
              </span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* ── MODAIS E SIDEBAR ── */}
      <ContractQuickViewSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        contract={selectedContract}
        onOpenSignatures={(id) => {
          setIsSidebarOpen(false);
          setSignatureModalState({ contractId: id, companyId: user?.company_id });
        }}
        onRefresh={fetchContracts}
      />

      <SaleContractModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        onSuccess={fetchContracts}
      />
      <RentContractModal
        isOpen={isRentModalOpen}
        onClose={() => setIsRentModalOpen(false)}
        onSuccess={fetchContracts}
      />
      {isAdminModalOpen && (
        <AdministrativeContractModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onSuccess={fetchContracts}
        />
      )}
      {signatureModalState && (
        <SignatureManagerModal
          contractId={signatureModalState.contractId}
          companyId={signatureModalState.companyId}
          onClose={() => { setSignatureModalState(null); fetchContracts(); }}
        />
      )}
    </div>
  );
}