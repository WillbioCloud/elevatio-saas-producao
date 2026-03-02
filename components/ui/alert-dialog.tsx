import React from 'react';

type AlertDialogContextValue = {
  onOpenChange?: (open: boolean) => void;
};

const AlertDialogContext = React.createContext<AlertDialogContextValue>({});

type AlertDialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => {
  if (!open) return null;

  return (
    <AlertDialogContext.Provider value={{ onOpenChange }}>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">{children}</div>
    </AlertDialogContext.Provider>
  );
};

export const AlertDialogContent = ({ children }: { children: React.ReactNode }) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);

  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5">
      <button
        type="button"
        onClick={() => onOpenChange?.(false)}
        className="sr-only"
        aria-label="Fechar"
      />
      {children}
    </div>
  );
};

export const AlertDialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-1">{children}</div>
);

export const AlertDialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xl font-bold text-slate-800">{children}</h3>
);

export const AlertDialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-slate-500">{children}</p>
);

export const AlertDialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-end gap-3">{children}</div>
);

export const AlertDialogCancel = ({ children, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);

  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event);
        onOpenChange?.(false);
      }}
      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
    >
      {children}
    </button>
  );
};

export const AlertDialogAction = ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60"
  >
    {children}
  </button>
);