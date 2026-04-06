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

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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
