import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icons } from '../../../components/Icons';
import { useTenant } from '../../../contexts/TenantContext';
import PartnersCarousel from '../../../components/PartnersCarousel';
import { supabase } from '../../../lib/supabase';

// ─── Hook: Animação de Contagem ───────────────────────────────
function useCounter(endValueStr: string, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [suffix, setSuffix] = useState('');
  
  useEffect(() => {
    // Separa o número do sufixo (ex: "49K" -> numero: 49, sufixo: "K")
    const match = String(endValueStr).match(/^([\d.,]+)(.*)$/);
    if (!match) {
      setSuffix(endValueStr);
      return;
    }
    
    const target = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(target)) {
      setSuffix(endValueStr);
      return;
    }
    
    setSuffix(match[2]);
    
    let startTime: number | null = null;
    let animationFrame: number;
    
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      const currentVal = Math.floor(target * easeOutQuart(progress));
      setCount(currentVal);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };
    
    animationFrame = requestAnimationFrame(step);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [endValueStr, duration]);

  return count + suffix;
}

// ─── Componente de Estatística Animada ────────────────────────
const AnimatedStat: React.FC<{ value: string, label: string }> = ({ value, label }) => {
  const animatedValue = useCounter(value);
  return (
    <div>
      <div className="text-5xl font-light mb-1 text-white">{animatedValue}</div>
      <div className="text-neutral-400 text-sm">{label}</div>
    </div>
  );
};

function useFeaturedProperties(companyId: string | undefined) {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    supabase
      .from('properties')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['Disponível', 'disponível', 'Ativo', 'ativo', 'available'])
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!data?.length) {
          supabase
            .from('properties')
            .select('*')
            .eq('company_id', companyId)
            .not('status', 'in', '("Vendido","Alugado")')
            .order('created_at', { ascending: false })
            .limit(3)
            .then(({ data: fallback }) => {
              setProperties(fallback ?? []);
              setLoading(false);
            });
        } else {
          setProperties(data);
          setLoading(false);
        }
      });
  }, [companyId]);

  return { properties, loading };
}

