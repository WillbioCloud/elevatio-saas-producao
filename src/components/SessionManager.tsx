import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';

const SessionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (authLoading) return;

    const checkAccess = async () => {
      // Deixa passar livremente quem não está no admin, não tem utilizador ou é super_admin
      if (!location.pathname.startsWith('/admin') || !user || user.role === 'super_admin') {
        if (isMounted) setIsChecking(false);
        return;
      }

      try {
        if (!user.company_id) throw new Error("Sem company_id");

        // Busca a empresa do utilizador logado DIRETAMENTE do banco (ignora TenantContext)
        const { data: company, error } = await supabase
          .from('companies')
          .select('plan_status, trial_ends_at')
          .eq('id', user.company_id)
          .single();

        if (error || !company) throw new Error("Empresa não encontrada");

        const status = company.plan_status;
        let shouldBlock = false;

        // Regra de Ouro: Bloqueia se não for active, trial ou canceled
        if (status !== 'active' && status !== 'trial' && status !== 'canceled') {
          shouldBlock = true;
        } else if (status === 'trial' && company.trial_ends_at) {
          // Bloqueia se o Trial já expirou
          if (new Date() > new Date(company.trial_ends_at)) {
            shouldBlock = true;
          }
        }

        if (shouldBlock && location.pathname !== '/admin/config') {
          navigate('/admin/config', { replace: true });
        }
      } catch (error) {
        console.error('Erro na validação da sessão:', error);
        if (location.pathname !== '/admin/config') {
          navigate('/admin/config', { replace: true });
        }
      } finally {
        if (isMounted) setIsChecking(false);
      }
    };

    checkAccess();

    return () => { isMounted = false; };
  }, [user, location.pathname, navigate, authLoading]);

  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center z-50">
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
