import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

export default function ModernHome() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};

  return (
    <div>
      <section className="py-24 px-6 bg-white rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12 relative z-10">
          <div className="flex-1 text-left">
            <div 
              className="inline-block px-4 py-2 rounded-full text-sm font-bold mb-6" 
              style={{ 
                backgroundColor: `${siteData.primaryColor || '#6366F1'}20`, 
                color: siteData.primaryColor || '#6366F1' 
              }}
            >
              A revolução do mercado imobiliário
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter mb-6 leading-[1.1]">
              {siteData.heroTitle || 'Sua nova casa a um clique de distância'}
            </h1>
            <p className="text-xl text-slate-500 mb-10">
              {siteData.heroSubtitle || 'Experiência 100% digital, transparente e sem burocracia para você viver melhor.'}
            </p>
            <button 
              style={{ backgroundColor: siteData.primaryColor || '#6366F1' }} 
              className="text-white px-8 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-xl"
            >
              Buscar Imóveis
            </button>
          </div>
          <div className="flex-1">
            <div 
              className="aspect-square rounded-full blur-3xl opacity-20 absolute -right-20 top-0" 
              style={{ backgroundColor: siteData.primaryColor || '#6366F1' }}
            ></div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
          <h2 className="text-3xl font-black mb-6 text-slate-900 tracking-tight">Nosso Propósito</h2>
          <p className="text-lg text-slate-500 leading-relaxed font-medium">
            {siteData.aboutText || 'Aceleramos conexões entre pessoas e espaços. Usamos tecnologia para simplificar processos e colocar a chave do seu novo lar na sua mão mais rápido.'}
          </p>
        </div>
      </section>
    </div>
  );
}
