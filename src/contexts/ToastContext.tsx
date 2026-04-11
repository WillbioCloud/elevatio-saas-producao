import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../../components/ui/sonner'; // Ajuste o caminho se necessário para encontrar o componente do Shadcn

type ToastType = 'success' | 'error' | 'info' | 'new_lead' | 'action_required';

interface ToastOptions {
  title?: string;
  avatar?: string | null;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const addToast = useCallback((message: string, type: ToastType, opts?: ToastOptions) => {
    // Layout Interativo para a Aura (Botões UI 100% Customizados)
    if (type === 'action_required') {
      toast.custom((t) => (
        <div className="flex w-[340px] flex-col gap-3 rounded-2xl bg-slate-900 p-5 shadow-2xl border border-slate-700 text-white pointer-events-auto animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 text-lg">🔮</span>
            <span className="text-[15px] font-bold text-slate-100">{opts?.title || 'Confirmação Rápida'}</span>
          </div>

          <p className="text-[14px] text-slate-300 font-medium leading-relaxed">{message}</p>

          <div className="mt-3 flex gap-3">
            <button
              onClick={async () => {
                toast.dismiss(t); // Fecha o balão imediatamente
                try {
                  if (opts?.onConfirm) {
                    await opts.onConfirm();
                  }
                  toast.success('Ação confirmada e registrada!');
                } catch (error) {
                  console.error('Erro ao confirmar ação da Aura:', error);
                  toast.error('Não foi possível concluir a ação.');
                }
              }}
              className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-600 active:scale-95"
            >
              Sim, registrar
            </button>
            <button
              onClick={() => {
                toast.dismiss(t); // Fecha o balão se disser "Não"
                if (opts?.onCancel) {
                  void opts.onCancel();
                }
              }}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 border border-slate-700 transition-all hover:bg-slate-700 active:scale-95"
            >
              Não
            </button>
          </div>
        </div>
      ), { duration: Infinity, position: 'top-center' });
      return;
    }

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
