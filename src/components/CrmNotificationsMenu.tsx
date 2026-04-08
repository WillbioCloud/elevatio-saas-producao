import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const NOTIFICATIONS_LIMIT = 50;

type CrmNotification = {
  id: string;
  title: string;
  content?: string | null;
  message?: string | null;
  read: boolean;
  created_at: string;
  link?: string | null;
  user_id?: string | null;
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Agora mesmo';
  if (minutes < 60) return `${minutes}m atrás`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;

  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
};

const getInitials = (text: string) => text.charAt(0).toUpperCase();

const normalizeAdminRoute = (path: string) => {
  if (path.startsWith('/admin/contracts')) {
    return path.replace('/admin/contracts', '/admin/contratos');
  }

  if (path.startsWith('/admin/tasks')) {
    return path.replace('/admin/tasks', '/admin/tarefas');
  }

  return path;
};

export function CrmNotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'human'>('all');
  const [isCenterOpen, setIsCenterOpen] = useState(false);
  const [centerSearch, setCenterSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const companyId = user?.company_id;

  const isVisibleToCurrentUser = (notification: CrmNotification) =>
    !notification.user_id || notification.user_id === user?.id;

  const syncNotifications = (nextNotifications: CrmNotification[]) => {
    setNotifications(nextNotifications);
    setUnreadCount(nextNotifications.filter((notification) => !notification.read).length);
  };

  const fetchNotifs = async () => {
    if (!companyId) return;

    setIsRefreshing(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(NOTIFICATIONS_LIMIT);

    if (error) {
      console.error('Erro ao carregar notificações:', error);
      window.setTimeout(() => setIsRefreshing(false), 500);
      return;
    }

    const visibleNotifications = ((data as CrmNotification[] | null) ?? []).filter(isVisibleToCurrentUser);
    syncNotifications(visibleNotifications);
    window.setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    if (!companyId) return;

    void fetchNotifs();

    const channel = supabase
      .channel(`crm_notifs_${companyId}_${user?.id ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `company_id=eq.${companyId}` },
        (payload) => {
          const newNotification = payload.new as CrmNotification;
          if (!isVisibleToCurrentUser(newNotification)) return;

          setNotifications((prev) => {
            const next = [newNotification, ...prev].slice(0, NOTIFICATIONS_LIMIT);
            setUnreadCount(next.filter((notification) => !notification.read).length);
            return next;
          });

          addToast(newNotification.title || 'Nova notificação', 'info');

          try {
            const audio = new Audio(NOTIFICATION_SOUND_URL);
            audio.volume = 0.5;
            void audio.play();
          } catch (error) {
            console.error('Erro de som', error);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `company_id=eq.${companyId}` },
        (payload) => {
          const updatedNotification = payload.new as CrmNotification;
          if (!isVisibleToCurrentUser(updatedNotification)) return;

          setNotifications((prev) => {
            const exists = prev.some((notification) => notification.id === updatedNotification.id);
            const next = exists
              ? prev.map((notification) =>
                  notification.id === updatedNotification.id ? { ...notification, ...updatedNotification } : notification
                )
              : [updatedNotification, ...prev].slice(0, NOTIFICATIONS_LIMIT);

            setUnreadCount(next.filter((notification) => !notification.read).length);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, addToast, user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isCenterOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCenterOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsCenterOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);

    if (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return false;
    }

    setNotifications((prev) => {
      const next = prev.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      );
      setUnreadCount(next.filter((notification) => !notification.read).length);
      return next;
    });

    return true;
  };

  const handleNotificationClick = async (notif: CrmNotification) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
    }

    setIsOpen(false);
    setIsCenterOpen(false);

    if (notif.link) {
      navigate(normalizeAdminRoute(notif.link));
      return;
    }

    const title = (notif.title || '').toLowerCase();
    const content = (notif.content || notif.message || '').toLowerCase();

    if (title.includes('lead') || content.includes('lead')) {
      navigate('/admin/leads');
      return;
    }

    if (title.includes('contrato') || content.includes('contrato')) {
      navigate('/admin/contratos');
      return;
    }

    if (
      title.includes('corretor') ||
      title.includes('equipe') ||
      content.includes('corretor') ||
      content.includes('equipe')
    ) {
      navigate('/admin/config?tab=team');
      return;
    }

    if (title.includes('tarefa') || content.includes('tarefa')) {
      navigate('/admin/tarefas');
      return;
    }

    if (title.includes('ranking') || title.includes('leaderboard') || content.includes('ranking')) {
      navigate('/admin/leaderboard');
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (!unreadIds.length) return;

    const { error } = await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    if (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      return;
    }

    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
  };

  const filteredDropdownNotifs = useMemo(
    () =>
      notifications.filter((notification) => {
        if (activeTab === 'system') return !notification.user_id;
        if (activeTab === 'human') return !!notification.user_id;
        return true;
      }),
    [notifications, activeTab]
  );

  const finalCenterNotifs = useMemo(
    () =>
      notifications.filter((notification) => {
        const text = `${notification.title} ${notification.content || ''} ${notification.message || ''}`.toLowerCase();
        const matchSearch = text.includes(centerSearch.toLowerCase());
        const matchFilter = centerFilter === 'unread' ? !notification.read : true;
        return matchSearch && matchFilter;
      }),
    [notifications, centerSearch, centerFilter]
  );

  const counts = {
    all: notifications.length,
    system: notifications.filter((notification) => !notification.user_id).length,
    human: notifications.filter((notification) => !!notification.user_id).length,
  };

  const renderIcon = (notif: CrmNotification) => {
    const title = notif.title.toLowerCase();

    if (notif.user_id) {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white shadow-sm">
          {getInitials(notif.title)}
        </div>
      );
    }

    if (title.includes('ia') || title.includes('copilot') || title.includes('automático')) {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <Icons.Sparkles size={14} className="text-emerald-600" />
        </div>
      );
    }

    let bgColor = 'bg-blue-100';
    let textColor = 'text-blue-600';
    let Icon = Icons.Info;

    if (title.includes('erro') || title.includes('falha') || title.includes('atraso')) {
      bgColor = 'bg-red-100';
      textColor = 'text-red-600';
      Icon = Icons.AlertTriangle;
    } else if (title.includes('sucesso') || title.includes('aprovado')) {
      bgColor = 'bg-green-100';
      textColor = 'text-green-600';
      Icon = Icons.CheckCircle;
    }

    return (
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgColor}`}>
        <Icon size={14} className={textColor} />
      </div>
    );
  };

  const NotificationCard = ({
    notification,
    isCenter = false,
  }: {
    notification: CrmNotification;
    isCenter?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => void handleNotificationClick(notification)}
      className={`group relative flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 ${
        !notification.read
          ? 'border-[#E5E7EB] bg-[#F9FAFB] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:bg-slate-50'
          : 'border-transparent bg-white hover:border-[#E5E7EB] hover:bg-[#F9FAFB]'
      } ${isCenter ? 'mb-2' : ''}`}
    >
      {!notification.read && <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-brand-500 shadow-sm" />}

      {renderIcon(notification)}

      <div className="flex-1 pr-4">
        <p
          className={`mb-1 text-[13px] leading-snug ${
            !notification.read ? 'font-semibold text-[#111827]' : 'font-medium text-slate-700'
          }`}
        >
          {notification.title}
        </p>

        {(notification.content || notification.message) && (
          <p className="mb-2 line-clamp-2 text-[12px] leading-snug text-[#6B7280]">
            {notification.content || notification.message}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          {(notification.title.toLowerCase().includes('lead') ||
            notification.title.toLowerCase().includes('contrato')) && (
            <span className="inline-flex items-center rounded-full border border-slate-200/50 bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
              {notification.title.toLowerCase().includes('lead') ? 'Lead CRM' : 'Assinatura'}
            </span>
          )}

          <span className="flex items-center gap-1 text-[11px] font-medium text-[#9CA3AF]">
            <Icons.Clock size={10} />
            {timeAgo(notification.created_at)}
          </span>
        </div>
      </div>
    </button>
  );

  const centerDrawer =
    isCenterOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[140] flex justify-end">
            <button
              type="button"
              aria-label="Fechar central de notificações"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setIsCenterOpen(false)}
            />

            <div className="relative flex h-full w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-800">
                    <Icons.BellRing size={20} className="text-brand-600" />
                    Central de Notificações
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Gerencie todo o seu histórico e alertas.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCenterOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <Icons.X size={20} />
                </button>
              </div>

              <div className="space-y-3 border-b border-slate-100 bg-slate-50 p-4">
                <div className="relative">
                  <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar em notificações..."
                    value={centerSearch}
                    onChange={(event) => setCenterSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-2 rounded-lg bg-slate-200/50 p-1">
                    <button
                      type="button"
                      onClick={() => setCenterFilter('all')}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                        centerFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Todas
                    </button>

                    <button
                      type="button"
                      onClick={() => setCenterFilter('unread')}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                        centerFilter === 'unread'
                          ? 'bg-white text-brand-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Não lidas {unreadCount > 0 ? `(${unreadCount})` : ''}
                    </button>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      <Icons.CheckCheck size={14} />
                      Marcar lidas
                    </button>
                  )}
                </div>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto bg-[#FCFCFD] p-4">
                {finalCenterNotifs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                      <Icons.SearchX size={28} className="text-slate-400" />
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-slate-800">Nenhum resultado</h3>
                    <p className="text-xs text-slate-500">Não encontramos notificações com esses filtros.</p>
                  </div>
                ) : (
                  finalCenterNotifs.map((notif) => (
                    <NotificationCard key={notif.id} notification={notif} isCenter={true} />
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Abrir notificações do CRM"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative rounded-full p-2 transition-colors ${
            isOpen ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          } dark:text-slate-400 dark:hover:bg-slate-800`}
        >
          <Icons.Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[9px] font-bold text-white shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-3 flex w-[360px] origin-top-right flex-col overflow-hidden rounded-[20px] border border-[#E6E8EC] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] animate-fade-in right-0 sm:-right-16 md:right-0">
            <div className="px-5 pb-3 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[#111827]">Notificações</h3>
                <button
                  type="button"
                  onClick={() => void fetchNotifs()}
                  className="rounded-full p-1 text-[#9CA3AF] transition-colors hover:bg-slate-50 hover:text-[#6B7280]"
                >
                  <Icons.RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {(['all', 'system', 'human'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex h-7 items-center rounded-full px-3 text-xs font-medium transition-all duration-200 ${
                      activeTab === tab
                        ? 'border border-[#E5E7EB] bg-white text-[#111827] shadow-sm'
                        : 'border border-transparent bg-[#F3F4F6] text-[#6B7280] hover:bg-slate-200'
                    }`}
                  >
                    <span className="capitalize">
                      {tab === 'all' ? 'Todas' : tab === 'system' ? 'Sistema' : 'Humano'}
                    </span>
                    {counts[tab] > 0 && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                          activeTab === tab ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {counts[tab]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="custom-scrollbar max-h-[400px] space-y-2 overflow-y-auto bg-white px-4 pb-4">
              {filteredDropdownNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Icons.BellOff size={24} className="mb-2 text-slate-300" />
                  <p className="text-sm text-[#6B7280]">Tudo limpo por aqui.</p>
                </div>
              ) : (
                filteredDropdownNotifs.map((notif) => <NotificationCard key={notif.id} notification={notif} />)
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#F9FAFB]/80 p-3 backdrop-blur-md">
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-[12px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                Marcar todas como lidas
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsCenterOpen(true);
                }}
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#111827] shadow-sm transition-all hover:bg-slate-50"
              >
                Ver central
              </button>
            </div>
          </div>
        )}
      </div>
      {centerDrawer}
    </>
  );
}
