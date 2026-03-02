import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import NotificationsMenu from './NotificationsMenu';
import { useInstallmentReminders } from '../hooks/useInstallmentReminders';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import ProductTour from './ProductTour';
import SetupWizardModal from './SetupWizardModal';

const AdminLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFunnelMenuOpen, setIsFunnelMenuOpen] = useState(false);
  const [isContractsMenuOpen, setIsContractsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('trimoveis-sidebar') === 'true');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isAdmin = user?.role === 'admin';

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('trimoveis-sidebar', String(newState));
  };

  useRealtimeEvents();
  useInstallmentReminders();

  const roleLabel = useMemo(() => {
    if (user?.role === 'admin') return 'Administrador';
    if (!user?.role) return 'Corretor';
    return `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`;
  }, [user?.role]);

  // 👇 ADICIONE ESTA LINHA AQUI 👇
  console.log('🚨 [DEBUG WIZARD] Usuário:', user?.email, '| CompanyID:', user?.company_id, '| Wizard vai abrir?', !user?.company_id);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));

      await Promise.race([supabase.auth.refreshSession(), timeoutPromise]);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.warn('Conexão lenta. Recarregando a página para restaurar...', error);
      window.location.reload();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    return () => {
      root.classList.remove('dark');
    };
  }, [theme]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      console.error('Erro ao sair:', error);
      navigate('/admin/login', { replace: true });
    }
  };

  const handleExitToHome = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: Icons.Dashboard },
    { label: 'Imóveis', path: '/admin/imoveis', icon: Icons.Building },
    { label: 'Tarefas', path: '/admin/tarefas', icon: Icons.Calendar },
    { label: 'Relatórios', path: '/admin/analytics', icon: Icons.PieChart, adminOnly: true },
    { label: 'Configurações', path: '/admin/config', icon: Icons.Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden font-sans">
      {/* 🚨 O GUARDA-COSTAS (WIZARD) 🚨 */}
      {/* Se o utilizador não tem empresa, trava a tela e obriga a criar */}
      {!user?.company_id && (
        <SetupWizardModal onComplete={handleRefresh} />
      )}

      <ProductTour isSidebarCollapsed={isSidebarCollapsed} />
      <aside
        className={`hidden md:flex flex-col bg-slate-900 text-white shadow-xl relative z-20 transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div
          className={`p-6 border-b border-slate-800 flex items-center transition-all ${
            isSidebarCollapsed ? 'justify-center px-2' : 'justify-between gap-2'
          }`}
        >
          {!isSidebarCollapsed ? (
            <div className="animate-in fade-in duration-300">
              <h1 className="text-2xl font-serif font-bold tracking-wide text-brand-400 whitespace-nowrap">TR Imóveis</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Gestão Premium</p>
            </div>
          ) : (
            <div
              onClick={toggleSidebar}
              className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center font-serif font-bold text-white shadow-lg cursor-pointer hover:bg-brand-500 transition-colors shrink-0"
              title="Expandir Menu"
            >
              TR
            </div>
          )}
          {!isSidebarCollapsed && (
            <button
              onClick={handleExitToHome}
              className="text-slate-400 hover:text-brand-400 transition-colors p-1 rounded-md hover:bg-slate-800 shrink-0"
              title="Ir para o site (Sair)"
            >
              <Icons.Globe size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {menuItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <React.Fragment key={item.path}>
              <NavLink
                to={item.path}
                id={item.path === '/admin/imoveis' ? 'tour-imoveis' : item.path === '/admin/config' ? 'tour-config' : undefined}
                data-tour-anchor={item.path === '/admin/imoveis' || item.path === '/admin/config' ? 'true' : undefined}
                className={({ isActive }) => `
                  flex items-center gap-3 py-3 rounded-xl transition-all duration-200 group ${item.path === '/admin/imoveis' ? 'tour-imoveis' : ''} ${item.path === '/admin/config' ? 'tour-config' : ''} ${
                    isSidebarCollapsed ? 'justify-center px-0' : 'px-4'
                  }
                  ${isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <item.icon size={20} className="group-hover:scale-110 transition-transform" />
                {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
              </NavLink>

              {item.path === '/admin/imoveis' && (
                <div className="space-y-1">
                  <div
                    className={`flex items-center justify-between rounded-xl transition-all ${
                      location.pathname.includes('/admin/contratos')
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <NavLink
                      to="/admin/contratos?tab=geral"
                      className={`flex-1 flex items-center gap-3 py-2.5 font-medium text-sm ${
                        isSidebarCollapsed ? 'justify-center px-0' : 'px-4'
                      }`}
                    >
                      <Icons.FileText
                        size={20}
                        className={location.pathname.includes('/admin/contratos') ? 'text-brand-600' : 'text-slate-400'}
                      />
                      {!isSidebarCollapsed && <span className="whitespace-nowrap">Contratos e Finanças</span>}
                    </NavLink>
                    {!isSidebarCollapsed && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setIsContractsMenuOpen(!isContractsMenuOpen);
                        }}
                        className="p-3 hover:bg-brand-50 rounded-r-xl transition-colors"
                      >
                        <Icons.ChevronDown
                          size={16}
                          className={`transition-transform duration-200 ${isContractsMenuOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    )}
                  </div>

                  {isContractsMenuOpen && !isSidebarCollapsed && (
                    <div className="pl-11 pr-3 py-2 space-y-1 animate-fade-in">
                      <NavLink
                        to="/admin/contratos?tab=geral"
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            isActive && (!location.search || location.search.includes('tab=geral'))
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                      >
                        Visão Geral
                      </NavLink>

                      <NavLink
                        to="/admin/contratos?tab=vendas"
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            isActive && location.search.includes('tab=vendas')
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                      >
                        Vendas (Recebíveis)
                      </NavLink>

                      <NavLink
                        to="/admin/contratos?tab=alugueis"
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            isActive && location.search.includes('tab=alugueis')
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                      >
                        Locações Ativas
                      </NavLink>
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Menu Dropdown - Funil de Vendas */}
          <div className="space-y-1" id="tour-kanban">
            <div
              className={`flex items-center justify-between rounded-xl transition-all ${
                location.pathname.includes('/admin/leads')
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <NavLink
                to="/admin/leads?funnel=geral"
                data-tour-anchor="true"
                className={`tour-kanban flex-1 flex items-center gap-3 py-2.5 font-medium text-sm ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'px-4'
                }`}
              >
                <Icons.Filter size={20} className={location.pathname.includes('/admin/leads') ? 'text-brand-600' : 'text-slate-400'} />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Visão Geral (Funil)</span>}
              </NavLink>
              {!isSidebarCollapsed && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setIsFunnelMenuOpen(!isFunnelMenuOpen);
                  }}
                  className="p-3 hover:bg-brand-100 rounded-r-xl transition-colors"
                >
                  <Icons.ChevronDown size={16} className={`transition-transform duration-200 ${isFunnelMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Submenu do Funil */}
            {isFunnelMenuOpen && !isSidebarCollapsed && (
              <div className="pl-11 pr-3 py-2 space-y-1 animate-fade-in">
                {isAdmin && (
                  <NavLink
                    to="/admin/leads?funnel=pre_atendimento"
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive && location.search.includes('pre_atendimento')
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    Pré-Atendimento
                  </NavLink>
                )}

                <NavLink
                  to="/admin/leads?funnel=atendimento"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive && (!location.search || location.search.includes('atendimento')) && !location.search.includes('pre_atendimento')
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  Atendimento
                </NavLink>

                <NavLink
                  to="/admin/leads?funnel=proposta"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive && location.search.includes('proposta')
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  Propostas
                </NavLink>

                <NavLink
                  to="/admin/leads?funnel=venda_ganha"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive && location.search.includes('venda_ganha')
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  Vendas Ganhas
                </NavLink>

                <NavLink
                  to="/admin/leads?funnel=perdido"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive && location.search.includes('perdido')
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  Perdidos
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 transition-all">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} mb-3`}>
            <div
              className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-lg shadow-md border-2 border-slate-700 shrink-0"
              title={user?.name || 'Perfil'}
            >
              {(user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-sm font-bold text-white truncate">{user?.name || user?.email || 'Usuário'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${user?.role === 'admin' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold truncate">{roleLabel}</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? 'Sair do Sistema' : undefined}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 text-xs font-bold transition-all border border-slate-700 hover:border-red-500/20 ${
              isSidebarCollapsed ? 'px-0' : ''
            }`}
          >
            <Icons.LogOut size={14} className="shrink-0" />
            {!isSidebarCollapsed && <span className="whitespace-nowrap">Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 md:rounded-l-[2.5rem] shadow-2xl relative z-10">
        <header className="flex items-center justify-between p-4 md:px-8 md:py-5 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Icons.Menu />
            </button>
            <button
              onClick={toggleSidebar}
              className="hidden md:flex p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Recolher / Expandir Menu Lateral"
            >
              <Icons.Menu />
            </button>
            <div className="md:hidden font-serif font-bold text-slate-800">TR Imóveis</div>
            <div className="hidden md:block min-w-0">
              <p className="text-sm font-bold text-slate-700 truncate">{user?.name || user?.email || 'Usuário'}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{roleLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="hidden md:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs md:text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Atualizar sessão e recarregar as telas administrativas"
            >
              <Icons.RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar Sistema'}
            </button>

            <NotificationsMenu />

            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Icons.Sun size={18} /> : <Icons.Moon size={18} />}
            </button>

            <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                {(user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-600 max-w-[120px] truncate">{user?.name || 'Perfil'}</span>
            </div>
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[70px] left-0 right-0 bg-white border-b border-slate-100 shadow-xl z-50 p-4 max-h-[calc(100vh-70px)] overflow-y-auto custom-scrollbar flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
            {/* 1. Itens Padrões */}
            {menuItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  ${isActive ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                `}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}

            {/* 2. Menu Contratos (Mobile) */}
            <div className="space-y-1">
              <div className={`flex items-center justify-between rounded-lg ${location.pathname.includes('/admin/contratos') ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <NavLink
                  to="/admin/contratos?tab=geral"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 font-medium ${location.pathname.includes('/admin/contratos') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}
                >
                  <Icons.FileText size={20} />
                  Contratos e Finanças
                </NavLink>
                <button onClick={() => setIsContractsMenuOpen(!isContractsMenuOpen)} className="p-3 text-slate-500">
                  <Icons.ChevronDown size={16} className={`transition-transform duration-200 ${isContractsMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {isContractsMenuOpen && (
                <div className="pl-12 pr-4 py-2 space-y-3 border-l-2 border-slate-100 ml-6 animate-fade-in">
                  <NavLink to="/admin/contratos?tab=geral" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Visão Geral</NavLink>
                  <NavLink to="/admin/contratos?tab=vendas" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Vendas (Recebíveis)</NavLink>
                  <NavLink to="/admin/contratos?tab=alugueis" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Locações Ativas</NavLink>
                </div>
              )}
            </div>

            {/* 3. Menu Funil de Vendas (Mobile) */}
            <div className="space-y-1">
              <div className={`flex items-center justify-between rounded-lg ${location.pathname.includes('/admin/leads') ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <NavLink
                  to="/admin/leads?funnel=geral"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 font-medium ${location.pathname.includes('/admin/leads') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}
                >
                  <Icons.Filter size={20} />
                  Funil de Vendas
                </NavLink>
                <button onClick={() => setIsFunnelMenuOpen(!isFunnelMenuOpen)} className="p-3 text-slate-500">
                  <Icons.ChevronDown size={16} className={`transition-transform duration-200 ${isFunnelMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {isFunnelMenuOpen && (
                <div className="pl-12 pr-4 py-2 space-y-3 border-l-2 border-slate-100 ml-6 animate-fade-in">
                  {isAdmin && <NavLink to="/admin/leads?funnel=pre_atendimento" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Pré-Atendimento</NavLink>}
                  <NavLink to="/admin/leads?funnel=atendimento" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Atendimento</NavLink>
                  <NavLink to="/admin/leads?funnel=proposta" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Propostas</NavLink>
                  <NavLink to="/admin/leads?funnel=venda_ganha" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Vendas Ganhas</NavLink>
                  <NavLink to="/admin/leads?funnel=perdido" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm text-slate-600 hover:text-brand-600">Perdidos</NavLink>
                </div>
              )}
            </div>

            {/* 4. Rodapé Mobile (Usuário e Sair) */}
            <div className="pt-4 border-t border-slate-100 mt-2 space-y-2 pb-4">
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
                  {(user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">{user?.name || user?.email}</p>
                  <p className="text-xs text-slate-500">{roleLabel}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 mt-2">
                <button
                  className="text-slate-400 hover:text-brand-400 transition-colors flex items-center justify-center p-2 rounded-md hover:bg-slate-100"
                  onClick={handleExitToHome}
                  title="Ir para o site público"
                >
                  <Icons.Globe size={20} />
                </button>
                <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                  <Icons.LogOut size={16} /> Sair
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-10">
            
            <Outlet key={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;