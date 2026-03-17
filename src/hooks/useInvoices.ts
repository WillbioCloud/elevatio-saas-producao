import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';

export function useInvoices(companyId: string | undefined) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchInvoices = async () => {
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select(`*, property:properties(title)`)
          .eq('company_id', companyId)
          .order('due_date', { ascending: true });

        if (error) throw error;
        setInvoices(data || []);
      } catch (error) {
        console.error('Erro ao buscar faturas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();

    const subscription = supabase
      .channel('invoices_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` },
        () => fetchInvoices()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [companyId]);

  return { invoices, loading };
}
