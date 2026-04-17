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
};

const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const normalizeStatus = (status: string | null): string | null =>
  status ? status.trim().toLowerCase() : null;

const isFutureDate = (value: string | null) => {
  if (!value) return false;

  try {
    return isAfter(parseISO(value), new Date());
  } catch {
    return false;
  }
};

const buildTenantSnapshot = (tenant: Record<string, unknown> | null): BillingSnapshot | null => {
  if (!tenant) return null;

  return {
    company: {
      id: toOptionalString(tenant.id) ?? undefined,
      name: toOptionalString(tenant.name) ?? undefined,
      asaas_customer_id: toOptionalString(tenant.asaas_customer_id),
      plan: toOptionalString(tenant.plan),
    },
    status: toOptionalString(tenant.subscription_status) ?? toOptionalString(tenant.plan_status),
    periodEnd:
      toOptionalString(tenant.subscription_current_period_end) ??
      toOptionalString(tenant.current_period_end) ??
      toOptionalString(tenant.trial_ends_at),
    planName: toOptionalString(tenant.plan),
  };
};

export default function BillingGuard({ children }: { children: React.ReactNode }) {
  const { tenant, isLoadingTenant } = useTenant();
  const { user, signOut } = useAuth();
  const [showBillingPortal, setShowBillingPortal] = useState(false);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshot | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadBillingSnapshot = async () => {
      if (isLoadingTenant || !user || user.role === 'super_admin' || !user.company_id) {
        if (isMounted) {
          setBillingSnapshot(null);
          setIsBillingLoading(false);
        }
        return;
      }

      const tenantSnapshot = buildTenantSnapshot(tenant);
      if (tenantSnapshot?.company?.id === user.company_id && tenantSnapshot.status) {
        if (isMounted) {
          setBillingSnapshot(tenantSnapshot);
          setIsBillingLoading(false);
        }
        return;
      }

      setIsBillingLoading(true);

      try {
        const [{ data: company, error: companyError }, { data: contract, error: contractError }] = await Promise.all([
          supabase
            .from('companies')
            .select('id, name, plan, plan_status, trial_ends_at, asaas_customer_id')
            .eq('id', user.company_id)
            .maybeSingle(),
          supabase
            .from('saas_contracts')
            .select('status, end_date, plan_name')
            .eq('company_id', user.company_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (companyError) throw companyError;
        if (contractError) throw contractError;

        if (!isMounted) return;

        setBillingSnapshot({
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
        });
      } catch (error) {
        console.error('Erro ao validar status de assinatura:', error);
        if (isMounted) {
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
        if (isMounted) {
          setIsBillingLoading(false);
        }
      }
    };

    void loadBillingSnapshot();

    return () => {
      isMounted = false;
    };
  }, [isLoadingTenant, tenant, user]);

  const normalizedStatus = useMemo(
    () => normalizeStatus(billingSnapshot?.status ?? null),
    [billingSnapshot?.status]
  );

  // Ignora o bloqueio se não houver usuário, se for Super Admin, ou se o cliente ainda está no onboarding.
  if (!user || user.role === 'super_admin' || !user.company_id) {
    return <>{children}</>;
  }

  if (isLoadingTenant || isBillingLoading || !billingSnapshot) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-4 text-white">
        <Icons.Loader2 className="mb-4 animate-spin text-brand-400" size={42} />
        <p className="text-sm font-bold text-slate-200">Verificando assinatura...</p>
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
    isCanceledButValid;

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
