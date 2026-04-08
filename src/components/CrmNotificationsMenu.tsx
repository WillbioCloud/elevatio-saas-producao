import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

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
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const companyId = user?.company_id;

  useEffect(() => {
    if (!companyId) return;

    const isVisibleToCurrentUser = (notification: CrmNotification) =>
      !notification.user_id || notification.user_id === user?.id;

    const syncNotifications = (nextNotifications: CrmNotification[]) => {
      setNotifications(nextNotifications);
      setUnreadCount(nextNotifications.filter((notification) => !notification.read).length);
    };

    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Erro ao carregar notificações:', error);
        return;
      }

      const visibleNotifications = ((data as CrmNotification[] | null) ?? []).filter(isVisibleToCurrentUser);
      syncNotifications(visibleNotifications);
    };

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
            const next = [newNotification, ...prev].slice(0, 20);
            setUnreadCount(next.filter((notification) => !notification.read).length);
            return next;
          });

          addToast(newNotification.title || 'Nova notificação no CRM', 'info');

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
              : [updatedNotification, ...prev].slice(0, 20);

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

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    if (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      return;
    }

    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notif: CrmNotification) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
    }

    setIsOpen(false);

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

    if (title.includes('corretor') || title.includes('equipe') || content.includes('corretor') || content.includes('equipe')) {
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <Icons.Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-bold text-white dark:border-slate-900">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <h3 className="font-bold text-slate-800 dark:text-white">Notificações</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-600 transition-colors hover:bg-brand-100"
              >
                Marcar lidas
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-500">Nenhuma notificação</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => void handleNotificationClick(notification)}
                  className={`cursor-pointer border-b border-slate-50 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                    !notification.read ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''
                  }`}
                >
                  <p
                    className={`text-sm font-bold ${
                      !notification.read ? 'text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {notification.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {notification.content || notification.message}
                  </p>
                  <p className="mt-2 text-[10px] font-medium text-slate-400">
                    {new Date(notification.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
