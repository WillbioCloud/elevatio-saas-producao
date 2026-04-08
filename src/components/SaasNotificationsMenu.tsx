import React, { useEffect, useRef, useState } from 'react';
import { Bell, Zap, CheckCircle2, XCircle, Info, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const getNotificationIcon = (type?: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-primary" />;
  }
};

export function SaasNotificationsMenu() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { addToast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('saas_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifs();

    // Preload audio
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;

    const channel = supabase
      .channel('saas_notifs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'saas_notifications' },
        (payload) => {
          const newNotification = payload.new as any;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          addToast(newNotification.title || 'Novo evento SaaS', 'success');

          try {
            audioRef.current?.play();
          } catch {
            // Silently fail if audio can't play
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [addToast]);

  const markAsRead = async (id: string) => {
    await supabase.from('saas_notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from('saas_notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    );
    setUnreadCount(0);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <DropdownMenuLabel className="p-0 text-sm font-semibold">
              Notificações SaaS
            </DropdownMenuLabel>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs font-medium"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={cn(
                    "group relative cursor-pointer p-4 transition-colors hover:bg-muted/30",
                    !notification.is_read && "bg-primary/5"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        !notification.is_read ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {notification.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.created_at && (
                        <p className="mt-1 text-[10px] text-muted-foreground/70">
                          {new Date(notification.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    {!notification.is_read && (
                      <div className="shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-border p-2 bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setIsOpen(false)}
          >
            Fechar
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}