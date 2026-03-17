import React from 'react';
import { Building2, Gem, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20 animate-fade-in">
      <div className="container mx-auto px-4 space-y-10 md:space-y-14">
        <section className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 md:p-14">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400 mb-3">Sobre a Tr Imóveis</p>
          <h1 className="text-4xl md:text-6xl font-serif font-semibold text-slate-900 mb-6">Nossa História</h1>
          <p className="text-slate-600 text-lg leading-relaxed max-w-4xl">
            A Tr Imóveis nasceu em Caldas Novas para atender um público que busca mais do que metragem: busca estilo de vida.
            Unimos inteligência de mercado, curadoria de alto padrão e atendimento próximo para conectar famílias e
            investidores aos endereços mais desejados da região.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Missão',
              text: 'Criar experiências imobiliárias exclusivas com transparência, elegância e foco total no cliente.',
              icon: Target
            },
            {
              title: 'Visão',
              text: 'Ser a referência em imóveis de luxo em Caldas Novas e nos principais destinos do Centro-Oeste.',
              icon: Gem
            },
            {
              title: 'Valores',
              text: 'Excelência, ética, discrição, inovação e compromisso com resultados duradouros.',
              icon: ShieldCheck
            }
          ].map((item) => (
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
            <h2 className="text-3xl font-serif font-semibold text-slate-900">Nossa Equipe</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Kalil Pires', role: 'Especialista em Alto Padrão', icon: Sparkles },
              { name: 'Ibrahim Alhana', role: 'Consultor de Investimentos', icon: Building2 },
              { name: 'Larissa Pires', role: 'Gestora de Relacionamento', icon: Users }
            ].map((member) => (
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