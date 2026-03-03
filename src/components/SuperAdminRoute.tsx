import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type SuperAdminRouteProps = {
  children: React.ReactNode;
};

/**
 * Protege rotas do painel Super Admin.
 * Apenas utilizadores com role === 'super_admin' podem aceder.
 * Caso contrário, redireciona para /admin/dashboard ou /.
 */
export default function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">A carregar...</div>
      </div>
    );
  }

  const role = (user as { role?: string } | null)?.role ?? (user?.user_metadata as { role?: string } | undefined)?.role;

  if (!user || role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
