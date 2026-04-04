import React, { useEffect, useState } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
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

  const toggleTemplateStatus = async (template: Template) => {
    // Não permite alterar status de templates exclusivos por este botão rápido
    if (template.status === 'exclusive') return;

    const newStatus = template.status === 'active' ? 'construction' : 'active';
    
    // Atualização otimista na tela
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, status: newStatus } : t));

    try {
      const { error } = await supabase
        .from('saas_templates')
        .update({ status: newStatus })
        .eq('id', template.id);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      // Reverte em caso de erro
      fetchTemplates();
    }
  };

  return (
    <div className="font-['DM_Sans'] animate-in fade-in duration-300">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Templates de Sites</h1>
          <p className="mt-1 text-slate-500">Controle a disponibilidade dos temas no Wizard dos clientes.</p>
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
              
              {/* Badge de Status */}
              <div className="absolute top-5 right-5 z-10">
                {template.status === 'active' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Disponível
                  </span>
                )}
                {template.status === 'construction' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                    <Icons.Wrench size={10} /> Em Construção
                  </span>
                )}
                {template.status === 'exclusive' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                    <Icons.Lock size={10} /> Exclusivo
                  </span>
                )}
              </div>

              {/* Preview (Placeholder) */}
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

              {/* Ações */}
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
                    <><Icons.EyeOff size={14} /> Ocultar do Wizard</>
                  ) : template.status === 'construction' ? (
                    <><Icons.Eye size={14} /> Liberar no Wizard</>
                  ) : (
                    <><Icons.Lock size={14} /> Cliente VIP</>
                  )}
                </button>

                <button className="text-slate-400 hover:text-brand-600 transition-colors p-2 rounded-lg hover:bg-brand-50">
                  <Icons.Settings size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
