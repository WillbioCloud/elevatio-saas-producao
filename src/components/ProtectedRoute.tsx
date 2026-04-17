import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type ProtectedRouteProps = {
  allowInactive?: boolean;
  children?: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowInactive = false, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Splash Screen de Autenticacao
  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-dark-bg flex flex-col items-center justify-center">
        <div className="relative animate-pulse duration-1000">
          <svg
            width="240"
            height="137"
            viewBox="0 0 587 335"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-xl"
          >
            <rect width="587" height="335" fill="transparent" />
            <rect x="141" y="265" width="313" height="59" fill="url(#paint0_linear_1_2)" />
            <path d="M141 213.302L390 129V194.282L141 275.5V213.302Z" fill="url(#paint1_linear_1_2)" />
            <path d="M141 155.796C141 136.983 152.703 120.156 170.34 113.609L446.76 11.0019C450.026 9.78948 453.5 12.2054 453.5 15.6894V79.4859C453.5 81.5943 452.177 83.4761 450.194 84.1903L142.339 195.018C141.687 195.253 141 194.77 141 194.077V155.796Z" fill="url(#paint2_linear_1_2)" />
            <path d="M141 265H237L217 273.659L184 293.014L141 319.5V265Z" fill="#003DCC" />
            <path d="M141 265H235L217.12 272.718L183.402 292.272L141 318V265Z" fill="#3C6CDD" />
            <defs>
              <linearGradient id="paint0_linear_1_2" x1="211" y1="295" x2="454" y2="294.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1547D3" />
                <stop offset="1" stopColor="#63BCFE" />
              </linearGradient>
              <linearGradient id="paint1_linear_1_2" x1="373.5" y1="158" x2="184" y2="220.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#47D6FE" />
                <stop offset="1" stopColor="#0025A1" />
              </linearGradient>
              <linearGradient id="paint2_linear_1_2" x1="485" y1="34" x2="164" y2="156" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5DF4FF" />
                <stop offset="1" stopColor="#0010C2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="h-1.5 w-32 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full w-full animate-[indeterminate_1.5s_infinite_linear] origin-left"></div>
          </div>
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Carregando Workspace</p>
        </div>
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
