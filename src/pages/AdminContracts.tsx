import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Icons } from '../components/Icons';
import SaleContractModal from '../components/SaleContractModal';
import RentContractModal from '../components/RentContractModal';
import SignatureManagerModal from '../components/SignatureManagerModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { appendSignatureManifest, injectSignatureStamps } from '../utils/contractGenerator';
import { GlassCard } from '../components/ui/GlassCard';
import { MetricCard } from '../components/ui/MetricCard';
import { RadialProgress } from '../components/ui/RadialProgress';
import { ContractRow } from '../components/contracts/ContractRow';
import { ContractQuickViewSidebar } from '../components/contracts/ContractQuickViewSidebar';
import { StatusPill, StatusType } from '../components/ui/StatusPill';
import { ContractTypeBadge, ContractTypeKey } from '../components/ui/ContractTypeBadge';

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

const glassCardClass =
  'rounded-3xl border border-white/60 dark:border-white/10 bg-white/75 dark:bg-[#0b1220]/75 backdrop-blur-xl shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:shadow-none';

const subtlePanelClass =
  'rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/85 dark:bg-[#111a2b]/70 backdrop-blur-md shadow-sm';

const AdminContracts: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const currentTab = searchParams.get('tab') || 'geral';
  const isSuperAdmin = user?.role === 'super_admin';
  const directUserPlan = typeof (user as { plan?: string } | null)?.plan === 'string'
    ? (user as { plan?: string }).plan ?? ''
    : '';
  
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [viewContractData, setViewContractData] = useState<any | null>(null);
  const [contracts, setContracts] = useState<ContractWithSignatureState[]>([]);
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<any[]>([]);
  const [showOverdue, setShowOverdue] = useState(false);
  const [contractTab, setContractTab] = useState<'pending' | 'active' | 'archived'>('active');
  const [maxContracts, setMaxContracts] = useState<number | null>(null);
  const [loadingPlanLimit, setLoadingPlanLimit] = useState(true);
  const [signatureModalState, setSignatureModalState] = useState<{ contractId: string; companyId: string } | null>(null);
  const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null);
  const [quickViewContract, setQuickViewContract] = useState<ContractWithSignatureState | null>(null);

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

      if (installmentsRes.error) {
        console.error('Erro parcelas:', installmentsRes.error);
      } else if (installmentsRes.data) {
        setInstallments(installmentsRes.data);
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
        // 1. Libera o imóvel (Usando APENAS a coluna status)
        if (propertyId) {
          const { error: propertyError } = await supabase
            .from('properties')
            .update({ status: 'Disponível' })
            .eq('id', propertyId);

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

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let recebidoMes = 0;
    let aReceberMes = 0;
    let inadimplencia = 0;
    let vgvAno = 0;
    let mrrAtivo = 0;
    let contratosVendaAtivos = 0;
    let contratosLocacaoAtivos = 0;

    installments.forEach(inst => {
      const dueDate = new Date(inst.due_date);
      const isCurrentMonth = dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = dueDate < today && inst.status !== 'paid';

      if (inst.status === 'paid' && isCurrentMonth) recebidoMes += Number(inst.amount);
      if (inst.status === 'pending' && isCurrentMonth && !isOverdue) aReceberMes += Number(inst.amount);
      if (isOverdue) inadimplencia += Number(inst.amount);
    });

    contracts.forEach(contract => {
      const createdDate = new Date(contract.created_at);
      const isCurrentYear = createdDate.getFullYear() === currentYear;

      if (contract.status === 'active') {
        if (contract.type === 'sale') {
          if (isCurrentYear) vgvAno += Number(contract.sale_total_value || 0);
          contratosVendaAtivos++;
        } else if (contract.type === 'rent') {
          mrrAtivo += Number(contract.rent_value || 0);
          contratosLocacaoAtivos++;
        }
      }
    });

    const limite14Dias = new Date();
    limite14Dias.setDate(limite14Dias.getDate() + 14);
    limite14Dias.setHours(23, 59, 59, 999);

    const proximos = installments
      .filter(inst => {
        if (inst.status === 'paid') return false;
        const due = new Date(inst.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return due >= today && due <= limite14Dias;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 10)
      .map(inst => {
        const contract = contracts.find(c => c.id === inst.contract_id);
        return { ...inst, contract };
      });

    const atrasados = installments
      .filter(inst => inst.status !== 'paid' && new Date(inst.due_date) < new Date(new Date().setHours(0,0,0,0)))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .map(inst => {
        const contract = contracts.find(c => c.id === inst.contract_id);
        return { ...inst, contract };
      });

    const chartData = [
      { name: 'Vendas', value: contratosVendaAtivos, color: '#0ea5e9' },
      { name: 'Locações', value: contratosLocacaoAtivos, color: '#8b5cf6' },
    ];

    const totalEsperado = recebidoMes + aReceberMes + inadimplencia;
    const saudeFinanceira = totalEsperado > 0 ? (((recebidoMes + aReceberMes) / totalEsperado) * 100).toFixed(1) : 100;

    return { recebidoMes, aReceberMes, inadimplencia, proximos, atrasados, vgvAno, mrrAtivo, chartData, saudeFinanceira };
  }, [installments, contracts]);

  const salesContracts = contracts.filter((c) => c.type === 'sale');
  const rentContracts = contracts.filter((c) => c.type === 'rent');
  const filterContractsByTab = (list: ContractWithSignatureState[]) =>
    list.filter((contract) => {
      if (contractTab === 'active') return contract.status === 'active';
      if (contractTab === 'pending') return contract.status === 'pending';
      if (contractTab === 'archived') return contract.status === 'canceled' || contract.status === 'archived';
      return true;
    });
  const filteredSalesContracts = useMemo(() => filterContractsByTab(salesContracts), [contractTab, salesContracts]);
  const filteredRentContracts = useMemo(() => filterContractsByTab(rentContracts), [contractTab, rentContracts]);
  const activeRentContractsCount = useMemo(
    () => contracts.filter((contract) => contract.type === 'rent' && contract.status === 'active').length,
    [contracts]
  );
  const contractsUsageLabel = isSuperAdmin
    ? 'Sem limite'
    : loadingPlanLimit
      ? '...'
      : maxContracts === 0
        ? 'Bloqueado'
        : String(maxContracts ?? '--');

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

  const setTab = (tab: string) => {
    setSearchParams({ tab });
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


  const getStatusPillType = (status?: string): StatusType => {
    if (status === 'active') return 'active';
    if (status === 'pending') return 'pending';
    if (status === 'archived') return 'archived';
    if (status === 'canceled') return 'rejected';
    return 'draft';
  };

  const getTypeBadge = (type?: string): ContractTypeKey => {
    if (type === 'sale' || type === 'rent') {
      return type;
    }

    return 'administrative';
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
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(241,245,249,0.92)_35%,rgba(238,242,255,0.9)_65%,rgba(243,244,246,0.95)_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.98),rgba(10,15,28,0.96)_35%,rgba(17,24,39,0.95)_70%,rgba(2,6,23,0.98)_100%)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[10%] h-72 w-72 rounded-full bg-sky-200/20 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute top-32 right-[12%] h-80 w-80 rounded-full bg-violet-200/20 blur-3xl dark:bg-violet-500/10" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-slate-200/30 blur-3xl dark:bg-slate-500/10" />
      </div>

      <div className="relative space-y-6 animate-fade-in pb-10">
      <div className="rounded-[32px] border border-white/60 bg-white/55 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0a0f1c]/60 dark:shadow-none sm:p-5">
        <div className="sticky top-2 z-20 flex flex-col gap-4 rounded-[24px] border border-white/70 bg-white/72 px-5 py-4 backdrop-blur-2xl shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#0b1220]/72 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-slate-800 dark:text-white">Contratos e Recebíveis</h1>
              <p className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">Gestão premium de vendas, locações e acompanhamento financeiro.</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200/55 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0a0f1c]/70 dark:text-slate-300">
                <Icons.KeyRound size={14} className="text-indigo-500" />
                <span>Locações Ativas: {activeRentContractsCount} / {contractsUsageLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenContractModal('rent')}
                disabled={!isSuperAdmin && maxContracts !== null && activeRentContractsCount >= maxContracts}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#0a0f1c]/80 dark:text-slate-300 dark:hover:bg-white/5"
                title={!isSuperAdmin && maxContracts !== null && activeRentContractsCount >= maxContracts ? 'Limite de contratos de locação atingido' : 'Novo Aluguel'}
              >
                <Icons.Plus size={16} /> Novo Aluguel
              </button>

              <button
                onClick={() => handleOpenContractModal('sale')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-lg"
              >
                <Icons.Plus size={16} /> Nova Venda
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 md:px-6 md:pb-4 md:pt-5">
          <div className={`${subtlePanelClass} flex w-full flex-wrap items-center gap-2 p-2`}>
            <button
              onClick={() => setTab('geral')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                currentTab === 'geral'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
              }`}
            >
              <Icons.LayoutDashboard size={16} /> Geral
            </button>
            <button
              onClick={() => setTab('vendas')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                currentTab === 'vendas'
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
              }`}
            >
              <Icons.Building size={16} /> Vendas
            </button>
            <button
              onClick={() => setTab('alugueis')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                currentTab === 'alugueis'
                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
              }`}
            >
              <Icons.KeyRound size={16} /> Aluguéis
            </button>
          </div>
        </div>
      </div>

      {currentTab === 'geral' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="VGV do Ano" value={dashboardStats.vgvAno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<Icons.Building size={18} />} color="brand" compact />
            <MetricCard label="MRR Ativo" value={dashboardStats.mrrAtivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<Icons.KeyRound size={18} />} color="violet" compact />
            <MetricCard label="Recebido" value={dashboardStats.recebidoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<Icons.TrendingUp size={18} />} color="emerald" compact />
            <MetricCard label="A Receber" value={dashboardStats.aReceberMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<Icons.Clock size={18} />} color="blue" compact />
            <MetricCard label="Inadimplência" value={dashboardStats.inadimplencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<Icons.AlertTriangle size={18} />} color="red" compact />

            <GlassCard className={`${glassCardClass} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Saúde</p>
              <div className="mt-3 flex items-center justify-between">
                <RadialProgress value={Number(dashboardStats.saudeFinanceira)} size={62} strokeWidth={5} color={Number(dashboardStats.saudeFinanceira) >= 90 ? '#10b981' : '#f59e0b'}>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{dashboardStats.saudeFinanceira}%</span>
                </RadialProgress>
                <p className="max-w-[120px] text-xs text-slate-500 dark:text-slate-400">Taxa de adimplência da carteira atual.</p>
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <GlassCard className={`${glassCardClass} xl:col-span-2 p-6`}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Distribuição Financeira da Carteira</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboardStats.chartData} cx="50%" cy="50%" innerRadius={58} outerRadius={85} paddingAngle={5} dataKey="value">
                      {dashboardStats.chartData.map((entry, index) => (
                        <Cell key={`chart-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => [`${value} contratos ativos`, 'Quantidade']}
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid rgba(226,232,240,0.8)',
                        background: 'rgba(255,255,255,0.92)',
                        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
                        backdropFilter: 'blur(12px)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-4">
                {dashboardStats.chartData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name} ({item.value})
                  </div>
                ))}
              </div>
            </GlassCard>

            <div className="space-y-4">
              <GlassCard className={`${subtlePanelClass} p-5`}>
                <h3 className="text-sm font-bold font-serif text-slate-700 dark:text-slate-200">Saúde Financeira</h3>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Recebido + previsto vs total esperado do mês.</p>
                <p className={`mt-3 text-3xl font-bold font-serif ${Number(dashboardStats.saudeFinanceira) >= 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{dashboardStats.saudeFinanceira}%</p>
              </GlassCard>

              <GlassCard onClick={() => setShowOverdue(!showOverdue)} className={`${subtlePanelClass} cursor-pointer p-5 transition-colors hover:border-red-200 dark:hover:border-red-400/30`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="inline-flex items-center gap-2 text-sm font-bold font-serif text-red-600 dark:text-red-400">
                      <Icons.AlertTriangle size={14} /> Inadimplência
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Clique para {showOverdue ? 'ocultar' : 'expandir'} detalhes.</p>
                  </div>
                  <Icons.ChevronDown size={16} className={`text-red-500 transition-transform ${showOverdue ? 'rotate-180' : ''}`} />
                </div>
                <p className="mt-3 text-xl font-bold font-serif text-red-600 dark:text-red-400">{dashboardStats.inadimplencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                {showOverdue && (
                  <div className="mt-3 space-y-2 border-t border-red-100 pt-3 dark:border-red-500/20" onClick={(event) => event.stopPropagation()}>
                    {dashboardStats.atrasados.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Excelente! Nenhum contrato atrasado.</p>
                    ) : (
                      dashboardStats.atrasados.slice(0, 6).map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between rounded-lg border border-red-100/70 bg-white/70 p-2 dark:border-red-500/20 dark:bg-[#0b1220]/80">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{inst.contract?.lead?.name || 'Cliente'}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{new Date(inst.due_date).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <button onClick={() => navigate(`/admin/contratos/${inst.contract_id}`)} className="rounded-lg border border-red-100 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10">
                            <Icons.ArrowRight size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </GlassCard>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <GlassCard className={`${glassCardClass} xl:col-span-2 overflow-hidden p-0`}>
              <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                <h3 className="text-sm font-bold font-serif text-slate-700 dark:text-slate-200">Contratos Recentes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {contracts.slice(0, 5).map((contract) => (
                      <ContractRow key={contract.id} contract={contract} onClick={setQuickViewContract} />
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard className={`${glassCardClass} overflow-hidden p-0`}>
              <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2.5 dark:border-white/10">
                <div className="flex items-center gap-2">
                <Icons.Calendar size={16} className="text-brand-500" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Vencimentos</h3>
                </div>
                <span className="text-[11px] text-red-500">{dashboardStats.atrasados.length} atrasados</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-10"><Icons.Loader2 className="animate-spin text-slate-300" /></div>
                ) : dashboardStats.proximos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Icons.CheckCircle size={28} className="text-emerald-400" />
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Tudo limpo!</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Nenhuma parcela a vencer nos próximos 14 dias.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboardStats.proximos.map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between rounded-xl border border-slate-100/80 px-3 py-4 hover:bg-slate-50/80 dark:border-white/10 dark:hover:bg-white/5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{inst.contract?.lead?.name || 'Cliente'}</p>
                          <p className="text-[12px] text-slate-400 dark:text-slate-500">{new Date(inst.due_date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-orange-500">{Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          <button onClick={() => navigate(`/admin/contratos/${inst.contract_id}`)} className="rounded-lg p-1.5 text-slate-300 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-300">
                            <Icons.ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {(currentTab === 'vendas' || currentTab === 'alugueis') && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-bold font-serif text-slate-800 dark:text-white">{currentTab === 'vendas' ? 'Contratos de Venda' : 'Contratos de Locação'}</h2>
          </div>

          <div className={`${subtlePanelClass} flex w-fit gap-2 p-2`}>
            <button onClick={() => setContractTab('active')} className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${contractTab === 'active' ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'}`}>Ativos</button>
            <button onClick={() => setContractTab('pending')} className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${contractTab === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'}`}>Pendentes</button>
            <button onClick={() => setContractTab('archived')} className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${contractTab === 'archived' ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'}`}>Arquivados</button>
          </div>

          <GlassCard className={`${glassCardClass} overflow-hidden p-0`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                  <Icons.List size={12} /> {currentTab === 'vendas' ? 'Vendas' : 'Locações'}
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{(currentTab === 'vendas' ? filteredSalesContracts : filteredRentContracts).length}</span>
                </button>
                <button className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5">
                  Todos
                </button>
              </div>
              <div className="relative">
                <Icons.Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="h-9 w-40 rounded-xl border border-slate-200/70 bg-white/75 pl-8 pr-3 text-xs text-slate-600 outline-none placeholder:text-slate-400 focus:border-slate-300 dark:border-white/10 dark:bg-[#111a2b]/80 dark:text-slate-300"
                  placeholder="Buscar..."
                  readOnly
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/40 text-[11px] uppercase tracking-[0.11em] text-slate-400 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-500">
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Imóvel</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Assinaturas</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                  {(currentTab === 'vendas' ? filteredSalesContracts : filteredRentContracts).map((contract) => (
                    <tr key={contract.id} className="hover:bg-white/45 dark:hover:bg-white/5">
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{contract.lead?.name || 'Não informado'}</td>
                      <td className="p-4"><ContractTypeBadge type={getTypeBadge(contract.type)} /></td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{contract.property?.title || 'Não informado'}</td>
                      <td className="p-4"><StatusPill status={getStatusPillType(contract.status)} /></td>
                      <td className="p-4">{renderSignatureStatus(contract)}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setQuickViewContract(contract)}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-100 dark:border-white/10 dark:bg-[#111a2b] dark:text-slate-300"
                            title="Resumo rápido"
                          >
                            <Icons.Layout size={16} />
                          </button>
                          <button onClick={() => navigate(`/admin/contratos/${contract.id}`)} className="rounded-lg border border-slate-200 bg-white p-2 text-brand-600 shadow-sm hover:bg-brand-50 dark:border-white/10 dark:bg-[#111a2b]" title="Ver detalhes"><Icons.Eye size={16} /></button>
                          <button onClick={() => setViewContractData(contract)} className="rounded-lg border border-slate-200 bg-white p-2 text-blue-600 shadow-sm hover:bg-blue-50 dark:border-white/10 dark:bg-[#111a2b]" title="Abrir formulário original"><Icons.FileText size={16} /></button>
                          {renderFinalPdfButton(contract)}
                          {renderApproveAction(contract)}
                          {isAdmin && (
                            <>
                              <button onClick={() => handleArchiveContract(contract.id, contract.status)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-100 dark:border-white/10 dark:bg-[#111a2b]" title={contract.status === 'archived' ? 'Reativar' : 'Arquivar'}><Icons.Archive size={16} /></button>
                              <button onClick={() => handleDeleteContract(contract.id, contract.property_id)} className="rounded-lg border border-red-100 bg-white p-2 text-red-600 shadow-sm hover:bg-red-50 dark:border-red-500/20 dark:bg-[#111a2b]" title="Excluir"><Icons.Trash2 size={16} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && (currentTab === 'vendas' ? filteredSalesContracts : filteredRentContracts).length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                  {currentTab === 'vendas' ? <Icons.Building size={28} /> : <Icons.KeyRound size={28} />}
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhum contrato encontrado nesta categoria.</p>
                {currentTab === 'alugueis' && (
                  <button onClick={() => handleOpenContractModal('rent')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                    <Icons.Plus size={16} /> Novo Contrato de Locação
                  </button>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      <ContractQuickViewSidebar contract={quickViewContract} isOpen={Boolean(quickViewContract)} onClose={() => setQuickViewContract(null)} />

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
    </div>
  );
};

export default AdminContracts;
