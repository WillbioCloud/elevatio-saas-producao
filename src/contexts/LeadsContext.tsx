import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Lead, LeadStatus } from '../types';
import { suggestLeadNextSteps } from '../services/ai';
import { addGamificationEvent, ACTIONS, calculateDealPoints } from '../services/gamification';
import { getHoursSinceLeadInteraction, LEAD_FREEZING_THRESHOLD_HOURS } from '../constants/leadHealth';

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  const message = `${maybe.message ?? ''}`.toLowerCase();
  return maybe.name === 'AbortError' || message.includes('aborted') || message.includes('signal is aborted');
};

interface LeadsContextType {
  leads: Lead[];
  loading: boolean;
  addLead: (lead: Partial<Lead> & Record<string, any>) => Promise<Lead>;
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

      const loadedLeads = (data || []) as Lead[];
      setLeads(loadedLeads);

      // ❄️ RADAR DE ESFRIAMENTO (Aura Proativa)
      // Faz uma varredura para encontrar leads "Congelando" (> 72h) e criar alertas
      if (loadedLeads.length > 0 && user?.id && user.company_id) {
        try {
          const freezingLeads = loadedLeads.filter((lead) => {
            const hoursSince = getHoursSinceLeadInteraction(lead.last_interaction);
            if (hoursSince === null) return false;

            return (
              hoursSince > LEAD_FREEZING_THRESHOLD_HOURS &&
              lead.status !== 'Arquivado' &&
              lead.status !== 'Venda Concluída'
            );
          });

          if (freezingLeads.length > 0) {
            const freezingLeadIds = freezingLeads.map((lead) => lead.id);
            const { data: existingTasks, error: existingTasksError } = await supabase
              .from('tasks')
              .select('lead_id')
              .in('lead_id', freezingLeadIds)
              .eq('status', 'pendente')
              .ilike('title', '%🤖 Aura: Retomar contato%');

            if (existingTasksError) {
              throw existingTasksError;
            }

            const leadsWithPendingAuraTask = new Set(
              (existingTasks || [])
                .map((task) => task.lead_id)
                .filter((leadId): leadId is string => typeof leadId === 'string' && leadId.length > 0)
            );

            const tasksToInsert = freezingLeads
              .filter((lead) => !leadsWithPendingAuraTask.has(lead.id))
              .map((lead) => ({
                company_id: user.company_id,
                user_id: lead.assigned_to || user.id,
                lead_id: lead.id,
                title: '🤖 Aura: Retomar contato urgente (Lead Esfriando)',
                description:
                  'Este lead está há mais de 3 dias sem interação. Risco alto de perda de interesse. Tente um contato rápido agora.',
                priority: 'alta',
                due_date: new Date().toISOString(),
                status: 'pendente'
              }));

            if (tasksToInsert.length > 0) {
              const { error: insertTasksError } = await supabase.from('tasks').insert(tasksToInsert);

              if (insertTasksError) {
                throw insertTasksError;
              }

              tasksToInsert.forEach((task) => {
                const lead = freezingLeads.find((item) => item.id === task.lead_id);
                console.log(`Aura: Gerada tarefa de emergência para o lead ${lead?.name || task.lead_id}`);
              });
            }
          }
        } catch (freezingRadarError) {
          console.error('Erro no Radar de Esfriamento:', freezingRadarError);
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Erro ao buscar leads:', error);
      }
    }

