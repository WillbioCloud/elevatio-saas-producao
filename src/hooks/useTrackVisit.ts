import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const DEVICE_ID_KEY = 'trimoveis_device_id';
const SESSION_ID_KEY = 'trimoveis_session_id';
const VISITED_PAGES_KEY = 'trimoveis_visited_pages';
const MAX_VISITED_PAGES = 20;

type VisitedPage = {
  url: string;
  timestamp: string;
  title: string;
};

const generateId = () => Math.random().toString(36).substring(2);

const getOrCreateStorageId = (storage: Storage, key: string) => {
  const existing = storage.getItem(key);
  if (existing) return existing;

  const created = generateId();
  storage.setItem(key, created);
  return created;
};

const updateVisitedPagesHistory = (url: string) => {
  const nextEntry: VisitedPage = {
    url,
    timestamp: new Date().toISOString(),
    title: document.title,
  };

  const rawHistory = sessionStorage.getItem(VISITED_PAGES_KEY);
  let parsedHistory: VisitedPage[] = [];

  if (rawHistory) {
    try {
      const candidate = JSON.parse(rawHistory) as unknown;
      if (Array.isArray(candidate)) {
        parsedHistory = candidate.filter((item): item is VisitedPage => {
          if (!item || typeof item !== 'object') return false;
          const typedItem = item as Partial<VisitedPage>;
          return (
            typeof typedItem.url === 'string' &&
            typeof typedItem.timestamp === 'string' &&
            typeof typedItem.title === 'string'
          );
        });
      }
    } catch {
      parsedHistory = [];
    }
  }

  const updatedHistory = [...parsedHistory, nextEntry].slice(-MAX_VISITED_PAGES);
  sessionStorage.setItem(VISITED_PAGES_KEY, JSON.stringify(updatedHistory));
};

export const useTrackVisit = () => {
  const location = useLocation();

  useEffect(() => {
    const trackVisit = async () => {
      try {
        if (location.pathname.startsWith('/admin')) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) return;

        const deviceId = getOrCreateStorageId(localStorage, DEVICE_ID_KEY);
        const sessionId = getOrCreateStorageId(sessionStorage, SESSION_ID_KEY);

        await supabase.from('site_visits').insert({
          page: location.pathname,
          device_id: deviceId,
          session_id: sessionId,
        });

        updateVisitedPagesHistory(`${location.pathname}${location.search}`);
      } catch (error) {
        console.error('Erro ao registrar visita:', error);
      }
    };

    void trackVisit();
  }, [location.pathname, location.search]);
};