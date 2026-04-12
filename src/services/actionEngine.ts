import { supabase } from '../lib/supabase';
import type { Lead } from '../types';

const SUPPORTED_SUGGESTED_STATUSES = ['Atendimento', 'Visita', 'Proposta'] as const satisfies readonly Extract<Lead['status'], string>[];

type SuggestedLeadStatus = (typeof SUPPORTED_SUGGESTED_STATUSES)[number];
type TaskPriority = 'alta' | 'media' | 'baixa';

const ACTION_INTENT_IDS = [
  'first_contact',
  'no_reply',
  'contact_replied',
  'callback_scheduled',
  'contact_resumed',
  'interest_shown',
  'wants_more_options',
  'rejected_property',
  'simulation_requested',
  'financing_interest',
  'rental_intent',
  'purchase_intent',
  'specific_requirements',
  'visit_suggested',
  'visit_scheduled',
  'visit_confirmed',
  'visit_rescheduled',
  'visit_canceled',
  'visit_done',
  'visit_no_show',
  'liked_property',
  'disliked_property',
  'needs_time',
  'family_alignment',
  'second_visit_requested',
  'proposal_sent',
  'proposal_discussed',
  'counterproposal',
  'discount_requested',
  'awaiting_response',
  'negotiating',
  'contract_started',
  'documents_pending',
  'awaiting_signature',
  'deal_closed',
  'lead_warming_down',
  'lead_cold',
  'client_disappeared',
  'no_response_timeout',
  'follow_up_needed',
  'key_issue',
  'key_confirmed',
  'property_unavailable',
  'property_reserved',
  'operational_conflict',
] as const;

type DefinedActionIntent = (typeof ACTION_INTENT_IDS)[number];
type IntentTrigger = string | string[];
type NormalizedIntentTrigger = string | string[];

export type ActionIntent = DefinedActionIntent | null;

export interface IntentResult {
  intent: ActionIntent;
  confidence: 'high' | 'medium' | 'low';
  question?: string;
  suggestedStatus?: SuggestedLeadStatus;
  originalText?: string;
}

type ConfidenceLevel = IntentResult['confidence'];
type IntentEntry = readonly [DefinedActionIntent, IntentDefinitionConfig];

interface IntentDefinitionConfig {
  priority: number;
  triggers: IntentTrigger[];
  excludeTriggers?: string[];
  question: string;
  suggestedStatus?: SuggestedLeadStatus;
  taskTitle?: string;
  taskDescTemplate?: string;
  taskHours?: number;
  taskPriority?: TaskPriority;
  scheduleAware?: boolean;
  maxConfidence?: ConfidenceLevel;
}

interface IntentDefinition extends IntentDefinitionConfig {
  id: DefinedActionIntent;
  triggers: IntentTrigger[];
  normalizedTriggers: NormalizedIntentTrigger[];
  normalizedExcludeTriggers: string[];
}

interface IntentCandidate {
  definition: IntentDefinition;
  matchedTriggers: string[];
  longestTriggerLength: number;
  score: number;
}

interface TimelineTextSignals {
  ambiguityHits: string[];
  strongActionHits: string[];
  tokenCount: number;
  hasSpecificDate: boolean;
  hasSpecificTime: boolean;
  hasTemporalContext: boolean;
  isLowSignalPhrase: boolean;
  isIncompletePhrase: boolean;
}

interface ExtractedTimeParts {
  hours: number;
  minutes: number;
}

interface ExistingTaskSnapshot {
  title?: string | null;
  status?: string | null;
  completed?: boolean | null;
  created_at?: string | null;
}

interface LeadActionSnapshot {
  assigned_to?: string | null;
  status?: string | null;
}

interface MatchedIntentTrigger {
  label: string;
  length: number;
}

type TaskDeduplicationState = 'clear' | 'duplicate' | 'unknown';

const AMBIGUITY_MODIFIERS = [
  'acho',
  'talvez',
  'parece',
  'vamos ver',
  'depois vejo',
  'quem sabe',
  'pode ser',
  'ficou de ver',
  'deve',
  'provavelmente',
  'se der',
  'qualquer coisa',
  'por enquanto',
  'vou tentar',
  'quase certo',
  'deve visitar',
  'talvez gostou',
  'tentar',
];
const LOW_SIGNAL_EXACT_PHRASES = ['ok', 'falado', 'visto', 'vamos', 'depois'];
const INCOMPLETE_PHRASES = [
  'vamos ver',
  'depois vejo',
  'quem sabe',
  'pode ser',
  'ficou de ver',
  'se der',
  'qualquer coisa',
  'por enquanto',
  'vou tentar',
];
const STRONG_ACTION_MARKERS = [
  'agendei',
  'agendada',
  'agendado',
  'marcou',
  'marcada',
  'marcamos',
  'confirmou',
  'confirmada',
  'reagendei',
  'remarcada',
  'remarcamos',
  'cancelou',
  'cancelada',
  'desmarcou',
  'visitou',
  'fizemos',
  'mostrei',
  'enviou',
  'enviada',
  'mandei',
  'encaminhei',
  'formalizei',
  'recebi',
  'iniciamos',
  'abri',
  'assinou',
  'fechamos',
  'fechou',
  'solicitou',
  'pediu',
  'retomei',
  'reativei',
  'liguei',
  'respondeu',
  'reservado',
  'reserva feita',
  'reserva confirmada',
  'concluida',
  'realizada',
];
const TODAY_REGEX = /\bhoje\b/;
const TOMORROW_REGEX = /\bamanha\b/;
const DAY_OF_MONTH_REGEX = /\bdia\s+(\d{1,2})(?!\d)\b/;
const HOUR_WITH_PREFIX_REGEX = /\b(?:as|das)\s+(\d{1,2})(?:(?::|h)(\d{2}))?\b/;
const HOUR_WITH_H_REGEX = /\b(\d{1,2})h(?:\s*(\d{2}))?\b/;
const HOUR_COLON_REGEX = /\b(\d{1,2}):(\d{2})\b/;
const AURA_TASK_MARKER = 'aura:';
const OPEN_TASK_STATUSES = new Set(['pendente', 'pending', 'em andamento', 'em_andamento']);
const VALID_SUGGESTED_STATUS_SET = new Set<SuggestedLeadStatus>(SUPPORTED_SUGGESTED_STATUSES);

const CONTACT_SILENCE_TRIGGERS = [
  'nao atende',
  'nao atendeu',
  'nao respondeu',
  'sem resposta',
  'caixa postal',
  'visualizou e nao respondeu',
  'sem retorno',
];

const VISIT_BLOCKERS = [
  'visita cancelada',
  'cancelou a visita',
  'desmarcou a visita',
  'visita remarcada',
  'remarcamos a visita',
  'nao apareceu na visita',
  'cliente faltou na visita',
  'visita concluida',
  'visita realizada',
];

const CLOSING_NEGATIONS = ['nao assinou', 'ainda nao assinou', 'contrato nao assinado'];

const normalizeTimelineText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const sanitizeOriginalText = (value?: string): string | undefined => {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  return value.trim().replace(/\s+/g, ' ');
};

const normalizeTriggerList = (triggers: string[]): string[] =>
  Array.from(new Set(triggers.map((trigger) => normalizeTimelineText(trigger)).filter(Boolean)));

const normalizeIntentTrigger = (trigger: IntentTrigger): NormalizedIntentTrigger | null => {
  if (Array.isArray(trigger)) {
    const normalizedWords = normalizeTriggerList(trigger);
    return normalizedWords.length > 0 ? normalizedWords : null;
  }

  const normalizedTrigger = normalizeTimelineText(trigger);
  return normalizedTrigger || null;
};

const getNormalizedIntentTriggerKey = (trigger: NormalizedIntentTrigger): string =>
  Array.isArray(trigger) ? `all:${trigger.join('&&')}` : `exact:${trigger}`;

