import React from 'react';
import { Home, TrendingUp, FileText, Key } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';

const services = [
  { icon: Home, title: 'Venda de Imóveis', desc: 'Assessoria completa para vender seu imóvel pelo melhor preço, com agilidade e segurança.' },
  { icon: Key, title: 'Gestão de Aluguéis', desc: 'Administramos seu imóvel com total transparência, garantindo renda e tranquilidade.' },
  { icon: TrendingUp, title: 'Consultoria de Investimento', desc: 'Identificamos as melhores oportunidades do mercado para maximizar seu retorno.' },
  { icon: FileText, title: 'Assessoria Jurídica', desc: 'Suporte completo em documentação, contratos e regularização de imóveis.' },
];

export function Services() {
  const { tenant } = useTenant();
  const siteData = tenant?.site_data as any;
  const primaryColor = siteData?.primary_color || '#b08d5e';

  return (
    <section id="servicos" className="py-24 bg-[#0e0e0e]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
            <p className="text-xs tracking-[0.4em] uppercase font-medium" style={{ color: primaryColor }}>Serviços</p>
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-bold">O Que Oferecemos</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-6 rounded-2xl border border-white/8 bg-white/3 hover:border-white/20 transition-all duration-300 group"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300"
                style={{ backgroundColor: primaryColor + '18' }}
              >
                <Icon size={22} style={{ color: primaryColor }} />
              </div>
              <h3 className="font-serif text-white font-semibold text-lg mb-3">{title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
