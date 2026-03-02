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
import { AnimatePresence } from 'framer-motion';

import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
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
    console.log(`🚨 [DEBUG SessionEnforcer] Analisando rota: ${location.pathname} | Loading: ${loading} | User: ${user?.email}`);
    
    if (!loading && user && (location.pathname === '/' || location.pathname === '/admin/login')) {
      console.log('🚨 [DEBUG SessionEnforcer] ACIONADO: Tirando o usuário do login e mandando para /admin/dashboard');
      navigate('/admin/dashboard', { replace: true });
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
                ? <Navigate to="/admin/login" replace /> // Se for localhost/master, VAI PARA O LOGIN
                : <PageWrapper><Home /></PageWrapper>    // Se for subdomínio/cliente, VAI PARA A VITRINE
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

          {/* === 3. A ROTA DE LOGIN DO CRM (COMUM A TODOS) === */}
          <Route path="/admin/login" element={<AnimatedPage><Login /></AnimatedPage>} />

          {/* === 4. ROTAS PROTEGIDAS DO CRM (COMUNS A TODOS) === */}
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