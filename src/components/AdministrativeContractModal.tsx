import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { buildContractHtml, generateContract } from '../utils/contractGenerator';
import { ADMIN_DOCUMENTS } from '../constants/contractTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdministrativeContractModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState('intermediacao');
  const [formData, setFormData] = useState({ lead_id: '', property_id: '' });

  useEffect(() => {
    if (isOpen && user?.company_id) {
      supabase
        .from('leads')
        .select('id, name, document, address')
        .eq('company_id', user.company_id)
        .then(({ data }) => setLeads(data || []));
      supabase
        .from('properties')
        .select('id, title, address, price')
        .eq('company_id', user.company_id)
        .then(({ data }) => setProperties(data || []));
    }
  }, [isOpen, user?.company_id]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lead_id || !formData.property_id) return addToast('Preencha os campos', 'error');
    setLoading(true);
    try {
      const lead = leads.find((l) => l.id === formData.lead_id);
      const prop = properties.find((p) => p.id === formData.property_id);

      const payload = {
        tenant_name: lead?.name,
        tenant_document: lead?.document,
        tenant_address: lead?.address,
        title: prop?.title,
        property_address: prop?.address,
        price: prop?.price,
      };

      const html = await buildContractHtml(documentType, payload, tenant, tenant?.logo_url);
      const { url } = await generateContract(html, `${documentType}_${Date.now()}.pdf`, user?.company_id!);

      await supabase.from('contracts').insert({
        company_id: user?.company_id,
        type: 'administrative',
        status: 'draft',
        file_url: url,
        lead_id: formData.lead_id,
        property_id: formData.property_id,
        contract_value: prop?.price,
      });

      addToast('Documento Administrativo gerado!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      addToast('Erro ao gerar documento', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Icons.FileText className="text-slate-400" /> Gerar Documento Admin
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
            <Icons.X size={20} />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">Tipo de Documento</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:bg-slate-950 dark:border-slate-700"
            >
              {ADMIN_DOCUMENTS.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">Cliente Vinculado</label>
            <select
              required
              value={formData.lead_id}
              onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:bg-slate-950 dark:border-slate-700"
            >
              <option value="">Selecione...</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">Imóvel Relacionado</label>
            <select
              required
              value={formData.property_id}
              onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:bg-slate-950 dark:border-slate-700"
            >
              <option value="">Selecione...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.FileText size={18} />} Gerar PDF
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}