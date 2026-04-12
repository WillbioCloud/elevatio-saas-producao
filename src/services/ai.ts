import { GoogleGenerativeAI } from "@google/generative-ai";
import { Lead, Property } from "../types";
import { supabase } from "../lib/supabase";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  console.warn("Gemini API Key nÃ£o encontrada. Funcionalidades de IA estarÃ£o desabilitadas.");
}

export type ChatMessageType = 'text' | 'action_prompt';
export type ChatMessageActionVariant = 'primary' | 'secondary' | 'ghost';
export type ChatMessageActionIcon = 'smartphone' | 'edit' | 'task' | 'timeline' | 'lead' | 'cancel';

export interface ChatMessageActionPayload {
  draftText?: string;
  leadName?: string;
  taskTitle?: string;
  taskDescription?: string;
  timelineNote?: string;
  leadId?: string;
}

export interface ChatMessageAction {
  id: string;
  label: string;
  icon?: ChatMessageActionIcon;
  variant?: ChatMessageActionVariant;
  payload?: ChatMessageActionPayload;
  disabled?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  messageType?: ChatMessageType;
  actions?: ChatMessageAction[];
}

export interface AuraLeadChatContext {
  leadId?: string;
  leadName?: string;
  leadStatus?: string;
  propertyTitle?: string;
  timelineContext?: string[];
}

export interface CandidateProperty {
  id: string;
  title: string;
  slug?: string;
  price: number;
  type?: string;
  bedrooms?: number;
  neighborhood?: string;
  city?: string;
  features?: string[];
}

export interface SmartMatchResult {
  property_id: string;
  match_score: number;
  match_reason: string;
  property?: Pick<Property, "id" | "title" | "price" | "type" | "bedrooms" | "neighborhood" | "city" | "slug" | "images">;
}

const safeJsonParse = <T>(rawText: string): T | null => {
  try {
    const cleaned = rawText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("Falha ao parsear resposta JSON da IA:", error);
    return null;
  }
};

const getApiKey = async (): Promise<string | null> => {
  const apiKey = API_KEY?.trim();
  return apiKey || null;
};

export const generateText = async (prompt: string): Promise<string | null> => {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao gerar texto com IA:", error);
    return null;
  }
};

export const generatePropertyDescription = async (
  propertyFeatures: string,
  condoName?: string | null,
  condoFeatures?: string[]
): Promise<string | null> => {
  const condoFeaturesText = condoFeatures && condoFeatures.length > 0 ? `\nComodidades do CondomÃ­nio: ${condoFeatures.join(', ')}` : '';
  const condominiumContext = condoName
    ? `InformaÃ§Ã£o Adicional: O imÃ³vel fica no condomÃ­nio ${condoName}.
Se houver um nome de condomÃ­nio, destaque a seguranÃ§a, infraestrutura e o estilo de vida exclusivo de residir nesta localidade.`
    : '';

  const condominiumContextWithFeatures = condoName
    ? `InformaÃ§Ã£o Adicional: O imÃ³vel fica no condomÃ­nio ${condoName}. ${condoFeaturesText}
Se houver um nome de condomÃ­nio, destaque a seguranÃ§a, infraestrutura e o estilo de vida exclusivo de residir nesta localidade, incluindo as comodidades citadas.`
    : condominiumContext;

  const prompt = `
Atue como um redator imobiliÃ¡rio profissional. Sua tarefa Ã© criar um anÃºncio padronizado SUBSTITUINDO os colchetes [...] do template abaixo pelos DADOS REAIS DO IMÃ“VEL, respeitando regras estritas de seguranÃ§a jurÃ­dica.

DADOS DO IMÃ“VEL A SEREM UTILIZADOS:
${propertyFeatures}
${condominiumContextWithFeatures ? `\n${condominiumContextWithFeatures}\n` : ''}

âš ï¸ REGRAS DE SEGURANÃ‡A JURÃDICA (CRÃTICO):
1. NÃƒO invente informaÃ§Ãµes. Use APENAS os dados fornecidos. Se algo nÃ£o foi informado, omita.
2. Nunca mencione metragem, vagas ou quartos se nÃ£o estiverem nos dados.
3. Nunca cite aceitaÃ§Ã£o de financiamento, permuta ou valor de condomÃ­nio se nÃ£o estiver nos dados.
4. NÃ£o use adjetivos exagerados como "imperdÃ­vel", "maravilhoso", "dos sonhos".
5. Mantenha um tom profissional, limpo e direto.

=== TEMPLATE OBRIGATÃ“RIO (Preencha os dados reais no lugar dos colchetes) ===
[Emoji correspondente] [Tipo do ImÃ³vel] com [1 Diferencial Principal] - [Bairro]
ðŸ“ [Bairro] - [Cidade]/[UF]

ðŸ“ CaracterÃ­sticas principais:
(Crie os bullets preenchidos com os dados reais. Exemplo de como deve ficar:
- 150mÂ² de Ã¡rea construÃ­da
- 3 quartos (1 suÃ­te)
- 2 vagas de garagem
- Piscina aquecida)

ðŸ“ DescriÃ§Ã£o:
(Escreva 1 ou 2 parÃ¡grafos curtos descrevendo o imÃ³vel real. Aplique a diretriz correspondente:
- CASA: Destaque conforto, praticidade, integraÃ§Ã£o e Ã¡rea externa (se houver).
- APARTAMENTO: Destaque praticidade, elevador/lazer (se houver) e localizaÃ§Ã£o.
- LOTE/TERRENO: Destaque potencial construtivo e valorizaÃ§Ã£o da regiÃ£o.
- SOBRADO: Destaque a divisÃ£o entre Ã¡rea Ã­ntima e social, espaÃ§o e privacidade.
- COBERTURA: Destaque exclusividade, vista, terraÃ§o (se houver) e amplitude.)

ðŸ’° Valor: [PreÃ§o real do imÃ³vel formatado]

(Adicione esta Ãºltima linha APENAS se os dados informarem financiamento, permuta ou condomÃ­nio:)
âœ” [InformaÃ§Ã£o financeira adicional real]
========================================

GUIA DE EMOJIS PARA O TÃTULO (Use apenas 1):
- Casa: ðŸ¡
- Apartamento: ðŸ¢
- Terreno/Lote: ðŸŒ³
- Sobrado: ðŸ˜
- Cobertura: ðŸŒ‡

IMPORTANTE: Retorne APENAS o texto do anÃºncio final preenchido. NÃƒO imprima os colchetes literais e nÃ£o inclua saudaÃ§Ãµes.
  `;

  return generateText(prompt);
};

export const findSmartMatches = async (
  lead: Lead,
  candidateProperties: CandidateProperty[],
  navigationHistory?: any[]
): Promise<SmartMatchResult[]> => {
  if (!genAI || candidateProperties.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
Atue como um corretor sÃªnior.
Analise este Lead (OrÃ§amento: ${lead.budget ?? "nÃ£o informado"}, Busca: ${lead.desired_type ?? "tipo livre"}, Quartos: ${lead.desired_bedrooms ?? "nÃ£o informado"}, LocalizaÃ§Ã£o: ${lead.desired_location ?? "nÃ£o informada"}) e estes ImÃ³veis Candidatos.
Retorne um JSON com os 3 melhores imÃ³veis, dando uma nota de 0-100 (match_score) e um "match_reason" (uma frase curta de venda explicando por que serve).

Formato obrigatÃ³rio da resposta:
{
  "matches": [
    {
      "property_id": "id-do-imovel",
      "match_score": 95,
      "match_reason": "Frase objetiva e comercial."
    }
  ]
}

Regras:
- Use APENAS os imÃ³veis recebidos.
- Traga no mÃ¡ximo 3 itens.
- match_score deve ser nÃºmero inteiro entre 0 e 100.
- match_reason deve ter no mÃ¡ximo 160 caracteres.
- NÃ£o adicione texto fora do JSON.

Lead:
${JSON.stringify(
    {
      id: lead.id,
      name: lead.name,
      budget: lead.budget,
      desired_type: lead.desired_type,
      desired_bedrooms: lead.desired_bedrooms,
      desired_location: lead.desired_location,
      message: lead.message
    },
    null,
    2
  )}

ImÃ³veis Candidatos:
${JSON.stringify(candidateProperties, null, 2)}

HISTÃ“RICO DE NAVEGAÃ‡ÃƒO RECENTE: ${JSON.stringify(navigationHistory || [])}.
InstruÃ§Ã£o: Se o cliente visitou imÃ³veis diferentes do perfil declarado, considere isso como um forte sinal de interesse latente.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsed = safeJsonParse<{ matches?: SmartMatchResult[] }>(response.text());

    if (!parsed?.matches || !Array.isArray(parsed.matches)) {
      return [];
    }

    const sanitizedMatches = parsed.matches
      .filter((item) => Boolean(item.property_id) && Number.isFinite(item.match_score))
      .map((item) => ({
        property_id: item.property_id,
        match_score: Math.max(0, Math.min(100, Math.round(item.match_score))),
        match_reason: item.match_reason || "Boa opÃ§Ã£o para o perfil informado."
      }))
      .slice(0, 3);

    const propertyIds = sanitizedMatches.map((item) => item.property_id);
    if (!propertyIds.length) return [];

    const { data: properties } = await supabase
      .from("properties")
      .select("id, title, price, type, bedrooms, neighborhood, city, slug, images")
      .in("id", propertyIds);

    const propertyById = new Map((properties || []).map((property) => [property.id, property]));

    return sanitizedMatches.map((item) => ({
      ...item,
      property: propertyById.get(item.property_id) as SmartMatchResult["property"] | undefined
    }));
  } catch (error) {
    console.error("Erro ao buscar matches inteligentes:", error);
    return [];
  }
};

export const mapPropertyToCandidate = (property: Property): CandidateProperty => ({
  id: property.id,
  title: property.title,
  slug: property.slug,
  price: Number(property.price || 0),
  type: property.type,
  bedrooms: property.bedrooms,
  neighborhood: property.neighborhood || property.location?.neighborhood,
  city: property.city || property.location?.city,
  features: property.features || []
});

export interface LeadNextStepSuggestion {
  title: string;
  description?: string;
  priority?: string;
  due_in_hours?: number;
}

const getLocalLeadNextStepSuggestion = (lead: Lead): LeadNextStepSuggestion => {
  const hasInitialMessage = Boolean(lead.message?.trim());

  return {
    title: hasInitialMessage ? "Revisar interesse e fazer primeiro contato" : "Fazer primeiro contato com o lead",
    description: hasInitialMessage
      ? `Revise a observacao inicial de ${lead.name} e envie a primeira mensagem de qualificacao.`
      : `Entre em contato com ${lead.name} para entender o perfil de busca e registrar as preferencias iniciais.`,
    priority: "alta",
    due_in_hours: 2
  };
};

export const suggestLeadNextSteps = async (
  lead: Lead,
  timelineEvents: any[] = []
): Promise<LeadNextStepSuggestion | null> => {
  const fallback = getLocalLeadNextStepSuggestion(lead);
  if (!genAI) return fallback;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const prompt = `
Voce e a Aura, uma IA especialista em rotina comercial imobiliaria.
Analise o lead recem-criado e sugira a proxima acao inicial para o corretor.

Retorne APENAS um JSON valido neste formato:
{
  "title": "Titulo curto da tarefa",
  "description": "Descricao objetiva para orientar o corretor",
  "priority": "alta",
  "due_in_hours": 24
}

Regras:
- Nao invente informacoes.
- O titulo deve ter no maximo 80 caracteres.
- A descricao deve ter no maximo 220 caracteres.
- priority deve ser "alta", "media" ou "baixa".
- due_in_hours deve ser um numero entre 1 e 72.
- Se houver observacao/mensagem inicial, use isso para orientar a primeira abordagem.

Lead:
${JSON.stringify({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      message: lead.message,
      status: lead.status,
      desired_type: lead.desired_type,
      desired_bedrooms: lead.desired_bedrooms,
      desired_location: lead.desired_location,
      budget: lead.budget
    }, null, 2)}

Timeline:
${JSON.stringify(timelineEvents || [], null, 2)}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsed = safeJsonParse<LeadNextStepSuggestion>(response.text());

    if (!parsed?.title) return fallback;

    const dueInHours = Number(parsed.due_in_hours);

    return {
      title: String(parsed.title).slice(0, 80),
      description: parsed.description ? String(parsed.description).slice(0, 220) : fallback.description,
      priority: ["alta", "media", "baixa"].includes(String(parsed.priority)) ? String(parsed.priority) : fallback.priority,
      due_in_hours: Number.isFinite(dueInHours) ? Math.max(1, Math.min(72, Math.round(dueInHours))) : fallback.due_in_hours
    };
  } catch (error) {
    console.error("Erro ao sugerir proximos passos do lead com IA:", error);
    return fallback;
  }
};

export async function generateCRMInsights(
  leads: any[],
  tasks: any[],
  gamificationEvents: any[],
  notifications: any[],
  userName: string,
  userLevelInfo: { title: string; level: number }
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) return 'A inteligÃªncia artificial estÃ¡ desativada no momento. Configure sua chave da API nas opÃ§Ãµes da empresa.';

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Usaremos a versÃ£o mais recente da API para testes iniciais
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const activeLeads = leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido');
    const delayedTasks = tasks.filter(t => t.status !== 'concluida' && new Date(t.due_date) < new Date());
    const unreadNotifications = notifications.filter(n => !n.read).length;

    const recentWins = gamificationEvents.filter(e => e.action_type === 'deal_closed').length;
    const totalPointsWeek = gamificationEvents.reduce((sum, e) => {
      const isThisWeek = (new Date().getTime() - new Date(e.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
      return isThisWeek ? sum + (e.points_awarded || 0) : sum;
    }, 0);

    const prompt = `VocÃª Ã© a "Aura", a inteligÃªncia artificial especialista em vendas imobiliÃ¡rias do Elevatio.
    Analise os nÃºmeros do corretor ${userName} e dÃª 3 dicas prÃ¡ticas em formato de bullet points.
    Fale diretamente com o corretor, de forma direta e motivacional.

    Contexto Atual:
    - Patente/Liga: ${userLevelInfo.title} (NÃ­vel ${userLevelInfo.level})
    - Pontos ganhos nos Ãºltimos 7 dias: ${totalPointsWeek}
    - NegÃ³cios fechados na semana: ${recentWins}
    - Leads Ativos: ${activeLeads.length}
    - Tarefas Atrasadas: ${delayedTasks.length}
    - NotificaÃ§Ãµes NÃ£o Lidas no Sininho: ${unreadNotifications}

    Regras:
    - Se houver notificaÃ§Ãµes nÃ£o lidas, alerte sobre o "Sininho".
    - Se houver tarefas atrasadas, sugira focar na "OperaÃ§Ã£o Limpa" (concluir todas).
    - Sugira focar no avanÃ§o de leads para somar pontos na gamificaÃ§Ã£o.`;

    const result = await model.generateContent(prompt);
    const response = result.response; // Removido o await desnecessÃ¡rio aqui

    if (!response.text()) {
      throw new Error("A API retornou uma resposta vazia.");
    }

    return response.text();
  } catch (error: any) {
    // Tratamento de erro aprimorado para capturar o motivo real
    console.error('ðŸš¨ Erro detalhado no Gemini API (generateCRMInsights):', error);

    let errMsg = 'Falha ao conectar com a Aura. Verifique sua conexÃ£o.';

    if (error instanceof Error) {
      errMsg = error.message;
    } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      errMsg = error.message;
    } else if (typeof error === 'string') {
      errMsg = error;
    }

    // Evita lanÃ§ar um erro com string vazia
    if (!errMsg || errMsg.trim() === '') {
      errMsg = 'Falha silenciosa na API do Google (PossÃ­vel erro de CORS, cota excedida, ou modelo nÃ£o suportado).';
      console.warn("Objeto de erro recebido:", JSON.stringify(error)); // Ajuda a debugar
    }

    throw new Error(errMsg);
  }
}

export async function autoTagContractTemplate(rawContent: string): Promise<string> {
  if (!genAI) throw new Error("Gemini API Key nÃ£o configurada.");

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `VocÃª Ã© um Assistente JurÃ­dico ImobiliÃ¡rio. Sua tarefa Ã© ler o contrato bruto fornecido e substituir os dados reais, nomes e valores por nossas TAGS (Shortcodes) padronizadas.

MANTENHA toda a formataÃ§Ã£o HTML, negritos e estrutura do texto original. APENAS substitua os dados especÃ­ficos pelas tags abaixo.

DicionÃ¡rio de VariÃ¡veis DisponÃ­veis:

[DADOS DA IMOBILIÃRIA / CORRETOR]
{{IMOBILIARIA_NOME}} - Nome da sua empresa
{{IMOBILIARIA_CNPJ}} - CNPJ da imobiliÃ¡ria
{{IMOBILIARIA_ENDERECO}} - EndereÃ§o da imobiliÃ¡ria
{{CORRETOR_NOME}} - Nome do corretor responsÃ¡vel
{{CORRETOR_CRECI}} - CRECI do corretor
{{IMOBILIARIA_ASSINATURA}} - A imagem da assinatura salva nas configuraÃ§Ãµes

[DADOS DO CLIENTE / LOCATÃRIO / COMPRADOR]
{{CLIENTE_NOME}} - Nome completo
{{CLIENTE_CPF}} - CPF ou CNPJ
{{CLIENTE_RG}} - RG
{{CLIENTE_NACIONALIDADE}} - Ex: Brasileiro
{{CLIENTE_PROFISSAO}} - Ex: Engenheiro
{{CLIENTE_ESTADO_CIVIL}} - Ex: Casado, Solteiro
{{CLIENTE_ENDERECO}} - EndereÃ§o de residÃªncia atual

[DADOS DO PROPRIETÃRIO / LOCADOR / VENDEDOR]
{{PROPRIETARIO_NOME}}
{{PROPRIETARIO_CPF}}
{{PROPRIETARIO_RG}}
{{PROPRIETARIO_ESTADO_CIVIL}}
{{PROPRIETARIO_ENDERECO}}

[DADOS DO IMÃ“VEL E FINANCEIRO]
{{IMOVEL_ENDERECO}} - EndereÃ§o completo do imÃ³vel negociado
{{IMOVEL_MATRICULA}} - NÃºmero da matrÃ­cula no cartÃ³rio
{{VALOR_TOTAL}} - Valor total do aluguel ou venda (em nÃºmeros)
{{VALOR_TOTAL_EXTENSO}} - Valor escrito por extenso
{{DATA_VENCIMENTO}} - Dia do vencimento (ex: dia 10)
{{PRAZO_MESES}} - Prazo de vigÃªncia do contrato (ex: 30 meses)
{{DATA_ATUAL}} - Data de geraÃ§Ã£o do contrato (ex: 15 de MarÃ§o de 2026)

Regras rigorosas:
1. Preserve RIGOROSAMENTE todo o texto jurÃ­dico, pontuaÃ§Ã£o, quebras de linha e clÃ¡usulas originais.
2. Quando o contrato mencionar cliente, locatÃ¡rio ou comprador, normalize para a famÃ­lia CLIENTE.
3. Quando o contrato mencionar proprietÃ¡rio, locador ou vendedor, normalize para a famÃ­lia PROPRIETARIO.
4. Retorne APENAS o texto do contrato com as tags aplicadas. NÃ£o adicione saudaÃ§Ãµes, explicaÃ§Ãµes ou formataÃ§Ã£o Markdown extra.

CONTRATO ORIGINAL PARA ANALISAR:
${rawContent}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text()
      .replace(/^```[a-z]*\n/gi, '')
      .replace(/\n```$/gi, '')
      .trim();
  } catch (error) {
    console.error("Erro ao analisar contrato com IA:", error);
    throw new Error("NÃ£o foi possÃ­vel analisar o contrato no momento.");
  }
}

/**
 * Copiloto de ComunicaÃ§Ã£o: Gera rascunho de WhatsApp baseado no histÃ³rico do Lead.
 * Inclui sistema de Retry para lidar com picos temporÃ¡rios de uso na API do Google (Erro 503).
 */
export const generateAuraWhatsAppDraft = async (leadName: string, context: string, retries = 3): Promise<string> => {
  if (!genAI) throw new Error("Gemini API Key nÃ£o configurada.");

  try {
    // Usando o modelo que a sua API Key reconheceu (pode usar gemini-2.0-flash se preferir)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Atue como um corretor de imÃ³veis de elite, mestre em persuasÃ£o e atendimento humanizado.
      Escreva uma mensagem de WhatsApp para o cliente: ${leadName}.
      
      CONTEXTO RECENTE DA TIMELINE DO CLIENTE:
      ${context || 'O cliente acabou de entrar no sistema e aguarda o primeiro contato.'}

      DIRETRIZES:
      1. Tom de voz: Profissional, acolhedor e focado em gerar resposta.
      2. Gatilho de contexto: Use a timeline para personalizar a mensagem.
      3. Estrutura: Direta ao ponto (2 ou 3 parÃ¡grafos curtos).
      4. Fechamento: Termine sempre com uma pergunta simples e aberta (Call to Action).
      5. FormataÃ§Ã£o: Use negrito do WhatsApp (*texto*) nos pontos altos e emojis com muita moderaÃ§Ã£o.
      6. IMPORTANTE: Retorne APENAS o texto da mensagem. Sem introduÃ§Ãµes, aspas ou comentÃ¡rios extras.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error: any) {
    // Se for erro de servidor ocupado (503) e ainda tivermos tentativas, esperamos e tentamos de novo
    if (error?.message?.includes('503') && retries > 0) {
      console.warn(`Aura: API ocupada (503). Tentando novamente em 2 segundos... (Restam ${retries} tentativas)`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
      return generateAuraWhatsAppDraft(leadName, context, retries - 1);
    }
    
    console.error("Aura: Erro final ao gerar draft de WhatsApp", error);
    throw new Error("NÃ£o foi possÃ­vel gerar a mensagem com a IA neste momento. Tente novamente em alguns minutos.");
  }
};

export interface VisitFeedbackAnalysis {
  status_suggestion: "Proposta" | "Atendimento" | "Congelado";
  timeline_note: string;
  next_task_title: string;
  next_task_desc: string;
  next_task_hours: number;
}

const getLocalVisitFeedbackFallback = (
  leadName: string,
  feedback: string
): VisitFeedbackAnalysis => {
  const normalized = feedback.toLowerCase();

  const isFrozen =
    normalized.includes("desist") ||
    normalized.includes("parou de procurar") ||
    normalized.includes("nao quer mais comprar") ||
    normalized.includes("nÃ£o quer mais comprar") ||
    normalized.includes("sem interesse") ||
    normalized.includes("vai pausar");

  const isProposal =
    normalized.includes("gostou") ||
    normalized.includes("adorou") ||
    normalized.includes("proposta") ||
    normalized.includes("negoci") ||
    normalized.includes("desconto") ||
    normalized.includes("fechar") ||
    normalized.includes("comprar");

  if (isFrozen) {
    return {
      status_suggestion: "Congelado",
      timeline_note: `${leadName} sinalizou pausa na busca apos a visita, exigindo acompanhamento futuro mais leve.`,
      next_task_title: "ðŸ¤– Aura: Registrar motivo da pausa do lead",
      next_task_desc: "Documente o motivo da pausa, confirme quando retomar o contato e mantenha o lead aquecido sem pressao comercial.",
      next_task_hours: 72,
    };
  }

  if (isProposal) {
    return {
      status_suggestion: "Proposta",
      timeline_note: `${leadName} demonstrou interesse concreto no imovel visitado e avancou para tratativas comerciais.`,
      next_task_title: `ðŸ¤– Aura: Preparar proposta para ${leadName}`,
      next_task_desc: "Organize a proposta comercial, alinhe margem de negociacao e confirme os proximos documentos necessarios.",
      next_task_hours: 24,
    };
  }

  return {
    status_suggestion: "Atendimento",
    timeline_note: `${leadName} concluiu a visita, mas ainda precisa de novas opcoes aderentes ao perfil informado.`,
    next_task_title: `ðŸ¤– Aura: Selecionar novos imoveis para ${leadName}`,
    next_task_desc: "Revise os pontos levantados na visita e envie novas sugestoes com melhor encaixe de perfil, valor ou localizacao.",
    next_task_hours: 24,
  };
};

const sanitizeVisitFeedbackAnalysis = (
  parsed: Partial<VisitFeedbackAnalysis> | null,
  leadName: string,
  feedback: string
): VisitFeedbackAnalysis => {
  const fallback = getLocalVisitFeedbackFallback(leadName, feedback);
  if (!parsed) return fallback;

  const statusSuggestion =
    parsed.status_suggestion === "Proposta" ||
    parsed.status_suggestion === "Atendimento" ||
    parsed.status_suggestion === "Congelado"
      ? parsed.status_suggestion
      : fallback.status_suggestion;

  const nextTaskHours = Number(parsed.next_task_hours);

  return {
    status_suggestion: statusSuggestion,
    timeline_note: String(parsed.timeline_note || fallback.timeline_note).slice(0, 220),
    next_task_title: String(parsed.next_task_title || fallback.next_task_title).slice(0, 120),
    next_task_desc: String(parsed.next_task_desc || fallback.next_task_desc).slice(0, 280),
    next_task_hours: Number.isFinite(nextTaskHours)
      ? Math.max(1, Math.min(168, Math.round(nextTaskHours)))
      : fallback.next_task_hours,
  };
};

/**
 * Loop de PÃ³s-Visita: Analisa o feedback do corretor e decide o destino do Lead.
 */
export const processVisitFeedback = async (
  leadName: string,
  feedback: string
): Promise<VisitFeedbackAnalysis> => {
  const fallback = getLocalVisitFeedbackFallback(leadName, feedback);
  if (!genAI) return fallback;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
Voce e a inteligencia por tras de um CRM imobiliario.
O corretor acabou de realizar uma visita com o cliente e precisa decidir o proximo passo do funil.

Contexto:
${JSON.stringify({ leadName, feedback }, null, 2)}

Sua tarefa e analisar o relato e devolver APENAS um objeto JSON valido com esta estrutura:
{
  "status_suggestion": "Proposta" | "Atendimento" | "Congelado",
  "timeline_note": "Um resumo profissional de 1 frase para o historico",
  "next_task_title": "Titulo da proxima tarefa",
  "next_task_desc": "Descricao objetiva da tarefa",
  "next_task_hours": 24
}

Regras:
- Se o cliente gostou e quer negociar/comprar, status_suggestion deve ser "Proposta".
- Se o cliente nao gostou, mas quer ver outros imoveis, status_suggestion deve ser "Atendimento".
- Se o cliente desistiu de comprar ou pausou a busca, status_suggestion deve ser "Congelado".
- timeline_note deve ter no maximo 180 caracteres.
- next_task_title deve ter no maximo 80 caracteres.
- next_task_desc deve ter no maximo 220 caracteres.
- next_task_hours deve ser um numero inteiro entre 1 e 168.
- Nao use markdown, comentarios ou texto fora do JSON.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsed = safeJsonParse<VisitFeedbackAnalysis>(response.text());

    return sanitizeVisitFeedbackAnalysis(parsed, leadName, feedback);
  } catch (error) {
    console.error("Aura: Erro ao processar feedback da visita", error);
    return fallback;
  }
};

/**
 * Oráculo (Chat Global): Permite conversação livre com a Aura baseada num histórico e contexto atual.
 */
export const chatWithAura = async (
  message: string,
  history: ChatMessage[],
  userName: string = "Corretor",
  options?: { retries?: number; leadContext?: AuraLeadChatContext }
): Promise<string> => {
  if (!genAI) throw new Error("Gemini API Key não configurada.");
  const retries = options?.retries ?? 3;
  const context = options?.leadContext;

  // INJEÇÃO INVISÍVEL DE CONTEXTO
  // Fornecemos as respostas antes mesmo da Aura perguntar.
  let contextPrompt = '';
  if (context && (context.leadName || context.leadStatus || context.timelineContext)) {
    contextPrompt = `\n\n--- INFORMAÇÕES ATUAIS DO LEAD (USE ISTO, NÃO PERGUNTE O QUE JÁ ESTÁ AQUI) ---\n`;
    if (context.leadName) contextPrompt += `- Nome do Lead: ${context.leadName}\n`;
    if (context.leadStatus) contextPrompt += `- Status no Funil: ${context.leadStatus}\n`;
    if (context.propertyTitle) contextPrompt += `- Imóvel de Interesse: ${context.propertyTitle}\n`;
    if (context.timelineContext && context.timelineContext.length > 0) {
      contextPrompt += `- Histórico Recente (Timeline):\n  * ${context.timelineContext.join('\n  * ')}\n`;
    }
    contextPrompt += `--------------------------------------------------------------------------\n`;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Você é a Aura, a Inteligência Artificial integrada a este CRM Imobiliário.
      Sua missão é ajudar o corretor ${userName} a fechar negócios, resumir a timeline, redigir mensagens e sugerir próximos passos.
      Regras de Ouro:
      1. Seja absurdamente direta, comercial e profissional.
      2. USE O CONTEXTO FORNECIDO! Nunca pergunte "qual o status" ou "qual o interesse" se esses dados já estiverem no bloco de Informações Atuais.
      3. Se não houver informações, aí sim pergunte.
      4. Se o corretor pedir para "resumir" ou "criar uma tarefa", cuspa o texto pronto para ser copiado. Evite enrolações como "Claro, aqui está a sua tarefa:".`
    });

    const formattedHistory = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({ history: formattedHistory });

    // Envia o prompt do usuário + os dados frescos do lead por trás dos panos
    const finalMessage = contextPrompt ? `${contextPrompt}\nPergunta do Corretor: ${message}` : message;

    const result = await chat.sendMessage(finalMessage);
    return result.response.text().trim();
  } catch (error: any) {
    if (error?.message?.includes('503') && retries > 0) {
      console.warn(`Aura Chat: Servidor ocupado (503). Tentando novamente... (${retries} restantes)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return chatWithAura(message, history, userName, { ...options, retries: retries - 1 });
    }
    console.error("Aura Chat: Erro ao gerar resposta", error);
    throw new Error("Desculpe, a minha linha de raciocínio falhou por um momento. Pode repetir?");
  }
};
