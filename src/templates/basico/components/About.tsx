import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

export function About() {
  const { tenant } = useTenant();
  const siteData = tenant?.site_data as any;
  const primaryColor = siteData?.primary_color || '#b08d5e';
  const title = siteData?.about_title || 'Nossa História';
  const text = siteData?.about_text || 'Uma imobiliária dedicada a encontrar o imóvel perfeito para cada cliente, com experiência, ética e excelência em cada negociação.';
  const imageUrl = siteData?.about_image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1973&auto=format&fit=crop';

  return (
    <section id="sobre" className="py-24 bg-[#111]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Imagem */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden">
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            </div>
            <div
              className="absolute -bottom-6 -right-6 w-48 h-48 rounded-2xl opacity-10"
              style={{ backgroundColor: primaryColor }}
            />
          </div>

          {/* Texto */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
              <p className="text-xs tracking-[0.4em] uppercase font-medium" style={{ color: primaryColor }}>
                Quem Somos
              </p>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white font-bold leading-tight mb-6">
              {title}
            </h2>
            <p className="text-white/50 text-base leading-relaxed mb-8 whitespace-pre-line">
              {text}
            </p>
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/10">
              {[
                { value: '10+', label: 'Anos de Mercado' },
                { value: '500+', label: 'Imóveis Vendidos' },
                { value: '98%', label: 'Clientes Satisfeitos' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold font-serif" style={{ color: primaryColor }}>{stat.value}</p>
                  <p className="text-white/40 text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
