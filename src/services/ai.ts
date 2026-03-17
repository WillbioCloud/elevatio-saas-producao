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

export const generateText = async (prompt: string): Promise<string | null> => {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao gerar texto com IA:", error);
    return null;
  }
};

export const generatePropertyDescription = async (propertyFeatures: string): Promise<string | null> => {
  const prompt = `
Atue como um redator imobiliário profissional. Sua tarefa é criar um anúncio padronizado SUBSTITUINDO os colchetes [...] do template abaixo pelos DADOS REAIS DO IMÓVEL, respeitando regras estritas de segurança jurídica.

DADOS DO IMÓVEL A SEREM UTILIZADOS:
${propertyFeatures}

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

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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

export async function autoTagContractTemplate(rawContent: string): Promise<string> {
  if (!genAI) throw new Error("Gemini API Key não configurada.");

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Você é um assistente de IA especialista em contratos imobiliários SaaS.
Sua tarefa é analisar o contrato abaixo e substituir Nomes Próprios, CPFs, RGs, Endereços, Profissões, Estados Civis, Nacionalidades e Valores reais (ou espaços em branco como '________') pelas tags (shortcodes) correspondentes do nosso sistema.

Lista EXATA de tags permitidas:
{{IMOBILIARIA_NOME}}, {{CORRETOR_NOME}}, {{CORRETOR_CRECI}}
{{IMOVEL_TITULO}}, {{IMOVEL_ENDERECO}}, {{IMOVEL_MATRICULA}}
{{VALOR_NEGOCIADO}}, {{VALOR_SINAL}}, {{VALOR_FINANCIAMENTO}}, {{VALOR_FGTS}}, {{VALOR_PERMUTA}}, {{QTD_PARCELAS}}
{{LOCATARIO_NOME}}, {{LOCATARIO_CPF}}, {{LOCATARIO_RG}}, {{LOCATARIO_PROFISSAO}}, {{LOCATARIO_ESTADO_CIVIL}}
{{LOCADOR_NOME}}, {{LOCADOR_CPF}}, {{LOCADOR_RG}}, {{LOCADOR_PROFISSAO}}, {{LOCADOR_ESTADO_CIVIL}}
{{FIADOR_NOME}}, {{FIADOR_CPF}}, {{FIADOR_RG}}, {{FIADOR_PROFISSAO}}, {{FIADOR_ESTADO_CIVIL}}
{{DATA_ATUAL}}

Regras rigorosas:
1. Preserve RIGOROSAMENTE todo o texto jurídico, pontuação, quebras de linha e cláusulas originais.
2. Identifique pelo contexto da frase quem é o Locador (Proprietário/Vendedor) e quem é o Locatário (Inquilino/Comprador) para usar a tag certa.
3. Se o contrato for de Venda, use a família LOCADOR para o Vendedor e a família LOCATARIO para o Comprador.
4. Retorne APENAS o texto do contrato com as tags aplicadas. Não adicione saudações, nem formatação Markdown (como \`\`\` ou dicas).

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