const normalizeIntentTriggerList = (triggers: IntentTrigger[]): NormalizedIntentTrigger[] => {
  const uniqueTriggers = new Map<string, NormalizedIntentTrigger>();

  for (const trigger of triggers) {
    const normalizedTrigger = normalizeIntentTrigger(trigger);

    if (!normalizedTrigger) {
      continue;
    }

    uniqueTriggers.set(getNormalizedIntentTriggerKey(normalizedTrigger), normalizedTrigger);
  }

  return Array.from(uniqueTriggers.values());
};

const sanitizeSuggestedStatus = (status?: string | null): SuggestedLeadStatus | undefined =>
  status && VALID_SUGGESTED_STATUS_SET.has(status as SuggestedLeadStatus) ? (status as SuggestedLeadStatus) : undefined;

const NORMALIZED_AMBIGUITY_MODIFIERS = normalizeTriggerList(AMBIGUITY_MODIFIERS);
const NORMALIZED_INCOMPLETE_PHRASES = new Set(normalizeTriggerList(INCOMPLETE_PHRASES));
const NORMALIZED_LOW_SIGNAL_EXACT_PHRASES = new Set(normalizeTriggerList(LOW_SIGNAL_EXACT_PHRASES));
const NORMALIZED_STRONG_ACTION_MARKERS = normalizeTriggerList(STRONG_ACTION_MARKERS);
const CONFIDENCE_LEVEL_ORDER: Record<ConfidenceLevel, number> = { low: 1, medium: 2, high: 3 };

