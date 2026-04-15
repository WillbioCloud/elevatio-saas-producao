import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// UI Components
import { GlassCard } from '../components/ui/GlassCard';
import { MetricCard } from '../components/ui/MetricCard';
import { ContractRow } from '../components/contracts/ContractRow';
import { ContractQuickViewSidebar } from '../components/contracts/ContractQuickViewSidebar';

// Modais
import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import SignatureManagerModal from '../components/SignatureManagerModal';

// Interfaces Originais
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

export default function AdminContracts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractWithSignatureState[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Estados de Modais
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [signatureModalState, setSignatureModalState] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // A SUA LÓGICA DE FETCH ORIGINAL E BLINDADA
  const fetchContracts = async () => {
    if (!user?.company_id) return;
    setLoading(true);

    const { data: contractsData, error: contractsError } = await supabase
      .from('contracts')
      .select(`*, properties(title), leads(name)`)
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false });

    if (contractsError || !contractsData) {
      setLoading(false);
      return;
    }

    const contractIds = contractsData.map((c) => c.id);
    let signaturesMap: Record<string, ContractSignatureRow[]> = {};

    if (contractIds.length > 0) {
      const { data: sigData, error: sigError } = await supabase
        .from('contract_signatures')
        .select('contract_id, status')
        .in('contract_id', contractIds);

      if (!sigError && sigData) {
        signaturesMap = sigData.reduce((acc, row) => {
          if (row.contract_id) {
            if (!acc[row.contract_id]) acc[row.contract_id] = [];
            acc[row.contract_id].push(row as ContractSignatureRow);
          }
          return acc;
        }, {} as Record<string, ContractSignatureRow[]>);
      }
    }

    const enrichedContracts: ContractWithSignatureState[] = contractsData.map((contract) => {
      const sigs = signaturesMap[contract.id] || [];
      return {
        ...contract,
        signatures: sigs, // Adicionando array para a nova UI
        signatures_count: sigs.length,
        pending_signatures_count: sigs.filter((s) => s.status === 'pending').length,
        signed_signatures_count: sigs.filter((s) => s.status === 'signed').length,
        rejected_signatures_count: sigs.filter((s) => s.status === 'rejected').length,
      };
    });

    setContracts(enrichedContracts);
    setLoading(false);
  };

  useEffect(() => {
    fetchContracts();
  }, [user?.company_id]);

  // Métricas UI
  const metrics = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'active');
    const pending = contracts.filter((c) => c.status === 'pending' || c.status === 'draft');
    const totalValue = active.reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0);
    return { active: active.length, pending: pending.length, totalValue, total: contracts.length };
  }, [contracts]);

  // Filtragem UI
  const filteredContracts = contracts.filter((c) => {
    const searchLow = searchTerm.toLowerCase();
    const matchesSearch =
      (c.properties?.title || '').toLowerCase().includes(searchLow) ||
      (c.leads?.name || '').toLowerCase().includes(searchLow);

    if (filterType === 'signatures') {
      return matchesSearch && c.pending_signatures_count > 0;
    }

    const matchesType =
      filterType === 'all' ||
      (filterType === 'administrative' ? !['sale', 'rent'].includes(c.type) : c.type === filterType);
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gestão de Contratos</h1>
          <p className="text-sm text-slate-500">Acompanhe e gerencie todos os documentos jurídicos.</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all"
          >
            <Icons.Plus size={18} /> Novo Contrato <Icons.ChevronDown size={16} />
          </button>

          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => {
                    setIsSaleModalOpen(true);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg dark:bg-sky-500/10">
                    <Icons.Building2 size={16} />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Compra e Venda</span>
                </button>
                <button
                  onClick={() => {
                    setIsRentModalOpen(true);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="p-1.5 bg-violet-100 text-violet-600 rounded-lg dark:bg-violet-500/10">
                    <Icons.KeyRound size={16} />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Locação</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total de Contratos"
          value={metrics.total}
          icon={<Icons.FileSignature size={20} />}
          color="brand"
        />
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
          label="Valor Total Ativo"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0,
          }).format(metrics.totalValue)}
          icon={<Icons.DollarSign size={20} />}
          color="blue"
        />
      </div>

      {/* LISTA DE CONTRATOS */}
      <GlassCard variant="default" padding="none" className="overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/50 dark:bg-slate-900/50">
          <div className="flex gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl overflow-x-auto w-full md:w-auto custom-scrollbar">
            {['all', 'sale', 'rent', 'signatures'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                  filterType === type
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {type === 'all'
                  ? 'Todos'
                  : type === 'sale'
                    ? 'Venda'
                    : type === 'rent'
                      ? 'Locação'
                      : 'Assinaturas Pendentes'}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64 shrink-0">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar contrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800/60">
                <th className="p-4">Imóvel & Cliente</th>
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
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <Icons.Loader2 className="animate-spin mx-auto text-brand-500 mb-2" /> Carregando...
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
                    onOpenSignatures={(id) => setSignatureModalState({ contractId: id, companyId: user?.company_id })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* INTEGRAÇÕES MODAIS */}
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
