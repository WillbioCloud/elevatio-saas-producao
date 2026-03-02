import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';

export const useTrackVisit = () => {
  const location = useLocation();

  useEffect(() => {
    const trackVisit = async () => {
      try {
        // 1. Não rastreia o Admin/Corretor (Impede que você mesmo suje as métricas)
        if (location.pathname.startsWith('/admin')) return;
        
        // Impede rastreamento se o usuário estiver logado no sistema
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return;

        // 2. Lógica de Visitante Único por Dia (Local Storage)
        const todayDate = new Date().toISOString().split('T')[0]; // Ex: 2026-02-27
        const lastVisitDate = localStorage.getItem('trimoveis_last_visit_date');

        // Se a última visita registrada não foi hoje, consideramos um "Novo Visitante Diário"
        if (lastVisitDate !== todayDate) {
          // Atualiza a data no navegador do usuário
          localStorage.setItem('trimoveis_last_visit_date', todayDate);

          // Registra a visita no banco de dados (Apenas 1x por dia por dispositivo)
          await supabase.rpc('increment_page_view', {
            page_path: location.pathname || '/'
          });
        }
      } catch (error) {
        console.error('Erro ao registrar visita:', error);
      }
    };

    // Pequeno delay para garantir que bots super-rápidos não sejam contabilizados instantaneamente
    const timer = setTimeout(() => {
      trackVisit();
    }, 2000);

    return () => clearTimeout(timer);
  }, [location.pathname]);
};