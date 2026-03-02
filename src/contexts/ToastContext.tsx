import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../../components/ui/sonner'; // Ajuste o caminho se necessário para encontrar o componente do Shadcn

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const addToast = useCallback((message: string, type: ToastType) => {
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