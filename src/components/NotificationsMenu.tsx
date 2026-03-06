import React, { useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface SaasNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  link?: string;
}

export default function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SaasNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!user) return;

    if (isSuperAdmin) {
      fetchSaasNotifications();
      subscribeToSaasNotifications();
    } else {
      // Futuro: Lógica de notificações do CRM (Corretores)
      setNotifications([]);
    }
  }, [user]);

  const fetchSaasNotifications = async () => {
    const { data } = await supabase
      .from('saas_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const subscribeToSaasNotifications = () => {
    supabase
      .channel('saas_notifications_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'saas_notifications'
      }, (payload) => {
        setNotifications(prev => [payload.new as SaasNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
  };

  const markAsRead = async (id: string) => {
    await supabase.from('saas_notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await supabase.from('saas_notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment_received':
        return <Icons.DollarSign className="text-emerald-500" size={20} />;
      case 'new_client':
        return <Icons.Building2 className="text-brand-500" size={20} />;
      case 'churn':
        return <Icons.UserMinus className="text-red-500" size={20} />;
      default:
        return <Icons.Bell className="text-slate-500" size={20} />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 relative text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-full transition-colors"
      >
        <Icons.Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-dark-card animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-slate-200 dark:border-dark-border z-50 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white">Notificações SaaS</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Icons.BellOff className="mx-auto mb-2 opacity-50" size={32} />
                  <p>Tudo tranquilo por aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-dark-border">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.link) {
                          navigate(notif.link);
                          setIsOpen(false);
                        }
                      }}
                      className={`p-4 flex gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                        !notif.is_read ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''
                      }`}
                    >
                      <div className="shrink-0 mt-1">{getIcon(notif.type)}</div>
                      <div>
                        <p className={`text-sm ${!notif.is_read ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                          {new Date(notif.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {!notif.is_read && <div className="w-2 h-2 bg-brand-500 rounded-full mt-2 shrink-0"></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
