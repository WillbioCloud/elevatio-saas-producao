import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Icons } from '../components/Icons';
import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import AdministrativeContractModal from '../components/AdministrativeContractModal';
import SignatureManagerModal from '../components/SignatureManagerModal';
import WelcomeBalloon from '../components/ui/WelcomeBalloon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { appendSignatureManifest, injectSignatureStamps } from '../utils/contractGenerator';

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

const ADMIN_DOCUMENT_TYPES = new Set([
  'proposal_buy',
  'inspection',
  'intermed_sale',
  'intermediacao',
  'intermed_rent',
  'visit_control',
  'keys_receipt',
]);

const isAdministrativeContract = (contract: ContractWithSignatureState) =>
  contract.type === 'administrative' || ADMIN_DOCUMENT_TYPES.has(contract.contract_data?.document_type);

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const EMPTY_SIGNATURE_SUMMARY: ContractSignatureSummary = {
  signatures_count: 0,
  pending_signatures_count: 0,
  signed_signatures_count: 0,
  rejected_signatures_count: 0,
};

const AdminContracts: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'all' | 'sale' | 'rent' | 'admin'>('all');
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';
  const directUserPlan = typeof (user as { plan?: string } | null)?.plan === 'string'
    ? (user as { plan?: string }).plan ?? ''
    : '';
  
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [viewContractData, setViewContractData] = useState<any | null>(null);
  const [contracts, setContracts] = useState<ContractWithSignatureState[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxContracts, setMaxContracts] = useState<number | null>(null);
  const [loadingPlanLimit, setLoadingPlanLimit] = useState(true);
  const [signatureModalState, setSignatureModalState] = useState<{ contractId: string; companyId: string } | null>(null);
  const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null);

  const fetchContracts = async () => {
    if (!user) return;
    setLoading(true);
    
    // Multi-Tenant: Filtra por company_id se não for super admin
    let contractsQuery = supabase
      .from('contracts')
      .select(`
        *,
        lead:leads!contracts_lead_id_fkey(*),
        property:properties(*),
        broker:profiles!contracts_broker_id_fkey(*)
      `);
    let signaturesQuery = supabase.from('contract_signatures').select('contract_id, status');
    
    if (!isSuperAdmin && user.company_id) {
      contractsQuery = contractsQuery.eq('company_id', user.company_id);
      signaturesQuery = signaturesQuery.eq('company_id', user.company_id);
    }
    
    try {
      const [contractsRes, signaturesRes] = await Promise.all([
        contractsQuery.order('created_at', { ascending: false }),
        signaturesQuery,
      ]);

      if (contractsRes.error) {
        console.error('Erro contratos:', contractsRes.error);
      } else if (contractsRes.data) {
        const signatureRows = (signaturesRes.data as ContractSignatureRow[] | null) ?? [];
        const signatureSummaryByContract = signatureRows.reduce<Record<string, ContractSignatureSummary>>(
          (accumulator, signature) => {
            if (!signature.contract_id) {
              return accumulator;
            }

            const currentSummary = accumulator[signature.contract_id] ?? {
              ...EMPTY_SIGNATURE_SUMMARY,
            };

            currentSummary.signatures_count += 1;

            if (signature.status === 'signed') {
              currentSummary.signed_signatures_count += 1;
            } else {
              currentSummary.pending_signatures_count += 1;

              if (signature.status === 'rejected') {
                currentSummary.rejected_signatures_count += 1;
              }
            }

            accumulator[signature.contract_id] = currentSummary;
            return accumulator;
          },
          {}
        );

        // O SEGREDO ESTÁ AQUI: Filtramos ANTES de definir o estado
        const validContracts = contractsRes.data.filter(c => c.contract_data?.document_type !== 'intermediacao');

        setContracts(
          validContracts.map((contract) => ({
            ...contract,
            ...(signatureSummaryByContract[contract.id] ?? EMPTY_SIGNATURE_SUMMARY),
          }))
        );
      }

      if (signaturesRes.error) {
        console.error('Erro assinaturas:', signaturesRes.error);
      }
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchContracts();
    }
  }, [user?.company_id, user?.role]);

  useEffect(() => {
    let isMounted = true;

    const fetchPlanLimit = async () => {
      if (!user) return;

      if (isSuperAdmin) {
        if (isMounted) {
          setMaxContracts(null);
          setLoadingPlanLimit(false);
        }
        return;
      }

      if (!user.company_id) {
        if (isMounted) {
          setMaxContracts(0);
          setLoadingPlanLimit(false);
        }
        return;
      }

      setLoadingPlanLimit(true);

      try {
        const { data: currentSaasContract, error: contractError } = await supabase
          .from('saas_contracts')
          .select('plan_id, plan_name, companies(plan)')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (contractError) {
          console.error('Erro ao buscar contrato SaaS atual:', contractError);
        }

        const planCandidates = [
          currentSaasContract?.plan_id,
          currentSaasContract?.plan_name,
          currentSaasContract?.companies?.plan,
          user.company?.plan,
          directUserPlan,
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase());

        if (planCandidates.length === 0) {
          if (isMounted) setMaxContracts(0);
          return;
        }

        const { data: plansData, error: plansError } = await supabase
          .from('saas_plans')
          .select('id, name, max_contracts');

        if (plansError) throw plansError;

        const matchedPlan = (plansData || []).find((plan) => {
          const planId = String(plan.id || '').toLowerCase();
          const planName = String(plan.name || '').toLowerCase();
          return planCandidates.some((candidate) => candidate === planId || candidate === planName);
        });

        if (isMounted) {
          setMaxContracts(Number(matchedPlan?.max_contracts ?? 0));
        }
      } catch (error) {
        console.error('Erro ao buscar limite de contratos do plano:', error);
        if (isMounted) {
          setMaxContracts(0);
        }
      } finally {
        if (isMounted) {
          setLoadingPlanLimit(false);
        }
      }
    };

    fetchPlanLimit();

    return () => {
      isMounted = false;
    };
  }, [directUserPlan, isSuperAdmin, user?.company?.plan, user?.company_id, user?.id]);

  const handleDeleteContract = async (id: string, propertyId?: string) => {
    if (window.confirm('CUIDADO: Deseja excluir permanentemente este contrato e liberar o imóvel de volta para a vitrine?')) {
      try {
        const resolvedPropertyId = propertyId || contracts.find((contract) => contract.id === id)?.property_id;

        // 1. Libera o imóvel (Usando APENAS a coluna status)
        if (resolvedPropertyId) {
          const { error: propertyError } = await supabase
            .from('properties')
            .update({ status: 'Disponível' })
            .eq('id', resolvedPropertyId);

          if (propertyError) {
            console.error('Erro ao liberar imóvel no banco:', propertyError);
          }
        }

        // 2. Limpa as faturas e parcelas
        await supabase.from('installments').delete().eq('contract_id', id);
        await supabase.from('invoices').delete().eq('contract_id', id);

        // 3. Exclui o contrato
        const { error: contractError } = await supabase.from('contracts').delete().eq('id', id);
        if (contractError) throw contractError;

        alert('Contrato excluído com sucesso! O imóvel voltou a ficar Disponível.');
        fetchContracts();
      } catch (error: any) {
        console.error('Falha na exclusão:', error);
        alert('Falha ao excluir o contrato: ' + error.message);
      }
    }
  };

  const handleArchiveContract = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived';
    if (window.confirm(`Deseja ${currentStatus === 'archived' ? 'reativar' : 'arquivar'} este contrato?`)) {
      await supabase.from('contracts').update({ status: newStatus }).eq('id', id);
      fetchContracts();
    }
  };

  const salesContracts = contracts.filter((c) => {
    // Regra de Negocio 1: Corretor so visualiza contratos onde ele e o autor ou responsavel
    const isCreator = c.user_id === user?.id || c.broker_id === user?.id || c.created_by === user?.id;
    if (!isAdmin && !isCreator) return false;
    return c.type === 'sale';
  });
  const rentContracts = contracts.filter((c) => {
    // Regra de Negocio 1: Corretor so visualiza contratos onde ele e o autor ou responsavel
    const isCreator = c.user_id === user?.id || c.broker_id === user?.id || c.created_by === user?.id;
    if (!isAdmin && !isCreator) return false;
    return c.type === 'rent';
  });
  const filteredAdminDocs = contracts.filter((c) => {
    const isCreator = c.user_id === user?.id || c.broker_id === user?.id || c.created_by === user?.id;
    if (!isAdmin && !isCreator) return false;
    return isAdministrativeContract(c);
  });
  const definitiveContracts = [...salesContracts, ...rentContracts].filter((contract) => !isAdministrativeContract(contract));
  const displayedContracts = useMemo(() => {
    if (activeFilter === 'sale') return salesContracts;
    if (activeFilter === 'rent') return rentContracts;
    if (activeFilter === 'admin') return filteredAdminDocs;
    // O filtro 'all' junta tudo para o dashboard
    return [...definitiveContracts, ...filteredAdminDocs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activeFilter, salesContracts, rentContracts, filteredAdminDocs, definitiveContracts]);

  const dashboardStats = useMemo(() => {
    let activeSales = 0;
    let activeRents = 0;
    let totalVGV = 0;
    let totalMRR = 0;
    let totalInadimplencia = 0;

    const revenueContracts = displayedContracts.filter(c => !ADMIN_DOCUMENT_TYPES.has(c.contract_data?.document_type));

    revenueContracts.forEach((c) => {
      // Soma APENAS o que for realidade (ativo ou assinado)
      if (c.status === 'active' || c.status === 'signed') {
        if (c.type === 'sale') {
          activeSales++;
          totalVGV += Number(c.contract_data?.sale_total_value || c.contract_data?.price || 0);
        } else if (c.type === 'rent') {
          activeRents++;
          totalMRR += Number(c.contract_data?.rent_value || c.contract_data?.price || 0);
        }
      }

      // Retorna o cálculo de inadimplência (atrasados)
      if (c.status === 'overdue' || c.payment_status === 'overdue') {
        totalInadimplencia += Number(c.contract_data?.rent_value || c.contract_data?.installment_value || c.contract_data?.price || 0);
      }
    });

    return { activeSales, activeRents, totalVGV, totalMRR, totalInadimplencia };
  }, [displayedContracts]);

  const chartData = useMemo(() => {
    const statusCounts = displayedContracts.reduce((acc: any, c) => {
      if (c.status !== 'archived') {
        const isSigned = c.signed_signatures_count === c.signatures_count && c.signatures_count > 0;
        const status = isSigned ? 'signed' : c.status;
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {});

    return [
      { name: 'Ativos/Em Andamento', value: statusCounts.active || 0, color: '#10b981' },
      { name: 'Rascunhos/Pendentes', value: statusCounts.draft || 0, color: '#f59e0b' },
      { name: 'Assinados', value: statusCounts.signed || 0, color: '#3b82f6' }
    ].filter(item => item.value > 0);
  }, [displayedContracts]);

  const activeRentContractsCount = useMemo(
    () => contracts.filter((contract) => contract.type === 'rent' && contract.status === 'active').length,
    [contracts]
  );
  const handleOpenContractModal = (type: 'sale' | 'rent') => {
    if (loadingPlanLimit) {
      alert('Estamos carregando os limites do seu plano. Tente novamente em alguns segundos.');
      return;
    }

    if (type === 'rent') {
      if (!isSuperAdmin && maxContracts === 0) {
        alert('O seu plano atual não inclui o módulo de Gestão de Locações. Faça o upgrade para desbloquear.');
        return;
      }

      if (!isSuperAdmin && typeof maxContracts === 'number' && activeRentContractsCount >= maxContracts) {
        alert(`Você atingiu o limite de locações ativas do seu plano (${maxContracts}). Faça o upgrade para adicionar novos aluguéis.`);
        return;
      }

      setIsRentModalOpen(true);
      return;
    }

    // Vendas são ilimitadas, sempre abre o modal
    setIsSaleModalOpen(true);
    return;
  };

  const handleOpenSignatureManager = (contractId: string, companyId?: string | null) => {
    if (!companyId) {
      alert('Este contrato nao possui uma empresa vinculada para gerar links de assinatura.');
      return;
    }

    setSignatureModalState({ contractId, companyId });
  };

  const handleDownloadFinalPDF = async (contract: ContractWithSignatureState) => {
    setDownloadingContractId(contract.id);

    try {
      const { data: fullContract, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contract.id)
        .single();

      if (error) throw error;

      let adminUrl = '';
      let companyName = '';

      if (user?.company_id) {
        const { data: companyInfo } = await supabase
          .from('companies')
          .select('name, admin_signature_url')
          .eq('id', user.company_id)
          .single();

        if (companyInfo?.admin_signature_url) {
          adminUrl = companyInfo.admin_signature_url;
        }

        if (companyInfo?.name) {
          companyName = companyInfo.name;
        }
      }

      const { data: signatures } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('contract_id', fullContract.id);

      let finalHtml = fullContract.html_content || fullContract.content || '';
      const safeSignatures = signatures || [];

      finalHtml = await injectSignatureStamps(finalHtml, safeSignatures, adminUrl);

      if (safeSignatures.length > 0) {
        finalHtml = appendSignatureManifest(
          finalHtml,
          {
            name: companyName || null,
            admin_signature_url: adminUrl || null,
          },
          safeSignatures
        );
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Por favor, permita os pop-ups para gerar o PDF final.');
      }

      printWindow.document.write(finalHtml);
      printWindow.document.close();
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.print();
        }
      }, 500);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar PDF do contrato.');
    } finally {
      setDownloadingContractId(null);
    }
  };

  const getSignatureState = (contract: ContractWithSignatureState) => {
    const signaturesCount = Number(contract.signatures_count ?? 0);
    const pendingSignaturesCount = Number(contract.pending_signatures_count ?? 0);
    const signedSignaturesCount = Number(contract.signed_signatures_count ?? 0);
    const rejectedSignaturesCount = Number(contract.rejected_signatures_count ?? 0);
    const hasSignatures = signaturesCount > 0;
    const isFullySigned = hasSignatures && pendingSignaturesCount === 0;

    return {
      signaturesCount,
      pendingSignaturesCount,
      signedSignaturesCount,
      rejectedSignaturesCount,
      hasSignatures,
      isFullySigned,
    };
  };

  const handleApproveContract = async (contractId: string) => {
    if (!window.confirm('Aprovar este contrato?')) {
      return;
    }

    await supabase.from('contracts').update({ status: 'active' }).eq('id', contractId);
    fetchContracts();
  };

  const renderSignatureStatus = (contract: ContractWithSignatureState) => {
    const signatureState = getSignatureState(contract);

    if (!signatureState.hasSignatures) {
      return (
        <button
          type="button"
          onClick={() => handleOpenSignatureManager(contract.id, contract.company_id)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
        >
          <Icons.PenTool size={14} /> Solicitar Assinaturas
        </button>
      );
    }

    const hasRejectedSignature = signatureState.rejectedSignaturesCount > 0;
    const badgeClasses = hasRejectedSignature
      ? 'border-red-200 bg-red-50 text-red-700'
      : signatureState.isFullySigned
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
    const statusLabel = hasRejectedSignature
      ? 'Assinatura recusada'
      : signatureState.isFullySigned
        ? 'Assinado'
        : 'Pendente de Assinatura';
    const StatusIcon = hasRejectedSignature
      ? Icons.AlertTriangle
      : signatureState.isFullySigned
        ? Icons.CheckCircle2
        : Icons.Clock;

    return (
      <div className="flex flex-col items-start gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses}`}>
          <StatusIcon size={13} />
          <span>{statusLabel}</span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {signatureState.signedSignaturesCount}/{signatureState.signaturesCount} assinaturas
        </span>
        <button
          type="button"
          onClick={() => handleOpenSignatureManager(contract.id, contract.company_id)}
          className="text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {signatureState.isFullySigned ? 'Ver assinaturas' : 'Gerenciar'}
        </button>
      </div>
    );
  };

  const renderApproveAction = (contract: ContractWithSignatureState) => {
    if (contract.status !== 'pending' || !isAdmin) {
      return null;
    }

    const { isFullySigned } = getSignatureState(contract);

    return (
      <button
        type="button"
        onClick={() => void handleApproveContract(contract.id)}
        disabled={!isFullySigned}
        className="rounded-lg border border-slate-200 bg-white p-2 text-emerald-600 shadow-sm transition-colors hover:bg-emerald-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-amber-100 disabled:bg-amber-50 disabled:text-amber-400 disabled:hover:bg-amber-50"
        title={!isFullySigned ? 'Aguardando assinaturas do cliente' : 'Aprovar Contrato'}
      >
        <Icons.CheckCircle size={16} />
      </button>
    );
  };

  const renderFinalPdfButton = (contract: ContractWithSignatureState) => {
    const isDownloading = downloadingContractId === contract.id;

    return (
      <button
        type="button"
        onClick={() => void handleDownloadFinalPDF(contract)}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        title="Gerar PDF com Manifesto de Assinaturas"
      >
        {isDownloading ? <Icons.Loader2 className="animate-spin" size={14} /> : <Icons.Download size={14} />}
        <span>PDF Final</span>
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <WelcomeBalloon pageId="contracts" icon="FileText" title="Gestão de Contratos" description="Adeus papelada! Gere contratos de venda, locação e intermediação em 1 clique, e envie para assinatura digital com validade jurídica." />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Central de Contratos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestão unificada de documentos e acordos comerciais.</p>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-brand-500/30 transition-all border-none"
          >
            <Icons.Plus size={18} /> Novo Contrato <Icons.ChevronDown size={16} />
          </button>
          
          {showCreateDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCreateDropdown(false)}></div>
              <div className="absolute right-0 mt-2 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-100 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-2">
                <button onClick={() => { handleOpenContractModal('sale'); setShowCreateDropdown(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg text-blue-600"><Icons.Home size={16} /></div> Contrato de Venda
                </button>
                <button onClick={() => { handleOpenContractModal('rent'); setShowCreateDropdown(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                  <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg text-emerald-600"><Icons.Key size={16} /></div> Contrato de Locação
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                <button onClick={() => { setShowAdminModal(true); setShowCreateDropdown(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                  <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg text-purple-600"><Icons.FileText size={16} /></div> Administrativo / Captação
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MÉTRICAS E GRÁFICOS GLASSMORPHISM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4">
        {/* CARDS DE NÚMEROS */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white/60 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl rounded-3xl p-6 border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-2xl text-blue-600 dark:text-blue-400">
                <Icons.Home size={24} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vendas Ativas</span>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-800 dark:text-white mb-1">{dashboardStats.activeSales}</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                VGV: <span className="text-blue-600 dark:text-blue-400 font-bold">{formatBRL(dashboardStats.totalVGV)}</span>
              </p>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl rounded-3xl p-6 border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <Icons.Key size={24} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Locações Ativas</span>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-800 dark:text-white mb-1">{dashboardStats.activeRents}</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                MRR: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatBRL(dashboardStats.totalMRR)}</span>
              </p>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl rounded-3xl p-6 border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-red-500/10 dark:bg-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
                <Icons.AlertCircle size={24} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inadimplência</span>
            </div>
            <div>
              <p className="text-3xl font-black text-red-600 dark:text-red-400 mb-1">{formatBRL(dashboardStats.totalInadimplencia)}</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">Contratos em Atraso</p>
            </div>
          </div>
        </div>

        {/* GRÁFICO RESUMO */}
        <div className="bg-white/60 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl rounded-3xl p-6 border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Status dos Contratos</h3>
          {chartData.length > 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-[120px] w-full max-w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="ml-4 flex flex-col gap-2 justify-center">
                {chartData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    {item.name} ({item.value})
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm font-medium text-slate-400">
              Sem dados no período
            </div>
          )}
        </div>
      </div>

      {/* FILTROS TIPO PILL */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 mb-6 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded-2xl w-full sm:w-fit">
        {[
          { id: 'all', label: 'Todos os Contratos', icon: Icons.Layout },
          { id: 'sale', label: 'Vendas', icon: Icons.Home },
          { id: 'rent', label: 'Locações', icon: Icons.Key },
          { id: 'admin', label: 'Administrativos', icon: Icons.FileSignature }
        ].map(filter => {
          const FilterIcon = filter.icon;

          return (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as 'all' | 'sale' | 'rent' | 'admin')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all w-full sm:w-auto ${activeFilter === filter.id ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border-transparent'}`}
            >
              <FilterIcon size={16} /> {filter.label}
            </button>
          );
        })}
      </div>

      {/* TABELA UNIFICADA GLASSMORPHISM */}
      <div className="bg-white/60 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto w-full custom-scrollbar pb-2">
          <table className="w-full min-w-[800px] md:min-w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100/50 dark:border-white/5 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                <th className="p-5">Status / Tipo</th>
                <th className="p-5">Referência do Imóvel</th>
                <th className="p-5">Data de Criação</th>
                <th className="p-5">Assinaturas</th>
                <th className="p-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50 dark:divide-white/5 text-sm text-slate-600 dark:text-slate-300">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium"><Icons.Loader2 className="inline animate-spin mr-2" size={16} /> Carregando contratos...</td></tr>
              ) : displayedContracts.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium">Nenhum contrato encontrado para este filtro.</td></tr>
              ) : displayedContracts.map((doc) => (
                <tr key={doc.id} className="hover:bg-white/80 dark:hover:bg-white/5 transition-colors">
                  <td className="p-5">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase w-fit ${doc.status === 'active' || doc.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : doc.status === 'archived' || doc.status === 'canceled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                        {doc.status === 'active' || doc.status === 'signed' ? 'Ativo' : doc.status === 'archived' || doc.status === 'canceled' ? 'Arquivado' : 'Rascunho'}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {doc.contract_data?.document_type === 'intermediacao' ? 'Captação' : doc.type === 'sale' ? 'Venda' : doc.type === 'rent' ? 'Locação' : 'Administrativo'}
                      </span>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{doc.property?.title || 'Não vinculado'}</span>
                      {doc.lead?.name && <span className="text-xs text-slate-400 mt-1">{doc.lead.name}</span>}
                    </div>
                  </td>
                  <td className="p-5 text-slate-500">{doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="p-5 align-middle">{renderSignatureStatus(doc)}</td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      {renderFinalPdfButton(doc)}
                      {renderApproveAction(doc)}
                      <button onClick={() => navigate(`/admin/contratos/${doc.id}`)} className="p-2 text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 rounded-xl transition-colors" title="Ver Detalhes"><Icons.Eye size={16} /></button>
                      {(doc.type === 'sale' || doc.type === 'rent') && (
                        <button onClick={() => setViewContractData(doc)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-xl transition-colors" title="Ver Formulário Original"><Icons.FileText size={16} /></button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleArchiveContract(doc.id, doc.status)} className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors" title={doc.status === 'archived' ? 'Reativar' : 'Arquivar'}><Icons.Archive size={16} /></button>
                      )}
                      {(isAdmin || ((doc.user_id === user?.id || doc.broker_id === user?.id || doc.created_by === user?.id) && (doc.status === 'draft' || doc.status === 'pending' || !doc.status))) && (
                        <button onClick={() => handleDeleteContract(doc.id)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-xl transition-colors" title="Excluir"><Icons.Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      <SaleContractModal 
        isOpen={isSaleModalOpen || (viewContractData?.type === 'sale')} 
        contractData={viewContractData?.type === 'sale' ? viewContractData : undefined}
        onClose={() => { setIsSaleModalOpen(false); setViewContractData(null); }} 
        onSuccess={() => {
          alert('Contrato de venda salvo com sucesso!');
          fetchContracts();
        }} 
      />

      <RentContractModal 
        isOpen={isRentModalOpen || (viewContractData?.type === 'rent')} 
        contractData={viewContractData?.type === 'rent' ? viewContractData : undefined}
        onClose={() => { setIsRentModalOpen(false); setViewContractData(null); }} 
        onSuccess={() => {
          alert('Contrato de locação salvo com sucesso!');
          fetchContracts();
        }} 
      />

      <AdministrativeContractModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={() => {
          fetchContracts();
        }}
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
};

export default AdminContracts;