const cleanSignalText = (normalizedText: string): string =>
  normalizedText.replace(/[.,!?;()[\]"]/g, ' ').replace(/\s+/g, ' ').trim();

const getTextTokens = (normalizedText: string): string[] => cleanSignalText(normalizedText).split(' ').filter(Boolean);

const hasAnyTrigger = (normalizedText: string, normalizedTriggers: string[]): boolean =>
  normalizedTriggers.some((trigger) => normalizedText.includes(trigger));

const getMatchedTriggers = (normalizedText: string, normalizedTriggers: string[]): string[] =>
  Array.from(new Set(normalizedTriggers.filter((trigger) => normalizedText.includes(trigger))));

const matchesIntentTrigger = (normalizedText: string, trigger: NormalizedIntentTrigger): boolean => {
  if (Array.isArray(trigger)) {
    return trigger.every((word) => normalizedText.includes(word));
  }

  return normalizedText.includes(trigger);
};

const formatIntentTrigger = (trigger: NormalizedIntentTrigger): string => (Array.isArray(trigger) ? trigger.join(' + ') : trigger);

const getIntentTriggerLength = (trigger: NormalizedIntentTrigger): number =>
  Array.isArray(trigger) ? trigger.reduce((total, word) => total + word.length, 0) : trigger.length;

const getMatchedIntentTriggers = (normalizedText: string, normalizedTriggers: NormalizedIntentTrigger[]): MatchedIntentTrigger[] => {
  const matchedTriggers: MatchedIntentTrigger[] = [];
  const seenLabels = new Set<string>();

  for (const trigger of normalizedTriggers) {
    if (!matchesIntentTrigger(normalizedText, trigger)) {
      continue;
    }

    const label = formatIntentTrigger(trigger);

    if (seenLabels.has(label)) {
      continue;
    }

    seenLabels.add(label);
    matchedTriggers.push({
      label,
      length: getIntentTriggerLength(trigger),
    });
  }

  return matchedTriggers;
};

const clampConfidence = (confidence: ConfidenceLevel, maxConfidence: ConfidenceLevel = 'high'): ConfidenceLevel =>
  CONFIDENCE_LEVEL_ORDER[confidence] <= CONFIDENCE_LEVEL_ORDER[maxConfidence] ? confidence : maxConfidence;

const toValidTimeParts = (hoursText: string, minutesText?: string): ExtractedTimeParts | null => {
  const hours = parseInt(hoursText, 10);
  const minutes = minutesText ? parseInt(minutesText, 10) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
};

const extractSpecificTimeParts = (normalizedText: string): ExtractedTimeParts | null => {
  const prefixMatch = normalizedText.match(HOUR_WITH_PREFIX_REGEX);
  if (prefixMatch) {
    const parsed = toValidTimeParts(prefixMatch[1], prefixMatch[2]);
    if (parsed) return parsed;
  }

  const hourMatch = normalizedText.match(HOUR_WITH_H_REGEX);
  if (hourMatch) {
    const parsed = toValidTimeParts(hourMatch[1], hourMatch[2]);
    if (parsed) return parsed;
  }

  const colonMatch = normalizedText.match(HOUR_COLON_REGEX);
  if (colonMatch) {
    const parsed = toValidTimeParts(colonMatch[1], colonMatch[2]);
    if (parsed) return parsed;
  }

  return null;
};

const hasSpecificDateContext = (normalizedText: string): boolean =>
  TODAY_REGEX.test(normalizedText) || TOMORROW_REGEX.test(normalizedText) || DAY_OF_MONTH_REGEX.test(normalizedText);

const analyzeTimelineTextSignals = (normalizedText: string, matchedTriggerCount = 0): TimelineTextSignals => {
  const cleanText = cleanSignalText(normalizedText);
  const ambiguityHits = getMatchedTriggers(cleanText, NORMALIZED_AMBIGUITY_MODIFIERS);
  const strongActionHits = getMatchedTriggers(cleanText, NORMALIZED_STRONG_ACTION_MARKERS);
  const hasSpecificDate = hasSpecificDateContext(normalizedText);
  const hasSpecificTime = Boolean(extractSpecificTimeParts(normalizedText));
  const hasTemporalContext = hasSpecificDate || hasSpecificTime;
  const tokenCount = getTextTokens(cleanText).length;
  const isLowSignalPhrase = NORMALIZED_LOW_SIGNAL_EXACT_PHRASES.has(cleanText);
  const isIncompletePhrase =
    isLowSignalPhrase ||
    NORMALIZED_INCOMPLETE_PHRASES.has(cleanText) ||
    NORMALIZED_AMBIGUITY_MODIFIERS.includes(cleanText) ||
    (tokenCount <= 2 && ambiguityHits.length > 0 && strongActionHits.length === 0 && !hasTemporalContext) ||
    (tokenCount <= 2 && matchedTriggerCount <= 1 && strongActionHits.length === 0 && !hasTemporalContext && ambiguityHits.length > 0);

  return {
    ambiguityHits,
    strongActionHits,
    tokenCount,
    hasSpecificDate,
    hasSpecificTime,
    hasTemporalContext,
    isLowSignalPhrase,
    isIncompletePhrase,
  };
};

const buildIntentCandidate = (definition: IntentDefinition, normalizedText: string): IntentCandidate | null => {
  const matchedTriggerEntries = getMatchedIntentTriggers(normalizedText, definition.normalizedTriggers);
  const matchedTriggers = matchedTriggerEntries.map((trigger) => trigger.label);

  if (matchedTriggers.length === 0) {
    return null;
  }

  if (definition.normalizedExcludeTriggers.length > 0 && hasAnyTrigger(normalizedText, definition.normalizedExcludeTriggers)) {
    return null;
  }

  const longestTriggerLength = matchedTriggerEntries.reduce((longest, trigger) => Math.max(longest, trigger.length), 0);

  return {
    definition,
    matchedTriggers,
    longestTriggerLength,
    score: matchedTriggers.length * 1000 + longestTriggerLength * 10 + definition.priority,
  };
};

const computeConfidence = (candidate: IntentCandidate, signals: TimelineTextSignals): ConfidenceLevel => {
  let score = 0;

  if (candidate.matchedTriggers.length >= 3) {
    score += 5;
  } else if (candidate.matchedTriggers.length === 2) {
    score += 4;
  } else {
    score += 3;
  }

  if (signals.strongActionHits.length > 0) {
    score += 2;
  }

  if (signals.strongActionHits.length > 1) {
    score += 1;
  }

  if (signals.hasTemporalContext) {
    score += 1;
  }

  if (signals.ambiguityHits.length > 0) {
    score -= 2;
  }

  if (signals.ambiguityHits.length > 1) {
    score -= 1;
  }

  if (signals.isIncompletePhrase) {
    score -= 3;
  }

  if (signals.tokenCount <= 2 && candidate.matchedTriggers.length === 1 && signals.strongActionHits.length === 0 && !signals.hasTemporalContext) {
    score -= 1;
  }

  const baseConfidence: ConfidenceLevel = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
  return clampConfidence(baseConfidence, candidate.definition.maxConfidence ?? 'high');
};

const CONTACT_INTENT_ENTRIES: IntentEntry[] = [
  [
    'first_contact',
    {
      priority: 50,
      triggers: [
        'liguei',
        'falei com',
        'conversei',
        'primeiro contato',
        'chamei no whatsapp',
        'mandei mensagem',
        'cliente respondeu',
        ['falei', 'cliente'],
      ],
      excludeTriggers: CONTACT_SILENCE_TRIGGERS,
      question: 'Voce realizou o primeiro contato efetivo com este cliente?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🗣️ Aura: Qualificacao do Primeiro Contato',
      taskDescTemplate: 'Primeiro contato estabelecido. Aprofunde motivacao, faixa de valor, prazo e perfil do imovel para qualificar o lead.',
      taskHours: 24,
      taskPriority: 'media',
      maxConfidence: 'medium',
    },
  ],
  [
    'no_reply',
    {
      priority: 52,
      triggers: [
        'tentei ligar e nao atendeu',
        'liguei e nao atendeu',
        'nao respondeu no whatsapp',
        'nao respondeu minha mensagem',
        'chamei e nao respondeu',
        'visualizou e nao respondeu',
        'caixa postal',
        'sem retorno no whatsapp',
      ],
      question: 'Voce tentou contato mas o cliente nao respondeu?',
      taskTitle: '📲 Aura: Tentativa de Contato Multi-Canal',
      taskDescTemplate: 'O cliente nao respondeu. Tente outro canal, mude o horario da abordagem e deixe uma mensagem curta com CTA claro.',
      taskHours: 12,
      taskPriority: 'alta',
    },
  ],
  [
    'contact_replied',
    {
      priority: 54,
      triggers: [
        'cliente respondeu',
        'respondeu no whatsapp',
        'me respondeu',
        'retornou mensagem',
        'retornou contato',
        'deu retorno',
        'respondeu a abordagem',
      ],
      excludeTriggers: CONTACT_SILENCE_TRIGGERS,
      question: 'O cliente respondeu e retomou a conversa com voce?',
      suggestedStatus: 'Atendimento',
      taskTitle: '💬 Aura: Avancar na Qualificacao',
      taskDescTemplate: 'O lead respondeu. Aproveite a abertura para aprofundar necessidade, momento de compra/locacao e proximos passos.',
      taskHours: 12,
      taskPriority: 'media',
    },
  ],
  [
    'callback_scheduled',
    {
      priority: 58,
      triggers: [
        'retorno combinado',
        'combinamos de falar',
        'ficou de me retornar',
        'ficou de retornar',
        'retorno agendado',
        'marcamos de falar de novo',
        'combinado retorno',
        'combinado falar novamente',
      ],
      excludeTriggers: ['sem resposta', 'nao respondeu', 'cliente sumiu'],
      question: 'Voce combinou um retorno em data/horario com este cliente?',
      taskTitle: '📞 Aura: Cumprir Retorno Combinado',
      taskDescTemplate: 'Existe um retorno combinado. Chegue no horario certo com a pauta pronta para passar seguranca e manter o aquecimento.',
      taskHours: 24,
      taskPriority: 'media',
      scheduleAware: true,
      maxConfidence: 'medium',
    },
  ],
  [
    'contact_resumed',
    {
      priority: 56,
      triggers: [
        'retomei contato',
        'retomamos contato',
        'voltou a responder',
        'voltamos a falar',
        'conversa retomada',
        'reativei o contato',
        'retomei a conversa',
      ],
      question: 'Voce retomou o contato com este cliente?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🔁 Aura: Retomada de Conversa',
      taskDescTemplate: 'Contato retomado. Aproveite a reabertura para confirmar contexto atual, interesse e passo seguinte ainda hoje.',
      taskHours: 8,
      taskPriority: 'media',
    },
  ],
];
const INTEREST_INTENT_ENTRIES: IntentEntry[] = [
  [
    'interest_shown',
    {
      priority: 70,
      triggers: [
        'demonstrou interesse',
        'mostrou interesse',
        'ficou interessado',
        'se interessou pelo imovel',
        'interessado no imovel',
        'quer saber mais do imovel',
        'gostou da ideia do imovel',
      ],
      excludeTriggers: ['nao gostou', 'recusou', 'descartou o imovel'],
      question: 'O cliente demonstrou interesse real neste imovel/atendimento?',
      suggestedStatus: 'Atendimento',
      taskTitle: '✨ Aura: Nutrir Interesse do Lead',
      taskDescTemplate: 'O cliente demonstrou interesse. Envie detalhes relevantes, gere urgencia saudavel e conduza para visita ou proposta.',
      taskHours: 24,
      taskPriority: 'media',
      maxConfidence: 'medium',
    },
  ],
  [
    'wants_more_options',
    {
      priority: 80,
      triggers: [
        'quer ver outras opcoes',
        'quer mais opcoes',
        'pediu mais opcoes',
        'mandar mais imoveis',
        'quer ver outros imoveis',
        'pediu outros imoveis',
        'quer novas opcoes',
      ],
      question: 'O cliente pediu novas opcoes de imoveis?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🔎 Aura: Curadoria de Novas Opcoes',
      taskDescTemplate: 'O cliente quer mais opcoes. Monte uma nova selecao curta, coerente com o feedback, e reapresente com contexto.',
      taskHours: 12,
      taskPriority: 'media',
    },
  ],
  [
    'rejected_property',
    {
      priority: 78,
      triggers: [
        'nao gostou deste imovel',
        'recusou este imovel',
        'descartou o imovel',
        'achou o imovel caro',
        'achou o imovel pequeno',
        'disse que o imovel nao atende',
        'nao serve para ele',
        'nao faz sentido esse imovel',
        'nao gostou do imovel',
      ],
      excludeTriggers: CONTACT_SILENCE_TRIGGERS,
      question: 'O cliente descartou esta opcao de imovel?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🚫 Aura: Reposicionar Oferta',
      taskDescTemplate: 'Este imovel foi descartado. Registre a objecao principal e reapresente alternativas corrigindo preco, localizacao ou configuracao.',
      taskHours: 24,
      taskPriority: 'media',
    },
  ],
  [
    'simulation_requested',
    {
      priority: 84,
      triggers: [
        'pediu simulacao',
        'quer simulacao',
        'solicitou simulacao',
        'pediu simulacao de financiamento',
        'simular parcelas',
        'quer ver parcelas',
        'pediu uma simulacao',
      ],
      question: 'O cliente pediu uma simulacao de valores ou parcelas?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🧮 Aura: Preparar Simulacao',
      taskDescTemplate: 'Existe pedido de simulacao. Organize renda, entrada, prazo e cenario de parcelas para responder com clareza.',
      taskHours: 12,
      taskPriority: 'alta',
    },
  ],
  [
    'financing_interest',
    {
      priority: 82,
      triggers: [
        'quer financiamento',
        'precisa financiar',
        'vai financiar',
        'financiamento bancario',
        'tem interesse em financiamento',
        'aprovar financiamento',
      ],
      question: 'O cliente quer seguir com financiamento?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🏦 Aura: Qualificar Financiamento',
      taskDescTemplate: 'O cliente quer financiamento. Confirme entrada, renda, bancos de preferencia e documentos basicos antes de avancar.',
      taskHours: 24,
      taskPriority: 'media',
    },
  ],
  [
    'rental_intent',
    {
      priority: 72,
      triggers: [
        'quer alugar',
        'busca aluguel',
        'procura aluguel',
        'quer locacao',
        'interesse em locacao',
        'busca um aluguel',
      ],
      question: 'Este lead esta buscando aluguel/locacao?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🏠 Aura: Qualificar Busca de Locacao',
      taskDescTemplate: 'O lead quer locacao. Confirme faixa mensal, garantias aceitas, prazo de mudanca e bairros prioritarios.',
      taskHours: 24,
      taskPriority: 'baixa',
    },
  ],
  [
    'purchase_intent',
    {
      priority: 74,
      triggers: [
        'quer comprar',
        'busca compra',
        'procura compra',
        'interesse em compra',
        'quer adquirir',
        'busca imovel para comprar',
      ],
      question: 'Este lead esta buscando compra?',
      suggestedStatus: 'Atendimento',
      taskTitle: '🧭 Aura: Qualificar Busca de Compra',
      taskDescTemplate: 'O lead quer compra. Confirme forma de pagamento, urgencia, motivacao e criterios decisivos para montar o funil certo.',
      taskHours: 24,
      taskPriority: 'baixa',
    },
  ],
  [
    'specific_requirements',
    {
      priority: 76,
      triggers: [
        'faz questao de',
        'precisa de 3 quartos',
        'precisa de 2 vagas',
        'precisa com quintal',
        'quer com varanda',
        'aceita pet',
        'precisa elevador',
        'quer area gourmet',
        'precisa perto do metro',
        'quer condominio com lazer',
      ],
      question: 'O cliente informou requisitos especificos para o imovel?',
      suggestedStatus: 'Atendimento',
      taskTitle: '📋 Aura: Atualizar Perfil do Cliente',
      taskDescTemplate: 'Existem criterios objetivos novos. Atualize o perfil do lead e refine a busca para evitar opcoes fora do alvo.',
      taskHours: 24,
      taskPriority: 'media',
      maxConfidence: 'medium',
    },
  ],
];
const VISIT_INTENT_ENTRIES: IntentEntry[] = [
  [
    'visit_suggested',
    {
      priority: 90,
      triggers: [
        'sugeri visita',
        'propus uma visita',
        'convidei para visitar',
        'falei de visitar o imovel',
        'abri convite para visita',
        'sugerimos uma visita',
      ],
      excludeTriggers: VISIT_BLOCKERS.concat([
        'visita marcada',
        'visita agendada',
        'visita confirmada',
        'confirmou a visita',
      ]),
      question: 'Voce sugeriu uma visita para avancar com este cliente?',
      taskTitle: '🚪 Aura: Converter Interesse em Visita',
      taskDescTemplate: 'A visita foi sugerida, mas ainda nao consolidada. Retome o lead com horarios possiveis e uma proposta objetiva de agenda.',
      taskHours: 24,
      taskPriority: 'media',
      scheduleAware: true,
      maxConfidence: 'medium',
    },
  ],
  [
    'visit_scheduled',
    {
      priority: 102,
      triggers: [
        'agendei visita',
        'visita marcada',
        'visita confirmada',
        'quer visitar',
        'agendar visita',
        'vamos no imovel',
        'marcou visita',
        ['marquei', 'visita'],
        ['fazer', 'visita'],
        ['agendei', 'visita'],
      ],
      excludeTriggers: VISIT_BLOCKERS.concat(['visita confirmada', 'confirmou a visita']),
      question: 'Voce agendou uma visita com este cliente?',
      suggestedStatus: 'Visita',
      taskTitle: '🚗 Aura: Confirmar Logistica da Visita',
      taskDescTemplate: 'A visita foi agendada. Confirme horario, acesso, chave, portaria e apresente o roteiro ideal antes do encontro.',
      taskHours: 2,
      taskPriority: 'alta',
      scheduleAware: true,
    },
  ],
  [
    'visit_confirmed',
    {
      priority: 108,
      triggers: [
        'visita confirmada',
        'confirmou a visita',
        'visita confirmada para',
        'cliente confirmou a visita',
        'confirmacao da visita',
      ],
      excludeTriggers: VISIT_BLOCKERS,
      question: 'A visita ficou confirmada com este cliente?',
      suggestedStatus: 'Visita',
      taskTitle: '✅ Aura: Visita Confirmada',
      taskDescTemplate: 'A visita esta confirmada. Garanta chave, apresentacao do imovel, materiais e plano de conduzir a visita ate o proximo passo.',
      taskHours: 2,
      taskPriority: 'alta',
      scheduleAware: true,
    },
  ],
  [
    'visit_rescheduled',
    {
      priority: 106,
      triggers: [
        'visita remarcada',
        'remarcamos a visita',
        'mudou a visita para',
        'adiamos a visita para',
        'reagendei a visita',
        'alteramos a visita para',
      ],
      excludeTriggers: ['visita cancelada', 'cancelou a visita', 'nao apareceu na visita'],
      question: 'A visita foi remarcada com este cliente?',
      suggestedStatus: 'Visita',
      taskTitle: '🔁 Aura: Reconfirmar Visita Remarcada',
      taskDescTemplate: 'A visita mudou de data/hora. Reconfirme agenda, chave e expectativa do cliente para nao perder o timing.',
      taskHours: 2,
      taskPriority: 'alta',
      scheduleAware: true,
    },
  ],
  [
    'visit_canceled',
    {
      priority: 92,
      triggers: [
        'visita cancelada',
        'cancelou a visita',
        'desmarcou a visita',
        'nao vai poder ir na visita',
        'imprevisto na visita',
        'cancelamos a visita',
      ],
      question: 'A visita foi cancelada?',
      taskTitle: '📆 Aura: Recuperar Visita Cancelada',
      taskDescTemplate: 'A visita caiu. Retome com empatia, entenda o motivo e ofereca duas novas opcoes de data ainda no calor do interesse.',
      taskHours: 12,
      taskPriority: 'alta',
    },
  ],
  [
    'visit_done',
    {
      priority: 96,
      triggers: [
        'visita concluida',
        'visitou o imovel',
        'fizemos a visita',
        'mostrei o imovel',
        'visita realizada',
        'tour concluido',
      ],
      excludeTriggers: ['nao apareceu na visita', 'visita cancelada', 'visita remarcada'],
      question: 'Voce concluiu a visita com este cliente?',
      taskTitle: '🎯 Aura: Coletar Feedback Pos-Visita',
      taskDescTemplate: 'A visita aconteceu. Ligue ou mande audio rapido para colher impressao fresca, objecoes e probabilidade de avancar.',
      taskHours: 24,
      taskPriority: 'media',
    },
  ],
  [
    'visit_no_show',
    {
      priority: 94,
      triggers: [
        'nao apareceu na visita',
        'cliente faltou na visita',
        'deu bolo na visita',
        'fiquei esperando na visita',
        'nao compareceu a visita',
      ],
      question: 'O cliente nao compareceu a visita (No-show)?',
      taskTitle: '🚨 Aura: Recuperacao de No-Show',
      taskDescTemplate: 'Houve no-show. Entre em contato sem confronto, confirme se aconteceu algo e tente recuperar a visita rapidamente.',
      taskHours: 4,
      taskPriority: 'alta',
    },
  ],
];
const POST_VISIT_INTENT_ENTRIES: IntentEntry[] = [
  [
    'liked_property',
    {
      priority: 100,
      triggers: [
        'cliente gostou',
        'adorou',
        'amou o imovel',
        'achou lindo',
        'faz sentido pra ele',
        ['gostou', 'fotos'],
        ['gostou', 'imovel'],
        ['gostou', 'imóvel'],
      ],
      excludeTriggers: ['nao gostou do imovel', 'nao curtiu o imovel'],
      question: 'O cliente gostou bastante do imovel depois da visita?',
      taskTitle: '🔥 Aura: Cliente Quente para Proposta',
      taskDescTemplate: 'O cliente saiu quente da visita. Ataque rapidamente com fechamento de objecoes e construcao de proposta.',
      taskHours: 2,
      taskPriority: 'alta',
    },
  ],
  [
    'disliked_property',
    {
      priority: 98,
      triggers: [
        'nao gostou do imovel',
        'nao curtiu o imovel',
        'nao gostou da visita',
        'achou ruim ao vivo',
        'nao se viu morando',
        'reprovou o imovel',
      ],
      question: 'O cliente nao gostou do imovel apos a visita?',
      taskTitle: '🧭 Aura: Refinar Criterios Pos-Visita',
      taskDescTemplate: 'O imovel nao convenceu. Registre a objecao exata e ajuste a curadoria para a proxima rodada de opcoes.',
      taskHours: 12,
      taskPriority: 'media',
    },
  ],
  [
    'needs_time',
    {
      priority: 86,
      triggers: [
        'vai pensar',
        'quer pensar',
        'precisa pensar',
        'pediu um tempo',
        'pediu tempo para decidir',
        'quer analisar com calma',
      ],
      excludeTriggers: ['falar com a esposa', 'falar com o marido', 'falar com a familia', 'alinhar com a familia'],
      question: 'O cliente pediu tempo para pensar antes de decidir?',
      taskTitle: '⏳ Aura: Follow-up de Reflexao',
      taskDescTemplate: 'O cliente pediu tempo. Respeite o espaco hoje e programe um retorno consultivo para destravar duvidas com calma.',
      taskHours: 48,
      taskPriority: 'media',
    },
  ],
  [
    'family_alignment',
    {
      priority: 88,
      triggers: [
        'vai falar com a esposa',
        'vai falar com o marido',
        'vai falar com a familia',
        'vai alinhar com a familia',
        'vai conversar com o conjuge',
        'precisa alinhar com a esposa',
      ],
      question: 'O cliente vai alinhar a decisao com conjuge/familia?',
      taskTitle: '👨‍👩‍👧 Aura: Follow-up de Decisao em Familia',
      taskDescTemplate: 'A decisao depende de terceiros. Prepare material objetivo e retorne no timing combinado para ajudar o alinhamento familiar.',
      taskHours: 48,
      taskPriority: 'media',
    },
  ],
  [
    'second_visit_requested',
    {
      priority: 104,
      triggers: [
        'pediu segunda visita',
        'quer segunda visita',
        'quer visitar de novo',
        'quer voltar ao imovel',
        'segunda visita no imovel',
        'nova visita no imovel',
      ],
      excludeTriggers: ['visita cancelada', 'nao apareceu na visita'],
      question: 'O cliente pediu uma segunda visita ao imovel?',
      suggestedStatus: 'Visita',
      taskTitle: '🔂 Aura: Organizar Segunda Visita',
      taskDescTemplate: 'Existe pedido de segunda visita. Reforce os pontos de decisao, alinhe acompanhantes e prepare uma visita mais cirurgica.',
      taskHours: 12,
      taskPriority: 'alta',
      scheduleAware: true,
    },
  ],
];
const PROPOSAL_INTENT_ENTRIES: IntentEntry[] = [
  [
    'proposal_sent',
    {
      priority: 122,
      triggers: [
        'proposta enviada',
        'oferta enviada',
        'enviou proposta',
        'formalizei a proposta',
        'mandei a proposta',
        'encaminhei proposta',
        'proposta formal enviada',
      ],
      question: 'Voce enviou uma proposta formal para este cliente?',
      suggestedStatus: 'Proposta',
      taskTitle: '💰 Aura: Follow-up da Proposta',
      taskDescTemplate: 'A proposta saiu. Controle prazo de retorno, objecoes e proximos passos para nao deixar a negociacao esfriar.',
      taskHours: 24,
      taskPriority: 'alta',
    },
  ],
  [
    'proposal_discussed',
    {
      priority: 116,
      triggers: [
        'falamos de proposta',
        'conversamos sobre proposta',
        'discutimos proposta',
        'alinhamos a proposta',
        'proposta em conversa',
        'tratamos da proposta',
      ],
      question: 'Voce discutiu proposta/condicoes, mas ainda sem formalizacao?',
      suggestedStatus: 'Proposta',
      taskTitle: '📝 Aura: Formalizar Proposta',
      taskDescTemplate: 'A proposta ja foi discutida verbalmente. Estruture numeros, condicoes e material de apoio para formalizar sem perder calor.',
      taskHours: 12,
      taskPriority: 'media',
      maxConfidence: 'medium',
    },
  ],
  [
    'counterproposal',
    {
      priority: 124,
      triggers: [
        'contraproposta',
        'mandou contraproposta',
        'recebi contraproposta',
        'proprietario fez contraproposta',
        'cliente fez contraproposta',
      ],
      question: 'Houve contraproposta nesta negociacao?',
      suggestedStatus: 'Proposta',
      taskTitle: '🤝 Aura: Trabalhar Contraproposta',
      taskDescTemplate: 'Existe contraproposta na mesa. Alinhe margem, concessoes e narrativa para aproximar as partes rapidamente.',
      taskHours: 12,
      taskPriority: 'alta',
    },
  ],
  [
    'discount_requested',
    {
      priority: 120,
      triggers: [
        'pediu desconto',
        'quer desconto',
        'pedindo desconto',
        'quer baixar o valor',
        'quer reduzir o preco',
        'pediu abatimento',
      ],
      question: 'O cliente pediu desconto para avancar?',
      suggestedStatus: 'Proposta',
      taskTitle: '🏷️ Aura: Tratar Pedido de Desconto',
      taskDescTemplate: 'Existe pedido de desconto. Valide limite de negociacao e volte com uma resposta objetiva, sem deixar a conversa esfriar.',
      taskHours: 12,
      taskPriority: 'alta',
    },
  ],
  [
    'awaiting_response',
    {
      priority: 114,
      triggers: [
        'aguardando resposta da proposta',
        'aguardando retorno da proposta',
        'ficou de responder a proposta',
        'aguardando posicionamento do cliente',
        'esperando resposta da proposta',
        'cliente ficou de responder a proposta',
      ],
      question: 'Voce esta aguardando resposta do cliente sobre a proposta/condicoes?',
      suggestedStatus: 'Proposta',
      taskTitle: '⏰ Aura: Cobrar Retorno da Proposta',
      taskDescTemplate: 'Existe proposta pendente de resposta. Marque um follow-up objetivo para evitar silencio prolongado e perda de timing.',
      taskHours: 24,
      taskPriority: 'media',
      scheduleAware: true,
      maxConfidence: 'medium',
    },
  ],
  [
    'negotiating',
    {
      priority: 118,
      triggers: [
        'negociando valores',
        'negociacao ativa',
        'em negociacao',
        'ajustando condicoes',
        'alinhando valores',
        'negociacao em andamento',
      ],
      question: 'A negociacao esta ativa entre as partes?',
      suggestedStatus: 'Proposta',
      taskTitle: '⚖️ Aura: Conduzir Negociacao',
      taskDescTemplate: 'A negociacao esta em curso. Mapeie travas, proximo movimento e responsavel por cada ajuste para encurtar o ciclo.',
      taskHours: 12,
      taskPriority: 'alta',
    },
  ],
];
const CONTRACT_INTENT_ENTRIES: IntentEntry[] = [
  [
    'contract_started',
    {
      priority: 130,
      triggers: [
        'contrato iniciado',
        'iniciamos o contrato',
        'contrato enviado',
        'minuta enviada',
        'fase de contrato iniciada',
        'abri contrato',
      ],
      excludeTriggers: ['aguardando assinatura', 'documentos pendentes', 'pendencia documental'],
      question: 'Voce iniciou a fase de contrato com este cliente?',
      suggestedStatus: 'Proposta',
      taskTitle: '📄 Aura: Acompanhar Contrato',
      taskDescTemplate: 'A fase contratual comecou. Organize checklist, pendencias e checkpoints para evitar travas no fechamento.',
      taskHours: 48,
      taskPriority: 'alta',
    },
  ],
  [
    'documents_pending',
    {
      priority: 132,
      triggers: [
        'documentos pendentes',
        'pendencia documental',
        'faltou documento',
        'aguardando documentos',
        'documentacao pendente',
        'falta comprovante',
        'falta rg',
      ],
      question: 'Existem documentos pendentes para seguir com o negocio?',
      suggestedStatus: 'Proposta',
      taskTitle: '📎 Aura: Resolver Pendencias Documentais',
      taskDescTemplate: 'Ha documentos faltando. Liste o que falta, o dono de cada item e a proxima cobranca para destravar a assinatura.',
      taskHours: 24,
      taskPriority: 'alta',
    },
  ],
  [
    'awaiting_signature',
    {
      priority: 134,
      triggers: [
        'aguardando assinatura',
        'assinatura pendente',
        'faltando assinar',
        'contrato para assinatura',
        'aguardando assinar',
      ],
      excludeTriggers: CLOSING_NEGATIONS.concat(['contrato assinado', 'assinou']),
      question: 'O processo esta aguardando assinatura?',
      suggestedStatus: 'Proposta',
      taskTitle: '✍️ Aura: Cobrar Assinatura',
      taskDescTemplate: 'O negocio depende de assinatura. Confirme quem falta assinar, prazo combinado e eventual barreira final.',
      taskHours: 12,
      taskPriority: 'alta',
    },
  ],
  [
    'deal_closed',
    {
      priority: 140,
      triggers: [
        'venda fechada',
        'locacao fechada',
        'negocio fechado',
        'contrato assinado',
        'fechamos a venda',
        'fechamos a locacao',
        'deu certo a venda',
        'venda concluida',
        'locacao concluida',
        'fechou negocio',
      ],
      excludeTriggers: CLOSING_NEGATIONS,
      question: 'Parabens! Voce fechou negocio com este cliente?',
      taskTitle: '🎉 Aura: Processo de Pos-Venda',
      taskDescTemplate: 'O negocio foi fechado. Acione pos-venda, comissoes, repasses, documentacao final e os proximos ritos internos.',
      taskHours: 24,
      taskPriority: 'alta',
    },
  ],
];
const RISK_INTENT_ENTRIES: IntentEntry[] = [
  [
    'lead_warming_down',
    {
      priority: 44,
      triggers: [
        'lead esfriando',
        'esta esfriando',
        'menos responsivo',
        'perdendo ritmo',
        'engajamento caiu',
        'esta mais frio',
      ],
      question: 'O lead esta esfriando e perdendo tracao?',
      taskTitle: '🌡️ Aura: Reaquecer Conversa',
      taskDescTemplate: 'O lead esta perdendo energia. Retome com um gancho forte, novidade de mercado ou oportunidade alinhada ao perfil.',
      taskHours: 24,
      taskPriority: 'media',
      maxConfidence: 'medium',
    },
  ],
  [
    'lead_cold',
    {
      priority: 42,
      triggers: ['lead frio', 'lead esfriou', 'muito frio', 'cliente frio', 'parou de engajar'],
      question: 'O lead ja esta frio e precisa reativacao?',
      taskTitle: '❄️ Aura: Campanha de Reativacao',
      taskDescTemplate: 'O lead esfriou. Reentre com abordagem mais consultiva, prova social ou nova oferta para reabrir o dialogo.',
      taskHours: 48,
      taskPriority: 'media',
    },
  ],
  [
    'client_disappeared',
    {
      priority: 48,
      triggers: [
        'cliente sumiu',
        'sumiu depois da visita',
        'sumiu depois da proposta',
        'cliente desapareceu',
        'nao deu mais sinal',
      ],
      question: 'O cliente sumiu do radar nesta etapa?',
      taskTitle: '👻 Aura: Recuperar Cliente Sumido',
      taskDescTemplate: 'O cliente saiu do radar. Retome com mensagem curta, contexto do ultimo passo e um CTA simples de resposta.',
      taskHours: 24,
      taskPriority: 'alta',
    },
  ],
  [
    'no_response_timeout',
    {
      priority: 46,
      triggers: [
        'sem resposta ha dias',
        'sem retorno ha dias',
        'nao responde ha dias',
        'sem resposta ha semanas',
        'sem retorno ha semanas',
        'mais de 3 dias sem resposta',
      ],
      question: 'Ja existe um periodo relevante sem resposta deste cliente?',
      taskTitle: '⌛ Aura: Follow-up por Tempo Sem Resposta',
      taskDescTemplate: 'Ja ha um silencio relevante. Priorize uma retomada objetiva com referencia temporal e proxima acao clara.',
      taskHours: 24,
      taskPriority: 'alta',
    },
  ],
  [
    'follow_up_needed',
    {
      priority: 40,
      triggers: [
        'preciso retomar',
        'retomar contato',
        'preciso cobrar retorno',
        'preciso fazer follow up',
        'voltar a falar com ele',
        'preciso reacender',
      ],
      question: 'Voce precisa retomar o contato para nao perder o lead?',
      taskTitle: '🔔 Aura: Follow-up Necessario',
      taskDescTemplate: 'Existe um follow-up claro pendente. Defina a melhor abordagem, o canal e um CTA direto para recuperar a conversa.',
      taskHours: 12,
      taskPriority: 'media',
      maxConfidence: 'medium',
    },
  ],
];

const OPERATION_INTENT_ENTRIES: IntentEntry[] = [
  [
    'key_issue',
    {
      priority: 64,
      triggers: [
        'chave indisponivel',
        'nao achei a chave',
        'problema com a chave',
        'chave nao liberada',
        'portaria sem autorizacao',
        'preciso confirmar chave',
      ],
      question: 'Existe problema operacional com chave/acesso para atender este cliente?',
      taskTitle: '🚨 Aura: Resolver Chave/Acesso',
      taskDescTemplate: 'Existe um problema operacional com chave ou acesso. Resolva isso antes que comprometa visita, confianca e ritmo do atendimento.',
      taskHours: 1,
      taskPriority: 'alta',
    },
  ],
  [
    'key_confirmed',
    {
      priority: 60,
      triggers: [
        'chave confirmada',
        'chave ok',
        'chave liberada',
        'chave disponivel',
        'peguei a chave',
        'retirada da chave confirmada',
      ],
      excludeTriggers: ['chave indisponivel', 'problema com a chave'],
      question: 'A chave/acesso do imovel foi confirmada?',
      taskTitle: '🔑 Aura: Garantir Fluxo de Chaves',
      taskDescTemplate: 'A chave foi confirmada. Alinhe retirada, devolucao e janela da visita para evitar ruido operacional.',
      taskHours: 4,
      taskPriority: 'media',
    },
  ],
  [
    'property_unavailable',
    {
      priority: 68,
      triggers: [
        'imovel indisponivel',
        'nao esta mais disponivel',
        'imovel saiu do mercado',
        'ja foi alugado',
        'ja foi vendido',
        'unidade indisponivel',
        'imovel nao disponivel',
      ],
      question: 'O imovel ficou indisponivel para este cliente?',
      taskTitle: '🏚️ Aura: Reagir a Imovel Indisponivel',
      taskDescTemplate: 'O imovel saiu do jogo. Retome rapido com contexto, preserve confianca e apresente alternativas equivalentes imediatamente.',
      taskHours: 2,
      taskPriority: 'alta',
    },
  ],
  [
    'property_reserved',
    {
      priority: 66,
      triggers: [
        'imovel reservado',
        'reserva feita',
        'reserva confirmada',
        'seguraram o imovel',
        'unidade reservada',
        'imovel em reserva',
      ],
      question: 'O imovel foi reservado e precisa alinhamento rapido?',
      taskTitle: '📌 Aura: Validar Reserva do Imovel',
      taskDescTemplate: 'Existe uma reserva no imovel. Confirme prazo, prioridade real do cliente e plano B para nao perder timing comercial.',
      taskHours: 4,
      taskPriority: 'alta',
    },
  ],
  [
    'operational_conflict',
    {
      priority: 62,
      triggers: [
        'conflito operacional',
        'conflito de agenda',
        'dupla agenda',
        'overbooking de visita',
        'problema operacional',
        'conflito interno',
        'captador nao confirmou',
      ],
      question: 'Existe um conflito operacional travando o atendimento?',
      taskTitle: '🛠️ Aura: Destravar Conflito Operacional',
      taskDescTemplate: 'Ha um conflito operacional em curso. Centralize responsaveis, resolva a pendencia e proteja a experiencia do cliente.',
      taskHours: 2,
      taskPriority: 'alta',
    },
  ],
];

const INTENT_DICTIONARY_CONFIG = Object.fromEntries([
  ...CONTACT_INTENT_ENTRIES,
  ...INTEREST_INTENT_ENTRIES,
  ...VISIT_INTENT_ENTRIES,
  ...POST_VISIT_INTENT_ENTRIES,
  ...PROPOSAL_INTENT_ENTRIES,
  ...CONTRACT_INTENT_ENTRIES,
  ...RISK_INTENT_ENTRIES,
  ...OPERATION_INTENT_ENTRIES,
]) as Partial<Record<DefinedActionIntent, IntentDefinitionConfig>>;

const toIntentDefinition = (id: DefinedActionIntent, config: IntentDefinitionConfig): IntentDefinition => ({
  id,
  ...config,
  triggers: [...config.triggers],
  excludeTriggers: Array.from(new Set(config.excludeTriggers ?? [])),
  normalizedTriggers: normalizeIntentTriggerList(config.triggers),
  normalizedExcludeTriggers: normalizeTriggerList(config.excludeTriggers ?? []),
});

const INTENT_DICTIONARY: IntentDefinition[] = ACTION_INTENT_IDS.flatMap((id) => {
  const config = INTENT_DICTIONARY_CONFIG[id];
  return config ? [toIntentDefinition(id, config)] : [];
});

const SORTED_INTENT_DEFINITIONS = [...INTENT_DICTIONARY].sort((a, b) => b.priority - a.priority);

const INTENT_DICTIONARY_BY_ID = INTENT_DICTIONARY.reduce<Partial<Record<DefinedActionIntent, IntentDefinition>>>((acc, definition) => {
  acc[definition.id] = definition;
  return acc;
}, {});

const isLocalDevelopment = (): boolean => {
  const hostname = (globalThis as { location?: { hostname?: string } }).location?.hostname;

  return hostname === 'localhost' || hostname === '127.0.0.1' || Boolean(hostname?.endsWith('.localhost'));
};

const auditIntentDictionary = (definitions: IntentDefinition[]) => {
  if (!isLocalDevelopment()) return;

  const triggerOwners = new Map<string, DefinedActionIntent>();
  const missingDefinitions = ACTION_INTENT_IDS.filter((id) => !INTENT_DICTIONARY_CONFIG[id]);

  if (missingDefinitions.length > 0) {
    console.warn(`Action Engine audit: missing definitions for intents ${missingDefinitions.join(', ')}.`);
  }

  for (const definition of definitions) {
    if ((definition.taskTitle && !definition.taskDescTemplate) || (!definition.taskTitle && definition.taskDescTemplate)) {
      console.warn(`Action Engine audit: intent "${definition.id}" has incomplete task metadata.`);
    }

    if (definition.suggestedStatus && !sanitizeSuggestedStatus(definition.suggestedStatus)) {
      console.warn(`Action Engine audit: intent "${definition.id}" uses unsupported suggestedStatus "${definition.suggestedStatus}".`);
    }

    for (const trigger of definition.normalizedTriggers) {
      const triggerKey = getNormalizedIntentTriggerKey(trigger);
      const owner = triggerOwners.get(triggerKey);

      if (owner && owner !== definition.id) {
        console.warn(`Action Engine audit: trigger "${formatIntentTrigger(trigger)}" is shared by "${owner}" and "${definition.id}".`);
        continue;
      }

      triggerOwners.set(triggerKey, definition.id);
    }
  }
};

auditIntentDictionary(INTENT_DICTIONARY);

const findIntentCandidate = (normalizedText: string): IntentCandidate | null => {
  const candidates = SORTED_INTENT_DEFINITIONS.flatMap((definition) => {
    const candidate = buildIntentCandidate(definition, normalizedText);
    return candidate ? [candidate] : [];
  });

  candidates.sort((a, b) => b.score - a.score || b.definition.priority - a.definition.priority);
  return candidates[0] ?? null;
};

const buildTimelineConfirmationMessage = (
  definition: IntentDefinition | null,
  suggestedStatus?: SuggestedLeadStatus,
): string => {
  const timelineMessage = definition
    ? definition.question
        .replace(/^Parabens!\s*/i, '')
        .replace(/^Voce\s+/i, '')
        .replace(/\?$/, '.')
    : 'acao confirmada.';

  return `🤖 Aura: confirmou a acao "${timelineMessage}"${suggestedStatus ? `\nStatus atualizado para ${suggestedStatus}.` : ''}`;
};

const buildTaskDescription = (definition: IntentDefinition, originalText?: string): string => {
  const sanitizedOriginalText = sanitizeOriginalText(originalText);

  if (!sanitizedOriginalText) {
    return definition.taskDescTemplate || '';
  }

  if (definition.scheduleAware) {
    return `📌 Nota do corretor: "${sanitizedOriginalText}"\n\n🤖 Aura sugere: ${definition.taskDescTemplate}`;
  }

  return `📌 Contexto registrado: "${sanitizedOriginalText}"\n\n🤖 Aura sugere: ${definition.taskDescTemplate}`;
};

const buildDefaultDueDate = (taskHours = 24): Date => {
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + taskHours);
  return dueDate;
};

const buildSameDayDueDate = (taskHours = 24): Date => {
  const dueDate = buildDefaultDueDate(Math.min(taskHours, 4));
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 0, 0);
  return dueDate.getTime() > endOfDay.getTime() ? endOfDay : dueDate;
};

