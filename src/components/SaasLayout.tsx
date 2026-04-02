import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Settings,
  Search,
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
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { SaasNotificationsMenu } from './SaasNotificationsMenu';

const BASE = '/saas';

const navigation = [
  {
    title: 'Gestão Principal',
    items: [
      { name: 'Dashboard', href: `${BASE}/dashboard`, icon: Home },
      { name: 'Clientes', href: `${BASE}/clientes`, icon: Users },
      { name: 'Planos', href: `${BASE}/planos`, icon: Briefcase },
      { name: 'Templates', href: `${BASE}/templates`, icon: Palette },
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
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumbs = () => {
    const path = location.pathname;

    if (path === `${BASE}/dashboard` || path === BASE || path === `${BASE}/`) return ['Dashboard', 'Visão Geral'];
    if (path === `${BASE}/clientes`) return ['Dashboard', 'Gestão Principal', 'Clientes'];
    if (path === `${BASE}/planos`) return ['Dashboard', 'Gestão Principal', 'Planos'];
    if (path === `${BASE}/templates`) return ['Dashboard', 'Gestão Principal', 'Templates'];
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
    <div className="h-screen w-full flex overflow-hidden bg-[#f8f9fa] font-sans text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-50">
      <div
        className={cn('fixed inset-0 z-50 bg-slate-900/80 lg:hidden', sidebarOpen ? 'block' : 'hidden')}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-slate-100 bg-white transition-transform duration-200 ease-in-out dark:border-slate-800/50 dark:bg-slate-900 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center px-6">
          <div className="flex w-full items-center gap-3">
            <div className="rounded-md bg-slate-900 p-1.5 text-white dark:bg-indigo-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight tracking-tight">Elevatio Vendas</span>
              <span className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">Super Admin</span>
            </div>
            <ChevronDown className="ml-auto h-4 w-4 text-slate-400 dark:text-slate-500" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-slate-500 dark:text-slate-400 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {navigation.map((section, idx) => (
            <div key={section.title} className={cn('px-4', idx > 0 ? 'mt-6' : '')}>
              <h3 className="mb-2 px-2 text-xs font-medium text-slate-400 dark:text-slate-500">{section.title}</h3>
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
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:text-slate-50 dark:hover:bg-slate-800/50 dark:hover:text-slate-50'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'mr-3 h-4 w-4 flex-shrink-0',
                          isActive
                            ? 'text-slate-900 dark:text-slate-50'
                            : 'text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                      {isActive && <div className="ml-auto h-4 w-1 rounded-full bg-slate-900 dark:bg-indigo-500" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="relative shrink-0 border-t border-slate-100 p-4 dark:border-slate-800/50" ref={profileRef}>
          <div
            className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-100 p-2 transition-colors hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} referrerPolicy="no-referrer" />
              <AvatarFallback>{(user?.email ?? 'SA').slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">Super Admin</span>
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email ?? '—'}</span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500', isProfileOpen && 'rotate-180')}
            />
          </div>

          {isProfileOpen && (
            <div className="absolute bottom-full left-4 right-4 z-50 mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="p-1">
                <button
                  onClick={() => {
                    navigate(`${BASE}/definicoes`);
                    setIsProfileOpen(false);
                  }}
                  className="w-full rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Meu Perfil
                  </span>
                </button>
                <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
                <button
                  onClick={handleLogout}
                  className="w-full rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sair da Conta
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 dark:border-slate-800/50 dark:bg-slate-900 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="-m-2.5 p-2.5 text-slate-700 dark:text-slate-200 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </Button>

            <div className="hidden items-center text-sm text-slate-500 dark:text-slate-400 sm:flex">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                  <LayoutDashboard className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                </div>
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb}>
                    <span className={idx === breadcrumbs.length - 1 ? 'font-medium text-slate-900 dark:text-slate-50' : ''}>{crumb}</span>
                    {idx < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-x-4">
            <div className="relative hidden w-64 md:block">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="Pesquisar (Ctrl+F)"
                className="h-9 w-full rounded-md border-slate-200 bg-slate-50 pl-9 pr-8 text-sm focus-visible:ring-1 focus-visible:ring-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-slate-600"
              />
              <div className="pointer-events-none absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-slate-200 bg-white text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                F
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-700 sm:flex"
              onClick={() => setIsNewTaskOpen(true)}
            >
              <span className="mr-2 flex items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
                12
              </span>
              Tarefas
            </Button>

            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7 rounded-sm',
                  !isDark
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-400 hover:text-slate-300 dark:text-slate-500'
                )}
                onClick={() => setIsDark(false)}
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7 rounded-sm',
                  isDark
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:text-slate-300'
                )}
                onClick={() => setIsDark(true)}
              >
                <Moon className="h-4 w-4" />
              </Button>
            </div>

            <SaasNotificationsMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-slate-950">
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsNewTaskOpen(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800/50">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                <Plus className="h-4 w-4 text-indigo-500" />
                Criar Nova Tarefa
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:text-slate-300 dark:hover:text-slate-300"
                onClick={() => setIsNewTaskOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Título da Tarefa</label>
                <Input
                  placeholder="Ex: Ligar para o cliente X"
                  className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Descrição (Opcional)</label>
                <textarea
                  className="min-h-[80px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                  placeholder="Detalhes da tarefa..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800/50 dark:bg-slate-950">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                onClick={() => setIsNewTaskOpen(false)}
              >
                Cancelar
              </Button>
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
