import React from 'react';
import { Icons } from './Icons';
import { getLevelInfo, LEVELS } from '../services/gamification';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  xpPoints: number;
}

const GamificationModal: React.FC<Props> = ({ isOpen, onClose, xpPoints }) => {
  if (!isOpen) return null;

  const { currentLevel, nextLevel, progress } = getLevelInfo(xpPoints);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 pt-16 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#0a0f1c]">
        <div className={`relative p-8 pb-10 text-center ${currentLevel.bg} bg-opacity-20`}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-white/50"
          >
            <Icons.X size={20} />
          </button>

          <div className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white shadow-xl ${currentLevel.color}`}>
            <Icons.Award size={48} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">{currentLevel.title}</h2>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            Nível {currentLevel.level} de {LEVELS.length} • {xpPoints} XP atuais
          </p>
        </div>

        <div className="relative z-10 -mt-6 rounded-t-3xl bg-white p-8 dark:bg-[#0a0f1c]">
          {nextLevel ? (
            <div className="mb-8">
              <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span>Progresso para {nextLevel.title}</span>
                <span>
                  {xpPoints} / {nextLevel.minXp} XP
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${currentLevel.color.replace('text-', 'bg-')}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                Faltam {Math.max(nextLevel.minXp - xpPoints, 0)} XP para subir de liga.
              </p>
            </div>
          ) : (
            <div className="mb-8 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center font-bold text-brand-700 shadow-sm dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-300">
              Liga máxima atingida.
            </div>
          )}

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">
              <Icons.Target size={16} className="text-brand-500" /> Como ganhar XP?
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                    <Icons.Home size={16} />
                  </div>
                  Cadastrar imóvel
                </span>
                <span className="text-sm font-black text-emerald-600">+50 XP</span>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                    <Icons.MessageCircle size={16} />
                  </div>
                  Avançar lead
                </span>
                <span className="text-sm font-black text-emerald-600">+20 XP</span>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 p-3.5 shadow-sm dark:border-brand-800 dark:bg-brand-900/20">
                <span className="flex items-center gap-3 text-sm font-bold text-brand-800 dark:text-brand-300">
                  <div className="rounded-lg bg-brand-200 p-1.5 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">
                    <Icons.DollarSign size={16} />
                  </div>
                  Fechar contrato
                </span>
                <span className="text-sm font-black text-emerald-600">+500 XP</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamificationModal;
