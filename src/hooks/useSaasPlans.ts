import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface SaasPlan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  active: boolean;
  description?: string;
  icon?: string;
  badge?: string;
  is_popular?: boolean;
  has_free_domain?: boolean;
  max_users?: number;
  max_properties?: number;
  max_contracts?: number;
  max_photos?: number;
  has_funnel?: boolean;
  has_pipeline?: boolean;
  has_gamification?: boolean;
  has_erp?: boolean;
  ia_limit?: string;
  aura_access?: string;
  has_site?: boolean;
  has_portals?: boolean;
  has_email_auto?: boolean;
  has_api?: boolean;
  support_level?: string;
  [key: string]: unknown;
}

type RawSaasPlan = Record<string, unknown>;

const toNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const normalizeSaasPlan = (plan: RawSaasPlan): SaasPlan => {
  const priceMonthly = toNumber(plan.price_monthly ?? plan.price, 0);
  const priceYearly = toNumber(plan.price_yearly, priceMonthly * 12 * 0.85);

  return {
    ...plan,
    id: String(plan.id ?? plan.name ?? ''),
    name: String(plan.name ?? ''),
    price_monthly: priceMonthly,
    price_yearly: priceYearly,
    features: Array.isArray(plan.features) ? plan.features.map(String) : [],
    active: plan.active !== false,
  };
};

export const getPlanMonthlyPrice = (plan: Pick<SaasPlan, 'price_monthly'>) =>
  toNumber(plan.price_monthly, 0);

export const getPlanYearlyTotal = (plan: Pick<SaasPlan, 'price_yearly' | 'price_monthly'>) =>
  toNumber(plan.price_yearly, getPlanMonthlyPrice(plan) * 12);

export const getPlanYearlyMonthlyPrice = (plan: Pick<SaasPlan, 'price_yearly' | 'price_monthly'>) =>
  getPlanYearlyTotal(plan) / 12;

export const getPlanAnnualDiscountPercent = (plan: Pick<SaasPlan, 'price_yearly' | 'price_monthly'>) => {
  const monthlyTotal = getPlanMonthlyPrice(plan) * 12;
  if (monthlyTotal <= 0) return 0;

  return Math.max(0, Math.round((1 - getPlanYearlyTotal(plan) / monthlyTotal) * 100));
};

export const getPlanBillingPrice = (
  plan: Pick<SaasPlan, 'price_monthly' | 'price_yearly'>,
  billingCycle: 'monthly' | 'yearly',
  options: { hasFidelity?: boolean } = {},
) => {
  if (billingCycle === 'yearly') return getPlanYearlyTotal(plan);

  const monthlyPrice = getPlanMonthlyPrice(plan);
  return options.hasFidelity ? monthlyPrice * 0.9 : monthlyPrice;
};

export function useSaasPlans() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchPlans() {
      setLoading(true);

      const { data, error } = await supabase
        .from('saas_plans')
        .select('*')
        .eq('active', true)
        .order('price_monthly', { ascending: true });

      if (!isMounted) return;

      if (!error && data) {
        setPlans(data.map((plan) => normalizeSaasPlan(plan as RawSaasPlan)));
      } else if (error) {
        console.error('Erro ao carregar planos SaaS:', error);
      }

      setLoading(false);
    }

    fetchPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  return { plans, loading };
}
