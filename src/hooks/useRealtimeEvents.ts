import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const useRealtimeEvents = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('custom-all-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {})
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {})
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, () => {})
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
};