    if (shouldShowInitialLoading) {
      setLoading(false);
    }
  }, [isAdmin, leads.length, user?.company_id, user?.id]);

  const updateLeadStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    const targetLead = leads.find(l => l.id === leadId);
    let previousLead: Lead | undefined;
    const now = new Date().toISOString();

    setLeads((prev) => {
      previousLead = prev.find((lead) => lead.id === leadId);
      return prev.map((lead) => (
        lead.id === leadId
          ? { ...lead, status, last_interaction: now, stage_updated_at: now }
          : lead
      ));
    });

    let updateQuery = supabase
      .from('leads')
      .update({
        status,
        last_interaction: now,
        stage_updated_at: now
      })
      .eq('id', leadId);

    if (user?.company_id) {
      updateQuery = updateQuery.eq('company_id', user.company_id);
    }

    const { error } = await updateQuery;

    if (error && previousLead) {
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? previousLead as Lead : lead)));
      console.error('Erro ao atualizar status do lead:', error);
    }

    if (!error && user?.id && user.company_id && previousLead && previousLead.status !== status) {
      // Registra na timeline a mudança de etapa
      await supabase.from('timeline_events').insert([{
        lead_id: leadId,
        type: 'status_change',
        description: `Avançou para: ${status}`,
        company_id: user.company_id,
        created_by: user.id
      }]);

      // 🧠 AURA ENGINE: Gatilhos Inteligentes de Funil (Auto-Tasks)
      try {
        const statusLower = `${status}`.trim().toLowerCase();
        let taskTitle = '';
        let taskDesc = '';
        let hoursDue = 24;
        let priority = 'media';

        if (statusLower.includes('visita') && (statusLower.includes('agendada') || statusLower.includes('marcada'))) {
          let keyIsInUse = false;
          let keyHolderName = 'outro corretor';

          // 🛡️ O ESCUDO DE OPERAÇÕES: Verificação de Conflito de Chave (Arquitetura Nativa)
          if (targetLead?.property_id) {
            try {
              const { data: propData } = await supabase
                .from('properties')
                .select('key_status')
                .eq('id', targetLead.property_id)
                .single();

              // Se a chave não estiver na imobiliária ('agency'), está em uso!
              if (propData && propData.key_status && propData.key_status !== 'agency') {
                keyIsInUse = true;

                // Traduz o status real do banco para a mensagem amigável da Aura
                const statusMap: Record<string, string> = {
                  broker: 'outro corretor',
                  client: 'um cliente em visita',
                  owner: 'o proprietário do imóvel'
                };

                keyHolderName = statusMap[propData.key_status] || 'outra pessoa';
              }
            } catch (keyCheckError) {
              console.error('Aura: Erro ao checar chave nativa', keyCheckError);
            }
          }

          // Bifurcação de Inteligência
          if (keyIsInUse) {
            taskTitle = '🚨 Aura: Conflito de Chave Detectado!';
            taskDesc = `Você agendou uma visita, mas a chave deste imóvel está atualmente com ${keyHolderName}. Entre em contato urgentemente para alinhar a devolução antes do horário da visita com o cliente.`;
            priority = 'critica';
            hoursDue = 1;
          } else {
            taskTitle = '🤖 Aura: Confirmar logística da Visita';
            taskDesc = 'Ligue para confirmar o horário com o cliente e certifique-se de que a chave do imóvel está separada na recepção.';
            priority = 'alta';
            hoursDue = 2;
          }
        } else if (statusLower.includes('proposta')) {
          taskTitle = '🤖 Aura: Fazer follow-up da Proposta';
          taskDesc = 'O cliente está quente! Acompanhe a aceitação da proposta para não deixar a negociação esfriar.';
          priority = 'alta';
          hoursDue = 24;
        } else if (statusLower.includes('contrato') || statusLower.includes('fechamento')) {
          taskTitle = '🤖 Aura: Preparar documentação do Contrato';
          taskDesc = 'Inicie a coleta de documentos e valide os dados jurídicos na aba "Contratos".';
          priority = 'critica';
          hoursDue = 12;
        }

        if (taskTitle) {
          const dueDate = new Date();
          dueDate.setHours(dueDate.getHours() + hoursDue);

          const { error: auraTaskError } = await supabase.from('tasks').insert([{
            company_id: user.company_id,
            user_id: previousLead.assigned_to || user.id,
            lead_id: leadId,
            title: taskTitle,
            description: taskDesc,
            priority,
            due_date: dueDate.toISOString(),
            status: 'pendente'
          }]);

          if (auraTaskError) {
            throw auraTaskError;
          }
        }
      } catch (auraError) {
        console.error('Erro na Aura ao criar task de funil:', auraError);
      }
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
  }, [leads, refreshUser, user?.company_id, user?.id]);

  const addLead = useCallback(async (lead: Partial<Lead> & Record<string, any>) => {
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();

    if (error) {
      throw error;
    }

    setLeads((prev) => [data as Lead, ...prev]);

    // Registra o nascimento do Lead na Timeline
    if (data && user?.company_id && user.id) {
      const { error: timelineError } = await supabase.from('timeline_events').insert([{
        lead_id: data.id,
        type: 'system',
        description: `Lead cadastrado no sistema\nOrigem: ${data.source || 'Nao informada'}\nStatus: ${data.status}`,
        company_id: user.company_id,
        created_by: user.id
      }]);

      if (timelineError) {
        console.error('Erro ao registrar criacao do lead na timeline:', timelineError);
      }
    }

    // --- AURA: CRIAÇÃO AUTOMÁTICA DE TAREFA (BACKGROUND) ---
    if (user?.id && data) {
      // Roda em segundo plano (Fire-and-Forget) para não travar a tela do usuário
      (async () => {
        try {
          const isExternalSource = data.source && data.source.toLowerCase() !== 'manual';
          const isAssignedByAnother = data.assigned_to && data.assigned_to !== user.id;

          if (isExternalSource || isAssignedByAnother) {
            const suggestion = await suggestLeadNextSteps(data, []);

            if (suggestion && suggestion.title) {
              const dueDate = new Date();
              dueDate.setHours(dueDate.getHours() + (suggestion.due_in_hours || 24));

              await supabase.from('tasks').insert({
                company_id: user.company_id,
                user_id: data.assigned_to || user.id,
                lead_id: data.id,
                title: `🤖 Aura: ${suggestion.title}`,
                description: suggestion.description,
                priority: suggestion.priority,
                due_date: dueDate.toISOString(),
                status: 'pendente'
              });
            }
          }
        } catch (auraError) {
          console.error('Aura falhou ao criar tarefa inicial (Background):', auraError);
        }
      })();
    }

    return data as Lead;
  }, [user?.company_id, user?.id]);

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
      addLead,
      refreshLeads,
      updateLeadStatus,
    }),
    [addLead, leads, loading, refreshLeads, updateLeadStatus]
  );

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
};
