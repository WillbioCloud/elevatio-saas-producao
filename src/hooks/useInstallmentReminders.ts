import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type InstallmentReminder = {
  id: string;
  amount: number | string;
  due_date: string;
  contract: {
    id: string;
    broker_id?: string | null;
    lead?: {
      name?: string | null;
    } | null;
  } | null;
};

export const useInstallmentReminders = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const checkUpcomingInstallments = async () => {
      try {
        const today = new Date();
        const limitDate = new Date();
        limitDate.setDate(today.getDate() + 3);

        const dateString = limitDate.toISOString().split('T')[0];

        const { data: installments, error } = await supabase
          .from('installments')
          .select('id, amount, due_date, contract:contracts(id, broker_id, lead:leads(name))')
          .eq('status', 'pending')
          .eq('notified_due', false)
          .lte('due_date', dateString);

        if (error) throw error;

        if (installments && installments.length > 0) {
          for (const inst of installments as InstallmentReminder[]) {
            const targetUserId = inst.contract?.broker_id || user.id;

            await supabase.from('notifications').insert({
              user_id: targetUserId,
              title: '💰 Vencimento Próximo',
              message: `A parcela de R$ ${Number(inst.amount).toLocaleString('pt-BR')} do cliente ${inst.contract?.lead?.name || 'Desconhecido'} vence em ${new Date(inst.due_date).toLocaleDateString('pt-BR')}.`,
              type: 'system',
              read: false,
              link: `/admin/contratos/${inst.contract?.id}`,
            });

            await supabase.from('installments').update({ notified_due: true }).eq('id', inst.id);
          }
        }
      } catch (err) {
        console.error('Erro no robô de verificação de parcelas:', err);
      }
    };

    checkUpcomingInstallments();

    const interval = setInterval(checkUpcomingInstallments, 1000 * 60 * 60 * 6);
    return () => clearInterval(interval);
  }, [user]);
};