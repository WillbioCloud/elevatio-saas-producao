import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { CrmNotificationsMenu } from './CrmNotificationsMenu';
import { useInstallmentReminders } from '../hooks/useInstallmentReminders';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import BillingPortalModal from './BillingPortalModal';
import BillingGuard from './BillingGuard';
import ProductTour from './ProductTour';
import SetupWizardModal from './SetupWizardModal';
import AuraChatWidget from './AuraChatWidget';
import SystemReviewModal from './SystemReviewModal';
import SystemChangelogModal from './SystemChangelogModal';

const getSmartNavigationBasePath = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length >= 2 && segments[0] === 'admin') {
    return `/${segments[0]}/${segments[1]}`;
  }

  return pathname;
};

type BillingGraceWarning = {
  dueDate: string;
  daysOverdue: number;
  daysUntilBlock: number;
};

type AsaasPaymentLinkCandidate = {
  status?: string | null;
  dueDate?: string | null;
  invoiceUrl?: string | null;
};

type TrialSidebarInfo = {
  trialEndsAt: string | null;
  planStatus: string | null;
};

const PAST_DUE_GRACE_DAYS = 7;
const DAY_IN_MS = 1000 * 60 * 60 * 24;
const paidSaasPaymentStatuses = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

const normalizeBillingStatus = (status: unknown) =>
  typeof status === 'string' ? status.trim().toLowerCase() : '';

const parseLocalDate = (value: string | null | undefined) => {
  if (!value) return null;

  const dateOnly = value.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);

  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    const parsedDate = new Date(year, month - 1, day);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getOverdueDays = (dueDate: string | null | undefined) => {
  const parsedDueDate = parseLocalDate(dueDate);
  if (!parsedDueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedDueDate.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today.getTime() - parsedDueDate.getTime()) / DAY_IN_MS));
};