const extractScheduledDueDate = (originalText: string, taskHours = 24): Date => {
  const normalizedText = normalizeTimelineText(originalText);
  const now = new Date();
  const targetDate = new Date(now);
  let changedDate = false;
  let changedTime = false;

  if (TODAY_REGEX.test(normalizedText)) {
    changedDate = true;
  }

  if (TOMORROW_REGEX.test(normalizedText)) {
    targetDate.setDate(targetDate.getDate() + 1);
    changedDate = true;
  }

  const dayMatch = normalizedText.match(DAY_OF_MONTH_REGEX);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);

    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      targetDate.setDate(day);

      if (targetDate.getTime() < now.getTime() - 86400000) {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }

      changedDate = true;
    }
  }

  const explicitTime = extractSpecificTimeParts(normalizedText);
  if (explicitTime) {
    targetDate.setHours(explicitTime.hours, explicitTime.minutes, 0, 0);
    changedTime = true;
  }

  if (changedTime && !changedDate && targetDate.getTime() < now.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  if (TODAY_REGEX.test(normalizedText) && !changedTime) {
    return buildSameDayDueDate(taskHours);
  }

  if (changedDate || changedTime) {
    return targetDate;
  }

  return buildDefaultDueDate(taskHours);
};

const resolveTaskDueDate = (definition: IntentDefinition, originalText?: string): Date => {
  const fallbackHours = definition.taskHours ?? 24;

  const candidate =
    definition.scheduleAware && isNonEmptyString(originalText)
      ? extractScheduledDueDate(originalText, fallbackHours)
      : buildDefaultDueDate(fallbackHours);

  const candidateTime = candidate.getTime();
  return Number.isFinite(candidateTime) && candidateTime > Date.now() ? candidate : buildDefaultDueDate(fallbackHours);
};

