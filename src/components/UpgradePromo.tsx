import React from 'react';
import { Icons } from './Icons';

interface UpgradePromoProps {
  title: string;
  description: string;
  minPlan: string;
  icon: keyof typeof Icons;
}

const UpgradePromo: React.FC<UpgradePromoProps> = ({ title, description, minPlan, icon }) => {
  const IconComp = Icons[icon as keyof typeof Icons] || Icons.Lock;

  return (
    <div className="flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto mt-10 animate-fade-in relative overflow-hidden">
      <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
        <IconComp size={200} />
      </div>
      <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mb-6 relative z-10">
        <IconComp size={40} />
      </div>
      <h2 className="text-3xl font-bold text-slate-800 mb-4 relative z-10">{title}</h2>
      <p className="text-slate-500 mb-8 max-w-md relative z-10">{description}</p>
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-8 flex items-center gap-3 relative z-10">
        <Icons.Unlock className="text-amber-500" size={24} />
        <div className="text-left">
          <p className="text-sm font-bold text-slate-700">Recurso Premium</p>
          <p className="text-xs text-slate-500">Disponível a partir do plano <span className="font-bold text-brand-600 uppercase">{minPlan}</span></p>
        </div>
      </div>
      <button onClick={() => alert('Em breve: Redirecionar para o Checkout de Upgrade!')} className="bg-brand-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg flex items-center gap-2 relative z-10">
        <Icons.ArrowUpCircle size={20} /> Fazer Upgrade Agora
      </button>
    </div>
  );
};

export default UpgradePromo;