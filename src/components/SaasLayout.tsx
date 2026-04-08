import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
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
  Globe,
  LogOut,
  User,
  Plus,
  Tag,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '../../components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SaasNotificationsMenu } from './SaasNotificationsMenu';

const BASE = '/saas';

const navigation = [
  {
    title: 'Gestão Principal',
    items: [
      { name: 'Dashboard', href: `${BASE}/dashboard`, icon: Home },
      { name: 'Clientes', href: `${BASE}/clientes`, icon: Users },
      { name: 'Domínios', href: `${BASE}/dominios`, icon: Globe },
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
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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

  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === `${BASE}/dashboard` || path === BASE || path === `${BASE}/`) return ['Dashboard', 'Visão Geral'];
    if (path === `${BASE}/clientes`) return ['Dashboard', 'Gestão Principal', 'Clientes'];
    if (path === `${BASE}/dominios`) return ['Dashboard', 'Gestão Principal', 'Domínios'];
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
    navigate('/admin/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex w-full items-center gap-3">
          <img src="/logo/logo.png" alt="Elevatio Vendas Logo" className="h-8 w-auto object-contain" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight tracking-tight">
              Elevatio<span className="text-primary">Vendas</span>
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">Super Admin</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4">
        {navigation.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && 'mt-6')}>
            <h3 className="mb-2 px-2 text-xs font-medium text-muted-foreground">{section.title}</h3>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="mr-3 h-4 w-4 shrink-0" />
                    {item.name}
                    {isActive && <div className="ml-auto h-4 w-1 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2 transition-colors hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{(user?.email ?? 'SA').slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">Super Admin</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email ?? '—'}</span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(`${BASE}/definicoes`)}>
              <User className="mr-2 h-4 w-4" /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sair da Conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background font-sans antialiased">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card">
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar (Sheet) */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="hidden items-center text-sm text-muted-foreground sm:flex">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  {breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb}>
                      <span className={cn(idx === breadcrumbs.length - 1 && 'font-medium text-foreground')}>{crumb}</span>
                      {idx < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Pesquisar (Ctrl+F)"
                  className="h-9 w-64 pl-9 pr-8 text-sm"
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-border bg-muted text-[10px] font-medium text-muted-foreground">
                  F
                </kbd>
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-7 w-7 rounded-sm', theme === 'light' && 'bg-background shadow-sm')}
                      onClick={() => theme === 'dark' && toggleTheme()}
                    >
                      <Sun className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Modo Claro</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-7 w-7 rounded-sm', theme === 'dark' && 'bg-accent shadow-sm')}
                      onClick={() => theme === 'light' && toggleTheme()}
                    >
                      <Moon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Modo Escuro</TooltipContent>
                </Tooltip>
              </div>

              {/* Notifications */}
              <SaasNotificationsMenu />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-muted/20">
            <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
