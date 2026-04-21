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

export type ChatMessageType = 'text' | 'action_prompt';
export type ChatMessageActionVariant = 'primary' | 'secondary' | 'ghost';
export type ChatMessageActionIcon = 'smartphone' | 'edit' | 'task' | 'timeline' | 'lead' | 'cancel';
export type AuraConversationIntent = 'support' | 'commercial' | 'operational' | 'hybrid';
export type AuraAssistantMode = AuraConversationIntent;
export type AuraCapabilityLevel = 'executed' | 'guided' | 'suggested';

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
  capabilityLevel?: AuraCapabilityLevel;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  messageType?: ChatMessageType;
  actions?: ChatMessageAction[];
  assistantMode?: AuraAssistantMode;
  capabilityLevel?: AuraCapabilityLevel;
}

export interface AuraLeadChatContext {
  leadId?: string;
  leadName?: string;
  leadStatus?: string;
  propertyTitle?: string;
  timelineContext?: string[];
  pendingTasks?: string[];
}

export interface AuraRecentLeadOption {
  id: string;
  name: string;
  status?: string | null;
}

export interface AuraGlobalChatContext {
  recentLeads?: AuraRecentLeadOption[];
  pendingTasks?: string[];
  activeLeadId?: string | null;
}

export interface AuraChatOptions {
  retries?: number;
  leadContext?: AuraLeadChatContext;
  globalContext?: AuraGlobalChatContext;
}

export interface AuraChatResponse {
  text: string;
  intent: AuraConversationIntent;
  assistantMode: AuraAssistantMode;
  capabilityLevel: AuraCapabilityLevel;
}

