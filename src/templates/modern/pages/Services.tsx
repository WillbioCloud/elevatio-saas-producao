import React from 'react';
import { BriefcaseBusiness, FileText, Gavel, Home, KeyRound, Megaphone } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { getTenantName } from '../tenantUtils';

const Services: React.FC = () => {
  const { tenant } = useTenant();
  const companyName = getTenantName(tenant);

  const services = [
    {
      title: 'Intermediação de Venda',
      description: 'Assessoria completa da avaliação à assinatura, com estratégia ajustada ao perfil do imóvel e do comprador.',
      icon: Home,
    },
    {
      title: 'Gestão de Locação',
      description: 'Suporte na divulgação, triagem de interessados, negociação e acompanhamento da jornada de locação.',
      icon: KeyRound,
    },
    {
      title: 'Avaliação de Imóveis',
      description: 'Levantamento técnico e análise comparativa para precificação com mais segurança comercial.',
      icon: FileText,
    },
    {
      title: 'Consultoria Documental',
      description: 'Orientação nas etapas contratuais e documentais para reduzir riscos e acelerar a negociação.',
      icon: Gavel,
    },
    {
      title: 'Marketing Imobiliário',
      description: 'Posicionamento digital, apresentação visual e campanhas para aumentar o alcance dos imóveis anunciados.',
      icon: Megaphone,
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20 animate-fade-in">
      <div className="container mx-auto px-4">
        <section className="mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-100 text-slate-600 text-sm mb-4">
            <BriefcaseBusiness size={16} />
            Soluções {companyName}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 mb-4">Serviços Imobiliários</h1>
          <p className="text-slate-600 text-lg max-w-3xl">
            Atuação estratégica para compra, venda, locação e posicionamento de imóveis com atendimento próximo e visão comercial.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <article key={service.title} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <service.icon className="text-slate-800" size={22} />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">{service.title}</h2>
              <p className="text-slate-600 leading-relaxed">{service.description}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default Services;
