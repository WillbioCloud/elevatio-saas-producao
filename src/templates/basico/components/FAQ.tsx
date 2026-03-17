import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';

const faqs = [
  { q: 'Como funciona o processo de compra de um imóvel?', a: 'Nosso processo é simples: você escolhe o imóvel, nossa equipe cuida de toda a documentação, negociação e acompanhamento até a entrega das chaves.' },
  { q: 'Vocês trabalham com financiamento?', a: 'Sim! Temos parceria com os principais bancos e podemos simular as melhores condições de financiamento para o seu perfil.' },
  { q: 'Qual o prazo médio para vender um imóvel?', a: 'Com nossa estratégia de marketing digital e carteira de clientes qualificados, o prazo médio é de 30 a 90 dias.' },
  { q: 'Vocês cobram alguma taxa para visitar imóveis?', a: 'Não. As visitas são totalmente gratuitas e sem compromisso. Nossa comissão é paga apenas na conclusão do negócio.' },
  { q: 'Como funciona a gestão de aluguel?', a: 'Cuidamos de tudo: divulgação, seleção de inquilinos, contratos, cobranças e manutenção. Você recebe o aluguel sem preocupações.' },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const { tenant } = useTenant();
  const siteData = tenant?.site_data as any;
  const primaryColor = siteData?.primary_color || '#b08d5e';

  return (
    <section className="py-24 bg-[#0e0e0e]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
            <p className="text-xs tracking-[0.4em] uppercase font-medium" style={{ color: primaryColor }}>FAQ</p>
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-bold">Perguntas Frequentes</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/8 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left gap-4"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-white font-medium text-sm">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className="flex-shrink-0 transition-transform duration-300"
                  style={{
                    color: primaryColor,
                    transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-6">
                  <p className="text-white/40 text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
