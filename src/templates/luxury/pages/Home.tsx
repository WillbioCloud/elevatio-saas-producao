import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

export default function LuxuryHome() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};
  const primaryColor = siteData.primaryColor || '#D4AF37';

  return (
    <div>
      <section className="relative py-48 px-6 text-center border-b border-white/10 overflow-hidden">
        {/* Fundo elegante simulando uma mansão escura */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950 -z-10"></div>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700 via-slate-950 to-slate-950 -z-10"></div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          <h1 className="text-5xl md:text-8xl font-normal tracking-tight mb-8 leading-tight">
            {siteData.heroTitle || 'Exclusividade em cada detalhe'}
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto font-light">
            {siteData.heroSubtitle || 'Descubra propriedades de alto padrão selecionadas para o seu estilo de vida.'}
          </p>
          <button 
            style={{ backgroundColor: primaryColor, color: '#000' }} 
            className="px-10 py-5 font-bold uppercase tracking-widest text-sm hover:brightness-110 transition-all"
          >
            Explorar Portfólio
          </button>
        </div>
      </section>

      <section className="py-32 px-6 max-w-5xl mx-auto text-center">
        <h2 className="text-4xl font-normal mb-10 tracking-wide" style={{ color: primaryColor }}>
          Tradição e Excelência
        </h2>
        <p className="text-xl text-slate-300 leading-relaxed font-light">
          {siteData.aboutText || 'O nosso compromisso é com a exclusividade. Entregamos residências de luxo com atendimento primoroso e total discrição para clientes exigentes.'}
        </p>
      </section>
    </div>
  );
}
