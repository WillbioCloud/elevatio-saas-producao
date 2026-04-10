import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../../components/ui/sonner'; // Ajuste o caminho se necessário para encontrar o componente do Shadcn

type ToastType = 'success' | 'error' | 'info' | 'new_lead';

interface ToastOptions {
  title?: string;
  avatar?: string | null;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const addToast = useCallback((message: string, type: ToastType, opts?: ToastOptions) => {
    // Layout Exclusivo para Novo Lead (Balão Branco Infalível com Avatar)
    if (type === 'new_lead') {
      toast(opts?.title || 'Lead Novo!', {
        description: message,
        duration: 6000,
        className: '!bg-white !border-slate-200 !shadow-[0_10px_40px_rgb(0,0,0,0.12)] !rounded-2xl !p-3 !flex !items-start !gap-4',
        icon: opts?.avatar ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-50 border border-slate-200 shadow-sm">
            <img src={opts.avatar} alt="Avatar" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-50 border border-slate-200">
            <span className="text-xl">🎯</span>
          </div>
        ),
      });
      return;
    }

    // Mapeia o tipo legado da aplicação para os métodos do Sonner
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* O Toaster do Shadcn substitui toda a lógica manual antiga de renderização e timers */}
      <Toaster position="top-center" richColors theme="light" className="font-sans" />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }

  return context;
};
