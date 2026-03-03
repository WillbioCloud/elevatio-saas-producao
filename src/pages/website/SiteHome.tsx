import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { 
  Menu, X, ArrowRight, Kanban, Target, Bot, Zap, 
  Check, FileSignature, Headset, Info, Twitter, Instagram, Linkedin, Minus
} from 'lucide-react';


gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [activeTab, setActiveTab] = useState('show-p3');

  const heroWords = ['O', 'Futuro', 'da', 'Gestão', 'Imobiliária', 'é'];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.reveal-up').forEach((elem) => {
        gsap.fromTo(
          elem,
          { y: 50, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: elem,
              start: 'top 85%',
            },
          },
        );
      });

      gsap.fromTo(
        '.hero-word',
        { y: 60, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 1.1,
          ease: 'power4.out',
          stagger: 0.09,
          delay: 0.15,
        },
      );

      gsap.set('.pricing-card', { autoAlpha: 1 });
      gsap.fromTo(
        '.pricing-card',
        { y: 45, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.85,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#pricing-grid',
            start: 'top 80%',
            once: true,
          },
        },
      );

      gsap.fromTo(
        '#pro-glow',
        { scale: 0.95, autoAlpha: 0.45 },
        {
          scale: 1.06,
          autoAlpha: 0.85,
          duration: 2.3,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        },
      );
    }, mainRef);

    return () => ctx.revert();
  }, []);

  // Preços
  const prices = {
    starter: isAnnual ? "46,65" : "54,90",
    basic: isAnnual ? "63,65" : "74,90",
    pro: isAnnual ? "101,90" : "119,90",
    business: isAnnual ? "152,90" : "179,90",
    premium: isAnnual ? "212,40" : "249,90",
    elite: isAnnual ? "297,40" : "349,90",
  };

  // MODIFICAÇÃO CRÍTICA: Navega para /registro (não /login) passando o plano
  const handleStart = (planName: string) => navigate('/registro', { state: { plan: planName } });

  return (
    <div ref={mainRef} className="bg-[#050505] text-white min-h-screen font-sans selection:bg-brand-500 selection:text-white">
      
      {/* Navbar */}
      <nav className="fixed w-full z-50 glass-nav transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 relative z-50">
            {/* Certifique-se de que a logo está na pasta public/logo/ */}
            <img src="/logo/logo.png" alt="Logo Elevatio Vendas" className="h-10 md:h-12 w-auto object-contain" />
            <span className="font-bold text-xl md:text-2xl tracking-tight">Elevatio<span className="text-brand-500"> Vendas</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planos</a>
            <a href="#compare-plans" className="hover:text-white transition-colors">Comparação</a>
          </div>
          
          <button onClick={ () => handleStart("starter")} className="hidden md:block bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors">
            Começar Agora
          </button>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white p-2 relative z-50">
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`fixed inset-0 bg-[#050505]/95 backdrop-blur-lg flex flex-col items-center justify-center gap-8 text-lg font-medium transition-all duration-300 z-40 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <a href="#features" onClick={() => setIsMenuOpen(false)} className="hover:text-brand-500 transition-colors">Recursos</a>
          <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="hover:text-brand-500 transition-colors">Planos</a>
          <a href="#compare-plans" onClick={() => setIsMenuOpen(false)} className="hover:text-brand-500 transition-colors">Comparação</a>
          <button onClick={ () => handleStart("starter")} className="bg-brand-600 text-white px-8 py-3 rounded-full text-sm font-bold mt-4 shadow-lg shadow-brand-500/20">
            Começar Agora
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 flex flex-col items-center text-center min-h-screen justify-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        
        <img src="/logo/LogoText.png" alt="Elevatio Vendas" className="h-18 md:h-24 w-auto object-contain mb-8 reveal-up" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-brand-400 mb-8 reveal-up">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
          Plataforma SaaS + CRM Imobiliário
        </div>
        
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter max-w-4xl mb-6 leading-[1.1]" aria-label="O Futuro da Gestão Imobiliária é Inteligente">
          {heroWords.map((word) => (
            <span key={word} className="hero-word inline-block mr-3 opacity-0">
              {word}
            </span>
          ))}
          <span className="hero-word gradient-text inline-block opacity-0">Inteligente</span>
        </h1>
        
        <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mb-10 reveal-up px-4">
          Escale suas vendas com um CRM poderoso, gamificação para corretores e IA de atendimento. Tudo em uma plataforma ultra-rápida.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 reveal-up">
          <a href="#pricing" className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-4 rounded-full font-semibold transition-all flex items-center gap-2">
            Ver Planos <ArrowRight className="w-4 h-4" />
          </a>
          <a href="#contact" className="px-8 py-4 rounded-full font-semibold border border-white/10 hover:bg-white/5 transition-all flex items-center gap-2">
            Falar com Consultor
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Diferenciais <span className="gradient-text">Exclusivos</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Tecnologia de ponta para otimizar cada etapa do seu funil de vendas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-gradient p-8 reveal-up">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-6 text-brand-400">
                <Kanban className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">CRM Inteligente</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Gestão de Leads com Kanban e histórico completo. Totalmente integrado ao Supabase para dados em tempo real e segurança máxima.</p>
            </div>
            
            <div className="border-gradient p-8 reveal-up">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-6 text-brand-400">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Sistema de Gamificação</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Recompensas e métricas dinâmicas para corretores. Aumente a produtividade da sua equipe transformando metas em conquistas.</p>
            </div>

            <div className="border-gradient p-8 reveal-up">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-6 text-brand-400">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">IA de Atendimento</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Assistente inteligente para triagem de leads 24/7. Qualifique contatos automaticamente antes mesmo de chegarem ao corretor.</p>
            </div>

            <div className="border-gradient p-8 reveal-up">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-6 text-brand-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Performance Ultra-Rápida</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Construído com React, TypeScript e Tailwind. Experiência fluida e carregamento instantâneo para não perder nenhuma venda.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 relative bg-[#111111]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Planos Feitos para <span className="gradient-text">Escalar Suas Vendas</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto mb-8">Escolha a flexibilidade ideal para o seu momento. Mais inteligência e gestão imobiliária completa em qualquer nível.</p>
            
            <div className="flex items-center justify-center gap-4 font-mono text-sm reveal-up">
              <span className={!isAnnual ? "text-white" : "text-gray-500"}>Mensal</span>
              <button 
                onClick={() => setIsAnnual(!isAnnual)} 
                className="w-14 h-7 bg-brand-600 rounded-full relative transition-colors focus:outline-none cursor-pointer"
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isAnnual ? 'translate-x-[28px]' : 'translate-x-1'}`}></div>
              </button>
              <span className={isAnnual ? "text-white" : "text-gray-500"}>Anual <span className="text-brand-400 text-xs ml-1">-15%</span></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="pricing-grid">
            
            {/* Starter */}
            <div className="border-gradient pricing-card p-6 flex flex-col">
              <div className="text-brand-400 font-mono text-xs mb-2 uppercase tracking-wider">🥉 Starter</div>
              <div className="text-3xl font-bold mb-2">R$ <span>{prices.starter}</span><span className="text-sm text-gray-500 font-normal">/mês</span></div>
              <p className="text-gray-400 text-sm mb-6 border-b border-white/10 pb-4">Melhor que o "Básico" do mercado.</p>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">50</strong> Imóveis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">40</strong> Fotos por imóvel</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">2</strong> Usuários do Sistema</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">50</strong> Descrições com IA</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Site Premium Exclusivo</li>
              </ul>
              <button onClick={() => handleStart("starter")} className="w-full py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-medium cursor-pointer">Começar Starter</button>
            </div>

            {/* Basic */}
            <div className="border-gradient pricing-card p-6 flex flex-col">
              <div className="text-brand-400 font-mono text-xs mb-2 uppercase tracking-wider">🥈 Basic</div>
              <div className="text-3xl font-bold mb-2">R$ <span>{prices.basic}</span><span className="text-sm text-gray-500 font-normal">/mês</span></div>
              <p className="text-gray-400 text-sm mb-6 border-b border-white/10 pb-4">A verdadeira evolução começa aqui.</p>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">400</strong> Imóveis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">60</strong> Fotos por imóvel</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">5</strong> Usuários do Sistema</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">200</strong> Descrições com IA</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> CRM Kanban Integrado</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Esteira de Leads</li>
              </ul>
              <button onClick={() => handleStart("basic")} className="w-full py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-medium cursor-pointer">Começar Basic</button>
            </div>

            {/* Profissional */}
            <div className="relative transform lg:scale-105 z-10">
              <div id="pro-glow" className="glow-effect absolute -inset-3 rounded-[1.2rem] pointer-events-none -z-10" aria-hidden="true" />
              <div className="border-gradient highlight-card pricing-card p-6 flex flex-col relative" id="pro-card">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Mais Popular</div>
              <div className="text-brand-400 font-mono text-xs mb-2 uppercase tracking-wider">⭐ Profissional</div>
              <div className="text-3xl font-bold mb-2">R$ <span>{prices.pro}</span><span className="text-sm text-gray-500 font-normal">/mês</span></div>
              <p className="text-gray-400 text-sm mb-6 border-b border-white/10 pb-4">Engajamento e domínio de mercado.</p>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">1.000</strong> Imóveis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Fotos <strong className="text-white">Ilimitadas</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">8</strong> Usuários do Sistema</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">600</strong> Descrições com IA</li>
                <li className="flex items-start gap-2"><Target className="w-4 h-4 text-yellow-400 mt-1 shrink-0" /> <span className="text-white font-medium">Módulo de Gamificação<br/><span className="text-xs text-brand-400 font-normal">Motive sua equipe</span></span></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Domínio Grátis (1º ano)</li>
              </ul>
                <button onClick={() => handleStart("professional")} className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-colors font-medium cursor-pointer shadow-lg shadow-brand-500/20">Assinar Profissional</button>
              </div>
            </div>

            {/* Business */}
            <div className="border-gradient pricing-card p-6 flex flex-col">
              <div className="text-brand-400 font-mono text-xs mb-2 uppercase tracking-wider">💼 Business</div>
              <div className="text-3xl font-bold mb-2">R$ <span>{prices.business}</span><span className="text-sm text-gray-500 font-normal">/mês</span></div>
              <p className="text-gray-400 text-sm mb-6 border-b border-white/10 pb-4">Para quem leva a gestão a sério.</p>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">2.000</strong> Imóveis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">12</strong> Usuários do Sistema</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">1.000</strong> Descrições com IA</li>
                <li className="flex items-start gap-2"><FileSignature className="w-4 h-4 text-green-400 mt-1 shrink-0" /> <span className="text-white font-medium">Contratos e Finanças<br/><span className="text-xs text-gray-400 font-normal">Gestão completa</span></span></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Dashboard Financeiro</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Automação E-mail/WhatsApp</li>
              </ul>
              <button onClick={() => handleStart("business")} className="w-full py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-medium cursor-pointer">Assinar Business</button>
            </div>

            {/* Premium */}
            <div className="border-gradient pricing-card p-6 flex flex-col">
              <div className="text-brand-400 font-mono text-xs mb-2 uppercase tracking-wider">🚀 Premium</div>
              <div className="text-3xl font-bold mb-2">R$ <span>{prices.premium}</span><span className="text-sm text-gray-500 font-normal">/mês</span></div>
              <p className="text-gray-400 text-sm mb-6 border-b border-white/10 pb-4">Performance máxima e IA avançada.</p>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">3.500</strong> Imóveis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">20</strong> Usuários do Sistema</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> <strong className="text-white">1.450</strong> Descrições com IA</li>
                <li className="flex items-start gap-2"><Bot className="w-4 h-4 text-purple-400 mt-1 shrink-0" /> <span className="text-white font-medium">IA Aura Liberada<br/><span className="text-xs text-gray-400 font-normal">Atendimento 24/7 de Leads</span></span></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Módulo de Contratos Completo</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> API de Integração Avançada</li>
              </ul>
              <button onClick={() => handleStart("premium")} className="w-full py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-medium cursor-pointer">Assinar Premium</button>
            </div>

            {/* Elite */}
            <div className="border-gradient pricing-card p-6 flex flex-col">
              <div className="text-brand-400 font-mono text-xs mb-2 uppercase tracking-wider">👑 Elite</div>
              <div className="text-3xl font-bold mb-2">R$ <span>{prices.elite}</span><span className="text-sm text-gray-500 font-normal">/mês</span></div>
              <p className="text-gray-400 text-sm mb-6 border-b border-white/10 pb-4">O pacote definitivo sem limitações.</p>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Imóveis <strong className="text-white">Ilimitados</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Usuários <strong className="text-white">Ilimitados</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> IA Descrições <strong className="text-white">Ilimitadas</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> IA Aura Prioritária</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-500" /> Contratos, Finanças e Gamificação</li>
                <li className="flex items-start gap-2"><Headset className="w-4 h-4 text-brand-500 mt-1 shrink-0" /> <span className="text-white font-medium">Suporte VIP 24h<br/><span className="text-xs text-gray-400 font-normal">Atendimento no WhatsApp</span></span></li>
              </ul>
              <button onClick={() => handleStart("elite")} className="w-full py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-medium cursor-pointer">Assinar Elite</button>
            </div>

          </div>
          
          <div className="mt-12 text-center reveal-up">
            <p className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-xl p-4 inline-block max-w-3xl shadow-lg">
              <span className="text-brand-400 font-bold flex items-center justify-center gap-2 mb-1"><Info className="w-4 h-4" /> Importante</span> 
              O registro de domínio personalizado (ex: <span className="font-mono text-gray-300">suaimobiliaria.com.br</span>) não está incluso nos planos <strong>Starter</strong> e <strong>Basic</strong>, possuindo um custo adicional. Para garantir a isenção dessa taxa no primeiro ano, opte pelo plano <strong className="text-brand-400">Profissional</strong> ou superior!
            </p>
          </div>
        </div>
      </section>

      {/* Compare Plans */}
      <section id="compare-plans" className="py-24 px-6 relative border-t border-white/5 bg-[#050505]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Compare os <span className="gradient-text">Planos em Detalhes</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Veja linha por linha por que oferecemos a tecnologia mais avançada e o melhor custo-benefício do mercado imobiliário.</p>
          </div>

          <div className="flex lg:hidden overflow-x-auto gap-3 pb-4 mb-6 custom-scrollbar snap-x reveal-up">
            {[
              { id: 'show-p1', label: 'Starter' },
              { id: 'show-p2', label: 'Basic' },
              { id: 'show-p3', label: 'Profissional' },
              { id: 'show-p4', label: 'Business' },
              { id: 'show-p5', label: 'Premium' },
              { id: 'show-p6', label: 'Elite' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`snap-start shrink-0 px-5 py-2.5 rounded-xl font-bold border transition-colors relative ${activeTab === tab.id ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-500/20' : 'bg-white/5 border-white/10 text-gray-400'}`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500 border border-black"></span>
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto xl:overflow-visible reveal-up pb-8 custom-scrollbar">
            <table className={`w-full text-left border-collapse min-w-full lg:min-w-[1000px] mobile-compare-table transition-all duration-300 ${activeTab}`}>
              <thead>
                <tr>
                  <th className="p-4 bg-[#050505] sticky top-20 left-0 z-40 w-[25%] border-b border-white/10 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]"></th>
                  
                  <th className="p-4 bg-[#050505] sticky top-20 z-30 text-center font-mono border-b border-white/10 w-[12.5%] min-w-[140px] shadow-sm">
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Starter</div>
                    <div className="text-xl font-bold text-white leading-tight">R$ <span>{prices.starter}</span></div>
                  </th>
                  
                  <th className="p-4 bg-[#050505] sticky top-20 z-30 text-center font-mono border-b border-white/10 w-[12.5%] min-w-[140px] shadow-sm">
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Basic</div>
                    <div className="text-xl font-bold text-white leading-tight">R$ <span>{prices.basic}</span></div>
                  </th>
                  
                  <th className="p-4 bg-[#110a1f] sticky top-20 z-30 text-center font-mono border-b border-brand-500/30 w-[12.5%] min-w-[140px] relative shadow-sm">
                    <span className="bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap mb-2 inline-block">
                      DESTAQUE
                    </span>
                    <div className="text-xs uppercase tracking-wider text-brand-400 mb-1">Profissional</div>
                    <div className="text-xl font-bold text-white leading-tight">R$ <span>{prices.pro}</span></div>
                  </th>
                  
                  <th className="p-4 bg-[#050505] sticky top-20 z-30 text-center font-mono border-b border-white/10 w-[12.5%] min-w-[140px] shadow-sm">
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Business</div>
                    <div className="text-xl font-bold text-white leading-tight">R$ <span>{prices.business}</span></div>
                  </th>
                  
                  <th className="p-4 bg-[#050505] sticky top-20 z-30 text-center font-mono border-b border-white/10 w-[12.5%] min-w-[140px] shadow-sm">
                    <div className="text-xs uppercase tracking-wider text-purple-400 mb-1">Premium</div>
                    <div className="text-xl font-bold text-white leading-tight">R$ <span>{prices.premium}</span></div>
                  </th>
                  
                  <th className="p-4 bg-[#050505] sticky top-20 z-30 text-center font-mono border-b border-white/10 w-[12.5%] min-w-[140px] shadow-sm">
                    <div className="text-xs uppercase tracking-wider text-yellow-500 mb-1">Elite</div>
                    <div className="text-xl font-bold text-white leading-tight">R$ <span>{prices.elite}</span></div>
                  </th>
                </tr>
              </thead>

              <tbody className="text-sm text-gray-300">
                <tr className="bg-white/[0.02]">
                  <td colSpan={7} className="p-3 font-semibold text-white text-xs uppercase tracking-widest sticky left-0 bg-[#0a0a0a] border-y border-white/10">Recursos Principais</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">Limite de Imóveis</td>
                  <td className="p-4 text-center">50</td>
                  <td className="p-4 text-center">400</td>
                  <td className="p-4 text-center bg-brand-500/5 font-semibold text-white">1.000</td>
                  <td className="p-4 text-center">2.000</td>
                  <td className="p-4 text-center">3.500</td>
                  <td className="p-4 text-center font-bold text-brand-400">Ilimitado</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">Fotos por Imóvel</td>
                  <td className="p-4 text-center">40</td>
                  <td className="p-4 text-center">60</td>
                  <td className="p-4 text-center bg-brand-500/5 font-semibold text-white">Ilimitado</td>
                  <td className="p-4 text-center text-white">Ilimitado</td>
                  <td className="p-4 text-center text-white">Ilimitado</td>
                  <td className="p-4 text-center font-bold text-brand-400">Ilimitado</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">Usuários do Sistema</td>
                  <td className="p-4 text-center">2</td>
                  <td className="p-4 text-center">5</td>
                  <td className="p-4 text-center bg-brand-500/5 font-semibold text-white">8</td>
                  <td className="p-4 text-center">12</td>
                  <td className="p-4 text-center">20</td>
                  <td className="p-4 text-center font-bold text-brand-400">Ilimitado</td>
                </tr>

                <tr className="bg-white/[0.02]">
                  <td colSpan={7} className="p-3 font-semibold text-white text-xs uppercase tracking-widest sticky left-0 bg-[#0a0a0a] border-y border-white/10 mt-4">CRM & Gestão Imobiliária</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium">Funil de Vendas (Kanban)</td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-brand-400"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium">Esteira de Leads</td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-brand-400"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium flex items-start gap-2"><Target className="w-4 h-4 text-yellow-400 mt-1" /> <span className="text-white font-medium">Módulo de Gamificação</span></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-brand-400"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500">Avançada</td>
                  <td className="p-4 text-center text-brand-500">Avançada</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-white sticky left-0 bg-[#050505] font-bold flex items-center gap-2"><FileSignature className="w-4 h-4 text-green-400" /> Módulo Contratos e Finanças</td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center font-bold text-green-400"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center font-bold text-green-400"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center font-bold text-green-400"><Check className="w-5 h-5 mx-auto" /></td>
                </tr>

                <tr className="bg-white/[0.02]">
                  <td colSpan={7} className="p-3 font-semibold text-white text-xs uppercase tracking-widest sticky left-0 bg-[#0a0a0a] border-y border-white/10 mt-4">Inteligência Artificial</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium">Gerador de Descrições (IA)</td>
                  <td className="p-4 text-center">50/dia</td>
                  <td className="p-4 text-center">200/dia</td>
                  <td className="p-4 text-center bg-brand-500/5 font-semibold text-white">600/dia</td>
                  <td className="p-4 text-center">1.000/dia</td>
                  <td className="p-4 text-center font-bold text-purple-400">1.450/dia</td>
                  <td className="p-4 text-center font-bold text-brand-400">Ilimitado</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-white sticky left-0 bg-[#050505] font-bold flex items-center gap-2"><Bot className="w-4 h-4 text-purple-400" /> Assistente Virtual Aura 24/7</td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center font-bold text-purple-400">Liberada</td>
                  <td className="p-4 text-center font-bold text-brand-400">Prioridade VIP</td>
                </tr>

                <tr className="bg-white/[0.02]">
                  <td colSpan={7} className="p-3 font-semibold text-white text-xs uppercase tracking-widest sticky left-0 bg-[#0a0a0a] border-y border-white/10 mt-4">Marketing & Integrações</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">Site Premium Exclusivo</td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-brand-400"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">Integração Portais</td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">Automação de E-mail/WhatsApp</td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">API de Integração</td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-gray-600"><Minus className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center bg-brand-500/5 text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                  <td className="p-4 text-center text-brand-500"><Check className="w-5 h-5 mx-auto" /></td>
                </tr>
                
                <tr className="bg-white/[0.02]">
                  <td colSpan={7} className="p-3 font-semibold text-white text-xs uppercase tracking-widest sticky left-0 bg-[#0a0a0a] border-y border-white/10 mt-4">Atendimento ao Cliente</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-gray-400 sticky left-0 bg-[#050505] font-medium shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]">Canal de Suporte</td>
                  <td className="p-4 text-center">Email</td>
                  <td className="p-4 text-center">Email / Chat</td>
                  <td className="p-4 text-center bg-brand-500/5 text-white font-medium">Chat Prioritário</td>
                  <td className="p-4 text-center">WhatsApp</td>
                  <td className="p-4 text-center">WhatsApp VIP</td>
                  <td className="p-4 text-center font-bold text-yellow-500">VIP 24/7</td>
                </tr>
                
                <tr>
                  <td className="p-4 sticky left-0 bg-[#050505] shadow-[4px_0_24px_-10px_rgba(0,0,0,0.8)]"></td>
                  <td className="p-4 text-center"><button onClick={() => handleStart("starter")} className="text-xs font-semibold hover:text-white transition-colors border border-white/20 rounded px-3 py-1.5 w-full cursor-pointer">Assinar</button></td>
                  <td className="p-4 text-center"><button onClick={() => handleStart("basic")} className="text-xs font-semibold hover:text-white transition-colors border border-white/20 rounded px-3 py-1.5 w-full cursor-pointer">Assinar</button></td>
                  <td className="p-4 text-center bg-brand-500/10 rounded-b-xl"><button onClick={() => handleStart("profissional")} className="text-xs font-semibold bg-brand-600 text-white rounded px-3 py-1.5 w-full hover:bg-brand-500 transition-colors cursor-pointer">Assinar</button></td>
                  <td className="p-4 text-center"><button onClick={() => handleStart("business")} className="text-xs font-semibold hover:text-white transition-colors border border-white/20 rounded px-3 py-1.5 w-full cursor-pointer">Assinar</button></td>
                  <td className="p-4 text-center"><button onClick={() => handleStart("premium")} className="text-xs font-semibold hover:text-white transition-colors border border-white/20 rounded px-3 py-1.5 w-full cursor-pointer">Assinar</button></td>
                  <td className="p-4 text-center"><button onClick={() => handleStart("elite")} className="text-xs font-semibold hover:text-white transition-colors border border-white/20 rounded px-3 py-1.5 w-full cursor-pointer">Assinar</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo/logo.png" alt="Logo Elevatio Vendas" className="h-10 w-auto object-contain" />
            <span className="font-bold text-xl tracking-tight">Elevatio<span className="text-brand-500"> Vendas</span></span>
          </div>
          <p className="text-gray-500 text-sm">© 2026 Elevatio Vendas. Todos os direitos reservados.</p>
          <div className="flex gap-4 text-gray-500">
            <a href="#" className="hover:text-white transition-colors"><Twitter className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white transition-colors"><Instagram className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white transition-colors"><Linkedin className="w-5 h-5" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}