import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../../components/ui/sonner';

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
    // Interactive layout for Aura actions.
    if (type === 'action_required') {
      toast.custom((t) => (
        <div className="flex w-[340px] flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl pointer-events-auto animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-lg text-brand-400">🔮</span>
            <span className="text-[15px] font-bold text-slate-100">{opts?.title || 'Confirmação Rápida'}</span>
          </div>

          <p className="text-[14px] font-medium leading-relaxed text-slate-300">{message}</p>

          <div className="mt-3 flex gap-3">
            <button
              onClick={async () => {
                toast.dismiss(t);
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
                toast.dismiss(t);
                if (opts?.onCancel) {
                  void opts.onCancel();
                }
              }}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-bold text-slate-300 transition-all hover:bg-slate-700 active:scale-95"
            >
              Não
            </button>
          </div>
        </div>
      ), { duration: Infinity, position: 'top-center' });
      return;
    }

    // Exclusive layout for new leads with an isolated avatar column.
    if (type === 'new_lead') {
      toast.custom((t) => (
        <div
          onClick={() => toast.dismiss(t)}
          className="flex w-[340px] cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_10px_40px_rgb(0,0,0,0.12)] pointer-events-auto animate-fade-in"
        >
          {opts?.avatar ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
              <img src={opts.avatar} alt="Avatar" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg">
              🎯
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-bold text-slate-800">{opts?.title || 'Lead Novo!'}</span>
            <p className="mt-0.5 line-clamp-3 text-[13px] leading-relaxed text-slate-500">{message}</p>
          </div>
        </div>
      ), { duration: 6000, position: 'top-center' });
      return;
    }

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
