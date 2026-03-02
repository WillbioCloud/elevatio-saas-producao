import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { supabase } from '../lib/supabase';

export type NotificationType = 'lead' | 'property' | 'task';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: Date;
  read: boolean;
  type: NotificationType;
}

interface NotificationInput {
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (notification: NotificationInput) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  fetchNotifications: () => Promise<void>;
}

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
};

const MAX_NOTIFICATIONS = 30;

const playNotificationSound = () => {
  const soundEnabled = localStorage.getItem('trimoveis-sound') !== 'disabled';
  if (!soundEnabled) return;

  try {
    const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (error) {
    console.error('Erro ao tocar som:', error);
  }
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const mapRowToNotification = (row: NotificationRow): NotificationItem => ({
  id: row.id,
  title: row.title,
  message: row.message,
  type: row.type,
  read: row.read,
  date: new Date(row.created_at),
});

const upsertNotification = (
  current: NotificationItem[],
  incoming: NotificationItem
): NotificationItem[] => {
  const existingIndex = current.findIndex((item) => item.id === incoming.id);
  if (existingIndex === -1) {
    return [incoming, ...current].slice(0, MAX_NOTIFICATIONS);
  }

  const next = [...current];
  next[existingIndex] = incoming;
  return next.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, MAX_NOTIFICATIONS);
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id,user_id,title,message,type,read,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATIONS);

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    setNotifications(rows.map(mapRowToNotification));
  }, [user?.id]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-channel-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
          const row = payload.new;
          if (!row) return;

          const mapped = mapRowToNotification(row);
          setNotifications((prev) => upsertNotification(prev, mapped));
          playNotificationSound();

          addToast(mapped.title, 'success');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
          const row = payload.new;
          if (!row) return;

          const mapped = mapRowToNotification(row);
          setNotifications((prev) => upsertNotification(prev, mapped));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addToast, user?.id]);

  const addNotification = useCallback((notification: NotificationInput) => {
    if (!user?.id) return;

    void (async () => {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          read: false,
        })
        .select('id,user_id,title,message,type,read,created_at')
        .single();

      if (error) {
        console.error('Erro ao criar notificação:', error);
        return;
      }

      if (!data) return;
      const mapped = mapRowToNotification(data as NotificationRow);
      setNotifications((prev) => upsertNotification(prev, mapped));
    })();
  }, [user?.id]);

  const markAsRead = useCallback((id: string) => {
    if (!user?.id) return;

    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );

    void supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao marcar notificação como lida:', error);
          void fetchNotifications();
        }
      });
  }, [fetchNotifications, user?.id]);

  const markAllAsRead = useCallback(() => {
    if (!user?.id) return;

    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));

    void supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao marcar todas as notificações como lidas:', error);
          void fetchNotifications();
        }
      });
  }, [fetchNotifications, user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, fetchNotifications }),
    [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, fetchNotifications]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotification deve ser usado dentro de NotificationProvider');
  }

  return context;
};