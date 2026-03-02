import React from 'react';
import { Icons } from './Icons';

const Loading: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-brand-500">
      <Icons.Loader2 className="animate-spin mb-4" size={48} />
      <p className="font-serif text-slate-600 text-lg animate-pulse">Carregando...</p>
    </div>
  );
};

export default Loading;