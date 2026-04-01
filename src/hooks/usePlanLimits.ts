import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { normalizePlanType, PLANS } from '../config/plans';

export function usePlanLimits(
  currentItemsCount: number,
  feature: 'properties' | 'users' | 'leads'
) {
  const { user } = useAuth();

  const limits = useMemo(() => {
    // Se for Super Admin, não tem limites
    if (user?.role === 'super_admin') {
      return { isUnlimited: true, hasReachedLimit: false, limit: Infinity };
    }

    // Pega o plano da empresa (default para 'starter' se não existir)
    const planId = normalizePlanType(user?.company?.plan, 'starter') ?? 'starter';
    const planConfig = PLANS.find((p) => p.id === planId) || PLANS[0];

    let limit = 0;
    if (feature === 'properties') limit = planConfig.limits.properties;
    if (feature === 'users') limit = planConfig.limits.users;
    if (feature === 'leads') limit = planConfig.limits.leads;

    const isUnlimited = limit === -1; // -1 significa ilimitado na nossa config
    const hasReachedLimit = !isUnlimited && currentItemsCount >= limit;

    return { isUnlimited, hasReachedLimit, limit };
  }, [user, currentItemsCount, feature]);

  return limits;
}
