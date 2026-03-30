import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

export default function LuxuryAbout() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};

  const companyName = tenant?.name || 'ModHous';
  const aboutTitle =
    siteData.about_title || 'Redefinindo o padrão do mercado imobiliário do padrão acima do comum.';
  const aboutText =
    siteData.about_text ||
    `${companyName} é uma agência imobiliária boutique especializada em propriedades arquitetonicamente significativas. Acreditamos que um lar é mais do que um espaço físico — é a expressão da sua identidade e a base do seu estilo de vida.`;
  const aboutImage =
    siteData.about_image_url || 'https://picsum.photos/seed/about/1920/1080';

  const pillars = [
    {
      num: '01',
      title: 'Curadoria',
      desc:
        siteData.mission ||
        'Não listamos qualquer imóvel. Nosso portfólio é estritamente selecionado para incluir apenas propriedades que atendem aos nossos rigorosos padrões de design, localização e qualidade.',
    },
    {
      num: '02',
      title: 'Discrição',
      desc:
        siteData.vision ||
        'Compreendemos o valor da privacidade. Nossa rede off-market nos permite conectar compradores e vendedores com absoluta confidencialidade e segurança.',
    },
    {
      num: '03',
      title: 'Excelência',
      desc:
        siteData.values ||
        'Nossa equipe é formada por profissionais com sólida experiência em arquitetura, design e finanças. E sabemos que o ambiente é tão importante quanto o imóvel em si.',
    },
  ];

  return (
    <div className="pt-32 pb-20 px-6 max-w-[1400px] mx-auto selection:bg-white selection:text-black">
      <div className="max-w-4xl mb-24">
        <h1 className="text-5xl md:text-7xl font-medium tracking-tight mb-8 leading-[1.1]">
          {aboutTitle}
        </h1>
        <p className="text-xl md:text-2xl text-neutral-400 leading-relaxed font-light whitespace-pre-line">
          {aboutText}
        </p>
      </div>

      <div className="relative w-full h-[50vh] md:h-[70vh] rounded-[2rem] overflow-hidden mb-32 bg-neutral-900 border border-white/5">
        <img
          src={aboutImage}
          alt={`Sobre a ${companyName}`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-32">
        {pillars.map((pillar, index) => (
          <div key={index}>
            <div className="text-6xl font-light mb-6 text-neutral-700">{pillar.num}</div>
            <h3 className="text-2xl font-medium mb-4">{pillar.title}</h3>
            <p className="text-neutral-400 leading-relaxed">{pillar.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
