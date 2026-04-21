import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { Search, Shield, TrendingUp, Handshake, ChevronRight, PenTool, Key } from 'lucide-react';
import { getWhatsappLink } from '../../../utils/tenantUtils';

export default function Services() {
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

  const services = [
    {
      id: 1,
      title: 'Consultoria Especializada',
      description: 'Entendemos seu estilo de vida e objetivos para realizar uma curadoria precisa de imóveis que superem suas expectativas.',
      icon: Search,
    },
    {
      id: 2,
      title: 'Inteligência de Mercado',
      description: 'Análises detalhadas de rentabilidade, valorização e tendências das melhores regiões e condomínios de alto padrão.',
      icon: TrendingUp,
    },
    {
      id: 3,
      title: 'Segurança Jurídica',
      description: 'Equipe especializada acompanhando cada etapa do contrato para garantir uma transação blindada e sem imprevistos.',
      icon: Shield,
    },
    {
      id: 4,
      title: 'Assessoria de Financiamento',
      description: 'Parcerias estratégicas com as principais instituições financeiras para aprovação ágil e as melhores taxas do mercado.',
      icon: PenTool,
    },
    {
      id: 5,
      title: 'Gestão de Propriedades',
      description: 'Administração patrimonial completa para investidores, otimizando rendimentos e garantindo a conservação do imóvel.',
      icon: Key,
    },
    {
      id: 6,
      title: 'Concierge Imobiliário',
      description: 'Atendimento premium que vai além da chave: suporte com mudanças, reformas, arquitetos e ambientação.',
      icon: Handshake,
    }
  ];

  const fallbackMessage = encodeURIComponent('Olá, gostaria de saber mais sobre os serviços.');
  const fallbackPhone = (siteData?.whatsapp || siteData?.contact?.phone || '').replace(/\D/g, '');
  const wpLink = getWhatsappLink(tenant, 'Olá, gostaria de saber mais sobre os serviços.') || (fallbackPhone ? `https://wa.me/${fallbackPhone}?text=${fallbackMessage}` : `https://wa.me/?text=${fallbackMessage}`);

  return (
    <div className="animate-fade-in bg-[#fcfcfc] min-h-screen pt-4 md:pt-12 pb-16 md:pb-24">
      <div className="max-w-[1024px] mx-auto px-4 md:px-8">
        
        {/* Header */}
        <div className="mb-12 md:mb-24 mt-8 md:mt-16 text-center max-w-2xl mx-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Nossa Expertise</span>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 mb-6">
            Muito além da <br className="hidden md:block" /> intermediação.
          </h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">
            Entregamos soluções completas e exclusivas para que sua experiência imobiliária seja ágil, segura e totalmente livre de atritos.
          </p>
        </div>

        {/* Services Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div 
                key={service.id} 
                className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow group cursor-default"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
                  <Icon size={20} className="text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-900 mb-3">{service.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA Block */}
        <div className="bg-black text-white rounded-[2.5rem] p-8 md:p-16 flex flex-col items-center text-center">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Atendimento Exclusivo</span>
           <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-8">
             Como podemos ajudar no seu próximo passo?
           </h2>
           <a 
             href={wpLink}
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full text-sm font-bold transition-transform hover:scale-105"
           >
             Falar com nossos especialistas
             <ChevronRight size={16} />
           </a>
        </div>

      </div>
    </div>
  );
}
