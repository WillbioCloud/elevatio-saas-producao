import React, { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export function SaasNotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { addToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifs = async () => {
      const { data } = await supabase.from('saas_notifications').select('*').order('created_at', { ascending: false }).limit(20);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((notification) => !notification.is_read).length);
      }
    };

    fetchNotifs();

    const channel = supabase
      .channel('saas_notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'saas_notifications' }, (payload) => {
        const newNotification = payload.new as any;
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);
        addToast(newNotification.title || 'Novo evento SaaS', 'success');

        try {
          const audio = new Audio(NOTIFICATION_SOUND_URL);
          audio.volume = 0.5;
          void audio.play();
        } catch {
          return;
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [addToast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('saas_notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((notification) => (notification.id === id ? { ...notification, is_read: true } : notification)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Icons.Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-[10px] font-bold text-white dark:border-slate-900">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-brand-50/50 p-4 dark:border-slate-800 dark:bg-brand-900/10">
            <h3 className="flex items-center gap-2 font-bold text-brand-800 dark:text-brand-400">
              <Icons.Zap size={16} />
              Painel SaaS
            </h3>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-500">Nenhum evento no sistema</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`cursor-pointer border-b border-slate-50 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                    !notification.is_read ? 'bg-slate-50 dark:bg-slate-800/50' : ''
                  }`}
                >
                  <p
                    className={`text-sm font-bold ${
                      !notification.is_read ? 'text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {notification.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{notification.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
