import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { supabase } from '../lib/supabase';

export type NotificationType = 'lead' | 'property' | 'task' | 'system';

type NotificationSender = { name: string; avatar_url: string | null };

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: Date;
  read: boolean;
  type: NotificationType;
  sender?: NotificationSender | null;
  created_at: string;
  user_id?: string | null;
  content?: string | null;
  link?: string | null;
  lead_id?: string | null;
}

interface NotificationInput {
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  leadId?: string | null;
  lead_id?: string | null;
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
  user_id?: string | null;
  sender_id?: string | null;
  company_id?: string | null;
  title: string;
  message?: string | null;
  content?: string | null;
  type: NotificationType;
  read: boolean;
  created_at: string;
  profiles?: NotificationSender | null;
  link?: string | null;
  lead_id?: string | null;
};

const MAX_NOTIFICATIONS = 30;

const buildLeadLink = (leadId?: string | null, sourceLink?: string | null) => {
  if (!leadId) return null;

  try {
    const url = new URL(sourceLink || '/admin/leads', typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (url.pathname.startsWith('/admin/leads')) {
      url.pathname = '/admin/leads';
      url.searchParams.set('open', leadId);
      url.searchParams.delete('leadId');
      url.searchParams.delete('lead_id');
      url.searchParams.delete('id');

      const query = url.searchParams.toString();
      return `/admin/leads${query ? `?${query}` : ''}`;
    }
  } catch {
    // Usa o fallback canônico abaixo.
  }

  return `/admin/leads?open=${encodeURIComponent(leadId)}`;
};

const extractLeadIdFromLink = (link?: string | null) => {
  if (!link) return null;

  try {
    const url = new URL(link, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

    const openId =
      url.searchParams.get('open') ||
      url.searchParams.get('leadId') ||
      url.searchParams.get('lead_id') ||
      url.searchParams.get('id');

    if (openId && url.pathname.startsWith('/admin/leads')) {
      return openId;
    }

    const pathMatch = url.pathname.match(/^\/admin\/leads\/([^/?#]+)/);
    return pathMatch?.[1] ?? null;
  } catch {
    const pathMatch = link.match(/\/admin\/leads\/([^/?#]+)/);
    return pathMatch?.[1] ?? null;
  }
};

const normalizeLeadLink = (link?: string | null, leadId?: string | null) => {
  const resolvedLeadId = leadId || extractLeadIdFromLink(link);
  return buildLeadLink(resolvedLeadId, link) || link || null;
};

const playNotificationSound = () => {
  const soundEnabled = localStorage.getItem('trimoveis-sound') !== 'disabled';
  if (!soundEnabled) return;

  try {
    const AudioContext =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
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

const mapRowToNotification = (row: NotificationRow): NotificationItem => {
  let finalTitle = row.title;
  const msg = row.message ?? row.content ?? '';

  const titleLower = finalTitle.toLowerCase();
  const msgLower = msg.toLowerCase();
  const isNewLead = titleLower.includes('atribuído') || titleLower.includes('novo lead') || (titleLower.includes('etapa') && (msgLower.includes('novo') || msgLower.includes('atendimento')));

  if (isNewLead) {
    finalTitle = 'Lead Novo!';
  }

  return {
    id: row.id,
    title: finalTitle,
    message: msg,
    type: row.type,
    read: row.read,
    date: new Date(row.created_at),
    sender: row.profiles ?? null,
    created_at: row.created_at,
    user_id: row.user_id,
    content: msg,
    link: normalizeLeadLink(row.link, row.lead_id),
    lead_id: row.lead_id || extractLeadIdFromLink(row.link),
  };
};

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
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.company_id || !user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, profiles!notifications_sender_id_fkey(name, avatar_url)')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) throw error;
      
      // Escudo Anti-Vazamento (Fetch): Se o user_id for nulo mas o texto for de Lead, bloqueia.
      const filteredData = ((data ?? []) as NotificationRow[]).filter(n => {
        if (n.user_id) return n.user_id === user.id;
        if (n.title?.toLowerCase().includes('lead') || n.message?.toLowerCase().includes('lead')) return false;
        return true;
      });
      
      setNotifications(filteredData.map(mapRowToNotification));
      setUnreadCount(filteredData.filter(n => !n.read).length);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  }, [user?.company_id, user?.id]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.company_id || !user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `company_id=eq.${user.company_id}` },
        async (payload) => {
          const newRow = payload.new as NotificationRow;

          // Escudo Anti-Vazamento (Realtime Live)
          if (newRow.user_id) {
            if (newRow.user_id !== user.id) return;
          } else {
            if (newRow.title?.toLowerCase().includes('lead') || newRow.message?.toLowerCase().includes('lead')) return;
          }

          // Puxa a foto do autor
          let senderProfile = null;
          if (newRow.sender_id) {
            const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', newRow.sender_id).single();
            senderProfile = data;
          }

          const mapped = mapRowToNotification({ ...newRow, profiles: senderProfile });

          setNotifications((prev) => upsertNotification(prev, mapped));
          setUnreadCount((c) => c + 1);
          playNotificationSound();

          // Dispara o Toast correto
          if (mapped.title === 'Lead Novo!') {
            addToast(mapped.message, 'new_lead', { title: 'Novo Lead!', avatar: mapped.sender?.avatar_url });
          } else {
            addToast(mapped.title, 'info');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `company_id=eq.${user.company_id}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          if (row.user_id && row.user_id !== user.id) return;
          const mapped = mapRowToNotification(row);
          setNotifications((prev) => upsertNotification(prev, mapped));
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.company_id, user?.id, addToast, fetchNotifications]);

  const addNotification = useCallback((notification: NotificationInput) => {
    if (!user?.id || !user.company_id) return;

    void (async () => {
      const leadId = notification.leadId || notification.lead_id || extractLeadIdFromLink(notification.link);

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          read: false,
          company_id: user.company_id,
          link: normalizeLeadLink(notification.link, leadId),
        })
        .select('*')
        .single();

      if (error) {
        console.error('Erro ao criar notificação:', error);
        return;
      }

      if (!data) return;
      const mapped = mapRowToNotification(data as NotificationRow);
      setNotifications((prev) => upsertNotification(prev, mapped));
      setUnreadCount((prev) => prev + 1);
    })();
  }, [user?.company_id, user?.id]);

  const markAsRead = useCallback((id: string) => {
    if (!user?.id || !user.company_id) return;

    const wasUnread = notifications.some((notification) => notification.id === id && !notification.read);

    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );

    if (wasUnread) {
      setUnreadCount((previous) => Math.max(0, previous - 1));
    }

    void supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('company_id', user.company_id)
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao marcar notificação como lida:', error);
          void fetchNotifications();
        }
      });
  }, [fetchNotifications, notifications, user?.company_id, user?.id]);

  const markAllAsRead = useCallback(() => {
    if (!user?.id || !user.company_id) return;

    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);

    void supabase
      .from('notifications')
      .update({ read: true })
      .eq('company_id', user.company_id)
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq('read', false)
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao marcar todas as notificações como lidas:', error);
          void fetchNotifications();
        }
      });
  }, [fetchNotifications, user?.company_id, user?.id]);

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
