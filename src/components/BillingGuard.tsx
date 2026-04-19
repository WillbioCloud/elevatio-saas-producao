import React, { useEffect, useMemo, useState } from 'react';
import { isAfter, parseISO } from 'date-fns';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import BillingPortalModal from './BillingPortalModal';
import { Icons } from './Icons';

type BillingCompany = {
  id?: string;
  name?: string;
  asaas_customer_id?: string | null;
  plan?: string | null;
};

type BillingSnapshot = {
  company: BillingCompany | null;
  status: string | null;
  periodEnd: string | null;
  planName: string | null;
  pastDueOverdueDays?: number | null;
  isPastDueWithinGrace?: boolean;
};

const PAST_DUE_GRACE_DAYS = 7;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const normalizeStatus = (status: string | null): string | null =>
  status ? status.trim().toLowerCase() : null;

const parseLocalDate = (value: string | null | undefined) => {
  if (!value) return null;

  const dateOnly = value.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);

  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    const parsedDate = new Date(year, month - 1, day);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getOverdueDays = (dueDate: string | null | undefined) => {
  const parsedDueDate = parseLocalDate(dueDate);
  if (!parsedDueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedDueDate.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today.getTime() - parsedDueDate.getTime()) / DAY_IN_MS));
};

const isFutureDate = (value: string | null) => {
  if (!value) return false;

  try {
    return isAfter(parseISO(value), new Date());
  } catch {
    return false;
  }
};

const fetchFreshBillingSnapshot = async (companyId: string): Promise<BillingSnapshot> => {
  const [{ data: company, error: companyError }, { data: contract, error: contractError }] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, plan, plan_status, trial_ends_at, asaas_customer_id')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('saas_contracts')
      .select('status, end_date, plan_name')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (companyError) throw companyError;
  if (contractError) throw contractError;

  return {
    company: company
      ? {
          id: toOptionalString(company.id) ?? undefined,
          name: toOptionalString(company.name) ?? undefined,
          asaas_customer_id: toOptionalString(company.asaas_customer_id),
          plan: toOptionalString(company.plan),
        }
      : null,
    status: toOptionalString(company?.plan_status) ?? toOptionalString(contract?.status),
    periodEnd: toOptionalString(company?.trial_ends_at) ?? toOptionalString(contract?.end_date),
    planName: toOptionalString(contract?.plan_name) ?? toOptionalString(company?.plan),
  };
};

