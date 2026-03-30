import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

export default function LuxuryServices() {
  const { tenant } = useTenant();
  
  // Dados dinâmicos do SaaS
  const companyName = tenant?.name || 'ModHous';
  const siteData = (tenant?.site_data as any) || {};

  // Textos traduzidos para português mantendo a estética minimalista
  const services = [
    {
      num: '01',
      title: siteData.service1_title || 'Compra e Venda',
      description: siteData.service1_desc || 'Assessoria completa na comercialização de propriedades arquitetonicamente significativas.',
    },
    {
      num: '02',
      title: siteData.service2_title || 'Locação Premium',
      description: siteData.service2_desc || 'Gestão de contratos e seleção de inquilinos com rigor e total transparência.',
    },
    {
      num: '03',
      title: siteData.service3_title || 'Consultoria Estratégica',
      description: siteData.service3_desc || 'Análise profunda de mercado para identificação de oportunidades exclusivas off-market.',
    },
    {
      num: '04',
      title: siteData.service4_title || 'Avaliação Técnica',
      description: siteData.service4_desc || 'Precificação técnica baseada em dados reais e potencial de valorização a longo prazo.',
    },
  ];

  return (
    <div className="pt-32 pb-20 px-6 max-w-[1400px] mx-auto selection:bg-white selection:text-black min-h-screen font-sans">
      {/* Linha absoluta no topo - Exatamente como no conceito */}
      <div className="absolute top-15 left-0 w-full h-[150px] bg-black border-b border-white/10 flex items-center px-6">
        <h1 className="text-[50px] md:text-[80px] font-bold text-white tracking-tighter">OUR SERVICES</h1>
        <p className="absolute right-6 text-neutral-500 text-sm font-light">{companyName}<span className="align-top ml-0.5 text-neutral-600">&copy;</span></p>
      </div>

      {/* Margem para compensar o header absoluto */}
      <div className="mt-[150px]"></div>

      {/* Grid de Serviços - Exatamente como no conceito */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-l border-white/10">
        {services.map((service, index) => (
          <div key={index} className="p-10 md:p-16 border-b border-r border-white/10 flex flex-col items-start min-h-[400px]">
            <div className="text-6xl font-light mb-8 text-neutral-800 tracking-tight">{service.num}</div>
            <h3 className="text-3xl font-medium mb-6 text-white tracking-tight">{service.title}</h3>
            <p className="text-neutral-400 leading-relaxed font-light text-lg whitespace-pre-line max-w-xl">
              {service.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
