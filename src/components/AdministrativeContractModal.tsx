import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { buildContractHtml, generateContract } from '../utils/contractGenerator';
import { ADMIN_DOCUMENTS } from '../constants/contractTypes';
import { format } from 'date-fns';

interface Props { isOpen: boolean; onClose: () => void; onSuccess: () => void; }

export default function AdministrativeContractModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState('intermediacao');
  
  const [formData, setFormData] = useState({
    lead_id: '',
    property_id: '',
    contract_value: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    observations: '',
    witness_name: '',
    witness_document: ''
  });

  useEffect(() => {
    if (isOpen && user?.company_id) {
      supabase.from('leads').select('*').eq('company_id', user.company_id).then(({ data }) => setLeads(data || []));
      supabase.from('properties').select('*').eq('company_id', user.company_id).then(({ data }) => setProperties(data || []));
    }
  }, [isOpen, user?.company_id]);

  // Atualiza o valor padrão ao selecionar o imóvel
  useEffect(() => {
    if (formData.property_id) {
      const prop = properties.find(p => p.id === formData.property_id);
      if (prop) setFormData(prev => ({ ...prev, contract_value: prop.price || prop.rent_value || '' }));
    }
  }, [formData.property_id]);

  const handleAction = async (isPreview = false) => {
    if (!formData.lead_id || !formData.property_id) return addToast('Selecione o cliente e o imóvel.', 'error');
    setLoading(true);
    try {
      const lead = leads.find(l => l.id === formData.lead_id);
      const prop = properties.find(p => p.id === formData.property_id);
      
      const payload = {
        tenant_name: lead?.name, tenant_document: lead?.document, tenant_address: lead?.address,
        tenant_spouse_name: lead?.spouse_name,
        title: prop?.title, property_address: prop?.address, price: formData.contract_value,
        owner_name: prop?.owner_name, owner_document: prop?.owner_document,
        start_date: formData.start_date,
        observations: formData.observations,
        witness_name: formData.witness_name,
        witness_document: formData.witness_document
      };

      const html = await buildContractHtml(documentType, payload, tenant, tenant?.logo_url);
      
      if (isPreview) {
        const { url } = await generateContract(html, `PREVIEW_${documentType}.pdf`, user?.company_id!);
        window.open(url, '_blank');
      } else {
        const { url } = await generateContract(html, `${documentType}_${Date.now()}.pdf`, user?.company_id!);
        await supabase.from('contracts').insert({
          company_id: user?.company_id, type: 'administrative', status: 'draft',
          file_url: url, lead_id: formData.lead_id, property_id: formData.property_id,
          contract_value: formData.contract_value, start_date: formData.start_date
        });
        addToast('Documento gerado com sucesso!', 'success');
        onSuccess();
        onClose();
      }
    } catch (err) {
      addToast('Erro ao processar documento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl dark:bg-brand-500/10"><Icons.FileText size={24} /></div>
            <div>
              <h2 className="font-bold text-xl dark:text-white">Gerar Documento Administrativo</h2>
              <p className="text-sm text-slate-500 italic">Vistorias, Propostas e Intermediações</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><Icons.X size={24} /></button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <fieldset className="border border-slate-100 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/30 dark:bg-slate-950/30">
              <legend className="px-3 text-xs font-bold uppercase tracking-widest text-brand-600">Configuração</legend>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Documento</label>
                  <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700">
                    {ADMIN_DOCUMENTS.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Data do Documento</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700" />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-slate-100 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/30 dark:bg-slate-950/30">
              <legend className="px-3 text-xs font-bold uppercase tracking-widest text-brand-600">Vínculos</legend>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 text-emerald-600 flex items-center gap-1"><Icons.User size={12}/> Cliente (Lead)</label>
                  <select required value={formData.lead_id} onChange={e => setFormData({ ...formData, lead_id: e.target.value })} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700">
                    <option value="">Selecione...</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name} - {l.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 text-sky-600 flex items-center gap-1"><Icons.Building2 size={12}/> Imóvel</label>
                  <select required value={formData.property_id} onChange={e => setFormData({ ...formData, property_id: e.target.value })} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700">
                    <option value="">Selecione...</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>
          </section>

          <fieldset className="border border-slate-100 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/30 dark:bg-slate-950/30">
            <legend className="px-3 text-xs font-bold uppercase tracking-widest text-brand-600">Financeiro & Detalhes</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Valor do Contrato/Proposta</label>
                <input type="number" placeholder="0,00" value={formData.contract_value} onChange={e => setFormData({...formData, contract_value: e.target.value})} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700 font-bold text-brand-600" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">Observações Adicionais</label>
                <input type="text" placeholder="Ex: Prazo de 48h para resposta..." value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700" />
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-slate-100 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/30 dark:bg-slate-950/30">
            <legend className="px-3 text-xs font-bold uppercase tracking-widest text-brand-600 text-slate-400">Testemunha (Opcional)</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <input type="text" placeholder="Nome Completo" value={formData.witness_name} onChange={e => setFormData({...formData, witness_name: e.target.value})} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700" />
              <input type="text" placeholder="CPF da Testemunha" value={formData.witness_document} onChange={e => setFormData({...formData, witness_document: e.target.value})} className="w-full rounded-xl border-slate-200 p-3 text-sm dark:bg-slate-900 dark:border-slate-700" />
            </div>
          </fieldset>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button onClick={() => handleAction(true)} disabled={loading} className="flex items-center gap-2 px-5 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-white transition-all text-sm">
            {loading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Eye size={18} />} Pré-visualizar Documento
          </button>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 text-slate-400 font-bold hover:text-slate-600">Cancelar</button>
            <button onClick={() => handleAction(false)} disabled={loading} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all">
              {loading ? <Icons.Loader2 className="animate-spin" size={20} /> : <Icons.Save size={20} />} Gerar e Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}