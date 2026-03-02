import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

type SelectContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SelectContext = createContext<SelectContextValue | null>(null);

const useSelectContext = () => {
  const context = useContext(SelectContext);
  if (!context) throw new Error('Select components must be used within <Select>');
  return context;
};

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
};

export const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const contextValue = useMemo(
    () => ({ value, onValueChange, open, setOpen }),
    [value, onValueChange, open]
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative" ref={rootRef}>{children}</div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  const { open, setOpen } = useSelectContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={`${className ?? ''} inline-flex items-center justify-between rounded-lg border px-3`}
    >
      {children}
      <span className="ml-2 text-xs text-slate-400">▾</span>
    </button>
  );
};

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const { value } = useSelectContext();
  return <span>{value || placeholder}</span>;
};

export const SelectContent = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  const { open } = useSelectContext();
  if (!open) return null;

  return (
    <div className={`${className ?? ''} absolute z-50 mt-2 w-full min-w-[200px] bg-white p-1`}>
      {children}
    </div>
  );
};

export const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
  const { onValueChange, setOpen } = useSelectContext();

  return (
    <button
      type="button"
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
};