import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../../components/Icons';
import { supabase } from '../../lib/supabase';

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'construction' | 'exclusive';
  exclusive_company_id: string | null;
}

export default function SaasTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados da Gaveta de Edição
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchCompanies();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saas_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Erro ao buscar templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, subdomain')
        .order('name', { ascending: true });

      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Erro ao buscar imobiliárias:', err);
    }
  };

  const toggleTemplateStatus = async (template: Template) => {
    if (template.status === 'exclusive') return;
    const newStatus = template.status === 'active' ? 'construction' : 'active';
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, status: newStatus } : t));

    try {
      const { error } = await supabase
        .from('saas_templates')
        .update({ status: newStatus })
        .eq('id', template.id);

      if (error) throw error;
    } catch (err) {
      fetchTemplates();
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTemplate) return;
    setIsSaving(true);

    try {
      // Se não for exclusivo, garante que o ID da empresa vinculada fique nulo
      const finalCompanyId = editingTemplate.status === 'exclusive' ? editingTemplate.exclusive_company_id : null;

      const { error } = await supabase
        .from('saas_templates')
        .update({
          name: editingTemplate.name,
          description: editingTemplate.description,
          status: editingTemplate.status,
          exclusive_company_id: finalCompanyId
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;
      
      await fetchTemplates();
      setEditingTemplate(null);
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao salvar as configurações do template.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="font-['DM_Sans'] animate-in fade-in duration-300">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Templates de Sites</h1>
          <p className="mt-1 text-slate-500">Controle a disponibilidade dos temas no Wizard e no Painel dos clientes.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-500 transition-colors">
          <Icons.Plus size={16} /> Novo Template
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[24px] border border-slate-200">
          <Icons.Loader2 className="w-10 h-10 text-[#1a56db] animate-spin mb-4" />
          <p className="font-bold text-slate-700">Carregando catálogo...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden flex flex-col group">
              
              <div className="absolute top-5 right-5 z-10">
                {template.status === 'active' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Disponível
                  </span>
                )}
                {template.status === 'construction' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 shadow-sm">
                    <Icons.Wrench size={10} /> Em Construção
                  </span>
                )}
                {template.status === 'exclusive' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold text-purple-700 shadow-sm">
                    <Icons.Lock size={10} /> Exclusivo
                  </span>
                )}
              </div>

              <div className="h-40 w-full rounded-xl bg-slate-100 mb-4 flex items-center justify-center border border-slate-200 group-hover:border-brand-200 transition-colors">
                <Icons.LayoutTemplate size={40} className="text-slate-300 group-hover:text-brand-300 transition-colors" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-black text-slate-800">{template.name}</h3>
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">/{template.slug}</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">{template.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button 
                  onClick={() => toggleTemplateStatus(template)}
                  disabled={template.status === 'exclusive'}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    template.status === 'active' 
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                      : template.status === 'construction'
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {template.status === 'active' ? (
                    <><Icons.EyeOff size={14} /> Ocultar</>
                  ) : template.status === 'construction' ? (
                    <><Icons.Eye size={14} /> Liberar</>
                  ) : (
                    <><Icons.Lock size={14} /> VIP</>
                  )}
                </button>

                {/* BOTÃO QUE ABRE A GAVETA DE EDIÇÃO */}
                <button 
                  onClick={() => setEditingTemplate(template)}
                  className="text-slate-400 hover:text-brand-600 transition-colors p-2 rounded-lg hover:bg-brand-50"
                >
                  <Icons.Settings size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GAVETA DE CONFIGURAÇÃO (PORTAL) */}
      {editingTemplate && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end font-['DM_Sans']">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => !isSaving && setEditingTemplate(null)} 
          />

          <div className="relative w-full max-w-md h-screen bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-800">Configurar Template</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">/{editingTemplate.slug}</p>
              </div>
              <button 
                onClick={() => setEditingTemplate(null)} 
                disabled={isSaving}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full disabled:opacity-50"
              >
                <Icons.X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 flex flex-col">
              
              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nome Comercial</label>
                  <input 
                    type="text" 
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Descrição Curta</label>
                  <textarea 
                    value={editingTemplate.description}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 resize-none h-24"
                    required
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Disponibilidade</label>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${editingTemplate.status === 'active' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${editingTemplate.status === 'active' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                          {editingTemplate.status === 'active' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${editingTemplate.status === 'active' ? 'text-emerald-800' : 'text-slate-700'}`}>Público / Ativo</p>
                          <p className="text-xs text-slate-500">Visível no Wizard para todos.</p>
                        </div>
                      </div>
                      <input type="radio" name="status" value="active" className="hidden" onChange={() => setEditingTemplate({ ...editingTemplate, status: 'active' })} checked={editingTemplate.status === 'active'} />
                    </label>

                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${editingTemplate.status === 'construction' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${editingTemplate.status === 'construction' ? 'border-amber-500 bg-amber-500' : 'border-slate-300'}`}>
                          {editingTemplate.status === 'construction' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${editingTemplate.status === 'construction' ? 'text-amber-800' : 'text-slate-700'}`}>Em Construção</p>
                          <p className="text-xs text-slate-500">Oculto temporariamente.</p>
                        </div>
                      </div>
                      <input type="radio" name="status" value="construction" className="hidden" onChange={() => setEditingTemplate({ ...editingTemplate, status: 'construction' })} checked={editingTemplate.status === 'construction'} />
                    </label>

                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${editingTemplate.status === 'exclusive' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${editingTemplate.status === 'exclusive' ? 'border-purple-500 bg-purple-500' : 'border-slate-300'}`}>
                          {editingTemplate.status === 'exclusive' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${editingTemplate.status === 'exclusive' ? 'text-purple-800' : 'text-slate-700'}`}>Exclusivo VIP</p>
                          <p className="text-xs text-slate-500">Apenas uma imobiliária pode usar.</p>
                        </div>
                      </div>
                      <input type="radio" name="status" value="exclusive" className="hidden" onChange={() => setEditingTemplate({ ...editingTemplate, status: 'exclusive' })} checked={editingTemplate.status === 'exclusive'} />
                    </label>
                  </div>
                </div>

                {editingTemplate.status === 'exclusive' && (
                  <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-purple-600 mb-2">Vincular à Imobiliária</label>
                    <select 
                      value={editingTemplate.exclusive_company_id || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, exclusive_company_id: e.target.value })}
                      className="w-full rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-900 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                      required
                    >
                      <option value="" disabled>Selecione o Cliente VIP...</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name} ({company.subdomain})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-all hover:shadow-lg disabled:opacity-70"
                >
                  {isSaving ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Save size={18} />}
                  Salvar Configurações
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
