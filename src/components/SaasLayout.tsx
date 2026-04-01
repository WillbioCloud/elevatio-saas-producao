import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Settings,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Home,
  Briefcase,
  HelpCircle,
  LogOut,
  User,
  Plus,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const BASE = '/saas';

const navigation = [
  {
    title: 'Gestão Principal',
    items: [
      { name: 'Dashboard', href: `${BASE}/dashboard`, icon: Home },
      { name: 'Clientes', href: `${BASE}/clientes`, icon: Users },
      { name: 'Planos', href: `${BASE}/planos`, icon: Briefcase },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { name: 'Cupons', href: `${BASE}/cupons`, icon: Tag },
      { name: 'Pagamentos', href: `${BASE}/pagamentos`, icon: CreditCard },
      { name: 'Contratos', href: `${BASE}/contratos`, icon: FileText },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { name: 'Definições', href: `${BASE}/definicoes`, icon: Settings },
      { name: 'Suporte', href: `${BASE}/suporte`, icon: HelpCircle },
    ],
  },
];

export default function SaasLayout() {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === `${BASE}/dashboard` || path === BASE || path === `${BASE}/`) return ['Dashboard', 'Visão Geral'];
    if (path === `${BASE}/clientes`) return ['Dashboard', 'Gestão Principal', 'Clientes'];
    if (path === `${BASE}/planos`) return ['Dashboard', 'Gestão Principal', 'Planos'];
    if (path === `${BASE}/cupons`) return ['Dashboard', 'Financeiro', 'Cupons'];
    if (path === `${BASE}/pagamentos`) return ['Dashboard', 'Financeiro', 'Pagamentos'];
    if (path === `${BASE}/contratos`) return ['Dashboard', 'Financeiro', 'Contratos'];
    if (path === `${BASE}/definicoes`) return ['Dashboard', 'Sistema', 'Definições'];
    if (path === `${BASE}/suporte`) return ['Dashboard', 'Sistema', 'Suporte'];
    return ['Dashboard'];
  };

  const breadcrumbs = getBreadcrumbs();

  const handleLogout = async () => {
    await signOut();
    setIsProfileOpen(false);
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans transition-colors duration-200">
      <div className={cn('fixed inset-0 z-50 bg-slate-900/80 lg:hidden', sidebarOpen ? 'block' : 'hidden')} onClick={() => setSidebarOpen(false)} />

      <div className={cn('fixed inset-y-0 left-0 z-50 w-64 transform bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/50 transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:flex flex-col', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 shrink-0 items-center px-6">
          <div className="flex items-center gap-3 w-full">
            <div className="bg-slate-900 dark:bg-indigo-600 text-white p-1.5 rounded-md">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-tight">Elevatio Vendas</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Super Admin</span>
            </div>
            <ChevronDown className="h-4 w-4 ml-auto text-slate-400 dark:text-slate-500" />
          </div>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden text-slate-500 dark:text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {navigation.map((section, idx) => (
            <div key={section.title} className={cn('px-4', idx > 0 ? 'mt-6' : '')}>
              <h3 className="px-2 text-xs font-medium text-slate-400 dark:text-slate-500 mb-2">{section.title}</h3>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-50'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'mr-3 h-4 w-4 flex-shrink-0',
                          isActive ? 'text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                      {isActive && <div className="ml-auto w-1 h-4 bg-slate-900 dark:bg-indigo-500 rounded-full" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800/50 relative shrink-0" ref={profileRef}>
          <div
            className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-slate-100 dark:border-slate-800/50"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} referrerPolicy="no-referrer" />
              <AvatarFallback>{(user?.email ?? 'SA').slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">Super Admin</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email ?? '—'}</span>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform', isProfileOpen && 'rotate-180')} />
          </div>

          {isProfileOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden z-50">
              <div className="p-1">
                <button
                  onClick={() => {
                    navigate(`${BASE}/definicoes`);
                    setIsProfileOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 rounded-md transition-colors"
                >
                  <User className="h-4 w-4" />
                  Meu Perfil
                </button>
                <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sair da Conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="-m-2.5 p-2.5 text-slate-700 dark:text-slate-200 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </Button>

            <div className="hidden sm:flex items-center text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                  <LayoutDashboard className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                </div>
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb}>
                    <span className={idx === breadcrumbs.length - 1 ? 'text-slate-900 dark:text-slate-50 font-medium' : ''}>{crumb}</span>
                    {idx < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-x-4">
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="Pesquisar (Ctrl+F)"
                className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 pl-9 pr-8 h-9 text-sm rounded-md focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600 dark:text-slate-100"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-medium text-slate-400 dark:text-slate-500 pointer-events-none">
                F
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setIsNewTaskOpen(true)}
            >
              <span className="flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs mr-2 font-medium">12</span>
              Tarefas
            </Button>

            <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-md p-0.5 bg-slate-50 dark:bg-slate-950">
              <Button variant="ghost" size="icon" className={cn('h-7 w-7 rounded-sm', !isDark ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500 hover:text-slate-300')} onClick={() => setIsDark(false)}>
                <Sun className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className={cn('h-7 w-7 rounded-sm', isDark ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300')} onClick={() => setIsDark(true)}>
                <Moon className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative" ref={notificationsRef}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'relative h-9 w-9 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800',
                  isNotificationsOpen && 'bg-slate-100 dark:bg-slate-800'
                )}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <span className="sr-only">View notifications</span>
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
              </Button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-50">Notificações</h3>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline">Marcar como lidas</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer bg-indigo-50/30 dark:bg-indigo-500/5">
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Novo cliente registado</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">A Imobiliária Central assinou o plano Profissional.</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">há 5 minutos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 border-t border-slate-100 dark:border-slate-800/50 text-center">
                    <button className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-50">Ver todas</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 bg-[#f8f9fa] dark:bg-slate-950 overflow-y-auto">
          <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsNewTaskOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800/50">
              <h3 className="font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-500" />
                Criar Nova Tarefa
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 dark:hover:text-slate-300" onClick={() => setIsNewTaskOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Título da Tarefa</label>
                <Input placeholder="Ex: Ligar para o cliente X" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Descrição (Opcional)</label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 dark:focus-visible:ring-slate-300 resize-none"
                  placeholder="Detalhes da tarefa..."
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/50 flex justify-end gap-2">
              <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" onClick={() => setIsNewTaskOpen(false)}>Cancelar</Button>
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                onClick={() => {
                  alert('Tarefa criada com sucesso!');
                  setIsNewTaskOpen(false);
                }}
              >
                Guardar Tarefa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
