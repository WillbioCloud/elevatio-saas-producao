import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Lead, LeadStatus } from '../types';
import { addGamificationEvent, ACTIONS, calculateDealPoints } from '../services/gamification';

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  const message = `${maybe.message ?? ''}`.toLowerCase();
  return maybe.name === 'AbortError' || message.includes('aborted') || message.includes('signal is aborted');
};

interface LeadsContextType {
  leads: Lead[];
  loading: boolean;
  refreshLeads: () => Promise<void>;
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<void>;
}

export const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export const LeadsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, refreshUser } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLeads = useCallback(async () => {
    if (!user?.id) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const shouldShowInitialLoading = leads.length === 0;
    if (shouldShowInitialLoading) {
      setLoading(true);
    }

    let query = supabase
      .from('leads')
      .select(`
        *,
        property:properties!leads_property_id_fkey (
          title,
          price,
          agent_id,
          strategic_weight,
          listing_type,
          agent:profiles (name)
        )
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('assigned_to', user.id);
    }

    try {
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        setLeads(data as Lead[]);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Erro ao buscar leads:', error);
      }
    }

    if (shouldShowInitialLoading) {
      setLoading(false);
    }
  }, [isAdmin, leads.length, user?.id]);

  const updateLeadStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    let previousLead: Lead | undefined;

    setLeads((prev) => {
      previousLead = prev.find((lead) => lead.id === leadId);
      return prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead));
    });

    const { error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', leadId);

    if (error && previousLead) {
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? previousLead as Lead : lead)));
      console.error('Erro ao atualizar status do lead:', error);
    }

    // --- DISTRIBUIÇÃO DE PONTOS (GAMIFICAÇÃO) ---
    if (!error && user?.id && previousLead && previousLead.status !== status) {
      const previousProperty = (previousLead as any).property;
      const pWeight = Number(previousProperty?.strategic_weight ?? 1.0) || 1.0;
      const behavioralScore = Number((previousLead as any).behavioral_score ?? 0) || 0;
      const lScore = behavioralScore ? (1 + behavioralScore / 100) : 1.0;
      const dealType = `${previousProperty?.listing_type ?? ''}`.toLowerCase() === 'locacao' ? 'locacao' : 'venda';
      const normalizedStatus = `${status}`.trim().toLowerCase();

      try {
        let awardedPoints = false;
        if (normalizedStatus === 'ganho' || normalizedStatus === 'fechado' || normalizedStatus.includes('fech')) {
          // O Grande Fechamento
          const pts = calculateDealPoints(dealType, pWeight, lScore, 1.15); // 1.15 = Bônus de processo fechado via CRM
          await addGamificationEvent(user.id, 'deal_closed', pts, leadId, { propertyWeight: pWeight, leadScore: lScore });
          awardedPoints = true;
          // Nota para Cursor: Assuma que `addToast` não está no contexto aqui diretamente, então deixe os toasts para os componentes visuais, o evento já vai somar no banco silenciosamente.
        } else if (normalizedStatus === 'visita' || normalizedStatus.includes('visita')) {
          // Agendou Visita
          await addGamificationEvent(user.id, ACTIONS.VISITA_AGENDADA.id, ACTIONS.VISITA_AGENDADA.points, leadId);
          awardedPoints = true;
        } else if (normalizedStatus === 'proposta') {
          // Enviou Proposta
          await addGamificationEvent(user.id, ACTIONS.PROPOSTA_ENVIADA.id, ACTIONS.PROPOSTA_ENVIADA.points, leadId);
          awardedPoints = true;
        } else if (normalizedStatus === 'perdido') {
          // Penalidade Leve por Perda sem justificativa (pode aprimorar depois verificando se tem motivo preenchido)
          await addGamificationEvent(user.id, ACTIONS.LEAD_PERDIDO_SEM_MOTIVO.id, ACTIONS.LEAD_PERDIDO_SEM_MOTIVO.points, leadId);
          awardedPoints = true;
        }

        if (awardedPoints) {
          await refreshUser();
        }
      } catch (gamiErr) {
        console.error('Falha ao distribuir pontos:', gamiErr);
      }
    }
  }, [refreshUser, user?.id]);

  useEffect(() => {
    void refreshLeads().catch((error) => {
      if (!isAbortError(error)) {
        console.error('Erro ao atualizar leads:', error);
      }
    });
  }, [refreshLeads]);

  const value = useMemo(
    () => ({
      leads,
      loading,
      refreshLeads,
      updateLeadStatus,
    }),
    [leads, loading, refreshLeads, updateLeadStatus]
  );

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
};
