import React, { useEffect, useMemo } from 'react';
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

import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import SaasLayout from './components/SaasLayout';
import AnimatedPage from './components/AnimatedPage';
import AdminContextWrapper from './components/AdminContextWrapper';
import SessionManager from './components/SessionManager';
import { useTrackVisit } from './hooks/useTrackVisit';
import { supabase } from './lib/supabase';

// Public Pages
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Login from './pages/Login';
import About from './pages/About';
import Services from './pages/Services';
import Financiamentos from './pages/Financiamentos';

// Website Landing Pages (Master Domain Only)
import SiteHome from './pages/website/SiteHome';
import SiteSignup from './pages/website/SiteSignup';

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

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const SessionEnforcer: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const role = user?.role ?? (user?.user_metadata as { role?: string } | undefined)?.role;
    const isSuperAdmin = role === 'super_admin';

    if (!loading && user) {
      // 1. Se for Super Admin e tentar acessar a raiz, o login ou qualquer tela do CRM (/admin)
      if (isSuperAdmin && (location.pathname === '/' || location.pathname.startsWith('/admin'))) {
        navigate('/saas/dashboard', { replace: true, state: location.state });
      }
      // 2. Se for Corretor/Admin de imobiliária e estiver no login ou na raiz
      else if (!isSuperAdmin && (location.pathname === '/' || location.pathname === '/admin/login')) {
        navigate('/admin/dashboard', { replace: true, state: location.state });
      }
    }
  }, [loading, user, location.pathname, navigate]);

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

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <Layout>
    <AnimatedPage>{children}</AnimatedPage>
  </Layout>
);

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const routeKey = useMemo(() => location.pathname, [location.pathname]);

  // 🧠 O CÉREBRO: Descobre de quem é o domínio acessado
  const { isMasterDomain } = useTenant();

  return (
    <>
      <ScrollToTop />

      <AnimatePresence mode="wait">
        <Routes location={location} key={routeKey}>
          
          {/* === 1. A ROTA RAIZ (A REGRA DE OURO) === */}
          <Route 
            path="/" 
            element={
              isMasterDomain 
                ? <AnimatedPage><SiteHome /></AnimatedPage> // Se for localhost/master, VAI PARA A LANDING PAGE
                : <PageWrapper><Home /></PageWrapper>       // Se for subdomínio/cliente, VAI PARA A VITRINE
            } 
          />

          {/* === 2. AS ROTAS DA VITRINE (SÓ EXISTEM PARA OS CLIENTES) === */}
          {!isMasterDomain && (
            <>
              <Route path="/imoveis" element={<PageWrapper><Properties /></PageWrapper>} />
              <Route path="/imoveis/:slug" element={<PageWrapper><PropertyDetail /></PageWrapper>} />
              <Route path="/bairros/:slug" element={<PageWrapper><Properties /></PageWrapper>} />
              <Route path="/servicos" element={<PageWrapper><Services /></PageWrapper>} />
              <Route path="/sobre" element={<PageWrapper><About /></PageWrapper>} />
              <Route path="/contato" element={<PageWrapper><div className="pt-20 text-center dark:text-white">Contato</div></PageWrapper>} />
              <Route path="/financiamentos" element={<AnimatedPage><Financiamentos /></AnimatedPage>} />
            </>
          )}

          {/* === 3. ROTAS DA LANDING PAGE (MASTER DOMAIN ONLY) === */}
          {isMasterDomain && (
            <Route path="/registro" element={<AnimatedPage><SiteSignup /></AnimatedPage>} />
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
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('trimoveis_navigation');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <BrowserRouter>
      <TenantProvider>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <SessionManager />
              <SessionEnforcer />
              <PageTracker />
              <UserPresenceTracker />
              <AppRoutes />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </TenantProvider>
    </BrowserRouter>
  );
};

export default App;