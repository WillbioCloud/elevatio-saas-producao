import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

const metrics = [
  { value: '1.200+', label: 'Imóveis Disponíveis' },
  { value: 'R$ 2B+', label: 'Em Transações' },
  { value: '15 Anos', label: 'De Experiência' },
  { value: '4.9★', label: 'Avaliação Média' },
];

export function Metrics() {
  const { tenant } = useTenant();
  const siteData = tenant?.site_data as any;
  const primaryColor = siteData?.primary_color || '#b08d5e';

  return (
    <section className="py-16 bg-[#0e0e0e] border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {metrics.map((m) => (
            <div key={m.label} className="text-center">
              <p className="font-serif text-3xl sm:text-4xl font-bold mb-2" style={{ color: primaryColor }}>
                {m.value}
              </p>
              <p className="text-white/40 text-sm">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
