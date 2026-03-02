import React, { useEffect, useState } from 'react';
import { Calendar } from '../../components/ui/calendar'; // Ajuste o caminho se necessário
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';

const DashboardCalendar: React.FC = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [visitsData, setVisitsData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisits = async () => {
      setLoading(true);
      try {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 60);

        const { data: visits, error } = await supabase
          .from('site_visits')
          .select('created_at, device_id, session_id, id')
          .gte('created_at', limitDate.toISOString());

        if (error) throw error;

        if (visits) {
          const grouped: Record<string, Set<string>> = {};
          
          visits.forEach(v => {
            const dateKey = new Date(v.created_at).toDateString();
            if (!grouped[dateKey]) grouped[dateKey] = new Set();
            grouped[dateKey].add(v.device_id || v.session_id || v.id);
          });

          const formatted: Record<string, number> = {};
          Object.keys(grouped).forEach(key => {
            formatted[key] = grouped[key].size;
          });
          
          setVisitsData(formatted);
        }
      } catch (e) {
        console.error('Erro ao buscar visitas:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, []);

  const datesWithVisits = Object.keys(visitsData).map(dateStr => new Date(dateStr));

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-dark-border h-full flex flex-col animate-fade-in">
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Icons.Calendar className="text-brand-500" size={20} />
          Tráfego Diário
        </h3>
        <p className="text-xs text-slate-500 mt-1">Selecione o dia para ver os acessos</p>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-10">
          <Icons.Loader2 className="animate-spin text-slate-400" size={30} />
        </div>
      ) : (
        <div 
          className="flex-1 flex flex-col items-center justify-center w-full py-2"
          /* A MÁGICA 1: Forçamos a variável do Shadcn na "marra" via CSS inline para o calendário ficar grande e respirar */
          style={{ '--cell-size': '48px' } as React.CSSProperties}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-lg border"
            modifiers={{
              hasVisits: datesWithVisits,
            }}
            modifiersClassNames={{
              /* A MÁGICA 2: O 'pb-3' (padding bottom) empurra o número um pouco pra cima para a bolinha não ficar no meio dele! */
              hasVisits: "relative font-bold text-brand-700 bg-brand-50/40 pb-3 after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-emerald-500 after:rounded-full",
            }}
          />
        </div>
      )}

      {/* Resumo do dia selecionado */}
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center border border-slate-100 dark:border-slate-700 transition-all">
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
          {date ? date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecione uma data'}
        </p>
        <p className="text-2xl font-black text-brand-600 mt-1">
          {date && visitsData[date.toDateString()] !== undefined 
            ? `${visitsData[date.toDateString()]} visitantes` 
            : '0 visitantes'}
        </p>
      </div>
    </div>
  );
};

export default DashboardCalendar;