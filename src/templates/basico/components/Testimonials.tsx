import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

const testimonials = [
  { name: 'Carlos Mendes', role: 'Comprador', text: 'Processo incrível do início ao fim. Encontraram exatamente o que eu precisava em tempo recorde. Recomendo muito!', avatar: 'CM' },
  { name: 'Ana Paula Silva', role: 'Vendedora', text: 'Venderam meu apartamento em menos de 30 dias pelo preço que eu queria. Equipe extremamente profissional.', avatar: 'AS' },
  { name: 'Roberto Faria', role: 'Investidor', text: 'Já fechei 3 negócios com eles. A consultoria de investimento é diferenciada e os resultados falam por si.', avatar: 'RF' },
];

export function Testimonials() {
  const { tenant } = useTenant();
  const siteData = tenant?.site_data as any;
  const primaryColor = siteData?.primary_color || '#b08d5e';

  return (
    <section id="depoimentos" className="py-24 bg-[#111]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
            <p className="text-xs tracking-[0.4em] uppercase font-medium" style={{ color: primaryColor }}>Depoimentos</p>
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-bold">O Que Dizem Nossos Clientes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="p-8 rounded-2xl border border-white/8 flex flex-col gap-6"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <p className="text-white/50 text-sm leading-relaxed italic">"{t.text}"</p>
              <div className="flex items-center gap-4 mt-auto">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: primaryColor + '22', color: primaryColor }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-white/30 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