const computeTaskPriority = (definition: IntentDefinition): TaskPriority => {
  if (definition.taskPriority) {
    return definition.taskPriority;
  }

  if (definition.priority >= 100) return 'alta';
  if (definition.priority >= 60) return 'media';
  return 'baixa';
};

const normalizeAuraTaskTitle = (title?: string | null): string => {
  const rawTitle = `${title ?? ''}`.trim();
  const markerIndex = rawTitle.toLowerCase().indexOf(AURA_TASK_MARKER);
  const cleanTitle = markerIndex >= 0 ? rawTitle.slice(markerIndex + AURA_TASK_MARKER.length) : rawTitle;
  return normalizeTimelineText(cleanTitle);
};

const isOpenTask = (task: Pick<ExistingTaskSnapshot, 'status' | 'completed'>): boolean => {
  if (task.completed === true) {
    return false;
  }

  const normalizedStatus = normalizeTimelineText(`${task.status ?? ''}`);

  if (normalizedStatus === 'concluida') {
    return false;
  }

  if (task.completed === false) {
    return true;
  }

  return OPEN_TASK_STATUSES.has(normalizedStatus);
};

const wasTaskCreatedRecently = (createdAt?: string | null, hours = 24): boolean => {
  if (!createdAt) {
    return false;
  }

  const createdAtTime = new Date(createdAt).getTime();

  if (!Number.isFinite(createdAtTime)) {
    return false;
  }

  return Date.now() - createdAtTime <= hours * 3600000;
};

