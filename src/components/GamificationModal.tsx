
import React from 'react';
import { Icons } from './Icons';
import { getLevelInfo } from '../services/gamification';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  xpPoints: number;
}

const GamificationModal: React.FC<Props> = ({ isOpen, onClose, xpPoints }) => {
  if (!isOpen) return null;

  const { currentLevel, nextLevel, progress } = getLevelInfo(xpPoints);

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4 overflow-y-auto bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative p-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full">
          <Icons.X size={20} />
        </button>

        <div className="text-center mb-8">
          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 ${currentLevel.bg} ${currentLevel.color}`}>
            <Icons.Award size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Nível {currentLevel.level}: {currentLevel.title}</h2>
          <p className="text-slate-500 font-medium mt-1">{xpPoints} XP Acumulados</p>
        </div>

        {nextLevel ? (
          <div className="mb-8">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span className="text-slate-500">Progresso para o Nível {nextLevel.level}</span>
              <span className={nextLevel.color}>{nextLevel.minXp - xpPoints} XP restantes</span>
            </div>
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${nextLevel.bg.replace('100', '500')} transition-all duration-1000`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div className="bg-brand-50 text-brand-700 p-4 rounded-xl text-center font-bold mb-8">
            🎉 Você atingiu o nível máximo!
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase mb-3">Como ganhar mais XP?</h3>
          <ul className="space-y-3">
            <li className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Icons.Home size={16} /> Cadastrar Imóvel</span>
              <span className="text-sm font-bold text-emerald-600">+50 XP</span>
            </li>
            <li className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Icons.MessageCircle size={16} /> Avançar Lead</span>
              <span className="text-sm font-bold text-emerald-600">+20 XP</span>
            </li>
            <li className="flex items-center justify-between p-3 bg-brand-50 rounded-xl border border-brand-100">
              <span className="flex items-center gap-2 text-sm font-bold text-brand-700"><Icons.DollarSign size={16} /> Fechar Venda</span>
              <span className="text-sm font-bold text-brand-600">+500 XP</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GamificationModal;
