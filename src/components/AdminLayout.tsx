import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { CrmNotificationsMenu } from './CrmNotificationsMenu';
import { useInstallmentReminders } from '../hooks/useInstallmentReminders';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import ProductTour from './ProductTour';
import SetupWizardModal from './SetupWizardModal';

const AdminLayout: React.FC = () => {
  const { user, signOut, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFunnelMenuOpen, setIsFunnelMenuOpen] = useState(false);
  const [isContractsMenuOpen, setIsContractsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contractPlanName, setContractPlanName] = useState(() => user?.company?.plan ?? '');

  const role = user?.role ?? (user?.user_metadata as { role?: string } | undefined)?.role;
  const isAdmin = role === 'admin';
  const shouldShowWizard = !user?.company_id && role !== 'super_admin';

  useRealtimeEvents();
  useInstallmentReminders();

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Administrador';
    if (!role) return 'Corretor';
    return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  }, [role]);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));

      await Promise.race([refreshUser(), timeoutPromise]);
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

  useEffect(() => {
    if (!user?.company_id) return;

    let isMounted = true;

    const fetchContractPlan = async () => {
      try {
        const { data } = await supabase
          .from('saas_contracts')
          .select('plan_name')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (isMounted && typeof data?.plan_name === 'string' && data.plan_name.trim()) {
          setContractPlanName(data.plan_name);
        }
      } catch (error) {
        console.warn('Nao foi possivel sincronizar o plano atual para a trava de gamificacao.', error);
      }
    };

    void fetchContractPlan();

    return () => {
      isMounted = false;
    };
  }, [user?.company_id]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      console.error('Erro ao sair:', error);
      navigate('/admin/login', { replace: true });
    }
  };

  const handleOpenWebsite = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!user?.company_id) {
      alert('Empresa não identificada.');
      return;
    }

    try {
      // Busca a informação real da empresa direto do banco
      const { data: company } = await supabase
        .from('companies')
        .select('domain, subdomain')
        .eq('id', user.company_id)
        .single();

      if (company?.domain) {
        const url = company.domain.startsWith('http') ? company.domain : `https://${company.domain}`;
        window.open(url, '_blank');
        return;
      }

      if (company?.subdomain) {
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        if (isLocalhost) {
          alert(`O seu site em produção ficará no endereço: https://${company.subdomain}.elevatiovendas.com`);
        } else {
          const baseDomain = hostname.replace(/^admin\./, '');
          window.open(`https://${company.subdomain}.${baseDomain}`, '_blank');
        }
        return;
      }

      alert('Esta imobiliária ainda não possui um domínio ou subdomínio configurado. Vá em Configurações > Meu Site.');
    } catch (error) {
      console.error('Erro ao buscar dados do site:', error);
      alert('Não foi possível abrir o site no momento.');
    }
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: Icons.Dashboard },
    { label: 'Imóveis', path: '/admin/imoveis', icon: Icons.Building },
    { label: 'Tarefas', path: '/admin/tarefas', icon: Icons.Calendar },
    { label: 'Relatórios', path: '/admin/analytics', icon: Icons.PieChart, adminOnly: true },
    { label: 'Leaderboard', path: '/admin/leaderboard', icon: Icons.Trophy },
    { label: 'Configurações', path: '/admin/config', icon: Icons.Settings },
  ];
  const normalizedPlanName = (contractPlanName || user?.company?.plan || '').trim().toUpperCase();
  const visibleMenuItems = menuItems
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => item.path !== '/admin/leaderboard' || !['STARTER', 'BASIC'].includes(normalizedPlanName));

  const getSidebarItemOrder = (path: string) => {
    if (path === '/admin/dashboard') return 'order-1';
    if (path === '/admin/imoveis') return 'order-2';
    if (path === '/admin/tarefas') return 'order-6';
    if (path === '/admin/config') return 'order-11';
    if (path === '/admin/analytics') return 'order-10';
    if (path === '/admin/leaderboard') return 'order-9';
    return '';
  };

  const getMobileItemOrder = (path: string) => {
    if (path === '/admin/dashboard') return 'order-1';
    if (path === '/admin/imoveis') return 'order-2';
    if (path === '/admin/tarefas') return 'order-6';
    if (path === '/admin/config') return 'order-11';
    if (path === '/admin/analytics') return 'order-10';
    if (path === '/admin/leaderboard') return 'order-9';
    return '';
  };

  return (
    <div className="flex h-screen bg-[#070d1f] overflow-hidden font-sans selection:bg-brand-500/30 text-slate-800 dark:text-slate-200">
      {shouldShowWizard && <SetupWizardModal onComplete={handleRefresh} />}
      <ProductTour isSidebarCollapsed={isSidebarCollapsed} />
      <aside
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
        className={`hidden md:flex flex-col relative z-30 transition-all duration-300 shrink-0 bg-gradient-to-b from-[#0c1445] via-[#0f2460] to-[#0c1f55] border-none ${
          isSidebarCollapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        
        <div className={`h-20 flex items-center border-b border-white/10 relative z-10 px-4 ${
          isSidebarCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          {isSidebarCollapsed ? (
            <img src="/logo/logo.png" alt="Elevatio Vendas Logo" className="h-8 w-auto object-contain drop-shadow-sm" />
          ) : (
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/logo/logo.png" alt="Elevatio Vendas Logo" className="h-8 w-auto object-contain drop-shadow-sm" />
              <div className="flex flex-col animate-in fade-in">
                <span className="font-serif font-bold text-lg leading-tight tracking-tight text-white">
                  Elevatio<span className="text-sky-400">Vendas</span>
                </span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">CRM Platform</span>
              </div>
            </div>
          )}
          {!isSidebarCollapsed && (
            <button
              onClick={handleOpenWebsite}
              className="text-white/60 hover:text-sky-400 transition-colors p-1 rounded-md hover:bg-white/5 shrink-0"
              title="Abrir site da imobiliária"
            >
              <Icons.Globe size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1 py-6 px-3 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {visibleMenuItems.map((item) => (
            <React.Fragment key={item.path}>
              <NavLink
                to={item.path}
                id={item.path === '/admin/imoveis' ? 'tour-imoveis' : item.path === '/admin/config' ? 'tour-config' : undefined}
                data-tour-anchor={item.path === '/admin/imoveis' || item.path === '/admin/config' ? 'true' : undefined}
                className={({ isActive }) => `
                  ${getSidebarItemOrder(item.path)} flex items-center gap-3 py-3 rounded-xl transition-all duration-200 group ${item.path === '/admin/imoveis' ? 'tour-imoveis' : ''} ${item.path === '/admin/config' ? 'tour-config' : ''} ${
                    isSidebarCollapsed ? 'justify-center px-0' : 'px-4'
                  }
                  ${isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <item.icon size={20} className="group-hover:scale-110 transition-transform" />
                {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
              </NavLink>

              {item.path === '/admin/imoveis' && (
                <div className="space-y-1 order-3">
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
                      {!isSidebarCollapsed && <span className="whitespace-nowrap">Contratos</span>}
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

              {item.path === '/admin/imoveis' && (
                <NavLink
                  to="/admin/financeiro"
                  className={({ isActive }) => `
                    order-4 flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm
                    ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}
                    ${isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <Icons.Wallet size={20} />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Financeiro</span>}
                </NavLink>
              )}

              {item.path === '/admin/imoveis' && (
                <NavLink
                  to="/admin/chaves"
                  onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `order-8 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                    } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`
                  }
                >
                  <Icons.Key size={20} />
                  <span className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>Chaves</span>
                </NavLink>
              )}
            </React.Fragment>
          ))}

          {/* Menu Dropdown - Funil de Vendas */}
          <div className="space-y-1 order-5" id="tour-kanban">
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
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Funil de Vendas</span>}
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

          <NavLink
            to="/admin/clientes"
            onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `order-7 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`
            }
          >
            <Icons.Users size={20} />
            <span className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>Clientes</span>
          </NavLink>

          {user?.role === 'super_admin' && (
            <NavLink
              to="/saas/dashboard"
              className={({ isActive }) => `
                flex items-center gap-3 py-3 rounded-xl transition-all duration-200 group
                ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}
                ${isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-violet-400 hover:bg-slate-800 hover:text-violet-300'}
              `}
            >
              <Shield size={20} className="group-hover:scale-110 transition-transform" />
              {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">Painel SaaS</span>}
            </NavLink>
          )}
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

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 md:rounded-l-[2rem] shadow-[-10px_0_40px_rgba(0,0,0,0.4)] relative z-20 transition-colors duration-300">
        <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0 relative z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm"
            >
              <Icons.Menu size={20} />
            </button>
            
            <div className="md:hidden flex items-center gap-2">
              <img src="/logo/logo.png" alt="Elevatio Vendas" className="h-7 w-auto object-contain" />
              <span className="font-serif font-bold text-slate-800 dark:text-white">Elevatio Vendas</span>
            </div>
            
            <div className="hidden md:block">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Olá, {user?.name?.split(' ')[0] || 'Corretor'} 👋</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bem-vindo de volta ao seu painel</p>
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

            <CrmNotificationsMenu />

            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Alternar tema"
              title= "Alternar tema claro/escuro"
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
            {visibleMenuItems.map((item) => (
              <React.Fragment key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    ${getMobileItemOrder(item.path)} flex items-center gap-3 px-4 py-3 rounded-lg
                    ${isActive ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                  `}
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
                {item.path === '/admin/imoveis' && (
                  <NavLink
                    to="/admin/chaves"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => `
                      order-8 flex items-center gap-3 px-4 py-3 rounded-lg
                      ${isActive ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                    `}
                  >
                    <Icons.Key size={20} />
                    Chaves
                  </NavLink>
                )}
              </React.Fragment>
            ))}

            {/* 2. Menu Contratos (Mobile) */}
            <div className="space-y-1 order-3">
              <div className={`flex items-center justify-between rounded-lg ${location.pathname.includes('/admin/contratos') ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <NavLink
                  to="/admin/contratos?tab=geral"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 font-medium ${location.pathname.includes('/admin/contratos') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}
                >
                  <Icons.FileText size={20} />
                  Contratos
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

            <NavLink
              to="/admin/financeiro"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => `
                order-4 flex items-center gap-3 px-4 py-3 rounded-lg
                ${isActive ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
              `}
            >
              <Icons.Wallet size={20} />
              Financeiro
            </NavLink>

            {/* 3. Menu Funil de Vendas (Mobile) */}
            <div className="space-y-1 order-5">
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

            <NavLink
              to="/admin/clientes"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => `
                order-7 flex items-center gap-3 px-4 py-3 rounded-lg
                ${isActive ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
              `}
            >
              <Icons.Users size={20} />
              Clientes
            </NavLink>

            {user?.role === 'super_admin' && (
              <NavLink
                to="/saas/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  ${isActive ? 'bg-violet-50 text-violet-700 font-bold' : 'text-violet-600 hover:bg-violet-50'}
                `}
              >
                <Shield size={20} />
                Painel SaaS
              </NavLink>
            )}

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
                  onClick={handleOpenWebsite}
                  title="Abrir site da imobiliária"
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

        {/* Padding reduzido para ganhar tela (p-3 md:p-5) */}
        <div className="flex-1 overflow-y-auto p-3 md:p-5 custom-scrollbar">
          {/* Largura dinâmica: se a sidebar fecha, o conteúdo expande ainda mais (1600px vs 1300px) */}
          <div className={`w-full mx-auto pb-10 transition-all duration-300 ${isSidebarCollapsed ? 'max-w-[1600px]' : 'max-w-[1300px]'}`}>
            
            <Outlet key={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