const getTaskDedupWindowHours = (definition: IntentDefinition): number => Math.max(2, Math.min(definition.taskHours ?? 24, 24));

const hasSimilarOpenTaskForIntent = async (
  leadId: string,
  companyId: string,
  definition: IntentDefinition,
): Promise<TaskDeduplicationState> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('title, status, completed, created_at')
    .eq('lead_id', leadId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Action Engine: Erro ao verificar tarefas pendentes da Aura', error);
    return 'unknown';
  }

  const referenceTitle = normalizeAuraTaskTitle(definition.taskTitle);
  const dedupWindowHours = getTaskDedupWindowHours(definition);

  const hasDuplicate = (data as ExistingTaskSnapshot[] | null)?.some((task) => {
    if (normalizeAuraTaskTitle(task.title) !== referenceTitle) {
      return false;
    }

    return isOpenTask(task) || wasTaskCreatedRecently(task.created_at, dedupWindowHours);
  }) ?? false;

  return hasDuplicate ? 'duplicate' : 'clear';
};

const fetchLeadActionSnapshot = async (leadId: string, companyId: string): Promise<LeadActionSnapshot | null> => {
  const { data, error } = await supabase
    .from('leads')
    .select('assigned_to, status')
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('Action Engine: Erro ao carregar lead para confirmar acao', error);
    return null;
  }

  if (!data) {
    console.warn(`Action Engine: lead ${leadId} nao encontrado para a empresa ${companyId}.`);
    return null;
  }

  return data as LeadActionSnapshot;
};

