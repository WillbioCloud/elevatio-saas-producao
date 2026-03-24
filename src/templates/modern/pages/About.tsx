import React from 'react';
import { Building2, Gem, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { getAboutText, getTenantName } from '../tenantUtils';

const About: React.FC = () => {
  const { tenant } = useTenant();
  const companyName = getTenantName(tenant);
  const aboutText = getAboutText(tenant);

  const pillars = [
    {
      title: 'Missão',
      text: `Oferecer uma experiência imobiliária consultiva, transparente e eficiente para cada cliente de ${companyName}.`,
      icon: Target,
    },
    {
      title: 'Visão',
      text: 'Ser lembrada como uma imobiliária confiável, atual e preparada para atender diferentes perfis de compra e locação.',
      icon: Gem,
    },
    {
      title: 'Valores',
      text: 'Ética, proximidade, clareza nas negociações e compromisso com bons resultados para todas as partes.',
      icon: ShieldCheck,
    },
  ];

  const teamHighlights = [
    { name: 'Especialista Comercial', role: 'Atendimento consultivo', icon: Sparkles },
    { name: 'Consultoria de Investimento', role: 'Análise de oportunidades', icon: Building2 },
    { name: 'Relacionamento com Clientes', role: 'Acompanhamento próximo', icon: Users },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20 animate-fade-in">
      <div className="container mx-auto px-4 space-y-10 md:space-y-14">
        <section className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 md:p-14">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400 mb-3">Sobre {companyName}</p>
          <h1 className="text-4xl md:text-6xl font-serif font-semibold text-slate-900 mb-6">Nossa História</h1>
          <p className="text-slate-600 text-lg leading-relaxed max-w-4xl whitespace-pre-line">
            {aboutText}
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((item) => (
            <article key={item.title} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm">
              <item.icon className="text-slate-900 mb-4" size={28} />
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">{item.title}</h2>
              <p className="text-slate-600 leading-relaxed">{item.text}</p>
            </article>
          ))}
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <Users className="text-slate-900" size={24} />
            <h2 className="text-3xl font-serif font-semibold text-slate-900">Como Atuamos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teamHighlights.map((member) => (
              <article key={member.name} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <member.icon className="text-slate-700" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{member.name}</h3>
                <p className="text-slate-500 mt-1">{member.role}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
