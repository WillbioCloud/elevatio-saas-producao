import React, { useState } from 'react';
import { Icons } from './Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InvoiceModal({ isOpen, onClose, onSuccess }: InvoiceModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '',
    client_document: '',
    description: '',
    amount: '',
    due_date: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id) {
      addToast('Erro: Não foi possível identificar a sua empresa.', 'error');
      return;
    }
    setLoading(true);
    try {
      const cleanAmount = formData.amount.replace(/\./g, '').replace(',', '.');
      const amountNumber = parseFloat(cleanAmount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        addToast('Por favor, insira um valor válido.', 'error');
        setLoading(false);
        return;
      }
      const { error } = await supabase.from('invoices').insert([{
        company_id: user.company_id,
        client_name: formData.client_name,
        client_document: formData.client_document,
        description: formData.description,
        amount: amountNumber,
        due_date: formData.due_date,
        status: 'pendente',
      }]);
      if (error) throw error;
      addToast('Cobrança criada com sucesso!', 'success');
      setFormData({ client_name: '', client_document: '', description: '', amount: '', due_date: '' });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao criar cobrança:', error);
      addToast('Erro ao criar cobrança. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-dark-card rounded-3xl w-full max-w-md overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-100 dark:border-dark-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Icons.Plus size={20} className="text-brand-500" /> Nova Cobrança Avulsa
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
            <Icons.X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Inquilino *</label>
              <input
                required
                type="text"
                value={formData.client_name}
                onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">CPF/CNPJ *</label>
              <input
                required
                type="text"
                value={formData.client_document}
                onChange={e => setFormData({ ...formData, client_document: e.target.value.replace(/\D/g, '') })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Apenas números"
                maxLength={14}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="Ex: Taxa de pintura / Aluguel atrasado"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Valor (R$) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="1"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Vencimento *</label>
              <input
                required
                type="date"
                value={formData.due_date}
                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Icons.Loader2 size={20} className="animate-spin" /> : <Icons.Save size={20} />}
              Criar Cobrança
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
