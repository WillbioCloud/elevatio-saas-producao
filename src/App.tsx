import React, { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminRoute from './components/SuperAdminRoute';
import { AnimatePresence } from 'framer-motion';

import AdminLayout from './components/AdminLayout';
import SaasLayout from './components/SaasLayout';
import AnimatedPage from './components/AnimatedPage';
import AdminContextWrapper from './components/AdminContextWrapper';
import SessionManager from './components/SessionManager';
import { useTrackVisit } from './hooks/useTrackVisit';
import { supabase } from './lib/supabase';

// Public Pages
import Login from './pages/Login';

// Website Landing Pages (Master Domain Only)
import SiteHome from './pages/website/SiteHome';
import SiteSignup from './pages/website/SiteSignup';

// Template Router
import TenantRouter from './templates/TenantRouter';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminProperties from './pages/AdminProperties';
import AdminPropertyForm from './pages/AdminPropertyForm';
import AdminLeads from './pages/AdminLeads';
import AdminTasks from './pages/AdminTasks';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminConfig from './pages/AdminConfig';
import AdminContracts from './pages/AdminContracts';
import AdminContractDetails from './pages/AdminContractDetails';
import PendingApproval from './pages/PendingApproval';

// Super Admin (SaaS) Pages
import SaasDashboard from './pages/saas/SaasDashboard';
import SaasClients from './pages/saas/SaasClients';
import SaasPlans from './pages/saas/SaasPlans';
import SaasPayments from './pages/saas/SaasPayments';
import SaasContracts from './pages/saas/SaasContracts';
import SaasSettings from './pages/saas/SaasSettings';
import SaasSupport from './pages/saas/SaasSupport';

// ============================================================================
// 🧠 ROTEADOR INTELIGENTE MULTI-TENANT (Elevatio Vendas SaaS)
// ============================================================================
/**
 * Identifica o tipo de ambiente baseado no hostname:
 * - 'landing': Domínio principal (elevatiovendas.com) → Landing Page do SaaS
 * - 'superadmin': Subdomínio admin (admin.elevatiovendas.com) → Painel Super Admin
 * - 'app': Subdomínio de cliente (imobiliaria.elevatiovendas.com) → CRM da Imobiliária
 * - 'website': Domínio customizado (www.imobiliariadojoao.com.br) → Site do Cliente
 */
const getEnvironment = () => {
  const hostname = window.location.hostname;

  // Para desenvolvimento local (localhost) - Força o modo app/crm para facilitar o dev
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return { type: 'app', subdomain: 'dev' };
  }

  // Domínios principais da plataforma SaaS
  const mainDomains = ['elevatiovendas.com', 'elevatiovendas.vercel.app'];
  
  const isMainDomain = mainDomains.some(domain => 
    hostname === domain || hostname === `www.${domain}`
  );
  
  if (isMainDomain) {
    return { type: 'landing' }; // Mostra a Landing Page do SaaS (SiteHome)
  }

  const isAdminDomain = mainDomains.some(domain => 
    hostname === `admin.${domain}`
  );
  
  if (isAdminDomain) {
    return { type: 'superadmin' }; // Redireciona para o painel do Dono do SaaS
  }

  const isSubdomain = mainDomains.some(domain => 
    hostname.endsWith(`.${domain}`)
  );
  
  if (isSubdomain) {
    const subdomain = hostname.split('.')[0];
    return { type: 'app', subdomain }; // CRM da Imobiliária (ex: nomedaimobiliaria.elevatiovendas.com)
  }

  // Se não caiu em nenhuma regra acima, é um Domínio Customizado de um cliente!
  return { type: 'website', customDomain: hostname }; // Site do Cliente (ex: www.imobiliariadojoao.com.br)
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};



const PageTracker: React.FC = () => {
  useTrackVisit();
  return null;
};

const UserPresenceTracker: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const updatePresence = async () => {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id);
      };

      updatePresence();
    }
  }, [user, location.pathname]);

  return null;
};



const AppRoutes: React.FC<{ env: { type: string; subdomain?: string; customDomain?: string } }> = ({ env }) => {
  const location = useLocation();
  const routeKey = useMemo(() => location.pathname, [location.pathname]);

  // 🧠 O CÉREBRO: Descobre de quem é o domínio acessado
  const { isMasterDomain } = useTenant();

  return (
    <>
      <ScrollToTop />

      <AnimatePresence mode="wait">
        <Routes location={location} key={routeKey}>
          
          {/* === 1. ROTAS DA LANDING PAGE DO SAAS (MASTER DOMAIN ONLY) === */}
          {isMasterDomain && (
            <>
              <Route path="/" element={<AnimatedPage><SiteHome /></AnimatedPage>} />
              <Route path="/registro" element={<AnimatedPage><SiteSignup /></AnimatedPage>} />
            </>
          )}

          {/* === 2. ROTA DOS SITES DOS CLIENTES (Templates) === */}
          {!isMasterDomain && (
            <Route path="/*" element={<TenantRouter customDomain={env.customDomain} />} />
          )}

          {/* === 4. A ROTA DE LOGIN DO CRM (COMUM A TODOS) === */}
          <Route path="/admin/login" element={<AnimatedPage><Login /></AnimatedPage>} />

          {/* === 5. ROTAS PROTEGIDAS DO CRM (COMUNS A TODOS) === */}
          <Route path="/admin/pendente" element={<ProtectedRoute allowInactive={true}><PendingApproval /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute><AdminContextWrapper /></ProtectedRoute>}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="imoveis" element={<AdminProperties />} />
              <Route path="imoveis/novo" element={<AdminPropertyForm />} />
              <Route path="imoveis/editar/:id" element={<AdminPropertyForm />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="tarefas" element={<AdminTasks />} />
              <Route path="contratos" element={<AdminContracts />} />
              <Route path="contratos/:id" element={<AdminContractDetails />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="config" element={<AdminConfig />} />
            </Route>
          </Route>

          {/* === 6. ROTAS SUPER ADMIN (PAINEL SaaS) === */}
          <Route
            path="/saas"
            element={
              <ProtectedRoute>
                <SuperAdminRoute>
                  <SaasLayout />
                </SuperAdminRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<SaasDashboard />} />
            <Route path="clientes" element={<SaasClients />} />
            <Route path="planos" element={<SaasPlans />} />
            <Route path="pagamentos" element={<SaasPayments />} />
            <Route path="contratos" element={<SaasContracts />} />
            <Route path="definicoes" element={<SaasSettings />} />
            <Route path="suporte" element={<SaasSupport />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
};

const App: React.FC = () => {
  // ============================================================================
  // 🎯 ESTADO DO AMBIENTE (Multi-tenant Router)
  // ============================================================================
  const [env, setEnv] = useState<{ 
    type: string; 
    subdomain?: string; 
    customDomain?: string 
  }>({ type: 'loading' });

  useEffect(() => {
    setEnv(getEnvironment());
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('trimoveis_navigation');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ============================================================================
  // 🔄 LOADING STATE (Enquanto identifica o ambiente)
  // ============================================================================
  if (env.type === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Carregando Elevatio Vendas...</p>
        </div>
      </div>
    );
  }



  // ============================================================================
  // 🚀 ROTA 2: LANDING PAGE DO SAAS + SUPER ADMIN + CRM (Aplicação Principal)
  // ============================================================================
  return (
    <BrowserRouter>
      <TenantProvider>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <SessionManager />
              <PageTracker />
              <UserPresenceTracker />
              <AppRoutes env={env} />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </TenantProvider>
    </BrowserRouter>
  );
};

export default App;