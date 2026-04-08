import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { supabase } from '../lib/supabase';

type BillingPortalCompany = {
  id?: string;
  name?: string;
  asaas_customer_id?: string | null;
} | null;

type BillingPortalContract = {
  plan_name?: string | null;
  status?: string | null;
} | null;

interface BillingPortalInvoice {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string | null;
  invoiceUrl?: string | null;
}

interface BillingPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: BillingPortalCompany;
  contract: BillingPortalContract;
}

const paidStatuses = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const overdueStatuses = new Set(['OVERDUE']);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);

const formatDate = (date: string | null | undefined) => {
  if (!date) return '-';

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '-';

  return parsedDate.toLocaleDateString('pt-BR');
};

const getStatusLabel = (status: string) => {
  if (paidStatuses.has(status)) return 'Pago';
  if (overdueStatuses.has(status)) return 'Atrasado';
  return 'Pendente';
};

const getStatusClassName = (status: string) => {
  if (paidStatuses.has(status)) return 'bg-emerald-100 text-emerald-700';
  if (overdueStatuses.has(status)) return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

export default function BillingPortalModal({
  isOpen,
  onClose,
  company,
  contract,
}: BillingPortalModalProps) {
  const [invoices, setInvoices] = useState<BillingPortalInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !company?.id) return;

    let ignore = false;

    const loadInvoices = async () => {
      setIsLoading(true);
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
          body: JSON.stringify({
            company_id: company.id,
            customer_id: company.asaas_customer_id ?? undefined,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Não foi possível carregar suas faturas agora.');
        }

        if (ignore) return;

        const nextInvoices = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.payments)
            ? payload.payments
            : [];

        setInvoices(nextInvoices);
      } catch (error) {
        if (ignore) return;
        console.error('Erro ao carregar histórico financeiro:', error);
        setErrorMessage(
          error instanceof Error ? error.message : 'Não foi possível carregar suas faturas agora.'
        );
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadInvoices();

    return () => {
      ignore = true;
    };
  }, [company?.asaas_customer_id, company?.id, isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const latestActionableInvoice =
    invoices.find((invoice) => invoice.invoiceUrl && !paidStatuses.has(invoice.status)) ||
    invoices.find((invoice) => invoice.invoiceUrl);

  const openPaymentManager = () => {
    if (!latestActionableInvoice?.invoiceUrl) return;
    window.open(latestActionableInvoice.invoiceUrl, '_blank', 'noopener,noreferrer');
  };

  const isContractActive = contract?.status === 'active';

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex w-screen h-screen items-start sm:items-center justify-center overflow-y-auto p-4 pt-16 sm:pt-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-50 font-['DM_Sans'] lg:flex-row">
        <button
          onClick={onClose}
          className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:text-[#1a56db] lg:left-6 lg:top-6"
        >
          <Icons.ArrowLeft size={18} /> Voltar ao CRM
        </button>

        <div className="relative w-full overflow-hidden border-b border-slate-200 bg-white px-6 pb-8 pt-20 lg:max-w-md lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
          <div className="absolute left-[-10%] top-[-10%] h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,36,96,0.02),rgba(14,165,233,0.04))]" />

          <div className="relative z-10">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a56db] shadow-lg shadow-blue-500/30">
              <Icons.CreditCard className="text-white" size={24} />
            </div>

            <h2 className="mb-2 text-2xl font-black text-slate-800">Sua Assinatura</h2>
            <p className="mb-8 text-slate-500">
              Gerencie a mensalidade do seu CRM, faturas e método de pagamento em um ambiente seguro.
            </p>

            <div className="mb-6 rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.08)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Plano Atual</p>
                  <h3 className="mt-1 text-lg font-black text-[#1a56db]">
                    {contract?.plan_name || 'Elevatio'}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    isContractActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Icons.CheckCircle2 size={12} /> {isContractActive ? 'Ativo' : 'Em análise'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-[linear-gradient(135deg,#0f2460_0%,#1a3a7a_100%)] p-5 text-white shadow-lg shadow-slate-900/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/55">Fatura de referência</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/70">Mensalidade SaaS</p>
                    <p className="mt-1 text-xl font-black">
                      {latestActionableInvoice ? formatCurrency(Number(latestActionableInvoice.value)) : 'Sem pendências'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur-sm">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">Vencimento</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {latestActionableInvoice ? formatDate(latestActionableInvoice.dueDate) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-5">
                <p className="mb-3 text-sm font-medium text-slate-600">Método de Pagamento</p>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <Icons.CreditCard className="text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Cartão protegido no portal</p>
                    <p className="text-xs text-slate-500">
                      A atualização é feita no ambiente seguro do Asaas.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openPaymentManager}
                  disabled={!latestActionableInvoice?.invoiceUrl}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Icons.RefreshCw size={16} /> Trocar Cartão de Crédito
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Conta SaaS</p>
              <p className="mt-2 text-sm font-bold text-slate-700">{company?.name || 'Imobiliária'}</p>
              <p className="mt-1 text-xs text-slate-500">
                O histórico abaixo se refere exclusivamente às mensalidades do uso da plataforma Elevatio, e não aos seus clientes de aluguel.
              </p>
            </div>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(26,86,219,0.08),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 pb-10 pt-24 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-800">Histórico de Faturas</h3>
                <p className="text-sm text-slate-500">
                  Acompanhe os pagamentos da sua assinatura e acesse seus recibos.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                {invoices.length} {invoices.length === 1 ? 'fatura encontrada' : 'faturas encontradas'}
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white/90 py-24 text-center shadow-sm">
                <Icons.Loader2 className="mb-4 h-10 w-10 animate-spin text-[#1a56db]" />
                <p className="font-bold text-slate-700">Buscando histórico seguro...</p>
                <p className="mt-1 text-sm text-slate-500">Sincronizando com o portal financeiro.</p>
              </div>
            ) : errorMessage ? (
              <div className="rounded-[28px] border border-red-200 bg-white p-8 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-red-100 p-3 text-red-600">
                    <Icons.XCircle size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">Não foi possível carregar as faturas</h4>
                    <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
                  </div>
                </div>
              </div>
            ) : invoices.length === 0 ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Icons.Receipt size={24} />
                </div>
                <h4 className="text-lg font-black text-slate-800">Nenhuma mensalidade gerada</h4>
                <p className="mt-2 text-sm text-slate-500">
                  As faturas da sua assinatura aparecerão aqui assim que forem processadas.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 md:hidden">
                  {invoices.map((invoice) => {
                    const statusLabel = getStatusLabel(invoice.status);
                    const isPayable = !paidStatuses.has(invoice.status);

                    return (
                      <article key={invoice.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Vencimento</p>
                            <p className="mt-1 text-base font-black text-slate-800">{formatDate(invoice.dueDate)}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClassName(invoice.status)}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Descrição</p>
                            <p className="mt-1 text-sm text-slate-600">Mensalidade Sistema</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Valor</p>
                            <p className="mt-1 text-sm font-black text-slate-800">{formatCurrency(Number(invoice.value))}</p>
                          </div>
                        </div>
                        <a href={invoice.invoiceUrl || '#'} target="_blank" rel="noopener noreferrer" className={`mt-5 inline-flex items-center gap-2 text-sm font-bold ${invoice.invoiceUrl ? 'text-[#1a56db] transition-colors hover:text-blue-800' : 'pointer-events-none text-slate-300'}`}>
                          {isPayable ? 'Pagar Fatura' : 'Ver Recibo'} <Icons.ExternalLink size={14} />
                        </a>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm md:block">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50/70">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Vencimento</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Descrição</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Valor</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((invoice) => {
                        const statusLabel = getStatusLabel(invoice.status);
                        const isPayable = !paidStatuses.has(invoice.status);
                        return (
                          <tr key={invoice.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold text-slate-700">{formatDate(invoice.dueDate)}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">Mensalidade Sistema</td>
                            <td className="px-6 py-4 font-bold text-slate-700">{formatCurrency(Number(invoice.value))}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClassName(invoice.status)}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <a href={invoice.invoiceUrl || '#'} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-sm font-bold ${invoice.invoiceUrl ? 'text-[#1a56db] transition-colors hover:text-blue-800' : 'pointer-events-none text-slate-300'}`}>
                                {isPayable ? 'Pagar Fatura' : 'Ver Recibo'} <Icons.ExternalLink size={14} />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
