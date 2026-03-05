import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from './Icons';

const SessionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant, loading: tenantLoading } = useTenant();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (authLoading || tenantLoading) return;

    const checkAccess = () => {
      if (user && user.role !== 'super_admin' && location.pathname.startsWith('/admin')) {
        // A FONTE DA VERDADE É A TABELA COMPANIES!
        const status = tenant?.plan_status;

        if (status !== 'active' && status !== 'trial' && status !== 'canceled') {
          if (location.pathname !== '/admin/config') {
            navigate('/admin/config', { replace: true });
            return;
          }
        }

        if (status === 'trial' && tenant?.trial_ends_at) {
          if (new Date() > new Date(tenant.trial_ends_at)) {
            if (location.pathname !== '/admin/config') {
              navigate('/admin/config', { replace: true });
              return;
            }
          }
        }
      }

      setIsChecking(false);
    };

    checkAccess();
  }, [user, tenant, location.pathname, navigate, authLoading, tenantLoading]);

  if (authLoading || tenantLoading || isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Icons.RefreshCw className="animate-spin text-brand-500" size={32} />
          <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">
            A verificar acessos...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SessionManager;
