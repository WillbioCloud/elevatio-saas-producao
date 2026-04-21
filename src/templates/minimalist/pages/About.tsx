import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';

export default function About() {
  const { tenant } = useTenant();
  const siteData = React.useMemo(() => {
    if (typeof tenant?.site_data === 'string') {
      try {
        return JSON.parse(tenant.site_data);
      } catch {
        return {};
      }
    }
    return tenant?.site_data || {};
  }, [tenant?.site_data]);

  // If there's tenant specific text, use it. Otherwise use realistic placeholder
  const aboutText = siteData?.about_text || siteData?.aboutText || 
    `Acreditamos que o alto padrão não se resume a metros quadrados ou acabamentos caros, mas sim à experiência de viver bem e com tranquilidade. Nascemos com o propósito de descomplicar o mercado imobiliário premium, reduzindo o complexo ao essencial. \n\nNossa curadoria é minuciosa: não vendemos qualquer imóvel, selecionamos lares e oportunidades de investimento que façam sentido para o seu momento de vida. \n\nTransparência, discrição e agilidade são os pilares que sustentam nossas relações. Porque para nós, cada chave entregue é um novo capítulo sendo escrito.`;

  const aboutParagraphs = aboutText.split('\n').filter(p => p.trim() !== '');

  const stats = [
    { value: '15+', label: 'Anos no mercado' },
    { value: '2.5B', label: 'VGV Intermediado' },
    { value: '100%', label: 'Discrição garantida' },
    { value: '450+', label: 'Famílias atendidas' },
  ];

  return (
    <div className="animate-fade-in bg-[#fcfcfc] min-h-screen pt-4 md:pt-12 pb-16 md:pb-24">
      <div className="max-w-[1024px] mx-auto px-4 md:px-8">
        
        {/* Hero Image Block */}
        <div className="w-full h-[40vh] md:h-[60vh] bg-slate-100 rounded-[2.5rem] overflow-hidden mb-16 relative">
          <img 
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80" 
            alt="Nosso escritório" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="text-center text-white px-4">
                <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest block mb-4 backdrop-blur-md bg-black/20 w-max mx-auto px-3 py-1.5 rounded-full">Manifesto</span>
                <h1 className="text-4xl md:text-6xl font-light tracking-tight">
                  Simplicidade é a<br/>maior sofisticação.
                </h1>
             </div>
          </div>
        </div>

        {/* Content Structure */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-24">
          
          {/* Left Column - Fixed Label */}
          <div className="md:col-span-4">
            <div className="sticky top-28">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-6">Nossa História</span>
              <h2 className="text-2xl md:text-3xl font-light tracking-tight text-slate-900 mb-4">
                Redefinindo o mercado de <span className="font-medium">alto padrão.</span>
              </h2>
            </div>
          </div>

          {/* Right Column - Text & Stats */}
          <div className="md:col-span-8">
            <div className="prose prose-slate prose-base md:prose-lg font-light text-slate-600 mb-12 md:mb-16 max-w-none">
              {aboutParagraphs.map((paragraph, index) => (
                <p key={index} className="mb-6 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Stats Bento */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white border border-slate-100 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-light tracking-tight text-slate-900 mb-2">{stat.value}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