export interface BuildAuraSystemInstructionArgs {
  userName: string;
  intent: AuraConversationIntent;
  leadContext?: AuraLeadChatContext;
  globalContext?: AuraGlobalChatContext;
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

export const AURA_IDENTITY_PROMPT = `
Voce e a Aura, a assistente nativa do Elevatio Vendas.
Voce nao e uma IA generica: voce conhece o produto, fala como especialista no CRM imobiliario e ajuda corretores, atendentes, gestores e admins a usar o sistema com seguranca.
Sua voz e direta, humana, consultiva e operacional. Quando o tema for comercial, pense como diretora comercial senior. Quando o tema for suporte, pense como suporte N1 do proprio Elevatio Vendas.
Fale em portugues do Brasil. Use o nome do usuario quando isso deixar a resposta mais natural, mas nao force saudacoes longas.
`.trim();

export const AURA_COMMERCIAL_RULES = `
REGRAS DO MODO COPILOTO COMERCIAL
- Use o contexto do lead antes de pedir qualquer informacao. Nao pergunte o que ja esta no contexto.
- Ajude com atendimento, WhatsApp, follow-up, resumo, objecoes, risco de esfriar, prioridade e proximos passos.
- Seja estrategica, especifica e orientada a conversao.
- Se existir lead em foco, trate-o como o centro da resposta.
- Se nao existir lead em foco, use o contexto global: leads recentes, tarefas pendentes e lead ativo.
- Evite respostas genericas. Entregue texto pronto, plano de acao ou diagnostico.
- Nao diga "preciso de mais contexto" quando houver dados suficientes para sugerir um caminho seguro.
`.trim();

export const AURA_SUPPORT_RULES = `
REGRAS DO MODO SUPORTE N1 DO SISTEMA
- Responda como especialista no Elevatio Vendas, nao como manual generico de CRM.
- Priorize a base de conhecimento do produto.
- Respostas devem ser curtas, didaticas e objetivas.
- Quando fizer sentido, use este formato:
  1. Titulo curto
  2. Caminho: Modulo > Aba > Acao
  3. Passos numerados ou bullets curtos
  4. Observacao final somente se for util
- Explique onde clicar, em qual aba ir, o que cada modulo faz e o fluxo correto.
- Se a acao ainda nao for automatica pela Aura, oriente passo a passo sem fingir que executou.
`.trim();

export const AURA_CAPABILITY_GUARDRAILS = `
GUARDRAILS DE CAPACIDADE DA AURA
- Nunca prometa que executou algo se a resposta apenas preparou orientacao ou texto.
- Voce pode preparar mensagens, resumos, scripts, proximos passos e notas.
- No widget, existem atalhos reais para: abrir rascunho no WhatsApp, abrir lead, criar tarefa e registrar nota na timeline quando houver contexto suficiente.
- Criar tarefa e registrar timeline so acontecem quando o usuario aciona o botao correspondente no widget.
- Se a acao for real, fale como acao executavel: "posso deixar o botao para executar" ou "use Executar para criar".
- Se a acao nao estiver disponivel ou faltar contexto, fale como orientacao guiada: "posso te orientar passo a passo" ou "ainda nao executo isso automaticamente".
- Diferencie verbos:
  - "posso abrir": abrir tela, link ou WhatsApp quando houver atalho.
  - "posso preparar": criar texto, roteiro, nota ou plano.
  - "posso sugerir": recomendar prioridade, proximo passo ou abordagem.
  - "posso registrar": somente quando houver lead em foco e o widget oferecer o botao de registro.
  - "ainda nao executo isso automaticamente": para alteracoes sem atalho real.
`.trim();

const ELEVATIO_KNOWLEDGE_SECTIONS = [
  {
    title: 'Visao geral',
    bullets: [
      'O Elevatio Vendas e um SaaS multi-tenant para imobiliarias, combinando site publico, vitrine de imoveis e CRM administrativo.',
      'Cada imobiliaria opera dentro da sua empresa/tenant, com usuarios, leads, tarefas, imoveis, configuracoes, site_data e limites ligados ao plano.',
      'O sistema atende jornada publica de captacao e jornada interna de atendimento, gestao comercial, contratos, financeiro, chaves e gamificacao.'
    ],
  },
  {
    title: 'Dashboard',
    bullets: [
      'Entrada principal do CRM. Mostra indicadores, carteira, tarefas, alertas, desempenho e atalhos.',
      'Use para decidir o que atacar primeiro no dia: leads recentes, tarefas atrasadas, notificacoes e oportunidades quentes.',
      'Caminho comum: Dashboard > card/atalho desejado > abrir modulo relacionado.'
    ],
  },
  {
    title: 'Imoveis',
    bullets: [
      'Modulo para cadastrar, editar e publicar imoveis de venda ou locacao.',
      'Inclui dados basicos, preco, endereco, caracteristicas, fotos, tipo, finalidade, destaque e informacoes de exibicao na vitrine.',
      'Fluxo: Imoveis > Novo Imovel > preencher dados > enviar fotos > salvar/publicar.',
      'Permissoes podem limitar corretores conforme configuracao da empresa.'
    ],
  },
  {
    title: 'Leads e funil',
    bullets: [
      'Leads representam oportunidades comerciais vindas do site, campanha, cadastro manual ou atendimento.',
      'Funil principal: pre-atendimento > atendimento > proposta > venda_ganha > perdido.',
      'O Kanban organiza leads por status; mover um card muda o estagio e pode disparar eventos, tarefas e gamificacao.',
      'No card ou detalhe do lead ficam nome, status, origem, responsavel, imovel/perfil de interesse, historico, timeline e tarefas pendentes.',
      'Fluxo recomendado: abrir lead > ler contexto > registrar contato > criar tarefa > mover no funil quando houver avanco real.'
    ],
  },
  {
    title: 'Clientes',
    bullets: [
      'Clientes consolidam informacoes pessoais e cadastrais usadas em negociacao, contratos e relacionamento.',
      'Podem incluir documento, contato, endereco e dados necessarios para contrato ou locacao.',
      'Quando houver duvida entre lead e cliente: lead e oportunidade em atendimento; cliente e cadastro mais consolidado.'
    ],
  },
  {
    title: 'Tarefas e agenda',
    bullets: [
      'Tarefas organizam follow-ups, ligacoes, visitas, reunioes, retorno de proposta e pendencias internas.',
      'Campos reais usados no sistema: company_id, user_id, lead_id, title, description, due_date, status pendente/concluida e completed.',
      'Fluxo: Tarefas > Nova > titulo > descricao > data/hora > prioridade > lead associado > salvar.',
      'Tarefas podem aparecer no contexto da Aura e no painel do corretor.'
    ],
  },
  {
    title: 'Timeline e historico',
    bullets: [
      'A timeline do lead registra notas, mudancas de status, contatos, WhatsApp, eventos de sistema e decisoes importantes.',
      'Use notas para documentar objeecoes, visitas, combinados, proximos passos e resumo de atendimento.',
      'Fluxo: Leads > abrir card > Timeline/Historico > adicionar nota.',
      'A Aura pode preparar uma nota; o registro automatico so deve acontecer quando existir lead em foco e o botao executar for acionado.'
    ],
  },
  {
    title: 'Contratos e assinaturas',
    bullets: [
      'Contratos atendem venda, locacao e documentos administrativos.',
      'Templates podem usar variaveis/shortcodes para preencher dados de imobiliaria, cliente, proprietario, imovel e valores.',
      'Fluxo: Contratos > escolher tipo/template > revisar dados > gerar documento > coletar assinatura.',
      'Assinaturas digitais dependem da configuracao e do fluxo habilitado; quando nao houver automacao, oriente o usuario a revisar e enviar pelo processo configurado.'
    ],
  },
  {
    title: 'Financeiro e cobrancas',
    bullets: [
      'Financeiro acompanha contratos, faturas, status de pagamento e integracoes de cobranca.',
      'Asaas/Cora podem ser usados conforme configuracao da empresa.',
      'Chamadas financeiras criticas usam fetch nativo no frontend quando passam por Edge Functions.',
      'Fluxo de cobranca: Financeiro > contrato/cliente > gerar cobranca > conferir link/status > acompanhar pagamento.'
    ],
  },
  {
    title: 'Analytics',
    bullets: [
      'Modulo para leitura de performance comercial, funil, conversao, tarefas, leads e produtividade.',
      'Use para gestores analisarem origem de leads, gargalos, propostas, ganhos e perdas.',
      'Quando o usuario pedir leitura de numeros, responda com diagnostico e acao recomendada.'
    ],
  },
  {
    title: 'Ranking, TV e gamificacao',
    bullets: [
      'A Liga dos Corretores usa gamification_events como fonte de eventos e profiles.xp_points como total de pontos atual.',
      'O Ranking/TV mostra classificacao ao vivo via Supabase Realtime.',
      'Pontos devem respeitar addGamificationEvent e o escudo anti-farming. Nao crie atalhos paralelos de pontuacao no frontend.',
      'Acoes como visita, proposta e fechamento podem alimentar o jogo quando implementadas pelo fluxo correto.'
    ],
  },
  {
    title: 'Chaves',
    bullets: [
      'Modulo para controlar retirada, devolucao e disponibilidade de chaves de imoveis.',
      'Use para registrar quem esta com a chave, qual imovel, prazo e status.',
      'Fluxo comum: Chaves > localizar imovel/chave > registrar retirada ou devolucao > salvar observacao.'
    ],
  },
  {
    title: 'Configuracoes',
    bullets: [
      'Central de parametros da imobiliaria: usuarios, permissoes, dados da empresa, site, integracoes, financeiro, logos e assinatura.',
      'Cores, textos, logos e personalizacoes do site ficam em site_data da tabela companies.',
      'Permissoes definem o que corretores, atendentes, gestores e owners podem fazer.'
    ],
  },
  {
    title: 'Suporte',
    bullets: [
      'Modulo ou area para ajuda operacional, duvidas do produto e contato com atendimento.',
      'A Aura atua como suporte N1: explica caminho, fluxo correto, diferenca entre modulos e limites de capacidade.',
      'Quando o problema for bug, erro de permissao ou falha externa, oriente a coletar tela, horario, usuario e acao feita.'
    ],
  },
  {
    title: 'Painel SaaS e Super Admin',
    bullets: [
      'Area para gestao da plataforma como SaaS: empresas, planos, status, limites, tenants, contratos do SaaS e configuracoes globais.',
      'Uso restrito a super_admin/owners habilitados.',
      'Nao oriente corretores comuns a acessar funcoes de super admin se a permissao nao estiver clara.'
    ],
  },
  {
    title: 'Site, vitrine, templates e dominio',
    bullets: [
      'O site publico usa TenantContext para resolver subdominios, inclusive *.localhost no desenvolvimento.',
      'Templates definem aparencia e estrutura da vitrine.',
      'Dominio/subdominio, textos, cores e logos sao configurados por empresa.',
      'Fluxo: Configuracoes > Site/Vitrine > escolher template > ajustar identidade > configurar dominio > salvar/publicar.'
    ],
  },
  {
    title: 'Planos SaaS e limites',
    bullets: [
      'Planos podem limitar usuarios, recursos, status do contrato, trial e acesso a funcionalidades.',
      'Se o usuario perguntar por limite bloqueado, explique que depende do plano e oriente o caminho de configuracao/financeiro.',
      'Para cobranca do SaaS, contratos e pagamentos devem seguir a integracao financeira configurada.'
    ],
  },
  {
    title: 'Diferenca entre orientar e executar',
    bullets: [
      'A Aura orienta qualquer fluxo conhecido do sistema.',
      'A Aura prepara textos, notas, tarefas e mensagens.',
      'A Aura executa somente acoes que o widget ou tela oferecem como atalho real.',
      'Sem botao real ou sem dados obrigatorios, a resposta deve ser guiada e transparente.'
    ],
  },
] as const;

export const ELEVATIO_KNOWLEDGE_BASE = ELEVATIO_KNOWLEDGE_SECTIONS
  .map((section) => {
    const bullets = section.bullets.map((item) => `- ${item}`).join('\n');
    return `## ${section.title}\n${bullets}`;
  })
  .join('\n\n');

const normalizeAuraIntentText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const matchesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const SUPPORT_INTENT_PATTERNS = [
  /\bonde (fica|clico|acho|encontro|configuro|vejo)\b/,
  /\bcomo (faco|fazer|cadastrar|gerar|mudar|alterar|configurar|usar|funciona|salvar|publicar)\b/,
  /\bo que (e|significa|faz)\b/,
  /\bqual (aba|menu|caminho|modulo|botao)\b/,
  /\b(aba|menu|modulo|tela|botao|configuracoes|suporte|site|vitrine|dominio|template)\b/,
];

const COMMERCIAL_INTENT_PATTERNS = [
  /\b(lead|leads|cliente|clientes|atendimento|whatsapp|mensagem|follow[- ]?up|retorno|proximo passo|proxima acao)\b/,
  /\b(resuma|resumo|abordagem|destravar|converter|conversao|objecao|objecoes|risco de esfriar|esfriar|prioridade|proposta)\b/,
  /\b(venda|locacao|negociacao|fechamento|visita|interesse|imovel de interesse)\b/,
];

const OPERATIONAL_INTENT_PATTERNS = [
  /\b(crie|criar|registre|registrar|abrir|abra|mudar|mude|alterar|altere|gerar|gere|adicionar|adicione|agendar|agende|salvar|salve|executar|execute)\b/,
  /\b(tarefa|historico|timeline|nota|status|funil|kanban|chave|contrato|assinatura|cobranca|boleto|fatura)\b/,
];

const DIRECT_OPERATION_PATTERNS = [
  /\b(crie|registre|abra|mude|altere|gere|adicione|agende|salve|execute)\b/,
  /\bquero (criar|registrar|abrir|mudar|alterar|gerar|adicionar|agendar|salvar)\b/,
];

export const classifyAuraIntent = (
  message: string,
  leadContext?: AuraLeadChatContext,
  globalContext?: AuraGlobalChatContext
): AuraConversationIntent => {
  const normalizedMessage = normalizeAuraIntentText(message);
  const hasLeadContext = Boolean(leadContext?.leadId || leadContext?.leadName || globalContext?.activeLeadId);
  const hasSupportSignal = matchesAny(normalizedMessage, SUPPORT_INTENT_PATTERNS);
  const hasCommercialSignal = matchesAny(normalizedMessage, COMMERCIAL_INTENT_PATTERNS) || hasLeadContext;
  const hasOperationalSignal = matchesAny(normalizedMessage, OPERATIONAL_INTENT_PATTERNS);
  const hasDirectOperation = matchesAny(normalizedMessage, DIRECT_OPERATION_PATTERNS);

  if ((hasSupportSignal || hasOperationalSignal) && hasCommercialSignal && /(\be depois\b|\bapos\b|\btambem\b|whatsapp|mensagem|follow[- ]?up|proximo passo|lead|cliente)/.test(normalizedMessage)) {
    return 'hybrid';
  }

  if (hasOperationalSignal && (hasDirectOperation || /\b(tarefa|historico|timeline|status|contrato|assinatura|chave)\b/.test(normalizedMessage))) {
    return 'operational';
  }

  if (hasSupportSignal) return 'support';
  if (hasCommercialSignal) return 'commercial';

  return hasLeadContext ? 'commercial' : 'support';
};

export const chatWithAura = async (
  message: string,
  history: ChatMessage[],
  userName: string = "Corretor",
  options?: AuraChatOptions
): Promise<AuraChatResponse> => {
  const retries = options?.retries ?? 3;
  const leadContext = options?.leadContext;
  const globalContext = options?.globalContext;
  const intent = classifyAuraIntent(message, leadContext, globalContext);
  const capabilityLevel = resolveAuraCapabilityLevel(message, intent, leadContext);
  const assistantMode: AuraAssistantMode = intent;

  const fallbackResponse = (): AuraChatResponse => ({
    text: getLocalAuraFallback(message, intent, leadContext, globalContext),
    intent,
    assistantMode,
    capabilityLevel,
  });

  if (!genAI) return fallbackResponse();

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildAuraSystemInstruction({
        userName,
        intent,
        leadContext,
        globalContext,
      }),
    });

    const formattedHistory = history.slice(-12).map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(`Mensagem do usuario (${intent}): ${message}`);
    const text = result.response.text().trim();

    if (!text) return fallbackResponse();

    return {
      text,
      intent,
      assistantMode,
      capabilityLevel,
    };
  } catch (error: any) {
    if (error?.message?.includes('503') && retries > 0) {
      console.warn(`Aura Chat: Servidor ocupado (503). Tentando novamente... (${retries} restantes)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return chatWithAura(message, history, userName, { ...options, retries: retries - 1 });
    }

    console.error("Aura Chat: Erro ao gerar resposta", error);
    return fallbackResponse();
  }
};

const resolveAuraCapabilityLevel = (
  message: string,
  intent: AuraConversationIntent,
  leadContext?: AuraLeadChatContext
): AuraCapabilityLevel => {
  const normalizedMessage = normalizeAuraIntentText(message);

  if (intent === 'support') return 'guided';

  const asksExecutableAction = matchesAny(normalizedMessage, DIRECT_OPERATION_PATTERNS);
  const canPersistTask = /\btarefa\b/.test(normalizedMessage);
  const canPersistTimeline = /\b(historico|timeline|nota)\b/.test(normalizedMessage) && Boolean(leadContext?.leadId);

  if (intent === 'operational' && asksExecutableAction && (canPersistTask || canPersistTimeline)) {
    return 'suggested';
  }

  if (intent === 'operational') return 'guided';
  return 'suggested';
};

const formatAuraGlobalContext = (globalContext?: AuraGlobalChatContext) => {
  if (
    !globalContext ||
    (!globalContext.recentLeads?.length && !globalContext.pendingTasks?.length && !globalContext.activeLeadId)
  ) {
    return '';
  }

  const lines = ['--- CONTEXTO GLOBAL DO CORRETOR ---'];

  if (globalContext.recentLeads?.length) {
    lines.push('- Leads recentes (o corretor pode escolher por numero ou nome):');
    globalContext.recentLeads.slice(0, 10).forEach((lead, index) => {
      lines.push(`  ${index + 1}. ${lead.name}${lead.status ? ` - ${lead.status}` : ''}`);
    });
  }

  if (globalContext.pendingTasks?.length) {
    lines.push('- Tarefas pendentes do dia:');
    globalContext.pendingTasks.slice(0, 10).forEach((task) => lines.push(`  * ${task}`));
  }

  if (globalContext.activeLeadId) {
    lines.push(`- Lead ativo no chat: ${globalContext.activeLeadId}`);
  }

  lines.push('----------------------------------');
  return lines.join('\n');
};

const formatAuraLeadContext = (leadContext?: AuraLeadChatContext) => {
  if (
    !leadContext ||
    (!leadContext.leadName &&
      !leadContext.leadStatus &&
      !leadContext.propertyTitle &&
      !leadContext.timelineContext?.length &&
      !leadContext.pendingTasks?.length)
  ) {
    return '';
  }

  const lines = ['--- CONTEXTO ATUAL DO LEAD (USE ISTO, NAO PERGUNTE O QUE JA ESTA AQUI) ---'];
  if (leadContext.leadId) lines.push(`- ID do Lead: ${leadContext.leadId}`);
  if (leadContext.leadName) lines.push(`- Nome do Lead: ${leadContext.leadName}`);
  if (leadContext.leadStatus) lines.push(`- Status no Funil: ${leadContext.leadStatus}`);
  if (leadContext.propertyTitle) lines.push(`- Imovel/Perfil de Interesse: ${leadContext.propertyTitle}`);

  if (leadContext.timelineContext?.length) {
    lines.push('- Historico recente:');
    leadContext.timelineContext.forEach((item) => lines.push(`  * ${item}`));
  }

  if (leadContext.pendingTasks?.length) {
    lines.push('- Tarefas pendentes ligadas ao lead:');
    leadContext.pendingTasks.forEach((item) => lines.push(`  * ${item}`));
  }

  lines.push('------------------------------------------------------------------------');
  return lines.join('\n');
};

const getAuraRulesForIntent = (intent: AuraConversationIntent) => {
  if (intent === 'support') return AURA_SUPPORT_RULES;
  if (intent === 'commercial') return AURA_COMMERCIAL_RULES;
  if (intent === 'operational') {
    return [
      AURA_SUPPORT_RULES,
      'REGRAS DO MODO OPERACIONAL\n- Identifique se a solicitacao e executavel pelo widget ou se exige orientacao manual.\n- Para criar tarefa ou registrar timeline, prepare titulo/descricao/nota com clareza e explique que o botao Executar fara a persistencia real.\n- Para contrato, chave, assinatura, cobranca ou mudanca de status sem atalho real, entregue caminho operacional e diga que ainda nao executa automaticamente.'
    ].join('\n\n');
  }

  return [
    AURA_SUPPORT_RULES,
    AURA_COMMERCIAL_RULES,
    'REGRAS DO MODO HIBRIDO\n- Responda primeiro a duvida operacional ou de suporte.\n- Depois, se fizer sentido, sugira uma acao comercial curta e concreta.\n- Nao misture tudo em um texto longo; separe em blocos curtos.'
  ].join('\n\n');
};

export const buildAuraSystemInstruction = ({
  userName,
  intent,
  leadContext,
  globalContext,
}: BuildAuraSystemInstructionArgs): string => {
  const contextPriority =
    intent === 'support'
      ? 'Prioridade: responda pela base de conhecimento do Elevatio. Use contexto comercial apenas se a pergunta mencionar lead/atendimento.'
      : intent === 'commercial'
        ? 'Prioridade: use o contexto do lead e o contexto global antes da base de conhecimento.'
        : intent === 'hybrid'
          ? 'Prioridade: resolva o caminho operacional primeiro e conecte ao proximo passo comercial.'
          : 'Prioridade: diferencie acao executavel, orientacao guiada e conteudo preparado.';

  const responseStyle =
    intent === 'support'
      ? 'Estilo de resposta: curta, didatica, com "Caminho:" quando houver navegacao. Evite excesso de texto.'
      : intent === 'commercial'
        ? 'Estilo de resposta: estrategica, direta, com plano comercial ou mensagem pronta quando pedido.'
        : intent === 'hybrid'
          ? 'Estilo de resposta: dois blocos curtos: "Como fazer" e "Proximo movimento".'
          : 'Estilo de resposta: objetivo, deixando claro o que esta pronto e o que exige botao/acao do usuario.';

  return [
    AURA_IDENTITY_PROMPT,
    `Usuario atual: ${userName || 'Corretor'}`,
    `Intencao detectada: ${intent}`,
    contextPriority,
    responseStyle,
    getAuraRulesForIntent(intent),
    AURA_CAPABILITY_GUARDRAILS,
    `BASE DE CONHECIMENTO DO ELEVATIO VENDAS\n${ELEVATIO_KNOWLEDGE_BASE}`,
    formatAuraGlobalContext(globalContext),
    formatAuraLeadContext(leadContext),
    'REGRAS FINAIS\n- Nao invente dados que nao constam no contexto.\n- Se faltar dado obrigatorio para executar, explique o dado faltante e ofereca orientacao.\n- Nao responda em JSON.\n- Use Markdown leve apenas quando ajudar a leitura.'
  ]
    .filter(Boolean)
    .join('\n\n');
};

const getLocalAuraFallback = (
  message: string,
  intent: AuraConversationIntent,
  leadContext?: AuraLeadChatContext,
  globalContext?: AuraGlobalChatContext
) => {
  const normalizedMessage = normalizeAuraIntentText(message);
  const leadName = leadContext?.leadName || 'este lead';

  if (intent === 'support' || intent === 'operational') {
    if (normalizedMessage.includes('imovel')) {
      return 'Cadastro de imovel\n\nCaminho: Imoveis > Novo Imovel\n\n- Preencha tipo, finalidade, preco e endereco.\n- Adicione caracteristicas e fotos.\n- Revise se deve aparecer na vitrine.\n- Salve ou publique conforme a permissao da sua empresa.';
    }

    if (normalizedMessage.includes('contrato')) {
      return 'Gerar contrato\n\nCaminho: Contratos > Novo contrato\n\n- Escolha venda, locacao ou administrativo.\n- Selecione o template.\n- Confira cliente, proprietario, imovel e valores.\n- Gere o documento e siga o fluxo de assinatura configurado.';
    }

    if (normalizedMessage.includes('chave')) {
      return 'Gestao de chaves\n\nCaminho: Chaves > localizar imovel/chave\n\n- Confira disponibilidade.\n- Registre retirada ou devolucao.\n- Informe responsavel, prazo e observacao.\n- Salve para manter o controle da imobiliaria.';
    }

    if (normalizedMessage.includes('site') || normalizedMessage.includes('dominio') || normalizedMessage.includes('template')) {
      return 'Configurar site\n\nCaminho: Configuracoes > Site/Vitrine\n\n- Ajuste template, cores, textos e logo.\n- Confira subdominio ou dominio.\n- Salve as alteracoes para atualizar a vitrine da imobiliaria.';
    }

    if (normalizedMessage.includes('tarefa')) {
      return `Tarefa pronta para organizar o atendimento\n\nCaminho: Tarefas > Nova\n\n- Titulo: Follow-up com ${leadName}\n- Descricao: revisar contexto, fazer contato e registrar retorno.\n- Vencimento sugerido: hoje ou proximo horario util.\n\nSe aparecer o botao Executar tarefa, ele cria a tarefa de verdade.`;
    }

    return 'Caminho rapido\n\nUse o menu lateral do CRM e abra o modulo relacionado: Dashboard, Imoveis, Leads, Tarefas, Contratos, Financeiro, Chaves ou Configuracoes. Se a acao nao tiver botao da Aura, eu posso te orientar passo a passo sem fingir que executei.';
  }

  if (leadContext?.leadName) {
    return `Resumo comercial de ${leadContext.leadName}\n\n- Status atual: ${leadContext.leadStatus || 'nao informado'}.\n- Interesse: ${leadContext.propertyTitle || 'nao definido'}.\n- Proximo passo: enviar contato curto, confirmar interesse e criar uma tarefa de retorno.\n\nSugestao: trabalhe uma pergunta simples para gerar resposta e registre a interacao na timeline.`;
  }

  const recentLeads = globalContext?.recentLeads?.slice(0, 3).map((lead, index) => `${index + 1}. ${lead.name}${lead.status ? ` - ${lead.status}` : ''}`).join('\n');
  return recentLeads
    ? `Leads para priorizar agora:\n${recentLeads}\n\nEscolha um deles pelo nome ou numero para eu aprofundar o atendimento.`
    : 'Posso te ajudar a resumir leads, preparar WhatsApp, definir follow-up ou explicar qualquer modulo do Elevatio Vendas.';
};

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

✨ Características principais:
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
- Casa: 🏠
- Apartamento: 🏢
- Terreno/Lote: 🌳
- Sobrado: 🏡
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
      ? `Revise a observação inicial de ${lead.name} e envie a primeira mensagem de qualificação.`
      : `Entre em contato com ${lead.name} para entender o perfil de busca e registrar as preferências iniciais.`,
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
Você é a Aura, uma IA especialista em rotina comercial imobiliária.
Analise o lead recém-criado e sugira a próxima ação inicial para o corretor.

Retorne APENAS um JSON válido neste formato:
{
  "title": "Título curto da tarefa",
  "description": "Descrição objetiva para orientar o corretor",
  "priority": "alta",
  "due_in_hours": 24
}

Regras:
- Não invente informações.
- O título deve ter no máximo 80 caracteres.
- A descrição deve ter no máximo 220 caracteres.
- priority deve ser "alta", "media" ou "baixa".
- due_in_hours deve ser um número entre 1 e 72.
- Se houver observação/mensagem inicial, use isso para orientar a primeira abordagem.

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
    console.error("Erro ao sugerir próximos passos do lead com IA:", error);
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
      timeline_note: `${leadName} sinalizou pausa na busca após a visita, exigindo acompanhamento futuro mais leve.`,
      next_task_title: "🤖 Aura: Registrar motivo da pausa do lead",
      next_task_desc: "Documente o motivo da pausa, confirme quando retomar o contato e mantenha o lead aquecido sem pressão comercial.",
      next_task_hours: 72,
    };
  }

  if (isProposal) {
    return {
      status_suggestion: "Proposta",
      timeline_note: `${leadName} demonstrou interesse concreto no imóvel visitado e avançou para tratativas comerciais.`,
      next_task_title: `🤖 Aura: Preparar proposta para ${leadName}`,
      next_task_desc: "Organize a proposta comercial, alinhe margem de negociação e confirme os próximos documentos necessários.",
      next_task_hours: 24,
    };
  }

  return {
    status_suggestion: "Atendimento",
    timeline_note: `${leadName} concluiu a visita, mas ainda precisa de novas opções aderentes ao perfil informado.`,
    next_task_title: `🤖 Aura: Selecionar novos imóveis para ${leadName}`,
    next_task_desc: "Revise os pontos levantados na visita e envie novas sugestões com melhor encaixe de perfil, valor ou localização.",
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
Você é a inteligência por trás de um CRM imobiliário.
O corretor acabou de realizar uma visita com o cliente e precisa decidir o próximo passo do funil.

Contexto:
${JSON.stringify({ leadName, feedback }, null, 2)}

Sua tarefa é analisar o relato e devolver APENAS um objeto JSON válido com esta estrutura:
{
  "status_suggestion": "Proposta" | "Atendimento" | "Congelado",
  "timeline_note": "Um resumo profissional de 1 frase para o histórico",
  "next_task_title": "Título da próxima tarefa",
  "next_task_desc": "Descrição objetiva da tarefa",
  "next_task_hours": 24
}

Regras:
- Se o cliente gostou e quer negociar/comprar, status_suggestion deve ser "Proposta".
- Se o cliente não gostou, mas quer ver outros imóveis, status_suggestion deve ser "Atendimento".
- Se o cliente desistiu de comprar ou pausou a busca, status_suggestion deve ser "Congelado".
- timeline_note deve ter no máximo 180 caracteres.
- next_task_title deve ter no máximo 80 caracteres.
- next_task_desc deve ter no máximo 220 caracteres.
- next_task_hours deve ser um número inteiro entre 1 e 168.
- Não use markdown, comentários ou texto fora do JSON.
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
