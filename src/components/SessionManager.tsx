import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from './Icons';

const SessionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setIsChecking(authLoading);
  }, [authLoading]);

  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <Icons.RefreshCw className="animate-spin text-brand-500" size={32} />
          <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">
            Verificando sessao...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SessionManager;
