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
import PublicCheckout from './pages/PublicCheckout';
import SignDocument from './pages/SignDocument';

// Website Landing Pages (Master Domain Only)
import LandingPage from './pages/website/LandingPage';
import PrivacyPolicy from './pages/website/PrivacyPolicy';
import TermsOfUse from './pages/website/TermsOfUse';

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
import AdminFinance from './pages/AdminFinance';
import AdminKeys from './pages/AdminKeys';
import AdminClients from './pages/AdminClients';
import AdminLeaderboard from './pages/AdminLeaderboard';
import AdminSupport from './pages/AdminSupport';
import AdminTV from './pages/AdminTV';
import PendingApproval from './pages/PendingApproval';
import InviteSignup from './pages/InviteSignup';

// Super Admin (SaaS) Pages
import SaasDashboard from './pages/saas/SaasDashboard';
import SaasClients from './pages/saas/SaasClients';
import SaasPlans from './pages/saas/SaasPlans';
import SaasPayments from './pages/saas/SaasPayments';
import SaasContracts from './pages/saas/SaasContracts';
import SaasSettings from './pages/saas/SaasSettings';
import SaasSupport from './pages/saas/SaasSupport';
import SaasCoupons from './pages/saas/SaasCoupons';
import SaasTemplates from './pages/saas/SaasTemplates';
import SaasDomains from './pages/saas/SaasDomains';
import SaasReviews from './pages/saas/SaasReviews';
import { SUPER_ADMIN_BASE_PATH } from './config/routes';
import { getEnvironment as resolveHostEnvironment } from './utils/domain';

// ============================================================================
// 🧠 ROTEADOR INTELIGENTE MULTI-TENANT (Elevatio Vendas SaaS)
// ============================================================================
/**
 * Identifica o tipo de ambiente baseado no hostname:
 * - 'landing': Domínio principal (elevatiovendas.com.br) → Landing Page do SaaS
 * - 'superadmin': Subdomínio admin (admin.elevatiovendas.com.br) → Painel Super Admin
 * - 'app': Subdomínio de cliente (imobiliaria.elevatiovendas.com.br) → CRM da Imobiliária
 * - 'website': Domínio customizado (www.imobiliariadojoao.com.br) → Site do Cliente
 */
const getEnvironment = () => resolveHostEnvironment(window.location.hostname);

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
              <Route path="/" element={<AnimatedPage><LandingPage /></AnimatedPage>} />
              <Route path="/privacidade" element={<AnimatedPage><PrivacyPolicy /></AnimatedPage>} />
              <Route path="/termos" element={<AnimatedPage><TermsOfUse /></AnimatedPage>} />
              <Route path="/registro" element={<Navigate to="/admin/login?mode=signup" replace />} />
              <Route path="/cadastro" element={<Navigate to="/admin/login?mode=signup" replace />} />
            </>
          )}

          {/* === 2. ROTA DOS SITES DOS CLIENTES (Templates) === */}
          {!isMasterDomain && (
            <Route path="/*" element={<TenantRouter customDomain={env.customDomain} />} />
          )}

          {/* === 4. A ROTA DE LOGIN DO CRM (COMUM A TODOS) === */}
          <Route path="/admin/login" element={<AnimatedPage><Login /></AnimatedPage>} />
          <Route path="/pay/:id" element={<PublicCheckout />} />
          <Route path="/assinar/:token" element={<SignDocument />} />

          {/* Rota de Convite de Equipe */}
          <Route path="/convite" element={<InviteSignup />} />

          {/* === 5. ROTAS PROTEGIDAS DO CRM (COMUNS A TODOS) === */}
          <Route path="/admin/pendente" element={<ProtectedRoute allowInactive={true}><PendingApproval /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute><AdminContextWrapper /></ProtectedRoute>}>
            <Route path="tv" element={<AdminTV />} />
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="imoveis" element={<AdminProperties />} />
              <Route path="chaves" element={<AdminKeys />} />
              <Route path="imoveis/novo" element={<AdminPropertyForm />} />
              <Route path="imoveis/editar/:id" element={<AdminPropertyForm />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="clientes" element={<AdminClients />} />
              <Route path="tarefas" element={<AdminTasks />} />
              <Route path="contratos" element={<AdminContracts />} />
              <Route path="contratos/:id" element={<AdminContractDetails />} />
              <Route path="financeiro" element={<AdminFinance />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="leaderboard" element={<AdminLeaderboard />} />
              <Route path="config" element={<AdminConfig />} />
              <Route path="suporte" element={<AdminSupport />} />
            </Route>
          </Route>

          {/* === 6. ROTAS SUPER ADMIN (PAINEL SaaS) === */}
          <Route
            path={SUPER_ADMIN_BASE_PATH}
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
            <Route path="dominios" element={<SaasDomains />} />
            <Route path="planos" element={<SaasPlans />} />
            <Route path="templates" element={<SaasTemplates />} />
            <Route path="cupons" element={<SaasCoupons />} />
            <Route path="pagamentos" element={<SaasPayments />} />
            <Route path="contratos" element={<SaasContracts />} />
            <Route path="avaliacoes" element={<SaasReviews />} />
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
