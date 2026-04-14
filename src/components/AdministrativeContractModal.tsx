import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { Lead, Property } from '../types';
import { useToast } from '../contexts/ToastContext';
import { buildContractHtml, generateContract } from '../utils/contractGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { ADMIN_DOCUMENTS } from '../constants/contractTypes';

interface AdministrativeContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdministrativeContractModal({ isOpen, onClose, onSuccess }: AdministrativeContractModalProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [documentType, setDocumentType] = useState('intermediacao');
  const [formData, setFormData] = useState({ lead_id: '', property_id: '', contract_value: '' });

  useEffect(() => {
    if (isOpen && user?.company_id) {
      supabase.from('leads').select('*').eq('company_id', user.company_id).then(({ data }) => setLeads(data || []));
      supabase.from('properties').select('*').eq('company_id', user.company_id).then(({ data }) => setProperties(data || []));
    }
  }, [isOpen, user?.company_id]);

  const handleGeneratePDF = async () => {
    if (!formData.lead_id || !formData.property_id) return addToast('Selecione cliente e imóvel.', 'error');
    setLoading(true);
    try {
      const selectedLead = leads.find((l) => l.id === formData.lead_id);
      const selectedProperty = properties.find((p) => p.id === formData.property_id);

      const payload = {
        tenant_name: selectedLead?.name,
        tenant_document: selectedLead?.document,
        tenant_address: selectedLead?.address,
        title: selectedProperty?.title,
        property_address: selectedProperty?.address,
        price: formData.contract_value || selectedProperty?.price
      };

      const html = await buildContractHtml(documentType, payload, tenant, tenant?.logo_url);
      const { url } = await generateContract(html, `${documentType}_${Date.now()}.pdf`, user?.company_id!);

      const { error } = await supabase.from('contracts').insert({
        company_id: user?.company_id,
        type: 'administrative',
        status: 'draft',
        file_url: url,
        lead_id: formData.lead_id,
        property_id: formData.property_id,
        contract_value: formData.contract_value || selectedProperty?.price
      });

      if (error) throw error;
      addToast('Contrato gerado com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      addToast('Erro ao gerar contrato.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Icons.FileText className="text-slate-500" /> Documento Administrativo</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><Icons.X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Documento</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 bg-white">
              {ADMIN_DOCUMENTS.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Cliente Vinculado</label>
            <select value={formData.lead_id} onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })} className="w-full rounded-xl border border-slate-200 p-3 bg-white">
              <option value="">Selecione um cliente...</option>
              {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Imóvel</label>
            <select value={formData.property_id} onChange={(e) => setFormData({ ...formData, property_id: e.target.value })} className="w-full rounded-xl border border-slate-200 p-3 bg-white">
              <option value="">Selecione o imóvel...</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold">Cancelar</button>
          <button onClick={handleGeneratePDF} disabled={loading || !formData.lead_id || !formData.property_id} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold flex items-center gap-2">
            {loading ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.FileText size={16} />} Gerar Documento
          </button>
        </div>
      </div>
    </div>
  );
}