const withPastDueGraceStatus = async (
  snapshot: BillingSnapshot,
  companyId: string
): Promise<BillingSnapshot> => {
  if (normalizeStatus(snapshot.status) !== 'past_due') {
    return snapshot;
  }

  const { data: oldestOpenPayment, error } = await supabase
    .from('saas_payments')
    .select('due_date, status')
    .eq('company_id', companyId)
    .in('status', ['PENDING', 'OVERDUE', 'pending', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const overdueDays = getOverdueDays(oldestOpenPayment?.due_date ?? null);

  return {
    ...snapshot,
    pastDueOverdueDays: overdueDays,
    isPastDueWithinGrace:
      overdueDays !== null && overdueDays <= PAST_DUE_GRACE_DAYS,
  };
};

export default function BillingGuard({ children }: { children: React.ReactNode }) {
  const { isLoadingTenant: tenantLoading } = useTenant();
  const { user, signOut } = useAuth();
  const [showBillingPortal, setShowBillingPortal] = useState(false);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshot | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    let requestVersion = 0;

    const loadBillingSnapshot = async (showLoading = true) => {
      if (tenantLoading || !user || user.role === 'super_admin' || !user.company_id) {
        if (isMounted) {
          setBillingSnapshot(null);
          setIsBillingLoading(false);
        }
        return;
      }

      const currentRequest = ++requestVersion;
      if (showLoading) {
        setIsBillingLoading(true);
      }

      try {
        let nextSnapshot = await fetchFreshBillingSnapshot(user.company_id);
        nextSnapshot = await withPastDueGraceStatus(nextSnapshot, user.company_id);

        if (!isMounted || currentRequest !== requestVersion) return;

        setBillingSnapshot(nextSnapshot);
      } catch (error) {
        console.error('Erro ao validar status de assinatura:', error);
        if (isMounted && currentRequest === requestVersion) {
          setBillingSnapshot({
            company: {
              id: user.company_id,
              name: user.company?.name,
              plan: user.company?.plan,
            },
            status: 'unknown',
            periodEnd: null,
            planName: user.company?.plan ?? null,
          });
        }
      } finally {
        if (isMounted && currentRequest === requestVersion) {
          setIsBillingLoading(false);
        }
      }
    };

    void loadBillingSnapshot();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadBillingSnapshot(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tenantLoading, user]);

  const normalizedStatus = useMemo(
    () => normalizeStatus(billingSnapshot?.status ?? null),
    [billingSnapshot?.status]
  );

  // 1. Splash Screen de Carregamento de Workspace
  if (tenantLoading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-dark-bg flex flex-col items-center justify-center">
        <div className="relative animate-pulse duration-1000">
          <svg
            width="240"
            height="137"
            viewBox="0 0 587 335"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-xl"
          >
            <rect width="587" height="335" fill="transparent" />
            <rect x="141" y="265" width="313" height="59" fill="url(#paint0_linear_1_2)" />
            <path d="M141 213.302L390 129V194.282L141 275.5V213.302Z" fill="url(#paint1_linear_1_2)" />
            <path d="M141 155.796C141 136.983 152.703 120.156 170.34 113.609L446.76 11.0019C450.026 9.78948 453.5 12.2054 453.5 15.6894V79.4859C453.5 81.5943 452.177 83.4761 450.194 84.1903L142.339 195.018C141.687 195.253 141 194.77 141 194.077V155.796Z" fill="url(#paint2_linear_1_2)" />
            <path d="M141 265H237L217 273.659L184 293.014L141 319.5V265Z" fill="#003DCC" />
            <path d="M141 265H235L217.12 272.718L183.402 292.272L141 318V265Z" fill="#3C6CDD" />
            <defs>
              <linearGradient id="paint0_linear_1_2" x1="211" y1="295" x2="454" y2="294.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1547D3" />
                <stop offset="1" stopColor="#63BCFE" />
              </linearGradient>
              <linearGradient id="paint1_linear_1_2" x1="373.5" y1="158" x2="184" y2="220.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#47D6FE" />
                <stop offset="1" stopColor="#0025A1" />
              </linearGradient>
              <linearGradient id="paint2_linear_1_2" x1="485" y1="34" x2="164" y2="156" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5DF4FF" />
                <stop offset="1" stopColor="#0010C2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="h-1.5 w-32 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full w-full animate-[indeterminate_1.5s_infinite_linear] origin-left"></div>
          </div>
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Carregando Workspace</p>
        </div>
      </div>
    );
  }

  // 2. Se for Super Admin ou Onboarding, passa direto sem checar pagamento
  if (!user || user.role === 'super_admin' || !user.company_id) {
    return <>{children}</>;
  }

  if (isBillingLoading || !billingSnapshot) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-dark-bg flex flex-col items-center justify-center">
        <div className="relative animate-pulse duration-1000">
          <svg
            width="240"
            height="137"
            viewBox="0 0 587 335"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-xl"
          >
            <rect width="587" height="335" fill="transparent" />
            <rect x="141" y="265" width="313" height="59" fill="url(#paint0_linear_1_2)" />
            <path d="M141 213.302L390 129V194.282L141 275.5V213.302Z" fill="url(#paint1_linear_1_2)" />
            <path d="M141 155.796C141 136.983 152.703 120.156 170.34 113.609L446.76 11.0019C450.026 9.78948 453.5 12.2054 453.5 15.6894V79.4859C453.5 81.5943 452.177 83.4761 450.194 84.1903L142.339 195.018C141.687 195.253 141 194.77 141 194.077V155.796Z" fill="url(#paint2_linear_1_2)" />
            <path d="M141 265H237L217 273.659L184 293.014L141 319.5V265Z" fill="#003DCC" />
            <path d="M141 265H235L217.12 272.718L183.402 292.272L141 318V265Z" fill="#3C6CDD" />
            <defs>
              <linearGradient id="paint0_linear_1_2" x1="211" y1="295" x2="454" y2="294.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1547D3" />
                <stop offset="1" stopColor="#63BCFE" />
              </linearGradient>
              <linearGradient id="paint1_linear_1_2" x1="373.5" y1="158" x2="184" y2="220.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#47D6FE" />
                <stop offset="1" stopColor="#0025A1" />
              </linearGradient>
              <linearGradient id="paint2_linear_1_2" x1="485" y1="34" x2="164" y2="156" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5DF4FF" />
                <stop offset="1" stopColor="#0010C2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="h-1.5 w-32 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full w-full animate-[indeterminate_1.5s_infinite_linear] origin-left"></div>
          </div>
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Carregando Workspace</p>
        </div>
      </div>
    );
  }

  // Se estiver cancelado, mas o período pago ainda não acabou, ele pode usar.
  const isCanceledButValid =
    normalizedStatus === 'canceled' && isFutureDate(billingSnapshot.periodEnd);

  // Status permitidos: active, trialing/trial, ou cancelado com dias sobrando.
  const isTrialValid =
    (normalizedStatus === 'trialing' || normalizedStatus === 'trial') &&
    (!billingSnapshot.periodEnd || isFutureDate(billingSnapshot.periodEnd));

  const isAllowed =
    normalizedStatus === 'active' ||
    isTrialValid ||
    isCanceledButValid ||
    (normalizedStatus === 'past_due' && billingSnapshot.isPastDueWithinGrace);

  if (isAllowed) {
    return <>{children}</>;
  }

  // SE CHEGOU AQUI, ESTÁ BLOQUEADO (past_due, unpaid, canceled vencido, etc.)
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 text-center shadow-2xl border border-red-100 dark:border-red-900/30 animate-in fade-in zoom-in duration-300">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Icons.Lock size={48} />
        </div>

        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
          Acesso Suspenso
        </h1>

        <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg leading-relaxed">
          Identificamos uma pendência no faturamento da sua assinatura. O acesso ao sistema e aos contratos foi temporariamente bloqueado.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setShowBillingPortal(true)}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-brand-500/30 text-lg"
          >
            <Icons.CreditCard size={22} /> Regularizar Pagamento
          </button>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-xl font-bold transition-all"
          >
            <Icons.LogOut size={20} /> Sair do Sistema
          </button>
        </div>

        {user.role !== 'admin' && (
          <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
            <p className="text-xs text-amber-800 dark:text-amber-400 flex items-center justify-center gap-2 font-medium">
              <Icons.AlertTriangle size={16} />
              Você é corretor. Peça ao gestor da imobiliária para regularizar a conta.
            </p>
          </div>
        )}
      </div>

      {showBillingPortal && (
        <BillingPortalModal
          isOpen={showBillingPortal}
          onClose={() => setShowBillingPortal(false)}
          company={billingSnapshot.company}
          contract={{
            plan_name: billingSnapshot.planName,
            status: billingSnapshot.status,
          }}
        />
      )}
    </div>
  );
}
