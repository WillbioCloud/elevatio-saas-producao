import React, { useState } from "react";
import {
  ChevronDown, ChevronUp, MapPin, Waves, Dumbbell, Flame,
  Utensils, Baby, Trophy, ShieldCheck, Bike, Dog, CheckCircle2, Trees
} from "lucide-react";

interface CondominiumCardProps {
  condominium: {
    name: string;
    image_url?: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    features?: string[];
  };
  primaryColor: string;
}

const getAmenityIcon = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("piscina")) return <Waves className="w-5 h-5" />;
  if (normalized.includes("academia") || normalized.includes("fitness")) return <Dumbbell className="w-5 h-5" />;
  if (normalized.includes("churrasqueira") || normalized.includes("gourmet")) return <Flame className="w-5 h-5" />;
  if (normalized.includes("festa") || normalized.includes("salão")) return <Utensils className="w-5 h-5" />;
  if (normalized.includes("play") || normalized.includes("brinquedo") || normalized.includes("infantil")) return <Baby className="w-5 h-5" />;
  if (normalized.includes("quadra") || normalized.includes("esporte")) return <Trophy className="w-5 h-5" />;
  if (normalized.includes("segurança") || normalized.includes("portaria")) return <ShieldCheck className="w-5 h-5" />;
  if (normalized.includes("bicicleta") || normalized.includes("bike")) return <Bike className="w-5 h-5" />;
  if (normalized.includes("pet") || normalized.includes("cachorro")) return <Dog className="w-5 h-5" />;
  if (normalized.includes("verde") || normalized.includes("parque") || normalized.includes("bosque")) return <Trees className="w-5 h-5" />;
  return <CheckCircle2 className="w-5 h-5" />;
};

export default function CondominiumCard({ condominium, primaryColor }: CondominiumCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { name, image_url, street, neighborhood, city, state, features = [] } = condominium;

  // Função para criar o background translúcido baseado na cor primária (10% de opacidade)
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
    const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
    const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const lightBg = hexToRgba(primaryColor, 0.1);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-8 transition-all duration-300 hover:shadow-md">
      <div className="flex flex-col md:flex-row">
        {/* Imagem do Condomínio */}
        {image_url && (
          <div className="w-full md:w-1/3 h-56 md:h-auto relative shrink-0">
            <img src={image_url} alt={name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent md:hidden"></div>
          </div>
        )}

        {/* Detalhes */}
        <div className={`flex-1 p-6 md:p-8 flex flex-col justify-center ${!image_url ? 'w-full' : ''}`}>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">{name}</h2>

          {(street || city) && (
            <div className="flex items-center text-slate-500 dark:text-slate-400 mb-6 gap-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="text-sm">
                {street && `${street}, `}{neighborhood && `${neighborhood} - `}{city && `${city}/${state}`}
              </span>
            </div>
          )}

          {/* Comodidades Expansíveis */}
          {features.length > 0 && (
            <div>
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 transition-all duration-500 ease-in-out ${
                  isExpanded ? 'max-h-[1000px] opacity-100 mb-6' : 'max-h-0 opacity-0 overflow-hidden m-0'
                }`}
              >
                {features.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-3 group">
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 transition-all duration-300 shrink-0"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = lightBg;
                        e.currentTarget.style.color = primaryColor;
                        e.currentTarget.style.borderColor = lightBg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '';
                        e.currentTarget.style.color = '';
                        e.currentTarget.style.borderColor = '';
                      }}
                    >
                      {getAmenityIcon(amenity)}
                    </div>
                    <span className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-tight group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {amenity}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-80 focus:outline-none"
                style={{ color: primaryColor }}
              >
                {isExpanded ? (
                  <><ChevronUp className="w-4 h-4" /> Recolher informações</>
                ) : (
                  <><ChevronDown className="w-4 h-4" /> Explorar {features.length} comodidades</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
