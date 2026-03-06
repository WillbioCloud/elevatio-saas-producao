import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

export default function MinimalistHome() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};

  return (
    <div>
      <section className="py-32 px-6 text-center bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-6">
            {siteData.heroTitle || 'Encontre o imóvel dos seus sonhos'}
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto">
            {siteData.heroSubtitle || 'Ajudamos você a encontrar o lugar perfeito para viver as suas melhores histórias.'}
          </p>
          <button 
            style={{ backgroundColor: siteData.primaryColor || '#0EA5E9' }} 
            className="text-white px-8 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            Ver Imóveis Disponíveis
          </button>
        </div>
      </section>

      <section className="py-24 px-6 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-6">Quem Somos</h2>
        <p className="text-lg text-slate-600 leading-relaxed">
          {siteData.aboutText || 'Somos especialistas em realizar sonhos. Com anos de experiência no mercado imobiliário, garantimos transparência e segurança no seu negócio.'}
        </p>
      </section>
    </div>
  );
}
