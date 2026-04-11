import { supabase } from '../lib/supabase';
import { LeadStatus, type Lead } from '../types';

type SuggestedLeadStatus = Lead['status'];

export type ActionIntent = 'first_contact' | 'visit_scheduled' | 'visit_done' | 'proposal_sent' | null;

export interface IntentResult {
  intent: ActionIntent;
  confidence: 'high' | 'medium' | 'low';
  question?: string;
  suggestedStatus?: SuggestedLeadStatus;
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
      question: 'Confirma o início das tratativas de proposta com este cliente?' 
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
      question: 'Você concluiu uma visita com este cliente?' 
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
      question: 'Você agendou uma visita para este cliente?' 
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
      question: 'Você realizou o primeiro contato com este cliente?' 
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
  suggestedStatus?: SuggestedLeadStatus
) => {
  if (!intent) return;

  // Atualiza o status APENAS se a engine tiver 100% de certeza de um status válido
  if (suggestedStatus) {
    await supabase.from('leads').update({ status: suggestedStatus }).eq('id', leadId);
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
};
