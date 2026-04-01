import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { supabase } from '../lib/supabase';
import type { Company, Invoice } from '../types';
import { generatePixPayload } from '../utils/pixGenerator';

type CheckoutCompany = Pick<Company, 'name' | 'site_data' | 'finance_config' | 'logo_url'>;

export default function PublicCheckout() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [companyData, setCompanyData] = useState<CheckoutCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [pixPayload, setPixPayload] = useState('');
  const [copied, setCopied] = useState(false);
  const [paymentNotified, setPaymentNotified] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) return;

      try {
        const { data: invData, error: invError } = await supabase.from('invoices').select('*').eq('id', id).single();
        if (invError) throw invError;
        setInvoice(invData);

        const { data: compData, error: compError } = await supabase
          .from('companies')
          .select('name, site_data, finance_config')
          .eq('id', invData.company_id)
          .single();
        if (compError) throw compError;

        const parsedSiteData =
          typeof compData.site_data === 'string' ? JSON.parse(compData.site_data) : compData.site_data || {};

        setCompanyData({
          ...compData,
          logo_url: parsedSiteData.logo_url,
        });

        const finance =
          typeof compData.finance_config === 'string'
            ? JSON.parse(compData.finance_config)
            : compData.finance_config || {};

        if (finance.pix_key) {
          const payload = generatePixPayload(
            finance.pix_key,
            finance.pix_name || compData.name,
            finance.pix_city || 'Cidade',
            invData.amount,
            invData.id.split('-')[0]
          );

          setPixPayload(payload);
        }
      } catch (err) {
        console.error('Erro ao carregar fatura:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Icons.Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  if (!invoice || !companyData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Fatura nao encontrada.
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Erro ao copiar codigo PIX:', error);
    }
  };

  const handleNotifyPayment = async () => {
    if (!invoice) return;
    try {
      const { error } = await supabase.rpc('notify_payment_made', {
        p_invoice_id: invoice.id,
        p_company_id: invoice.company_id,
        p_description: invoice.description || 'Fatura sem descrição',
        p_amount: invoice.amount
      });
      if (error) throw error;
      setPaymentNotified(true);
    } catch (err) {
      console.error('Erro ao notificar:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 text-white p-6 text-center">
          {companyData.logo_url ? (
            <img
              src={companyData.logo_url}
              alt={companyData.name}
              className="h-12 mx-auto mb-4 object-contain"
            />
          ) : (
            <h1 className="text-xl font-black mb-4">{companyData.name}</h1>
          )}
          <p className="text-slate-400 text-sm uppercase tracking-wider font-bold mb-1">Valor a pagar</p>
          <h2 className="text-4xl font-black mb-2">
            R$ {invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-sm text-slate-300">
            Vencimento: {new Date(invoice.due_date).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          <h3 className="font-bold text-slate-800 dark:text-white mb-2">
            {invoice.description || 'Pagamento de Fatura'}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            Copie o codigo PIX e cole no app do seu banco para realizar o pagamento.
          </p>

          {pixPayload ? (
            <>
              <div className="bg-white p-2 rounded-xl border-2 border-slate-100 shadow-sm mb-6 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pixPayload)}&size=200x200`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>

              <button
                onClick={handleCopy}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-200'
                }`}
              >
                {copied ? (
                  <>
                    <Icons.CheckCircle size={18} /> Copiado!
                  </>
                ) : (
                  <>
                    <Icons.Copy size={18} /> Copiar Codigo PIX
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="p-4 bg-amber-50 text-amber-700 rounded-lg text-sm">
              Esta imobiliaria ainda nao configurou as chaves de recebimento PIX.
            </div>
          )}

          <div className="w-full mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            {paymentNotified ? (
              <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-fade-in">
                <h4 className="text-emerald-800 dark:text-emerald-400 font-bold flex items-center justify-center gap-2 mb-2">
                  <Icons.CheckCircle size={20} /> Pagamento Informado!
                </h4>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 text-center leading-relaxed">
                  Para agilizar a emissao do seu recibo, por favor, <strong>envie o comprovante de pagamento</strong> respondendo a mensagem no WhatsApp por onde voce recebeu este link.
                </p>
              </div>
            ) : (
              <button
                onClick={handleNotifyPayment}
                className="w-full py-3 text-brand-600 hover:text-brand-700 font-bold text-sm underline transition-colors"
              >
                Ja realizei o pagamento
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-6 flex items-center gap-1">
        <Icons.ShieldCheck size={14} /> Ambiente Seguro • Powered by Elevatio Vendas
      </p>
    </div>
  );
}
