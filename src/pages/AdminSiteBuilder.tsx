import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

export default function AdminSiteBuilder() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [isSaving, setIsSaving] = useState(false);
  const [siteData, setSiteData] = useState({
    primaryColor: '#0EA5E9',
    heroTitle: 'Encontre o Imóvel dos Seus Sonhos',
    heroSubtitle: 'As melhores opções do mercado com atendimento exclusivo.',
    aboutText: 'Somos especialistas em realizar sonhos e garantir os melhores negócios imobiliários.'
  });

  useEffect(() => {
    if (tenant?.site_data) {
      setSiteData({ ...siteData, ...(tenant.site_data as any) });
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!user?.company_id) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('companies')
      .update({ site_data: siteData })
      .eq('id', user.company_id);

    setIsSaving(false);

    if (error) {
      alert("Erro ao salvar as edições.");
    } else {
      alert("Site atualizado com sucesso!");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Icons.Layout className="text-brand-500" /> Meu Site
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Personalize as cores e textos da sua vitrine de imóveis.
          </p>
        </div>
        <a
          href={`http://${tenant?.subdomain || tenant?.slug}.localhost:5173`}
          target="_blank"
          rel="noreferrer"
          className="bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <Icons.ExternalLink size={18} /> Ver Meu Site
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Formulário de Edição */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-dark-border pb-3">
              Identidade Visual
            </h3>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Cor Principal
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={siteData.primaryColor}
                  onChange={e => setSiteData({...siteData, primaryColor: e.target.value})}
                  className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                />
                <input
                  type="text"
                  value={siteData.primaryColor}
                  onChange={e => setSiteData({...siteData, primaryColor: e.target.value})}
                  className="bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none w-32"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-dark-border pb-3">
              Textos Principais
            </h3>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Título do Banner (Hero)
              </label>
              <input
                value={siteData.heroTitle}
                onChange={e => setSiteData({...siteData, heroTitle: e.target.value})}
                className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Subtítulo do Banner
              </label>
              <input
                value={siteData.heroSubtitle}
                onChange={e => setSiteData({...siteData, heroSubtitle: e.target.value})}
                className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Texto "Quem Somos"
              </label>
              <textarea
                value={siteData.aboutText}
                onChange={e => setSiteData({...siteData, aboutText: e.target.value})}
                className="w-full h-32 resize-none bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-brand-500/20"
            >
              {isSaving ? <Icons.RefreshCw className="animate-spin" size={20} /> : <Icons.Save size={20} />}
              Salvar Alterações
            </button>
          </div>
        </div>

        {/* Live Preview (Simulação) */}
        <div className="hidden md:block">
          <div className="sticky top-6 bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl h-[600px] flex flex-col relative">
            {/* Header Mock */}
            <div className="h-12 bg-white/10 backdrop-blur border-b border-white/10 flex items-center px-4 justify-between z-10">
              <div className="w-24 h-4 rounded bg-white/20"></div>
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-[10px] text-white">
                <Icons.Menu size={14}/>
              </div>
            </div>

            {/* Banner Mock */}
            <div
              className="h-48 relative flex items-center justify-center p-6 text-center"
              style={{ backgroundColor: siteData.primaryColor }}
            >
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10">
                <h4 className="text-white font-black text-lg leading-tight mb-2">
                  {siteData.heroTitle}
                </h4>
                <p className="text-white/80 text-[10px]">
                  {siteData.heroSubtitle}
                </p>
              </div>
            </div>

            {/* Imóveis Mock */}
            <div className="p-4 flex-1 bg-white">
              <div className="w-1/3 h-3 bg-slate-200 rounded mb-4"></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 bg-slate-100 rounded-xl"></div>
                <div className="h-24 bg-slate-100 rounded-xl"></div>
              </div>
              <div className="mt-6">
                <div className="w-1/3 h-3 bg-slate-200 rounded mb-2"></div>
                <p className="text-[8px] text-slate-500 leading-relaxed line-clamp-4">
                  {siteData.aboutText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
