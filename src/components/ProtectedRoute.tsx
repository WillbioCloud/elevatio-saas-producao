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

  // 1. Aguarda o carregamento da autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg">
        <Icons.Loader2 className="animate-spin text-brand-600" size={36} />
      </div>
    );
  }

  // 2. Bloqueia se não estiver logado
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Identifica se é um novo cliente SaaS que acabou de se cadastrar (ainda não tem empresa)
  const isNewSaaSClient = !user.company_id && user.role !== 'super_admin';

  // 3. Bloqueia se o corretor foi inativado pelo dono da imobiliária
  if (!allowInactive && !user.active && !isNewSaaSClient && location.pathname !== '/admin/pendente') {
    return <Navigate to="/admin/pendente" state={location.state} replace />;
  }

  // NOTA: A validação de Assinatura/Faturação (Trial, Pending, Inadimplente)
  // agora é tratada globalmente e de forma centralizada pelo SessionManager.tsx
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