export default function LuxuryHome() {
  const { tenant } = useTenant();
  const siteData = typeof tenant?.site_data === 'string' 
    ? JSON.parse(tenant.site_data) 
    : tenant?.site_data || {};
  const { properties, loading } = useFeaturedProperties(tenant?.id);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const companyName = tenant?.name || 'ModHous';
  const heroTitle = siteData.hero_title || companyName;
  const heroSubtitle =
    siteData.hero_subtitle ||
    'Residências cuidadosamente projetadas que combinam conforto, estilo e vida urbana.';
  const heroImage =
    siteData.hero_image_url || 'https://res.cloudinary.com/dxplpg36m/image/upload/v1775143365/elite-prop-hmlP-v0vJ5o-unsplash_jkryxj.jpg';
  const aboutImage =
    siteData.about_image_url || 'https://picsum.photos/seed/architecture/1000/1200';

  const stats = [
    { num: siteData.stat_clients || '49K', label: 'Clientes Satisfeitos' },
    { num: siteData.stat_properties || '4K', label: 'Imóveis Vendidos' },
    { num: siteData.stat_years || '99%', label: 'Satisfação' },
  ];

  const defaultFaqs = [
    {
      q: 'Quanto tempo leva um processo de compra típico?',
      a: 'Dependendo do imóvel e da documentação, os processos geralmente variam de 15 a 45 dias.',
    },
    {
      q: 'Vocês trabalham com imóveis na planta ou em construção?',
      a: 'Sim! Desde lançamentos até imóveis prontos para morar, garantimos que cada projeto atenda aos nossos altos padrões.',
    },
    {
      q: 'Posso personalizar a busca para atender ao meu estilo de vida?',
      a: 'Absolutamente. Trabalhamos em estreita colaboração com você para encontrar propriedades que se adaptem perfeitamente a cada aspecto da sua rotina.',
    },
    {
      q: 'Qual é o processo para agendar uma visita?',
      a: 'Tudo começa com uma breve conversa com nossa equipe para entender sua visão, seguida de um agendamento nos melhores horários para você.',
    },
  ];

  const rawFaqs: any[] = siteData.faqs || defaultFaqs;
  const faqs = rawFaqs.map((f: any) => ({
    q: f.question || f.q || '',
    a: f.answer || f.a || '',
  }));

  return (
    <div className="pt-32 pb-20">
      <section className="px-6 max-w-[1400px] mx-auto mb-40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
          <div className="max-w-3xl">
            <h1 className="text-[15vw] md:text-[10rem] leading-[0.85] font-medium tracking-tighter mb-8 break-words">
              {heroTitle}
              <span className="text-xl align-top">&copy;</span>
            </h1>
            <p className="text-neutral-400 max-w-sm text-sm md:text-base leading-relaxed whitespace-pre-line">
              {heroSubtitle}
            </p>
            <div className="mt-10">
              <Link
                to="/imoveis"
                className="inline-flex items-center gap-3 bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-neutral-200 transition-colors"
              >
                Ver Imóveis
                <div className="bg-black text-white rounded-full p-1">
                  <Icons.ArrowUpRight className="w-3 h-3" />
                </div>
              </Link>
            </div>
          </div>

          <div className="hidden md:flex flex-col gap-10 text-right mt-12 md:mt-0 z-10">
            {stats.map((stat, i) => (
              <AnimatedStat key={i} value={stat.num} label={stat.label} />
            ))}
          </div>
        </div>

        <div className="relative w-full h-[60vh] md:h-[75vh] rounded-[2rem] overflow-hidden">
          <img
            src={heroImage}
            alt="Luxury Home"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      <section className="px-6 max-w-[1400px] mx-auto mb-40">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12">
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight">Nossos Projetos</h2>
          <p className="text-neutral-400 max-w-xs text-sm mt-4 md:mt-0">
            Uma seleção criteriosa de espaços residenciais desenhados com clareza e propósito.
          </p>
        </div>

        {loading ? (
          <div className="text-neutral-500 text-sm">Carregando portfólio...</div>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {properties.map((property) => (
              <Link
                to={`/imovel/${property.slug || property.id}`}
                key={property.id}
                className="group cursor-pointer block"
              >
                <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden mb-6 bg-neutral-900 border border-white/5">
                  {property.images?.[0] ? (
                    <img
                      src={property.images[0]}
                      alt={property.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-800">
                      <Icons.Home size={48} strokeWidth={1} />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-medium mb-4 line-clamp-1">{property.title}</h3>
                <div className="space-y-2 text-sm text-neutral-400">
                  <div className="flex items-center gap-2 line-clamp-1">
                    <Icons.MapPin className="w-4 h-4 flex-shrink-0" /> {property.neighborhood},{' '}
                    {property.city}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icons.Users className="w-4 h-4 flex-shrink-0" /> {property.bedrooms}{' '}
                    Quartos
                  </div>
                  <div className="flex items-center gap-2">
                    <Icons.Maximize className="w-4 h-4 flex-shrink-0" /> {property.area} m²
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-neutral-500 text-sm p-8 bg-[#111] rounded-[2rem] border border-white/5 text-center">
            Nenhum imóvel listado no momento.
          </div>
        )}
      </section>

      <section className="px-6 max-w-[1400px] mx-auto mb-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative h-[600px] rounded-[2rem] overflow-hidden p-8 flex items-start bg-neutral-900">
            <img
              src= 'https://images.unsplash.com/photo-1448630360428-65456885c650?q=80&w=1167&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
              alt="Architecture"
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
            <div className="relative z-10 bg-white text-black px-6 py-3 rounded-full text-sm font-medium">
              Por que escolher a {companyName}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: 'Curadoria Cuidadosa',
                desc: 'Não listamos tudo — apenas residências que atendem aos nossos altos padrões de design, localização e habitabilidade. Cada imóvel é minuciosamente revisado antes de chegar à nossa plataforma.',
              },
              {
                title: 'Perspectiva Direcionada',
                desc: 'Nossa experiência nos permite avaliar lares muito além do preço — com foco profundo no espaço, luz, materiais e no valor real a longo prazo.',
              },
              {
                title: 'Expertise Local Confiável',
                desc: 'Com conhecimento profundo dos mercados e bairros, oferecemos orientação honesta respaldada por dados reais e experiência prática diária.',
              },
              {
                title: 'Experiência Fluida e Transparente',
                desc: 'Cuidamos de toda a burocracia para que você tenha uma jornada tranquila do início ao fim, sem surpresas ocultas ou letras miúdas.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-[#111111] p-8 rounded-[2rem] flex flex-col justify-between h-[290px] border border-transparent hover:border-white/5 transition-colors"
              >
                <h3 className="text-xl font-medium leading-tight">{feature.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 max-w-[1400px] mx-auto mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <h2 className="text-[6rem] md:text-[8rem] leading-none font-light tracking-tighter">
              FAQ
            </h2>
          </div>
          <div className="lg:col-span-8 flex flex-col justify-center">
            <div className="space-y-4">
              {faqs.map((faq, i) => {
                const isActive = openFaq === i;
                return (
                  <div
                    key={i}
                    onClick={() => setOpenFaq(isActive ? null : i)}
                    className={`p-8 rounded-[1.5rem] transition-colors cursor-pointer border border-white/5 ${
                      isActive ? 'bg-[#111111]' : 'hover:bg-[#111111]/50'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-6">
                      <h3 className="text-xl md:text-2xl font-light">{faq.q}</h3>
                      <Icons.ChevronDown
                        className={`w-6 h-6 transition-transform flex-shrink-0 ${
                          isActive ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    {isActive && (
                      <div className="mt-8 text-right text-neutral-400 text-sm max-w-md ml-auto leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {/* Carrossel de Parcerias */}
      {siteData.show_partnerships !== false && siteData.partners && siteData.partners.length > 0 && (
        <PartnersCarousel partners={siteData.partners} />
      )}
    </div>
  );
}
