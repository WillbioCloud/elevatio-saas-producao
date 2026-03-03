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

  // Se o utilizador está inativo e não é o super_admin, e AINDA NÃO ESTÁ na tela de pendente
  if (!allowInactive && !user.active && location.pathname !== '/admin/pendente') {
    console.log('🚨 [DEBUG ProtectedRoute] BLOQUEADO: Usuário inativo. Redirecionando para /admin/pendente');
    return <Navigate to="/admin/pendente" replace />;
  }

  console.log('🚨 [DEBUG ProtectedRoute] ACESSO LIBERADO.');
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;