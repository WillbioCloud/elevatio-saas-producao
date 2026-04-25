import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { useOnboarding } from '../../hooks/useOnboarding';

type WelcomeBalloonProps = {
  pageId: string;
  title: string;
  description: React.ReactNode;
  icon: keyof typeof Icons;
};

export default function WelcomeBalloon({ pageId, title, description, icon: IconName }: WelcomeBalloonProps) {
  const { state, loading, markAsVisited } = useOnboarding();
  const Icon = Icons[IconName] || Icons.Info;

  const isOpen = !loading && !state.visited[pageId];

  useEffect(() => {
    // Não marca como visitado automaticamente ao abrir, apenas ao clicar em "Começar"
  }, []);

  const handleClose = () => {
    markAsVisited(pageId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-brand-600 to-brand-400 h-32 w-full absolute top-0 left-0" />
            <div className="relative pt-20 px-8 pb-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex items-center justify-center mb-6 border-4 border-white dark:border-slate-900 relative z-10">
                <Icon size={40} className="text-brand-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{title}</h2>
              <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-8">
                {description}
              </div>
              <button
                onClick={handleClose}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                Incrível, vamos começar!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
