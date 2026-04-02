import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Icons } from '../../components/Icons';

interface Payment {
  id: string;
  status: string;
  value: number;
  netValue: number;
  dueDate: string;
  paymentDate: string | null;
  invoiceUrl: string;
  companyName: string;
}

export default function SaasPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-asaas-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel carregar os pagamentos agora.');
      }

      const nextPayments = Array.isArray(payload?.payments)
        ? payload.payments
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      setPayments(nextPayments);
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Nao foi possivel carregar os pagamentos agora.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 w-fit">
            <Icons.CheckCircle size={14} /> Pago
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1 w-fit">
            <Icons.Clock size={14} /> Pendente
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1 w-fit">
            <Icons.AlertCircle size={14} /> Vencido
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 w-fit">
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Icons.DollarSign className="text-brand-500" />
            Gestão de Pagamentos
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Acompanhe todas as faturas geradas e recebidas via Asaas.
          </p>
        </div>
        <button
          onClick={fetchPayments}
          disabled={loading}
          className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <Icons.RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Atualizar Lista
        </button>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-dark-border">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor Bruto</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vencimento</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pago em</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-dark-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Icons.RefreshCw size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                    A sincronizar com o Asaas...
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-red-500">
                    {errorMessage}
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nenhum pagamento registado até ao momento.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white">{payment.companyName}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">{payment.id}</p>
                    </td>
                    <td className="p-4">{getStatusBadge(payment.status)}</td>
                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(payment.value)}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(payment.dueDate)}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {payment.paymentDate ? formatDate(payment.paymentDate) : '-'}
                    </td>
                    <td className="p-4">
                      <a
                        href={payment.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-bold text-sm flex items-center gap-1"
                      >
                        Ver Fatura <Icons.ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
