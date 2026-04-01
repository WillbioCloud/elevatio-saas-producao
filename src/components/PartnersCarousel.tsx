import React from 'react';

interface Partner {
  id: string;
  name: string;
  logo_url: string;
}

interface PartnersCarouselProps {
  partners?: Partner[];
  title?: string;
}

export default function PartnersCarousel({ partners, title = "Nossos Parceiros" }: PartnersCarouselProps) {
  if (!partners || partners.length === 0) return null;

  return (
    <section className="py-12 bg-white dark:bg-[#0a0f1c] border-t border-slate-100 dark:border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-8 text-center">
        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
          {title}
        </h3>
      </div>
      
      {/* Container do Carrossel Infinito */}
      <div className="relative w-full flex overflow-x-hidden group">
        {/* Máscara de gradiente para suavizar as bordas */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white dark:from-[#0a0f1c] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white dark:from-[#0a0f1c] to-transparent z-10 pointer-events-none"></div>
        
        {/* Trilha animada: 20 repetições para garantir o preenchimento de telas 4K/8K */}
        <div 
          className="flex whitespace-nowrap items-center w-max group-hover:[animation-play-state:paused]"
          style={{ animation: `marquee ${partners.length * 8}s linear infinite` }}
        >
          {[...Array(20)].map((_, setIndex) => (
            <React.Fragment key={`set-${setIndex}`}>
              {partners.map((partner, idx) => (
                <div 
                  key={`${partner.id}-${setIndex}-${idx}`} 
                  className="flex-shrink-0 w-40 h-20 flex items-center justify-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300 mx-8"
                  title={partner.name}
                >
                  {partner.logo_url ? (
                    <img 
                      src={partner.logo_url} 
                      alt={partner.name} 
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="font-bold text-slate-400 truncate w-full text-center px-2">{partner.name}</span>
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-5%); } /* 100 dividido por 20 repetições = -5%. Precisão matemática absoluta. */
        }
      `}</style>
    </section>
  );
}