export const parseTimelineNote = (text: string): IntentResult => {
  const sanitizedText = sanitizeOriginalText(text);

  if (!sanitizedText) {
    return { intent: null, confidence: 'low' };
  }

  const normalizedText = normalizeTimelineText(sanitizedText);

  if (!normalizedText) {
    return { intent: null, confidence: 'low' };
  }

  const initialSignals = analyzeTimelineTextSignals(normalizedText);

  if (initialSignals.isLowSignalPhrase || NORMALIZED_AMBIGUITY_MODIFIERS.includes(cleanSignalText(normalizedText))) {
    return { intent: null, confidence: 'low' };
  }

  const candidate = findIntentCandidate(normalizedText);

  if (!candidate) {
    return { intent: null, confidence: 'low' };
  }

  const definition = candidate.definition;
  const signals = analyzeTimelineTextSignals(normalizedText, candidate.matchedTriggers.length);

  return {
    intent: definition.id,
    confidence: computeConfidence(candidate, signals),
    question: definition.question,
    suggestedStatus: sanitizeSuggestedStatus(definition.suggestedStatus),
    originalText: sanitizedText,
  };
};

export const executeConfirmedAction = async (
  leadId: string,
  companyId: string,
  userId: string,
  intent: ActionIntent,
  suggestedStatus?: SuggestedLeadStatus,
  originalText?: string,
) => {
  if (!intent || !isNonEmptyString(leadId) || !isNonEmptyString(companyId) || !isNonEmptyString(userId)) {
    console.warn('Action Engine: parametros invalidos para executeConfirmedAction.', { leadId, companyId, userId, intent });
    return;
  }

  const definition = INTENT_DICTIONARY_BY_ID[intent] ?? null;

  if (!definition) {
    console.warn(`Action Engine: intent "${intent}" nao possui definicao valida.`);
    return;
  }

  const leadSnapshot = await fetchLeadActionSnapshot(leadId, companyId);

  if (!leadSnapshot) {
    return;
  }

  const touchedAt = new Date().toISOString();
  const safeSuggestedStatus = sanitizeSuggestedStatus(suggestedStatus) ?? sanitizeSuggestedStatus(definition.suggestedStatus);
  const leadUpdatePayload: { last_interaction: string; status?: SuggestedLeadStatus } = { last_interaction: touchedAt };

  if (safeSuggestedStatus && safeSuggestedStatus !== leadSnapshot.status) {
    leadUpdatePayload.status = safeSuggestedStatus;
  }

  const { error: leadUpdateError } = await supabase
    .from('leads')
    .update(leadUpdatePayload)
    .eq('id', leadId)
    .eq('company_id', companyId);

  if (leadUpdateError) {
    console.error('Action Engine: Erro ao atualizar lead apos confirmacao da Aura', leadUpdateError);
    return;
  }

  const { error: timelineError } = await supabase.from('timeline_events').insert([
    {
      lead_id: leadId,
      type: 'system',
      description: buildTimelineConfirmationMessage(definition, leadUpdatePayload.status),
      company_id: companyId,
      created_by: userId,
    },
  ]);

  if (timelineError) {
    console.error('Action Engine: Erro ao registrar timeline da confirmacao', timelineError);
  }

  if (definition.taskTitle && definition.taskDescTemplate) {
    try {
      const deduplicationState = await hasSimilarOpenTaskForIntent(leadId, companyId, definition);

      if (deduplicationState === 'unknown') {
        console.warn(`Action Engine: pulando criacao de task para "${intent}" porque a deduplicacao nao pode ser validada.`);
        return;
      }

      if (deduplicationState === 'clear') {
        const dueDate = resolveTaskDueDate(definition, originalText);
        const { error: taskInsertError } = await supabase.from('tasks').insert([
          {
            company_id: companyId,
            user_id: leadSnapshot.assigned_to || userId,
            lead_id: leadId,
            title: definition.taskTitle,
            description: buildTaskDescription(definition, originalText),
            priority: computeTaskPriority(definition),
            due_date: dueDate.toISOString(),
            status: 'pendente',
            completed: false,
          },
        ]);

        if (taskInsertError) {
          throw taskInsertError;
        }
      }
    } catch (taskError) {
      console.error('Action Engine: Erro ao gerar tarefa da Aura', taskError);
    }
  }
};
