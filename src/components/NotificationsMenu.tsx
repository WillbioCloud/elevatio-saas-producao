import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { Icons } from './Icons';

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffInMinutes = Math.max(1, Math.floor((now.getTime() - date.getTime()) / 60000));

  if (diffInMinutes < 60) return `${diffInMinutes} min atrás`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} h atrás`;
  return date.toLocaleDateString('pt-BR');
};

const NotificationsMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();

  const visibleNotifications = useMemo(() => notifications.slice(0, 8), [notifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((previous) => !previous)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        aria-label="Notificações"
      >
        <Icons.Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl z-40">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Notificações</h3>
            <button
              onClick={markAllAsRead}
              className="text-xs font-semibold text-brand-600 transition hover:text-brand-700"
            >
              Marcar todas como lidas
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Nenhuma notificação por enquanto.</p>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markAsRead(notification.id)}
                  className={`w-full text-left border-b border-slate-100 px-4 py-3 last:border-none transition ${
                    notification.read ? 'bg-white' : 'bg-red-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{notification.message}</p>
                    </div>
                    {!notification.read && <span className="mt-1 h-2 w-2 rounded-full bg-red-500" />}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{formatRelativeTime(notification.date)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsMenu;