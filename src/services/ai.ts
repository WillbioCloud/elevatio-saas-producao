import { GoogleGenerativeAI } from "@google/generative-ai";
import { Lead, Property } from "../types";
import { supabase } from "../lib/supabase";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  console.warn("Gemini API Key não encontrada. Funcionalidades de IA estarão desabilitadas.");
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
  const condoFeaturesText = condoFeatures && condoFeatures.length > 0 ? `\nComodidades do Condomínio: ${condoFeatures.join(', ')}` : '';
  const condominiumContext = condoName
    ? `Informação Adicional: O imóvel fica no condomínio ${condoName}.
Se houver um nome de condomínio, destaque a segurança, infraestrutura e o estilo de vida exclusivo de residir nesta localidade.`
    : '';

  const condominiumContextWithFeatures = condoName
    ? `Informação Adicional: O imóvel fica no condomínio ${condoName}. ${condoFeaturesText}
Se houver um nome de condomínio, destaque a segurança, infraestrutura e o estilo de vida exclusivo de residir nesta localidade, incluindo as comodidades citadas.`
    : condominiumContext;

  const prompt = `
Atue como um redator imobiliário profissional. Sua tarefa é criar um anúncio padronizado SUBSTITUINDO os colchetes [...] do template abaixo pelos DADOS REAIS DO IMÓVEL, respeitando regras estritas de segurança jurídica.

DADOS DO IMÓVEL A SEREM UTILIZADOS:
${propertyFeatures}
${condominiumContextWithFeatures ? `\n${condominiumContextWithFeatures}\n` : ''}

⚠️ REGRAS DE SEGURANÇA JURÍDICA (CRÍTICO):
1. NÃO invente informações. Use APENAS os dados fornecidos. Se algo não foi informado, omita.
2. Nunca mencione metragem, vagas ou quartos se não estiverem nos dados.
3. Nunca cite aceitação de financiamento, permuta ou valor de condomínio se não estiver nos dados.
4. Não use adjetivos exagerados como "imperdível", "maravilhoso", "dos sonhos".
5. Mantenha um tom profissional, limpo e direto.

=== TEMPLATE OBRIGATÓRIO (Preencha os dados reais no lugar dos colchetes) ===
[Emoji correspondente] [Tipo do Imóvel] com [1 Diferencial Principal] - [Bairro]
📍 [Bairro] - [Cidade]/[UF]

📐 Características principais:
(Crie os bullets preenchidos com os dados reais. Exemplo de como deve ficar:
- 150m² de área construída
- 3 quartos (1 suíte)
- 2 vagas de garagem
- Piscina aquecida)

📝 Descrição:
(Escreva 1 ou 2 parágrafos curtos descrevendo o imóvel real. Aplique a diretriz correspondente:
- CASA: Destaque conforto, praticidade, integração e área externa (se houver).
- APARTAMENTO: Destaque praticidade, elevador/lazer (se houver) e localização.
- LOTE/TERRENO: Destaque potencial construtivo e valorização da região.
- SOBRADO: Destaque a divisão entre área íntima e social, espaço e privacidade.
- COBERTURA: Destaque exclusividade, vista, terraço (se houver) e amplitude.)

💰 Valor: [Preço real do imóvel formatado]

(Adicione esta última linha APENAS se os dados informarem financiamento, permuta ou condomínio:)
✔ [Informação financeira adicional real]
========================================

GUIA DE EMOJIS PARA O TÍTULO (Use apenas 1):
- Casa: 🏡
- Apartamento: 🏢
- Terreno/Lote: 🌳
- Sobrado: 🏘
- Cobertura: 🌇

IMPORTANTE: Retorne APENAS o texto do anúncio final preenchido. NÃO imprima os colchetes literais e não inclua saudações.
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
Atue como um corretor sênior.
Analise este Lead (Orçamento: ${lead.budget ?? "não informado"}, Busca: ${lead.desired_type ?? "tipo livre"}, Quartos: ${lead.desired_bedrooms ?? "não informado"}, Localização: ${lead.desired_location ?? "não informada"}) e estes Imóveis Candidatos.
Retorne um JSON com os 3 melhores imóveis, dando uma nota de 0-100 (match_score) e um "match_reason" (uma frase curta de venda explicando por que serve).

Formato obrigatório da resposta:
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
- Use APENAS os imóveis recebidos.
- Traga no máximo 3 itens.
- match_score deve ser número inteiro entre 0 e 100.
- match_reason deve ter no máximo 160 caracteres.
- Não adicione texto fora do JSON.

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

Imóveis Candidatos:
${JSON.stringify(candidateProperties, null, 2)}

HISTÓRICO DE NAVEGAÇÃO RECENTE: ${JSON.stringify(navigationHistory || [])}.
Instrução: Se o cliente visitou imóveis diferentes do perfil declarado, considere isso como um forte sinal de interesse latente.
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
        match_reason: item.match_reason || "Boa opção para o perfil informado."
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
  if (!apiKey) return 'A inteligência artificial está desativada no momento. Configure sua chave da API nas opções da empresa.';

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Usaremos a versão mais recente da API para testes iniciais
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const activeLeads = leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido');
    const delayedTasks = tasks.filter(t => t.status !== 'concluida' && new Date(t.due_date) < new Date());
    const unreadNotifications = notifications.filter(n => !n.read).length;

    const recentWins = gamificationEvents.filter(e => e.action_type === 'deal_closed').length;
    const totalPointsWeek = gamificationEvents.reduce((sum, e) => {
      const isThisWeek = (new Date().getTime() - new Date(e.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
      return isThisWeek ? sum + (e.points_awarded || 0) : sum;
    }, 0);

    const prompt = `Você é a "Aura", a inteligência artificial especialista em vendas imobiliárias do Elevatio.
    Analise os números do corretor ${userName} e dê 3 dicas práticas em formato de bullet points.
    Fale diretamente com o corretor, de forma direta e motivacional.

    Contexto Atual:
    - Patente/Liga: ${userLevelInfo.title} (Nível ${userLevelInfo.level})
    - Pontos ganhos nos últimos 7 dias: ${totalPointsWeek}
    - Negócios fechados na semana: ${recentWins}
    - Leads Ativos: ${activeLeads.length}
    - Tarefas Atrasadas: ${delayedTasks.length}
    - Notificações Não Lidas no Sininho: ${unreadNotifications}

    Regras:
    - Se houver notificações não lidas, alerte sobre o "Sininho".
    - Se houver tarefas atrasadas, sugira focar na "Operação Limpa" (concluir todas).
    - Sugira focar no avanço de leads para somar pontos na gamificação.`;

    const result = await model.generateContent(prompt);
    const response = result.response; // Removido o await desnecessário aqui

    if (!response.text()) {
      throw new Error("A API retornou uma resposta vazia.");
    }

    return response.text();
  } catch (error: any) {
    // Tratamento de erro aprimorado para capturar o motivo real
    console.error('🚨 Erro detalhado no Gemini API (generateCRMInsights):', error);

    let errMsg = 'Falha ao conectar com a Aura. Verifique sua conexão.';

    if (error instanceof Error) {
      errMsg = error.message;
    } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      errMsg = error.message;
    } else if (typeof error === 'string') {
      errMsg = error;
    }

    // Evita lançar um erro com string vazia
    if (!errMsg || errMsg.trim() === '') {
      errMsg = 'Falha silenciosa na API do Google (Possível erro de CORS, cota excedida, ou modelo não suportado).';
      console.warn("Objeto de erro recebido:", JSON.stringify(error)); // Ajuda a debugar
    }

    throw new Error(errMsg);
  }
}

export async function autoTagContractTemplate(rawContent: string): Promise<string> {
  if (!genAI) throw new Error("Gemini API Key não configurada.");

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Você é um Assistente Jurídico Imobiliário. Sua tarefa é ler o contrato bruto fornecido e substituir os dados reais, nomes e valores por nossas TAGS (Shortcodes) padronizadas.

MANTENHA toda a formatação HTML, negritos e estrutura do texto original. APENAS substitua os dados específicos pelas tags abaixo.

Dicionário de Variáveis Disponíveis:

[DADOS DA IMOBILIÁRIA / CORRETOR]
{{IMOBILIARIA_NOME}} - Nome da sua empresa
{{IMOBILIARIA_CNPJ}} - CNPJ da imobiliária
{{IMOBILIARIA_ENDERECO}} - Endereço da imobiliária
{{CORRETOR_NOME}} - Nome do corretor responsável
{{CORRETOR_CRECI}} - CRECI do corretor
{{IMOBILIARIA_ASSINATURA}} - A imagem da assinatura salva nas configurações

[DADOS DO CLIENTE / LOCATÁRIO / COMPRADOR]
{{CLIENTE_NOME}} - Nome completo
{{CLIENTE_CPF}} - CPF ou CNPJ
{{CLIENTE_RG}} - RG
{{CLIENTE_NACIONALIDADE}} - Ex: Brasileiro
{{CLIENTE_PROFISSAO}} - Ex: Engenheiro
{{CLIENTE_ESTADO_CIVIL}} - Ex: Casado, Solteiro
{{CLIENTE_ENDERECO}} - Endereço de residência atual

[DADOS DO PROPRIETÁRIO / LOCADOR / VENDEDOR]
{{PROPRIETARIO_NOME}}
{{PROPRIETARIO_CPF}}
{{PROPRIETARIO_RG}}
{{PROPRIETARIO_ESTADO_CIVIL}}
{{PROPRIETARIO_ENDERECO}}

[DADOS DO IMÓVEL E FINANCEIRO]
{{IMOVEL_ENDERECO}} - Endereço completo do imóvel negociado
{{IMOVEL_MATRICULA}} - Número da matrícula no cartório
{{VALOR_TOTAL}} - Valor total do aluguel ou venda (em números)
{{VALOR_TOTAL_EXTENSO}} - Valor escrito por extenso
{{DATA_VENCIMENTO}} - Dia do vencimento (ex: dia 10)
{{PRAZO_MESES}} - Prazo de vigência do contrato (ex: 30 meses)
{{DATA_ATUAL}} - Data de geração do contrato (ex: 15 de Março de 2026)

Regras rigorosas:
1. Preserve RIGOROSAMENTE todo o texto jurídico, pontuação, quebras de linha e cláusulas originais.
2. Quando o contrato mencionar cliente, locatário ou comprador, normalize para a família CLIENTE.
3. Quando o contrato mencionar proprietário, locador ou vendedor, normalize para a família PROPRIETARIO.
4. Retorne APENAS o texto do contrato com as tags aplicadas. Não adicione saudações, explicações ou formatação Markdown extra.

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
    throw new Error("Não foi possível analisar o contrato no momento.");
  }
}

/**
 * Copiloto de Comunicação: Gera rascunho de WhatsApp baseado no histórico do Lead.
 * Inclui sistema de Retry para lidar com picos temporários de uso na API do Google (Erro 503).
 */
export const generateAuraWhatsAppDraft = async (leadName: string, context: string, retries = 3): Promise<string> => {
  if (!genAI) throw new Error("Gemini API Key não configurada.");

  try {
    // Usando o modelo que a sua API Key reconheceu (pode usar gemini-2.0-flash se preferir)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Atue como um corretor de imóveis de elite, mestre em persuasão e atendimento humanizado.
      Escreva uma mensagem de WhatsApp para o cliente: ${leadName}.
      
      CONTEXTO RECENTE DA TIMELINE DO CLIENTE:
      ${context || 'O cliente acabou de entrar no sistema e aguarda o primeiro contato.'}

      DIRETRIZES:
      1. Tom de voz: Profissional, acolhedor e focado em gerar resposta.
      2. Gatilho de contexto: Use a timeline para personalizar a mensagem.
      3. Estrutura: Direta ao ponto (2 ou 3 parágrafos curtos).
      4. Fechamento: Termine sempre com uma pergunta simples e aberta (Call to Action).
      5. Formatação: Use negrito do WhatsApp (*texto*) nos pontos altos e emojis com muita moderação.
      6. IMPORTANTE: Retorne APENAS o texto da mensagem. Sem introduções, aspas ou comentários extras.
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
    throw new Error("Não foi possível gerar a mensagem com a IA neste momento. Tente novamente em alguns minutos.");
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
    normalized.includes("não quer mais comprar") ||
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
      next_task_title: "🤖 Aura: Registrar motivo da pausa do lead",
      next_task_desc: "Documente o motivo da pausa, confirme quando retomar o contato e mantenha o lead aquecido sem pressao comercial.",
      next_task_hours: 72,
    };
  }

  if (isProposal) {
    return {
      status_suggestion: "Proposta",
      timeline_note: `${leadName} demonstrou interesse concreto no imovel visitado e avancou para tratativas comerciais.`,
      next_task_title: `🤖 Aura: Preparar proposta para ${leadName}`,
      next_task_desc: "Organize a proposta comercial, alinhe margem de negociacao e confirme os proximos documentos necessarios.",
      next_task_hours: 24,
    };
  }

  return {
    status_suggestion: "Atendimento",
    timeline_note: `${leadName} concluiu a visita, mas ainda precisa de novas opcoes aderentes ao perfil informado.`,
    next_task_title: `🤖 Aura: Selecionar novos imoveis para ${leadName}`,
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
 * Loop de Pós-Visita: Analisa o feedback do corretor e decide o destino do Lead.
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
