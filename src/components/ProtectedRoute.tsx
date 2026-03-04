import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';

type ProtectedRouteProps = {
  allowInactive?: boolean;
  children?: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowInactive = false, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  console.log('🚨 [DEBUG ProtectedRoute] Renderizou. Loading:', loading, '| User:', user?.email, '| Active:', user?.active);

  useEffect(() => {
    const checkSubscriptionAccess = async () => {
      if (!user?.company_id) {
        setCheckingSubscription(false);
        return;
      }

      try {
        // Busca o contrato atual da empresa
        const { data: contract, error } = await supabase
          .from('saas_contracts')
          .select('status, end_date')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar contrato:', error);
          setCheckingSubscription(false);
          return;
        }

        if (!contract) {
          // Sem contrato = acesso liberado (pode ser novo cliente)
          setHasAccess(true);
          setCheckingSubscription(false);
          return;
        }

        const now = new Date();
        const endDate = new Date(contract.end_date);

        // Regra de acesso com Grace Period:
        // - 'active' ou 'trial': acesso liberado
        // - 'canceled': acesso liberado SE ainda não venceu (Grace Period)
        // - 'past_due', 'expired': acesso bloqueado
        const allowedStatuses = ['active', 'trial'];
        const isInGracePeriod = contract.status === 'canceled' && now < endDate;

        if (allowedStatuses.includes(contract.status) || isInGracePeriod) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        setHasAccess(true); // Em caso de erro, libera acesso
      } finally {
        setCheckingSubscription(false);
      }
    };

    if (!loading && user) {
      checkSubscriptionAccess();
    } else {
      setCheckingSubscription(false);
    }
  }, [user, loading]);

  if (loading || checkingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg">
        <Icons.Loader2 className="animate-spin text-brand-600" size={36} />
      </div>
    );
  }

  if (!user) {
    console.log('🚨 [DEBUG ProtectedRoute] BLOQUEADO: Sem usuário. Redirecionando para /admin/login');
    return <Navigate to="/admin/login" replace />;
  }

  // Identifica se é um novo cliente SaaS que acabou de se cadastrar (ainda não tem empresa)
  const isNewSaaSClient = !user.company_id && user.role !== 'super_admin';

  // Se o utilizador está inativo, NÃO é um novo cliente configurando a conta, e não está na tela de pendente
  if (!allowInactive && !user.active && !isNewSaaSClient && location.pathname !== '/admin/pendente') {
    console.log('🚨 [DEBUG ProtectedRoute] BLOQUEADO: Usuário inativo. Redirecionando para /admin/pendente');
    return <Navigate to="/admin/pendente" state={location.state} replace />;
  }

  // Verifica se a assinatura está bloqueada (fora do Grace Period)
  if (!hasAccess && location.pathname !== '/admin/config') {
    console.log('🚨 [DEBUG ProtectedRoute] BLOQUEADO: Assinatura inativa. Redirecionando para /admin/config');
    return <Navigate to="/admin/config" state={{ subscriptionExpired: true }} replace />;
  }

  console.log('🚨 [DEBUG ProtectedRoute] ACESSO LIBERADO.');
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;