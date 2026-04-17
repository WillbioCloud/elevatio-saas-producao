import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useNotification } from '../contexts/NotificationContext';

export const useRealtimeEvents = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { addNotification } = useNotification();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('custom-all-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {})
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {})
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, () => {})
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contract_signatures' }, (payload: any) => {
        if (payload.new.status === 'signed' && payload.old.status !== 'signed') {
          const signerName = payload.new.signer_name || 'Alguém';

          addToast(`Oba! ${signerName} assinou o documento.`, 'success');

          addNotification({
            title: 'Documento Assinado',
            message: `${signerName} acabou de assinar o contrato!`,
            type: 'system'
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, addToast, addNotification]);
};