const getPaymentDueTimestamp = (payment: AsaasPaymentLinkCandidate) =>
  parseLocalDate(payment.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;

const getTrialDaysLeft = (trialEndsAt: string | null | undefined) => {
  if (!trialEndsAt) return null;

  const trialEnd = new Date(trialEndsAt);
  if (Number.isNaN(trialEnd.getTime())) return null;

  const diff = trialEnd.getTime() - Date.now();
  if (diff < 0) return null;

  return Math.max(0, Math.ceil(diff / DAY_IN_MS));
};

const isTrialLikeStatus = (status: string) =>
  !status || status === 'trial' || status === 'trialing' || status === 'pending';

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
  const [billingWarning, setBillingWarning] = useState<{ dueDate: string; daysLeft: number; isOverdue: boolean } | null>(null);
  const [billingGraceWarning, setBillingGraceWarning] = useState<BillingGraceWarning | null>(null);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isOpeningPaymentLink, setIsOpeningPaymentLink] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [hasContextualAura, setHasContextualAura] = useState(false);
  const [trialInfo, setTrialInfo] = useState<TrialSidebarInfo>({
    trialEndsAt: user?.company?.trial_ends_at ?? null,
    planStatus: user?.company?.plan_status ?? null,
  });
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    const saved = localStorage.getItem(`hideBillingWarning_${user?.company_id}`);
    const parsed = saved ? parseInt(saved, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });

  const isSmartNavigationActive = (targetPath: string) => {
    const normalizedTargetPath = getSmartNavigationBasePath(targetPath);

    return location.pathname === normalizedTargetPath || location.pathname.startsWith(`${normalizedTargetPath}/`);
  };

  // --- SMART NAVIGATION MEMORY ---
  // Salva a URL exata do módulo atual, incluindo abas e modais expostos nos search params.
  useEffect(() => {
    if (!user) return;

    const basePath = getSmartNavigationBasePath(location.pathname);
    const fullPath = location.pathname + location.search;

    try {
      sessionStorage.setItem(`last_visit_${basePath}`, fullPath);
    } catch (error) {
      console.warn('Nao foi possivel salvar a memoria de navegacao da sessao.', error);
    }
  }, [location.pathname, location.search, user]);

  // Funcao para interceptar o clique no menu e restaurar a memoria ou resetar
  const handleSmartNavigation = (e: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
    e.preventDefault();

    // REGRA DE OURO (Reset vs Memória):
    // Se o usuário já está dentro desta seção e clica no menu novamente, nós usamos isso como um botão "Home/Reset", limpando a URL.
    if (location.pathname.startsWith(targetPath) && targetPath !== '/admin') {
      sessionStorage.setItem(`last_visit_${targetPath}`, targetPath);
      navigate(targetPath);
    } else {
      // Se ele está vindo de fora, tenta buscar a memória de onde ele parou (ex: modal aberto)
      const savedPath = sessionStorage.getItem(`last_visit_${targetPath}`);
      navigate(savedPath || targetPath);
    }

    setIsMobileMenuOpen(false);
  };

  const role = user?.role ?? (user?.user_metadata as { role?: string } | undefined)?.role;
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin' || role === 'owner';
  const shouldShowWizard = !user?.company_id && role !== 'super_admin';

  useRealtimeEvents();
  useInstallmentReminders();

  const roleLabel = useMemo(() => {
    if (role === 'owner') return 'Dono da Imobiliária';
    if (role === 'admin') return 'Gerente / Admin';
    if (!role) return 'Corretor';
    return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  }, [role]);
  const userInitial = (user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase();

  const checkReviewEligibility = async () => {
    if (role !== 'owner') {
      setIsReviewModalOpen(false);
      return;
    }

    if (!user?.created_at) {
      setIsReviewModalOpen(false);
      return;
    }

    const createdAt = new Date(user.created_at).getTime();

    if (!Number.isFinite(createdAt)) {
      setIsReviewModalOpen(false);
      return;
    }

    const accountAge = Date.now() - createdAt;
    if (accountAge < 604800000) {
      setIsReviewModalOpen(false);
      return;
    }

    try {
      const { data: existingReview, error } = await supabase
        .from('system_reviews')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setIsReviewModalOpen(!existingReview);
    } catch (error) {
      console.error('Erro ao verificar elegibilidade da avaliacao do sistema:', error);
      setIsReviewModalOpen(false);
    }
  };

  useEffect(() => {
    void checkReviewEligibility();
  }, [role, user?.created_at, user?.id]);

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

  useEffect(() => {
    if (!user?.company_id || role === 'super_admin') {
      setTrialInfo({ trialEndsAt: null, planStatus: null });
      return;
    }

    let isMounted = true;

    setTrialInfo({
      trialEndsAt: user.company?.trial_ends_at ?? null,
      planStatus: user.company?.plan_status ?? null,
    });

    const fetchTrialInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('trial_ends_at, plan_status')
          .eq('id', user.company_id)
          .maybeSingle();

        if (error) throw error;
        if (!isMounted) return;

        setTrialInfo({
          trialEndsAt: data?.trial_ends_at ?? user.company?.trial_ends_at ?? null,
          planStatus: data?.plan_status ?? user.company?.plan_status ?? null,
        });
      } catch (error) {
        console.warn('Nao foi possivel sincronizar os dias de trial da empresa.', error);
      }
    };

    void fetchTrialInfo();

    return () => {
      isMounted = false;
    };
  }, [role, user?.company_id, user?.company?.plan_status, user?.company?.trial_ends_at]);

  useEffect(() => {
    if (!user?.company_id) {
      setDismissedUntil(0);
      return;
    }

    const saved = localStorage.getItem(`hideBillingWarning_${user.company_id}`);
    const parsed = saved ? parseInt(saved, 10) : 0;
    setDismissedUntil(Number.isFinite(parsed) ? parsed : 0);
  }, [user?.company_id]);

  useEffect(() => {
    if (!user?.company_id || role === 'super_admin') {
      setBillingGraceWarning(null);
      return;
    }

    let isMounted = true;

    const checkPastDueGrace = async () => {
      try {
        const [{ data: company, error: companyError }, { data: payment, error: paymentError }] = await Promise.all([
          supabase
            .from('companies')
            .select('plan_status')
            .eq('id', user.company_id)
            .maybeSingle(),
          supabase
            .from('saas_payments')
            .select('due_date, status')
            .eq('company_id', user.company_id)
            .in('status', ['PENDING', 'OVERDUE', 'pending', 'overdue'])
            .order('due_date', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (companyError) throw companyError;
        if (paymentError) throw paymentError;
        if (!isMounted) return;

        const overdueDays = getOverdueDays(payment?.due_date ?? null);

        if (
          normalizeBillingStatus(company?.plan_status) === 'past_due' &&
          payment?.due_date &&
          overdueDays !== null &&
          overdueDays <= PAST_DUE_GRACE_DAYS
        ) {
          setBillingGraceWarning({
            dueDate: payment.due_date,
            daysOverdue: overdueDays,
            daysUntilBlock: Math.max(1, PAST_DUE_GRACE_DAYS + 1 - overdueDays),
          });
        } else {
          setBillingGraceWarning(null);
        }
      } catch (error) {
        console.error('Erro ao checar tolerancia de pagamento do SaaS:', error);
        if (isMounted) setBillingGraceWarning(null);
      }
    };

    void checkPastDueGrace();

    const interval = setInterval(() => {
      void checkPastDueGrace();
    }, 60 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [role, user?.company_id]);

  useEffect(() => {
    if (!user?.company_id || role !== 'owner') return;

    let isMounted = true;

    const checkBilling = async () => {
      try {
        const { data, error } = await supabase
          .from('saas_payments')
          .select('due_date, status')
          .eq('company_id', user.company_id)
          .in('status', ['PENDING', 'OVERDUE', 'pending', 'overdue'])
          .order('due_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!isMounted) return;

        if (data) {
          const today = new Date();
          const due = new Date(data.due_date);
          const diffTime = due.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 5) {
            setBillingWarning({
              dueDate: data.due_date,
              daysLeft: diffDays,
              isOverdue: diffDays < 0 || data.status.toUpperCase() === 'OVERDUE',
            });
          } else {
            setBillingWarning(null);
          }
        } else {
          setBillingWarning(null);
        }
      } catch (err) {
        console.error('Erro ao checar pagamentos do SaaS', err);
      }
    };

    void checkBilling();

    const interval = setInterval(() => {
      void checkBilling();
    }, 60 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [role, user?.company_id]);

  useEffect(() => {
    const handleAuraVisibilityChange = (event: Event) => {
      const { detail } = event as CustomEvent<boolean>;
      setHasContextualAura(Boolean(detail));
    };

    window.addEventListener('aura-context-visibility', handleAuraVisibilityChange as EventListener);

    return () => {
      window.removeEventListener('aura-context-visibility', handleAuraVisibilityChange as EventListener);
    };
  }, []);

  const handleDismissBillingWarning = () => {
    const hideUntil = Date.now() + 10800000;
    localStorage.setItem(`hideBillingWarning_${user?.company_id}`, hideUntil.toString());
    setDismissedUntil(hideUntil);
  };

  const handlePayNow = async () => {
    if (!user?.company_id || isOpeningPaymentLink) return;

    setIsOpeningPaymentLink(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-asaas-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ company_id: user.company_id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel buscar o link de pagamento.');
      }

      const payments: AsaasPaymentLinkCandidate[] = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.payments)
          ? payload.payments
          : [];

      const payableInvoice = payments
        .filter((payment) => {
          const status = typeof payment.status === 'string' ? payment.status.toUpperCase() : '';
          return payment.invoiceUrl && !paidSaasPaymentStatuses.has(status);
        })
        .sort((a, b) => getPaymentDueTimestamp(a) - getPaymentDueTimestamp(b))[0];

      if (!payableInvoice?.invoiceUrl) {
        throw new Error('Nenhuma fatura aberta com link de pagamento foi encontrada.');
      }

      window.open(payableInvoice.invoiceUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Erro ao abrir link de pagamento:', error);
      setIsBillingModalOpen(true);
    } finally {
      setIsOpeningPaymentLink(false);
    }
  };

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
          const baseDomain = hostname.replace(/^admin\./, '').replace(/^www\./, '');
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
    { label: 'Relatórios', path: '/admin/analytics', icon: Icons.PieChart, ownerOnly: true },
    { label: 'Leaderboard', path: '/admin/leaderboard', icon: Icons.Trophy },
    { label: 'Suporte', path: '/admin/suporte', icon: Icons.MessageSquare },
    { label: 'Configurações', path: '/admin/config', icon: Icons.Settings },
  ];
  const normalizedPlanName = (contractPlanName || user?.company?.plan || '').trim().toUpperCase();
  const visibleMenuItems = menuItems
    .filter((item) => !item.ownerOnly || isOwner)
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => item.path !== '/admin/leaderboard' || !['STARTER', 'BASIC'].includes(normalizedPlanName));

  const getSidebarItemOrder = (path: string) => {
    if (path === '/admin/dashboard') return 'order-1';
    if (path === '/admin/imoveis') return 'order-2';
    if (path === '/admin/tarefas') return 'order-6';
    if (path === '/admin/config') return 'order-11';
    if (path === '/admin/analytics') return 'order-10';
    if (path === '/admin/leaderboard') return 'order-9';
    if (path === '/admin/suporte') return 'order-10';
    return '';
  };

  const getMobileItemOrder = (path: string) => {
    if (path === '/admin/dashboard') return 'order-1';
    if (path === '/admin/imoveis') return 'order-2';
    if (path === '/admin/tarefas') return 'order-6';
    if (path === '/admin/config') return 'order-11';
    if (path === '/admin/analytics') return 'order-10';
    if (path === '/admin/leaderboard') return 'order-9';
    if (path === '/admin/suporte') return 'order-10';
    return '';
  };

  const billingGraceOverdueText = billingGraceWarning
    ? billingGraceWarning.daysOverdue === 0
      ? 'hoje'
      : `ha ${billingGraceWarning.daysOverdue} ${billingGraceWarning.daysOverdue === 1 ? 'dia' : 'dias'}`
    : '';
  const billingGraceBlockText = billingGraceWarning
    ? `${billingGraceWarning.daysUntilBlock} ${billingGraceWarning.daysUntilBlock === 1 ? 'dia' : 'dias'}`
    : '';
  const trialDaysLeft = getTrialDaysLeft(trialInfo.trialEndsAt);
  const normalizedTrialStatus = normalizeBillingStatus(trialInfo.planStatus);
  const shouldShowTrialBadge = trialDaysLeft !== null && isTrialLikeStatus(normalizedTrialStatus);
  const trialRemainingPercent = trialDaysLeft === null ? 0 : Math.min(100, Math.round((trialDaysLeft / 7) * 100));
  const trialDaysLabel =
    trialDaysLeft === 0
      ? 'Termina hoje'
      : `${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}`;

  return (
    <BillingGuard>
      <div className="flex h-screen bg-[#070d1f] overflow-hidden font-sans selection:bg-brand-500/30 text-slate-800 dark:text-slate-200">
      {shouldShowWizard && <SetupWizardModal onComplete={handleRefresh} />}
      <SystemChangelogModal
        isOpen={isChangelogModalOpen}
        onClose={() => setIsChangelogModalOpen(false)}
      />
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
              <a
                href={item.path}
                onClick={(e) => handleSmartNavigation(e, item.path)}
                id={item.path === '/admin/imoveis' ? 'tour-imoveis' : item.path === '/admin/config' ? 'tour-config' : undefined}
                data-tour-anchor={item.path === '/admin/imoveis' || item.path === '/admin/config' ? 'true' : undefined}
                className={`
                  ${getSidebarItemOrder(item.path)} flex items-center gap-3 py-3 rounded-xl transition-all duration-200 group ${item.path === '/admin/imoveis' ? 'tour-imoveis' : ''} ${item.path === '/admin/config' ? 'tour-config' : ''} ${
                    isSidebarCollapsed ? 'justify-center px-0' : 'px-4'
                  }
                  ${isSmartNavigationActive(item.path) ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <item.icon size={20} className="group-hover:scale-110 transition-transform" />
                {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
              </a>

              {item.path === '/admin/imoveis' && (
                <div className="space-y-1 order-3">
                  <div
                    className={`flex items-center justify-between rounded-xl transition-all ${
                      location.pathname.includes('/admin/contratos')
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <a
                      href="/admin/contratos"
                      onClick={(e) => handleSmartNavigation(e, '/admin/contratos')}
                      className={`flex-1 flex items-center gap-3 py-2.5 font-medium text-sm ${
                        isSidebarCollapsed ? 'justify-center px-0' : 'px-4'
                      }`}
                    >
                      <Icons.FileText
                        size={20}
                        className={location.pathname.includes('/admin/contratos') ? 'text-brand-600' : 'text-slate-400'}
                      />
                      {!isSidebarCollapsed && <span className="whitespace-nowrap">Contratos</span>}
                    </a>
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

              {item.path === '/admin/imoveis' && isOwner && (
                <a
                  href="/admin/financeiro"
                  onClick={(e) => handleSmartNavigation(e, '/admin/financeiro')}
                  className={`
                    order-4 flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm
                    ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}
                    ${isSmartNavigationActive('/admin/financeiro') ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <Icons.Wallet size={20} />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Financeiro</span>}
                </a>
              )}

              {item.path === '/admin/imoveis' && (
                <a
                  href="/admin/chaves"
                  onClick={(e) => handleSmartNavigation(e, '/admin/chaves')}
                  className={`order-8 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                    isSmartNavigationActive('/admin/chaves')
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                  } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icons.Key size={20} />
                  <span className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>Chaves</span>
                </a>
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
              <a
                href="/admin/leads?funnel=geral"
                onClick={(e) => handleSmartNavigation(e, '/admin/leads')}
                data-tour-anchor="true"
                className={`tour-kanban flex-1 flex items-center gap-3 py-2.5 font-medium text-sm ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'px-4'
                }`}
              >
                <Icons.Filter size={20} className={location.pathname.includes('/admin/leads') ? 'text-brand-600' : 'text-slate-400'} />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Funil de Vendas</span>}
              </a>
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

          <a
            href="/admin/clientes"
            onClick={(e) => handleSmartNavigation(e, '/admin/clientes')}
            className={`order-7 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
              isSmartNavigationActive('/admin/clientes')
                ? 'bg-brand-500 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
            } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <Icons.Users size={20} />
            <span className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>Clientes</span>
          </a>

        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 transition-all">
          {shouldShowTrialBadge && (
            <button
              type="button"
              onClick={() => navigate('/admin/config?tab=subscription')}
              title={isSidebarCollapsed ? `Trial: ${trialDaysLabel}` : undefined}
              className={`mb-3 w-full overflow-hidden rounded-xl border border-amber-400/20 bg-amber-400/10 text-left text-amber-100 transition-all hover:border-amber-300/40 hover:bg-amber-400/15 ${
                isSidebarCollapsed ? 'flex h-11 items-center justify-center px-0' : 'p-3'
              }`}
            >
              {isSidebarCollapsed ? (
                <div className="flex flex-col items-center justify-center leading-none">
                  <Icons.Clock size={16} className="text-amber-300" />
                  <span className="mt-0.5 text-[10px] font-black">{trialDaysLeft ?? 0}d</span>
                </div>
              ) : (
                <div className="animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-300">
                      <Icons.Clock size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Trial ativo</p>
                      <p className="truncate text-xs font-bold text-white">{trialDaysLabel}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all duration-500"
                      style={{ width: `${trialRemainingPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </button>
          )}

          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} mb-3`}>
            <div
              className="h-9 w-9 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 shrink-0"
              title={user?.name || 'Perfil'}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user?.name || 'Perfil'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
                  {userInitial}
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-sm font-bold text-white truncate">{user?.name || user?.email || 'Usuário'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${user?.role === 'owner' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold truncate">{roleLabel}</p>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsChangelogModalOpen(true)}
            title={isSidebarCollapsed ? 'Novidades v1.0.0' : undefined}
            className={`mb-3 flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70 py-2 text-xs font-black text-slate-400 transition-all hover:border-sky-400/30 hover:bg-sky-400/10 hover:text-sky-200 ${
              isSidebarCollapsed ? 'flex-col gap-0.5 px-0' : 'gap-2 px-3'
            }`}
          >
            <Icons.Bug size={14} className="shrink-0" />
            <span className={isSidebarCollapsed ? 'text-[10px] leading-none' : 'whitespace-nowrap'}>
              v1.0.0
            </span>
          </button>

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
            {isOwner && billingWarning && !billingGraceWarning && Date.now() > dismissedUntil && (
              <div className="relative group hidden md:block">
                <button
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold border transition-colors ${
                    billingWarning.isOverdue
                      ? 'bg-red-50 text-red-600 border-red-200 cursor-default'
                      : 'bg-amber-50 text-amber-600 border-amber-200 cursor-default'
                  }`}
                >
                  <Icons.AlertCircle size={16} className={billingWarning.isOverdue ? 'animate-pulse' : ''} />
                  {billingWarning.isOverdue ? 'Mensalidade Atrasada' : 'Mensalidade Vencendo'}
                </button>

                <div className="absolute right-0 mt-2 w-72 origin-top-right translate-y-2 rounded-2xl border border-slate-200 bg-white p-5 opacity-0 invisible shadow-2xl transition-all duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 z-50">
                  <div className="absolute -top-2 right-6 h-4 w-4 rotate-45 border-l border-t border-slate-200 bg-white"></div>
                  <h3 className="relative z-10 mb-2 flex items-center gap-2 font-bold text-slate-800">
                    {billingWarning.isOverdue ? (
                      <Icons.AlertTriangle size={18} className="text-red-500" />
                    ) : (
                      <Icons.Calendar size={18} className="text-amber-500" />
                    )}
                    {billingWarning.isOverdue ? 'Assinatura em Atraso' : 'Vencimento Próximo'}
                  </h3>
                  <p className="relative z-10 mb-5 text-xs leading-relaxed text-slate-500">
                    {billingWarning.isOverdue
                      ? `Sua mensalidade venceu dia ${new Date(billingWarning.dueDate).toLocaleDateString('pt-BR')}. Evite a suspensão do sistema regularizando sua situação agora.`
                      : `Sua mensalidade vence dia ${new Date(billingWarning.dueDate).toLocaleDateString('pt-BR')} (em ${billingWarning.daysLeft === 0 ? 'hoje' : `${billingWarning.daysLeft} dias`}). Pague antes do vencimento para evitar interrupções.`}
                  </p>
                  <div className="relative z-10 flex flex-col gap-2">
                    <button
                      onClick={() => setIsBillingModalOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
                    >
                      <Icons.CreditCard size={14} /> Ver Fatura e Pagar
                    </button>
                    <button
                      onClick={handleDismissBillingWarning}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Já regularizei
                    </button>
                  </div>
                </div>
              </div>
            )}

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
              <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user?.name || 'Perfil'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
                    {userInitial}
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-600 max-w-[120px] truncate">{user?.name || 'Perfil'}</span>
            </div>
          </div>
        </header>

        {billingGraceWarning && (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm dark:border-red-500/20 dark:bg-red-950/40 dark:text-red-200 md:px-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-200">
                  <Icons.AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-red-800 dark:text-red-100">
                    Sua fatura venceu {billingGraceOverdueText}.
                  </p>
                  <p className="text-xs font-medium text-red-700/80 dark:text-red-200/80">
                    Seu acesso sera bloqueado em {billingGraceBlockText}. Regularize para manter o CRM ativo.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePayNow}
                disabled={isOpeningPaymentLink}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isOpeningPaymentLink ? (
                  <Icons.Loader2 size={15} className="animate-spin" />
                ) : (
                  <Icons.CreditCard size={15} />
                )}
                {isOpeningPaymentLink ? 'Abrindo...' : 'Pagar Agora'}
              </button>
            </div>
          </div>
        )}

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[70px] left-0 right-0 bg-white border-b border-slate-100 shadow-xl z-50 p-4 max-h-[calc(100vh-70px)] overflow-y-auto custom-scrollbar flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
            {/* 1. Itens Padrões */}
            {visibleMenuItems.map((item) => (
              <React.Fragment key={item.path}>
                <a
                  href={item.path}
                  onClick={(e) => handleSmartNavigation(e, item.path)}
                  className={`
                    ${getMobileItemOrder(item.path)} flex items-center gap-3 px-4 py-3 rounded-lg
                    ${isSmartNavigationActive(item.path) ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                  `}
                >
                  <item.icon size={20} />
                  {item.label}
                </a>
                {item.path === '/admin/imoveis' && (
                  <a
                    href="/admin/chaves"
                    onClick={(e) => handleSmartNavigation(e, '/admin/chaves')}
                    className={`
                      order-8 flex items-center gap-3 px-4 py-3 rounded-lg
                      ${isSmartNavigationActive('/admin/chaves') ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                    `}
                  >
                    <Icons.Key size={20} />
                    Chaves
                  </a>
                )}
              </React.Fragment>
            ))}

            {/* 2. Menu Contratos (Mobile) */}
            <div className="space-y-1 order-3">
              <div className={`flex items-center justify-between rounded-lg ${location.pathname.includes('/admin/contratos') ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <a
                  href="/admin/contratos"
                  onClick={(e) => handleSmartNavigation(e, '/admin/contratos')}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 font-medium ${location.pathname.includes('/admin/contratos') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}
                >
                  <Icons.FileText size={20} />
                  Contratos
                </a>
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

            {isOwner && (
              <a
                href="/admin/financeiro"
                onClick={(e) => handleSmartNavigation(e, '/admin/financeiro')}
                className={`
                  order-4 flex items-center gap-3 px-4 py-3 rounded-lg
                  ${isSmartNavigationActive('/admin/financeiro') ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                `}
              >
                <Icons.Wallet size={20} />
                Financeiro
              </a>
            )}

            {/* 3. Menu Funil de Vendas (Mobile) */}
            <div className="space-y-1 order-5">
              <div className={`flex items-center justify-between rounded-lg ${location.pathname.includes('/admin/leads') ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <a
                  href="/admin/leads?funnel=geral"
                  onClick={(e) => handleSmartNavigation(e, '/admin/leads')}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 font-medium ${location.pathname.includes('/admin/leads') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}
                >
                  <Icons.Filter size={20} />
                  Funil de Vendas
                </a>
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

            <a
              href="/admin/clientes"
              onClick={(e) => handleSmartNavigation(e, '/admin/clientes')}
              className={`
                order-7 flex items-center gap-3 px-4 py-3 rounded-lg
                ${isSmartNavigationActive('/admin/clientes') ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
              `}
            >
              <Icons.Users size={20} />
              Clientes
            </a>

            {/* 4. Rodapé Mobile (Usuário e Sair) */}
            <div className="pt-4 border-t border-slate-100 mt-2 space-y-2 pb-4">
              {shouldShowTrialBadge && (
                <button
                  type="button"
                  onClick={() => {
                    navigate('/admin/config?tab=subscription');
                    setIsMobileMenuOpen(false);
                  }}
                  className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-amber-800"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <Icons.Clock size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest">Trial ativo</p>
                    <p className="truncate text-sm font-bold">{trialDaysLabel}</p>
                  </div>
                </button>
              )}

              <div className="flex items-center gap-3 px-4 py-2">
                <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user?.name || 'Perfil'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
                      {userInitial}
                    </div>
                  )}
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
                <button
                  type="button"
                  onClick={() => {
                    setIsChangelogModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-600"
                >
                  <Icons.Bug size={14} />
                  v1.0.0
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
        {isBillingModalOpen && (
          <BillingPortalModal
            isOpen={isBillingModalOpen}
            onClose={() => setIsBillingModalOpen(false)}
            company={{
              id: user?.company_id,
              name: user?.company?.name,
            }}
            contract={{
              plan_name: contractPlanName || user?.company?.plan || null,
            }}
          />
        )}
        {isOwner && (
          <SystemReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => setIsReviewModalOpen(false)}
          />
        )}
      </main>

      {!hasContextualAura ? <AuraChatWidget /> : null}
      </div>
    </BillingGuard>
  );
};

export default AdminLayout;
