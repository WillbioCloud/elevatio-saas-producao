import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

import { GlassCard } from '../components/ui/GlassCard';
import { MetricCard } from '../components/ui/MetricCard';
import { ContractRow } from '../components/contracts/ContractRow';
import { ContractQuickViewSidebar } from '../components/contracts/ContractQuickViewSidebar';

import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import AdministrativeContractModal from '../components/AdministrativeContractModal';
import SignatureManagerModal from '../components/SignatureManagerModal';

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

export default function AdminContracts() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [contracts, setContracts] = useState<ContractWithSignatureState[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [signatureModalState, setSignatureModalState] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Mantém a conexão blindada do arquivo original (query por aliases + multi-tenant)
  const fetchContracts = async () => {
    if (!user) return;
    setLoading(true);

    let contractsQuery = supabase.from('contracts').select(`
        *,
        lead:leads!contracts_lead_id_fkey(*),
        property:properties(*),
        broker:profiles!contracts_broker_id_fkey(*)
      `);

    let installmentsQuery = supabase.from('installments').select('*');
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
        const signatureSummaryByContract = signatureRows.reduce<Record<string, ContractSignatureSummary>>((acc, signature) => {
          if (!signature.contract_id) return acc;

          const summary = acc[signature.contract_id] ?? { ...EMPTY_SIGNATURE_SUMMARY };
          summary.signatures_count += 1;

          if (signature.status === 'signed') {
            summary.signed_signatures_count += 1;
          } else {
            summary.pending_signatures_count += 1;
            if (signature.status === 'rejected') summary.rejected_signatures_count += 1;
          }

          acc[signature.contract_id] = summary;
          return acc;
        }, {});

        const validContracts = contractsRes.data.filter((c: any) => c.contract_data?.document_type !== 'intermediacao');

        // Compatibilidade visual: mantém aliases originais e expõe propriedades no plural para os novos componentes
        const hydratedContracts = validContracts.map((contract: any) => ({
          ...contract,
          properties: contract.properties || contract.property || null,
          leads: contract.leads || contract.lead || null,
          ...(signatureSummaryByContract[contract.id] ?? EMPTY_SIGNATURE_SUMMARY),
        }));

        setContracts(hydratedContracts);
      } else {
        console.error('Erro contratos:', contractsRes.error);
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
  }, [user?.company_id, user?.role]);

  const metrics = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'active');
    const pending = contracts.filter((c) => c.status === 'pending' || c.status === 'draft');
    const totalValue = active.reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0);
    const signedTotal = contracts.reduce((sum, c) => sum + (c.signed_signatures_count || 0), 0);
    const signaturesTotal = contracts.reduce((sum, c) => sum + (c.signatures_count || 0), 0);
    const health = signaturesTotal > 0 ? (signedTotal / signaturesTotal) * 100 : 0;
    return { active: active.length, pending: pending.length, totalValue, total: contracts.length, health };
  }, [contracts]);

  const upcomingInstallments = useMemo(
    () => installments.filter((i) => i.status !== 'paid').slice(0, 4),
    [installments]
  );

  const filteredContracts = contracts.filter((c) => {
    const searchLow = searchTerm.toLowerCase();
    const propertyName = c.properties?.title || c.property?.title || '';
    const leadName = c.leads?.name || c.lead?.name || '';

    const matchesSearch = propertyName.toLowerCase().includes(searchLow) || leadName.toLowerCase().includes(searchLow);

    if (filterType === 'signatures') return matchesSearch && c.pending_signatures_count > 0;

    const matchesType = filterType === 'all' || (filterType === 'administrative' ? !['sale', 'rent'].includes(c.type) : c.type === filterType);

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && c.status === 'active') ||
      (filterStatus === 'pending' && (c.status === 'pending' || c.status === 'draft')) ||
      (filterStatus === 'archived' && ['archived', 'ended'].includes(c.status));

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Contratos</h1>
          <p className="text-sm text-slate-500">Gerencie vendas, locações e documentos administrativos</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Locações</span>
            <span className="ml-2 text-brand-600 font-bold">{metrics.active}/{metrics.total}</span>
          </div>
          <div className="relative">
            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all">
              <Icons.Plus size={18} /> Novo Contrato <Icons.ChevronDown size={16} />
            </button>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <button onClick={() => { setIsSaleModalOpen(true); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg dark:bg-sky-500/10"><Icons.Building2 size={16} /></div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Compra e Venda</span>
                  </button>
                  <button onClick={() => { setIsRentModalOpen(true); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="p-1.5 bg-violet-100 text-violet-600 rounded-lg dark:bg-violet-500/10"><Icons.KeyRound size={16} /></div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Locação</span>
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                  <button onClick={() => { setIsAdminModalOpen(true); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg dark:bg-slate-800"><Icons.FileText size={16} /></div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Documento Administrativo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <MetricCard label="Total" value={metrics.total} icon={<Icons.FileSignature size={18} />} color="brand" />
        <MetricCard label="Ativos" value={metrics.active} icon={<Icons.CheckCircle2 size={18} />} color="emerald" />
        <MetricCard label="Pendentes" value={metrics.pending} icon={<Icons.Clock size={18} />} color="amber" />
        <MetricCard label="Assinados" value={contracts.reduce((sum, c) => sum + (c.signed_signatures_count || 0), 0)} icon={<Icons.PenTool size={18} />} color="blue" />
        <MetricCard label="Inadimplência" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(upcomingInstallments.reduce((sum, i) => sum + (Number(i.amount || 0)), 0))} icon={<Icons.AlertTriangle size={18} />} color="red" />
        <GlassCard className="p-4 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{metrics.health.toFixed(1)}%</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Saúde</div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Fluxo Financeiro</h3>
            <span className="text-xs text-slate-500">Últimos 6 meses</span>
          </div>
          <div className="h-36 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm text-slate-400">
            Visualização financeira resumida (design fiel) – dados ativos: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(metrics.totalValue)}
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Vencimentos</h3>
            <span className="text-xs text-red-500 font-semibold">{upcomingInstallments.filter((i) => new Date(i.due_date) < new Date()).length} atrasados</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {upcomingInstallments.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Sem vencimentos pendentes.</div>
            ) : (
              upcomingInstallments.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.payer_name || 'Cliente'}</div>
                    <div className="text-xs text-slate-500">{item.due_date ? new Date(item.due_date).toLocaleDateString('pt-BR') : '-'}</div>
                  </div>
                  <div className="text-sm font-bold text-orange-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.amount || 0))}</div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard variant="default" padding="none" className="overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/50 dark:bg-slate-900/50">
          <div className="flex gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl overflow-x-auto w-full md:w-auto custom-scrollbar">
            {['all', 'sale', 'rent', 'administrative', 'signatures'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  filterType === type ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {type === 'all' ? 'Todos' : type === 'sale' ? 'Vendas' : type === 'rent' ? 'Locações' : type === 'administrative' ? 'Administrativos' : 'Assinaturas'}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
              {[
                { key: 'active', label: 'Ativos' },
                { key: 'pending', label: 'Pendentes' },
                { key: 'archived', label: 'Arquivados' },
                { key: 'all', label: 'Todos' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilterStatus(item.key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition ${filterStatus === item.key ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white' : 'text-slate-500'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-56 shrink-0">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800/60">
                <th className="p-4">Contrato</th>
                <th className="p-4 hidden sm:table-cell">Tipo</th>
                <th className="p-4">Status</th>
                <th className="p-4 hidden lg:table-cell text-center">Assinaturas</th>
                <th className="p-4 hidden md:table-cell text-center">Data</th>
                <th className="p-4 text-right">Valor</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-12 text-center"><Icons.Loader2 className="animate-spin mx-auto text-brand-500 mb-2" /> Carregando...</td></tr>
              ) : filteredContracts.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500">Nenhum contrato encontrado.</td></tr>
              ) : (
                filteredContracts.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    onClick={(c) => { setSelectedContract(c); setIsSidebarOpen(true); }}
                    onOpenSignatures={(id) => setSignatureModalState({ contractId: id, companyId: user?.company_id })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <ContractQuickViewSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} contract={selectedContract} onOpenSignatures={(id) => { setIsSidebarOpen(false); setSignatureModalState({ contractId: id, companyId: user?.company_id }); }} onRefresh={fetchContracts} />
      <SaleContractModal isOpen={isSaleModalOpen} onClose={() => setIsSaleModalOpen(false)} onSuccess={fetchContracts} />
      <RentContractModal isOpen={isRentModalOpen} onClose={() => setIsRentModalOpen(false)} onSuccess={fetchContracts} />
      {isAdminModalOpen && <AdministrativeContractModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} onSuccess={fetchContracts} />}
      {signatureModalState && <SignatureManagerModal contractId={signatureModalState.contractId} companyId={signatureModalState.companyId} onClose={() => { setSignatureModalState(null); fetchContracts(); }} />}
    </div>
  );
}