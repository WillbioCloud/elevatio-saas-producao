import { supabase } from '../lib/supabase';
import type { Lead } from '../types';

type SuggestedLeadStatus = Lead['status'];

export type ActionIntent = 'first_contact' | 'visit_scheduled' | 'visit_done' | 'proposal_sent' | null;

export interface IntentResult {
  intent: ActionIntent;
  confidence: 'high' | 'medium' | 'low';
  question?: string;
  suggestedStatus?: SuggestedLeadStatus;
  originalText?: string;
}

// MOTOR DE REGRAS: Analisa o texto sem usar IA
// A ORDEM IMPORTA: Fundo de funil (Proposta) deve ser verificado ANTES de topo de funil (Visita).
export const parseTimelineNote = (text: string): IntentResult => {
  const lowerText = text.toLowerCase();

  // 1. Prioridade Máxima: Proposta
  if (
    lowerText.includes('proposta') ||
    lowerText.includes('oferta') ||
    lowerText.includes('mandou valor')
  ) {
    return {
      intent: 'proposal_sent',
      confidence: 'medium',
      question: 'Confirma o início das tratativas de proposta com este cliente?',
    };
  }

  // 2. Prioridade Alta: Visita Realizada
  if (
    lowerText.includes('visitou') ||
    lowerText.includes('mostrei o imóvel') ||
    lowerText.includes('mostrei o imovel') ||
    lowerText.includes('gostou do imóvel') ||
    lowerText.includes('gostou do imovel')
  ) {
    return {
      intent: 'visit_done',
      confidence: 'medium',
      question: 'Você concluiu uma visita com este cliente?',
    };
  }

  // 3. Prioridade Média: Visita Agendada
  if (
    lowerText.includes('marquei') ||
    lowerText.includes('agendei') ||
    lowerText.includes('visita para')
  ) {
    return {
      intent: 'visit_scheduled',
      confidence: 'medium',
      question: 'Você agendou uma visita para este cliente?',
      originalText: text,
    };
  }

  // 4. Prioridade Base: Primeiro Contato
  if (
    lowerText.includes('liguei') ||
    lowerText.includes('chamei no whats') ||
    lowerText.includes('falei com')
  ) {
    return {
      intent: 'first_contact',
      confidence: 'medium',
      question: 'Você realizou o primeiro contato com este cliente?',
    };
  }

  // 5. Prioridade Alta: Agendamento de Visita (Futuro)
  const isSchedulingVisit =
    lowerText.includes('visita agendada') ||
    (lowerText.includes('visita') &&
      (
        lowerText.includes('marcou') ||
        lowerText.includes('marcar') ||
        lowerText.includes('agendou') ||
        lowerText.includes('agendar') ||
        lowerText.includes('quer') ||
        lowerText.includes('gostaria') ||
        lowerText.includes('agendamento') ||
        lowerText.includes('amanhã') ||
        lowerText.includes('amanha')
      ));

  if (isSchedulingVisit) {
    return {
      intent: 'visit_scheduled',
      confidence: 'high',
      question: 'Você agendou uma visita com este cliente?',
      originalText: text,
    };
  }

  return { intent: null, confidence: 'low' };
};

// EXECUTOR DA AÇÃO CONFIRMADA
export const executeConfirmedAction = async (
  leadId: string,
  companyId: string,
  userId: string,
  intent: ActionIntent,
  suggestedStatus?: SuggestedLeadStatus,
  originalText?: string
) => {
  if (!intent) return;

  const touchedAt = new Date().toISOString();

  // Atualiza o status APENAS se a engine tiver 100% de certeza de um status válido
  if (suggestedStatus) {
    await supabase.from('leads').update({ status: suggestedStatus, last_interaction: touchedAt }).eq('id', leadId);
  }

  // Dicionário de respostas amigáveis para a Timeline
  const intentMessages: Record<string, string> = {
    first_contact: 'Primeiro contato realizado com sucesso.',
    visit_scheduled: 'Visita agendada com o cliente.',
    visit_done: 'Visita concluída. Cliente conheceu o imóvel.',
    proposal_sent: 'Tratativas de proposta iniciadas/enviadas.',
  };

  const message = intentMessages[intent as string] || 'Ação confirmada.';

  await supabase.from('timeline_events').insert([
    {
      lead_id: leadId,
      type: 'system',
      description: `🤖 Aura: ${message}${suggestedStatus ? ` (Avançou para ${suggestedStatus})` : ''}`,
      company_id: companyId,
      created_by: userId,
    },
  ]);

  // 🧠 AURA ENGINE: Criação de Tarefas baseadas na Ação Confirmada
  try {
    let dueDate = new Date();

    if (intent === 'visit_scheduled') {
      let taskDescription = 'Você anotou na timeline que uma visita foi agendada. Confirme a logística e a chave.';

      // Extrai data e horário diretamente da nota original quando possível.
      if (originalText) {
        taskDescription = `📌 Nota da Timeline: "${originalText}"\n\n🤖 Aura: Confirme a logística e a chave para este horário.`;
        const lowerText = originalText.toLowerCase();
        let targetDate = new Date();
        let changedDate = false;
        let changedTime = false;

        if (lowerText.includes('amanhã') || lowerText.includes('amanha')) {
          targetDate.setDate(targetDate.getDate() + 1);
          changedDate = true;
        }

        const dayMatch = lowerText.match(/dia\s+(\d{1,2})/);
        if (dayMatch) {
          const day = parseInt(dayMatch[1], 10);
          targetDate.setDate(day);

          if (targetDate.getTime() < new Date().getTime() - 86400000) {
            targetDate.setMonth(targetDate.getMonth() + 1);
          }

          changedDate = true;
        }

        const timeMatch = lowerText.match(/(?:às|as|ás)?\s*(\d{1,2})(?:h|:(\d{2}))/i);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          targetDate.setHours(hours, minutes, 0, 0);
          changedTime = true;
        }

        if (changedDate || changedTime) {
          dueDate = targetDate;
        } else {
          dueDate.setHours(dueDate.getHours() + 2);
        }
      } else {
        dueDate.setHours(dueDate.getHours() + 2);
      }

      await supabase.from('tasks').insert([
        {
          company_id: companyId,
          user_id: userId,
          lead_id: leadId,
          title: '🤖 Aura: Visita Marcada',
          description: taskDescription,
          priority: 'alta',
          due_date: dueDate.toISOString(),
          status: 'pendente',
        },
      ]);
    } else if (intent === 'proposal_sent') {
      dueDate.setHours(dueDate.getHours() + 24);
      await supabase.from('tasks').insert([
        {
          company_id: companyId,
          user_id: userId,
          lead_id: leadId,
          title: '🤖 Aura: Fazer follow-up da Proposta',
          description: 'Você registrou o envio de uma proposta. Acompanhe a aceitação para não deixar a negociação esfriar.',
          priority: 'alta',
          due_date: dueDate.toISOString(),
          status: 'pendente',
        },
      ]);
    }
  } catch (taskError) {
    console.error('Action Engine: Erro ao gerar tarefa da Aura', taskError);
  }

  if (!suggestedStatus) {
    await supabase.from('leads').update({ last_interaction: touchedAt }).eq('id', leadId);
  }
};
