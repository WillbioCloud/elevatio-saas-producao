import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useNotification } from '../contexts/NotificationContext';

type SupportMessageRow = {
  id: string;
  ticket_id: string;
  sender_type: string | null;
  message: string | null;
};

const getCurrentSupportSenderType = (role?: string | null) => (role === 'super_admin' ? 'admin' : 'client');

const getSupportLink = (role?: string | null) => (role === 'super_admin' ? '/saas/suporte' : '/admin/suporte');

const getSupportMessagePreview = (message?: string | null) => {
  if (!message) return 'Nova mensagem recebida no suporte.';
  if (message.startsWith('![Anexo](')) return 'Enviou uma imagem no suporte.';

  return message.length > 90 ? `${message.slice(0, 87)}...` : message;
};

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'saas_ticket_messages' }, (payload: any) => {
        const message = payload.new as SupportMessageRow;
        const currentSenderType = getCurrentSupportSenderType(user.role);

        if (!message.sender_type || message.sender_type === currentSenderType) return;

        const senderLabel = message.sender_type === 'admin' ? 'Suporte' : 'Cliente';
        const notificationMessage = `${senderLabel}: ${getSupportMessagePreview(message.message)}`;

        addToast('Nova mensagem no suporte.', 'info');

        addNotification({
          title: 'Nova mensagem no suporte',
          message: notificationMessage,
          type: 'system',
          link: getSupportLink(user.role),
        });
      })
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
  }, [user?.id, user?.role, addToast, addNotification]);
};
