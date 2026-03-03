import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from './Icons';

type ProtectedRouteProps = {
  allowInactive?: boolean;
  children?: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowInactive = false, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('🚨 [DEBUG ProtectedRoute] Renderizou. Loading:', loading, '| User:', user?.email, '| Active:', user?.active);

  if (loading) {
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

  console.log('🚨 [DEBUG ProtectedRoute] ACESSO LIBERADO.');
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;