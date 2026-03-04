import React from 'react';
import { BriefcaseBusiness, FileText, Gavel, Home, KeyRound, Megaphone } from 'lucide-react';

const Services: React.FC = () => {
  const services = [
    {
      title: 'Intermediação de Venda',
      description: 'Assessoria completa do valuation à assinatura, com estratégia sob medida para cada perfil de imóvel.',
      icon: Home
    },
    {
      title: 'Gestão de Locação',
      description: 'Operação para temporada e contratos anuais, com triagem, vistoria e suporte contínuo.',
      icon: KeyRound
    },
    {
      title: 'Avaliação de Imóveis',
      description: 'Laudos técnicos e análise comparativa para decisões de compra, venda e investimento.',
      icon: FileText
    },
    {
      title: 'Consultoria Jurídica',
      description: 'Segurança contratual em cada etapa da negociação, com apoio especializado em documentação.',
      icon: Gavel
    },
    {
      title: 'Marketing Imobiliário',
      description: 'Fotos profissionais, tours virtuais e posicionamento premium para acelerar resultados.',
      icon: Megaphone
    }
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20 animate-fade-in">
      <div className="container mx-auto px-4">
        <section className="mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-100 text-slate-600 text-sm mb-4">
            <BriefcaseBusiness size={16} />
            Soluções Tr Imóveis
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 mb-4">Serviços Imobiliários Premium</h1>
          <p className="text-slate-600 text-lg max-w-3xl">
            Da prospecção ao pós-venda, entregamos uma jornada completa para proprietários, investidores e locatários.
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