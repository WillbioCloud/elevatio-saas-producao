import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Novos Componentes UI
import { GlassCard } from '../components/ui/GlassCard';
import { MetricCard } from '../components/ui/MetricCard';
import { ContractRow } from '../components/contracts/ContractRow';
import { ContractQuickViewSidebar } from '../components/contracts/ContractQuickViewSidebar';

// Modais Antigos e Motores
import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import AdministrativeContractModal from '../components/AdministrativeContractModal';
import SignatureManagerModal from '../components/SignatureManagerModal';

export default function AdminContracts() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Estados de Modais
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [signatureModalState, setSignatureModalState] = useState<any>(null);
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);

  const fetchContracts = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *, 
        property:properties(title, address), 
        lead:leads!contracts_lead_id_fkey(name, phone),
        signatures:contract_signatures(status)
      `)
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false });

    if (!error && data) setContracts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchContracts();
  }, [user?.company_id]);

  // Cálculos de Métricas
  const metrics = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'active');
    const pending = contracts.filter((c) => c.status === 'pending' || c.status === 'draft');
    const totalValue = active.reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0);
    return { active: active.length, pending: pending.length, totalValue, total: contracts.length };
  }, [contracts]);

  // Filtragem
  const filteredContracts = contracts.filter((c) => {
    const matchesSearch = (c.property?.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.lead?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (filterType === 'signatures') {
      return matchesSearch && (c.status === 'pending' || c.status === 'draft');
    }

    const matchesType = filterType === 'all' ||
      (filterType === 'administrative' ? !['sale', 'rent'].includes(c.type) : c.type === filterType);
    return matchesSearch && matchesType;
  });

  return (
    <div className="animate-in mx-auto max-w-7xl space-y-6 fade-in pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gestão de Contratos</h1>
          <p className="text-sm text-slate-500">Acompanhe e gerencie todos os documentos jurídicos.</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsNewDropdownOpen(!isNewDropdownOpen)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-700"
          >
            <Icons.Plus size={18} /> Novo Contrato
          </button>

          {isNewDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsNewDropdownOpen(false)} />
              <div className="animate-in slide-in-from-top-2 absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl fade-in dark:border-slate-800 dark:bg-slate-900">
                <button
                  onClick={() => {
                    setIsSaleModalOpen(true);
                    setIsNewDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="rounded-lg bg-sky-100 p-1.5 text-sky-600 dark:bg-sky-500/10">
                    <Icons.Building2 size={16} />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Compra e Venda</span>
                </button>
                <button
                  onClick={() => {
                    setIsRentModalOpen(true);
                    setIsNewDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="rounded-lg bg-violet-100 p-1.5 text-violet-600 dark:bg-violet-500/10">
                    <Icons.KeyRound size={16} />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Locação</span>
                </button>
                <button
                  onClick={() => {
                    setIsAdminModalOpen(true);
                    setIsNewDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600 dark:bg-slate-800">
                    <Icons.FileText size={16} />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Intermediação (Admin)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Métricas com Design System Novo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total de Contratos" value={metrics.total} icon={<Icons.FileSignature size={20} />} color="brand" />
        <MetricCard
          label="Contratos Ativos"
          value={metrics.active}
          icon={<Icons.CheckCircle2 size={20} />}
          color="emerald"
        />
        <MetricCard
          label="Aguardando Assinatura"
          value={metrics.pending}
          icon={<Icons.Clock size={20} />}
          color="amber"
        />
        <MetricCard
          label="Valor Ativo Mensal/Total"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
            metrics.totalValue
          )}
          icon={<Icons.DollarSign size={20} />}
          color="blue"
        />
      </div>

      {/* Lista Principal */}
      <GlassCard variant="default" padding="none" className="overflow-hidden flex flex-col">
        {/* Filtros e Busca */}
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-white/50 p-4 dark:border-slate-800/60 dark:bg-slate-900/50 md:flex-row">
          <div className="custom-scrollbar flex w-full gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50 md:w-auto">
            {['all', 'sale', 'rent', 'administrative', 'signatures'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                  filterType === type ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type === 'all' ? 'Todos' : type === 'sale' ? 'Venda' : type === 'rent' ? 'Locação' : type === 'administrative' ? 'Administrativos' : 'Assinaturas Pendentes'}
              </button>
            ))}
          </div>

          <div className="relative w-full shrink-0 md:w-64">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar contrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-[800px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/20">
                <th className="p-4 font-semibold">Imóvel & Cliente</th>
                <th className="p-4 font-semibold hidden sm:table-cell">Tipo</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold hidden lg:table-cell text-center">Assinaturas</th>
                <th className="p-4 font-semibold hidden md:table-cell">Data de Emissão</th>
                <th className="p-4 font-semibold text-right">Valor</th>
                <th className="p-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Icons.Loader2 className="mx-auto animate-spin text-brand-500" />
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    Nenhum contrato encontrado.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    onClick={(c) => {
                      setSelectedContract(c);
                      setIsSidebarOpen(true);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Sidebar de Visão Rápida */}
      <ContractQuickViewSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        contract={selectedContract}
        onOpenSignatures={(contractId) => {
          setIsSidebarOpen(false);
          setSignatureModalState({ contractId, companyId: user?.company_id });
        }}
        onRefresh={fetchContracts}
      />

      {/* Modais Antigos de Criação (Motores de Geração PDF) */}
      <SaleContractModal isOpen={isSaleModalOpen} onClose={() => setIsSaleModalOpen(false)} onSuccess={fetchContracts} />
      <RentContractModal isOpen={isRentModalOpen} onClose={() => setIsRentModalOpen(false)} onSuccess={fetchContracts} />
      <AdministrativeContractModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} onSuccess={fetchContracts} />

      {signatureModalState && (
        <SignatureManagerModal
          contractId={signatureModalState.contractId}
          companyId={signatureModalState.companyId}
          onClose={() => {
            setSignatureModalState(null);
            fetchContracts();
          }}
        />
      )}
    </div>
  );
}