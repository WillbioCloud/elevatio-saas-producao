import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  AuraGlobalChatContext,
  AuraLeadChatContext,
  AuraRecentLeadOption,
  ChatMessage,
  ChatMessageAction,
  ChatMessageActionIcon,
  ChatMessageActionPayload,
  ChatMessageActionVariant,
  ChatMessageType,
  chatWithAura,
} from '../services/ai';

const DEFAULT_QUICK_PROMPTS = [
  'Resuma o atendimento e destaque oportunidades',
  'Qual abordagem pode destravar essa conversa?',
  'Monte uma mensagem curta para WhatsApp',
  'O que merece prioridade agora?',
] as const;

type LegacyChatMessage = Partial<ChatMessage> & {
  role?: ChatMessage['role'] | string | null;
  text?: unknown;
  messageType?: unknown;
  actions?: unknown;
};

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'emphasis'; value: string };

type MessageBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; items: string[] };

const MAX_TIMELINE_CONTEXT_ITEMS = 4;
const MAX_TIMELINE_CONTEXT_LENGTH = 160;
const MAX_AURA_LEAD_RESULTS = 10;

const CHAT_MESSAGE_TYPES = new Set<ChatMessageType>(['text', 'action_prompt']);
const CHAT_ACTION_VARIANTS = new Set<ChatMessageActionVariant>(['primary', 'secondary', 'ghost']);
const CHAT_ACTION_ICONS = new Set<ChatMessageActionIcon>(['smartphone', 'edit', 'task', 'timeline', 'lead', 'cancel']);
const ACTION_PAYLOAD_KEYS: Array<keyof ChatMessageActionPayload> = [
  'draftText',
  'leadName',
  'taskTitle',
  'taskDescription',
  'timelineNote',
  'leadId',
];

const ACTION_ICON_MAP: Record<ChatMessageActionIcon, typeof Icons.Smartphone> = {
  smartphone: Icons.Smartphone,
  edit: Icons.Edit3,
  task: Icons.CalendarCheck,
  timeline: Icons.Clock,
  lead: Icons.User,
  cancel: Icons.X,
};

const truncateText = (value: string, maxLength = MAX_TIMELINE_CONTEXT_LENGTH) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length <= maxLength) return trimmedValue;
  return `${trimmedValue.slice(0, maxLength - 3).trimEnd()}...`;
};

const getLeadFirstName = (leadName?: string) => leadName?.trim().split(/\s+/)[0] || '';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const buildQuickPrompts = (leadContext?: AuraLeadChatContext): string[] => {
  const leadFirstName = getLeadFirstName(leadContext?.leadName);

  if (!leadFirstName) {
    return [...DEFAULT_QUICK_PROMPTS];
  }

  return [
    `Resuma o momento de ${leadFirstName}`,
    `Qual o melhor prÃ³ximo passo com ${leadFirstName}?`,
    `Escreva um WhatsApp para ${leadFirstName}`,
    `Existe risco de ${leadFirstName} esfriar?`,
  ];
};

const buildLeadContext = (leadContext: AuraLeadChatContext): AuraLeadChatContext | undefined => {
  const timelineContext = (leadContext.timelineContext || [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => truncateText(item))
    .filter(Boolean)
    .slice(-MAX_TIMELINE_CONTEXT_ITEMS);
  const pendingTasks = (leadContext.pendingTasks || [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  const normalizedContext: AuraLeadChatContext = {
    leadId: leadContext.leadId?.trim() || undefined,
    leadName: leadContext.leadName?.trim() || undefined,
    leadStatus: leadContext.leadStatus?.trim() || undefined,
    propertyTitle: leadContext.propertyTitle?.trim() || undefined,
    timelineContext: timelineContext.length ? timelineContext : undefined,
    pendingTasks: pendingTasks.length ? pendingTasks : undefined,
  };

  if (
    !normalizedContext.leadId &&
    !normalizedContext.leadName &&
    !normalizedContext.leadStatus &&
    !normalizedContext.propertyTitle &&
    !normalizedContext.timelineContext?.length &&
    !normalizedContext.pendingTasks?.length
  ) {
    return undefined;
  }

  return normalizedContext;
};

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const LIST_LEADS_INTENT_REGEX =
  /\b(meus leads|meus clientes|quem eu tenho|quais leads|listar leads|liste os leads|lista de leads|mostre meus leads|mostre os leads)\b/;
const EXPLICIT_LEAD_LOOKUP_REGEX =
  /\b(lead|cliente|timeline|historico|abrir|carregar|mostrar|buscar|busque|procure)\b|falar com|dados do|dados da|me fale de/;
const GENERIC_ANALYSIS_REGEX =
  /\b(resuma|resume|qual|como|mande|monte|escreva|crie|prioridade|proximo|oque|oq|abordagem|risco)\b/;
const LEAD_QUERY_STOPWORDS = new Set([
  'a',
  'abrir',
  'agora',
  'ao',
  'aos',
  'as',
  'buscar',
  'busque',
  'carregar',
  'cliente',
  'clientes',
  'com',
  'da',
  'das',
  'dados',
  'de',
  'do',
  'dos',
  'eu',
  'falar',
  'lead',
  'leads',
  'me',
  'meu',
  'meus',
  'minha',
  'mostrar',
  'mostre',
  'na',
  'no',
  'o',
  'os',
  'para',
  'por',
  'procure',
  'quais',
  'quero',
  'sobre',
  'tenho',
  'um',
  'uma',
]);

const buildLeadInterestLabel = (lead: {
  desired_type?: string | null;
  desired_location?: string | null;
  budget?: string | number | null;
}) =>
  [
    lead.desired_type,
    lead.desired_location ? `em ${lead.desired_location}` : '',
    lead.budget ? `(Orcamento: ${lead.budget})` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

const extractPotentialLeadQuery = (value: string) => {
  const cleanedTokens = value
    .replace(/[^\wÀ-ÿ\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !LEAD_QUERY_STOPWORDS.has(normalizeSearchText(token)));

  if (!cleanedTokens.length || cleanedTokens.length > 4) return null;
  return cleanedTokens.join(' ');
};

const findLeadByReference = (value: string, leads: AuraRecentLeadOption[] = []) => {
  const normalizedValue = normalizeSearchText(value).trim();
  if (!normalizedValue) return null;

  if (/^\d+$/.test(normalizedValue)) {
    const selectedIndex = Number(normalizedValue) - 1;
    return leads[selectedIndex] || null;
  }

  const messageTokens = new Set(normalizedValue.split(/\s+/).filter(Boolean));

  return (
    leads.find((lead) => {
      const normalizedLeadName = normalizeSearchText(lead.name || '').trim();
      if (!normalizedLeadName) return false;
      if (normalizedValue === normalizedLeadName || normalizedValue.includes(normalizedLeadName)) return true;

      const firstName = normalizedLeadName.split(/\s+/)[0];
      return Boolean(firstName && firstName.length >= 3 && messageTokens.has(firstName));
    }) || null
  );
};

const normalizeMessageText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;

  const normalizedValue = value.replace(/\r\n/g, '\n').trim();
  return normalizedValue || fallback;
};

const isChatMessageType = (value: unknown): value is ChatMessageType =>
  typeof value === 'string' && CHAT_MESSAGE_TYPES.has(value as ChatMessageType);

const isChatMessageActionVariant = (value: unknown): value is ChatMessageActionVariant =>
  typeof value === 'string' && CHAT_ACTION_VARIANTS.has(value as ChatMessageActionVariant);

const isChatMessageActionIcon = (value: unknown): value is ChatMessageActionIcon =>
  typeof value === 'string' && CHAT_ACTION_ICONS.has(value as ChatMessageActionIcon);

const normalizeActionPayload = (payload: unknown): ChatMessageActionPayload | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;

  const rawPayload = payload as Record<string, unknown>;
  const normalizedPayload: ChatMessageActionPayload = {};

  ACTION_PAYLOAD_KEYS.forEach((key) => {
    const value = rawPayload[key];

    if (typeof value === 'string' && value.trim()) {
      normalizedPayload[key] = value.trim();
    }
  });

  return Object.keys(normalizedPayload).length ? normalizedPayload : undefined;
};

const normalizeMessageActions = (actions: unknown): ChatMessageAction[] | undefined => {
  if (!Array.isArray(actions)) return undefined;

  const normalizedActions = actions.reduce<ChatMessageAction[]>((acc, action, index) => {
      if (!action || typeof action !== 'object') return acc;

      const rawAction = action as Partial<ChatMessageAction> & {
        id?: unknown;
        label?: unknown;
        icon?: unknown;
        variant?: unknown;
        payload?: unknown;
        disabled?: unknown;
      };

      const label = normalizeMessageText(rawAction.label);
      if (!label) return acc;

      acc.push({
        id: normalizeMessageText(rawAction.id, `legacy_action_${index}`),
        label,
        icon: isChatMessageActionIcon(rawAction.icon) ? rawAction.icon : undefined,
        variant: isChatMessageActionVariant(rawAction.variant) ? rawAction.variant : 'ghost',
        payload: normalizeActionPayload(rawAction.payload),
        disabled: Boolean(rawAction.disabled),
      });

      return acc;
    }, []);

  return normalizedActions.length ? normalizedActions : undefined;
};

const normalizeChatMessage = (message: LegacyChatMessage): ChatMessage => {
  const role = message.role === 'user' ? 'user' : 'model';
  const actions = normalizeMessageActions(message.actions);
  const hasActions = Boolean(actions?.length);
  const fallbackText = role === 'model' ? 'Posso te ajudar a destravar esse atendimento.' : '';

  return {
    role,
    text: normalizeMessageText(message.text, fallbackText),
    messageType: hasActions ? 'action_prompt' : isChatMessageType(message.messageType) ? message.messageType : 'text',
    actions: hasActions ? actions : undefined,
  };
};

const toPlainLine = (value: string) =>
  value
    .replace(/[*_`>#]/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const buildFollowUpTaskTitle = (leadContext?: AuraLeadChatContext) =>
  leadContext?.leadName ? `Follow-up com ${leadContext.leadName}` : 'Follow-up do lead';

const buildFollowUpTaskDescription = (text: string, leadContext?: AuraLeadChatContext) => {
  const plainText = toPlainLine(text);
  const leadPrefix = leadContext?.leadName ? `Lead ${leadContext.leadName}: ` : '';
  return truncateText(`${leadPrefix}${plainText}`, 180);
};

const buildTimelineDraft = (text: string, leadContext?: AuraLeadChatContext) => {
  const plainText = toPlainLine(text);
  const prefix = leadContext?.leadName ? `${leadContext.leadName}: ` : 'Lead: ';
  return truncateText(`${prefix}${plainText}`, 150);
};

const createAction = (
  id: string,
  label: string,
  icon: ChatMessageAction['icon'],
  variant: ChatMessageAction['variant'],
  payload?: ChatMessageAction['payload']
): ChatMessageAction => ({
  id,
  label,
  icon,
  variant,
  payload,
});

const buildWhatsAppActionMessage = (text: string, leadContext?: AuraLeadChatContext): ChatMessage => {
  const taskTitle = buildFollowUpTaskTitle(leadContext);
  const taskDescription = buildFollowUpTaskDescription(text, leadContext);
  const actions: ChatMessageAction[] = [
    createAction('send_whatsapp', 'Abrir no WhatsApp', 'smartphone', 'primary', {
      draftText: text,
    }),
    createAction('edit_whatsapp', 'Ajustar texto', 'edit', 'secondary', {
      draftText: text,
      leadName: leadContext?.leadName || '',
    }),
    createAction('create_task', 'Criar tarefa', 'task', 'ghost', {
      taskTitle,
      taskDescription,
    }),
    createAction('cancel_actions', 'Agora nÃ£o', 'cancel', 'ghost'),
  ];

  return {
    role: 'model',
    text,
    messageType: 'action_prompt',
    actions,
  };
};

const buildFollowUpActionMessage = (text: string, leadContext?: AuraLeadChatContext): ChatMessage => {
  const taskTitle = buildFollowUpTaskTitle(leadContext);
  const taskDescription = buildFollowUpTaskDescription(text, leadContext);
  const timelineNote = buildTimelineDraft(text, leadContext);
  const actions: ChatMessageAction[] = [
    createAction('create_task', 'Criar tarefa', 'task', 'primary', {
      taskTitle,
      taskDescription,
    }),
    createAction('register_timeline', 'Preparar histÃ³rico', 'timeline', 'secondary', {
      timelineNote,
    }),
    ...(leadContext?.leadId
      ? [
          createAction('open_lead', 'Abrir lead', 'lead', 'ghost', {
            leadId: leadContext.leadId,
          }),
        ]
      : []),
    createAction('cancel_actions', 'Agora nÃ£o', 'cancel', 'ghost'),
  ];

  return {
    role: 'model',
    text,
    messageType: 'action_prompt',
    actions,
  };
};

const buildAuraReply = (text: string, prompt: string, leadContext?: AuraLeadChatContext): ChatMessage => {
  const normalizedPrompt = normalizeSearchText(prompt);
  const normalizedReply = normalizeSearchText(text);

  if (
    /whatsapp|mensagem|resposta/.test(normalizedPrompt) ||
    (normalizedReply.includes('whatsapp') && normalizedReply.length <= 900)
  ) {
    return buildWhatsAppActionMessage(text, leadContext);
  }

  if (
    /proximo passo|proximo movimento|follow-up|follow up|retorno|tarefa|ligar|recontato/.test(normalizedPrompt) ||
    /follow-up|follow up|proximo passo|retorno/.test(normalizedReply)
  ) {
    return buildFollowUpActionMessage(text, leadContext);
  }

  return { role: 'model', text };
};

const parseInlineTokens = (text: string): InlineToken[] => {
  const tokens: InlineToken[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    if (text.startsWith('**', cursor)) {
      const closingIndex = text.indexOf('**', cursor + 2);

      if (closingIndex > cursor + 2) {
        tokens.push({ type: 'strong', value: text.slice(cursor + 2, closingIndex) });
        cursor = closingIndex + 2;
        continue;
      }
    }

    if (text[cursor] === '*') {
      const closingIndex = text.indexOf('*', cursor + 1);

      if (closingIndex > cursor + 1) {
        tokens.push({ type: 'emphasis', value: text.slice(cursor + 1, closingIndex) });
        cursor = closingIndex + 1;
        continue;
      }
    }

    const nextBoldIndex = text.indexOf('**', cursor);
    const nextItalicIndex = text.indexOf('*', cursor);
    let nextTokenIndex = text.length;

    if (nextBoldIndex !== -1) nextTokenIndex = Math.min(nextTokenIndex, nextBoldIndex);
    if (nextItalicIndex !== -1) nextTokenIndex = Math.min(nextTokenIndex, nextItalicIndex);

    if (nextTokenIndex === cursor) {
      tokens.push({ type: 'text', value: text[cursor] });
      cursor += 1;
      continue;
    }

    tokens.push({ type: 'text', value: text.slice(cursor, nextTokenIndex) });
    cursor = nextTokenIndex;
  }

  return tokens;
};

const renderInlineContent = (text: string, keyPrefix: string, tone: 'default' | 'inverse' = 'default') =>
  parseInlineTokens(text).map((token, index) => {
    if (token.type === 'strong') {
      return (
        <strong
          key={`${keyPrefix}-strong-${index}`}
          className={cn('font-semibold', tone === 'inverse' ? 'text-white' : 'text-slate-900')}
        >
          {token.value}
        </strong>
      );
    }

    if (token.type === 'emphasis') {
      return (
        <em
          key={`${keyPrefix}-em-${index}`}
          className={cn('font-medium italic', tone === 'inverse' ? 'text-brand-300' : 'text-brand-700')}
        >
          {token.value}
        </em>
      );
    }

    return <React.Fragment key={`${keyPrefix}-text-${index}`}>{token.value}</React.Fragment>;
  });

const parseMessageBlocks = (text: string): MessageBlock[] => {
  const blocks: MessageBlock[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: 'paragraph', lines: paragraphLines });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: 'list', items: listItems });
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: Math.min(headingMatch[1].length, 3) as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      return;
    }

    const listMatch = trimmedLine.match(/^(?:[-*â€¢]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1].trim());
      return;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  });

  flushParagraph();
  flushList();

  return blocks;
};

function AuraMessageBody({
  text,
  tone = 'default',
}: {
  text: string;
  tone?: 'default' | 'inverse';
}) {
  const safeText = text.trim() || 'Posso te ajudar a destravar esse atendimento.';
  const blocks = parseMessageBlocks(safeText);
  const isInverse = tone === 'inverse';

  if (blocks.length === 0) {
    return (
      <p className={cn('max-w-none text-[13px] leading-6', isInverse ? 'text-slate-100' : 'text-slate-700')}>
        {safeText}
      </p>
    );
  }

  return (
    <div className="max-w-none space-y-2 text-[13px]">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'heading') {
          const headingClassName =
            block.level === 1
              ? isInverse
                ? 'text-[11px] font-black uppercase tracking-[0.18em] text-brand-300'
                : 'text-[11px] font-black uppercase tracking-[0.18em] text-brand-600'
              : block.level === 2
                ? isInverse
                  ? 'text-sm font-bold text-white'
                  : 'text-sm font-bold text-slate-900'
                : isInverse
                  ? 'text-xs font-bold uppercase tracking-[0.14em] text-slate-400'
                  : 'text-xs font-bold uppercase tracking-[0.14em] text-slate-500';

          return (
            <p key={`heading-${blockIndex}`} className={headingClassName}>
              {renderInlineContent(block.text, `heading-${blockIndex}`, tone)}
            </p>
          );
        }

        if (block.type === 'list') {
          return (
            <ul
              key={`list-${blockIndex}`}
              className={cn(
                'my-1 space-y-1.5 rounded-2xl px-3 py-2',
                isInverse
                  ? 'border border-slate-700/80 bg-slate-900/60'
                  : 'border border-slate-100 bg-slate-50/90'
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`list-item-${blockIndex}-${itemIndex}`} className="my-0 flex items-start gap-2">
                  <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', isInverse ? 'bg-brand-300' : 'bg-brand-500')} />
                  <span className={cn('min-w-0 flex-1 text-[13px] leading-5', isInverse ? 'text-slate-100' : 'text-slate-700')}>
                    {renderInlineContent(item, `list-item-${blockIndex}-${itemIndex}`, tone)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`} className={cn('text-[13px] leading-6', isInverse ? 'text-slate-100' : 'text-slate-700')}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={`paragraph-line-${blockIndex}-${lineIndex}`}>
                {renderInlineContent(line, `paragraph-line-${blockIndex}-${lineIndex}`, tone)}
                {lineIndex !== block.lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function AuraMessageActions({
  actions,
  isBusy,
  onActionClick,
}: {
  actions: ChatMessageAction[];
  isBusy: boolean;
  onActionClick: (action: ChatMessageAction) => void;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {actions.map((action) => {
        const IconComponent = action.icon ? ACTION_ICON_MAP[action.icon] : Icons.Zap;
        const variant = action.variant || 'ghost';
        const variantClassName =
          variant === 'primary'
            ? 'border-brand-500/30 bg-brand-500/12 text-brand-200 hover:border-brand-400/40 hover:bg-brand-500/18 hover:text-white'
            : variant === 'secondary'
              ? 'border-slate-600 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800 hover:text-white'
              : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white';

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onActionClick(action)}
            disabled={isBusy || action.disabled}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              variantClassName
            )}
          >
            <IconComponent size={12} className="text-brand-400" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  onUsePrompt,
  contextLeadName,
  leadStatus,
  propertyTitle,
  quickPrompts,
}: {
  onUsePrompt: (prompt: string) => void;
  contextLeadName?: string;
  leadStatus?: string;
  propertyTitle?: string;
  quickPrompts: string[];
}) {
  const intro = contextLeadName
    ? `Vamos destravar ${contextLeadName}?`
    : 'Sua copiloto comercial para destravar conversas e acelerar negociações.';
  const description = contextLeadName
    ? 'Já estou olhando o contexto desse atendimento. Se quiser, eu resumo o momento do lead, sugiro a abordagem e preparo a próxima mensagem.'
    : 'Peça ajuda para entender o momento do lead, montar abordagens para WhatsApp e decidir o próximo movimento sem esfriar a oportunidade.';

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <Icons.Sparkles size={20} />
          </div>

          <div className="min-w-0">
            <h4 className="mt-1 text-base font-bold text-slate-900">Aura</h4>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">{intro}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

            {contextLeadName && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
                  <Icons.User size={12} />
                  <span className="truncate">Conversando sobre: {contextLeadName}</span>
                </span>

                {leadStatus && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {leadStatus}
                  </span>
                )}

                {propertyTitle && (
                  <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    <span className="truncate">Imóvel: {propertyTitle}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Comece por aqui</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onUsePrompt(prompt)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuraChatWidget() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [context, setContext] = useState<AuraLeadChatContext>({});
  const [globalContext, setGlobalContext] = useState<AuraGlobalChatContext>({});
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Estados para o Morfismo (Figma: Stage 1 -> Stage 2 -> Stage 3)
  const [animStage, setAnimStage] = useState<'closed' | 'pill' | 'open'>('closed');
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLeadContextDismissed, setIsLeadContextDismissed] = useState(false);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animationTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const handleTelepathy = (e: Event) => {
      const customEvent = e as CustomEvent<AuraLeadChatContext>;
      setContext(customEvent.detail || {});
    };

    window.addEventListener('auraTelepathy', handleTelepathy);
    return () => window.removeEventListener('auraTelepathy', handleTelepathy);
  }, []);

  const clearAnimationTimeouts = () => {
    animationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    animationTimeoutsRef.current = [];
  };

  const queueAnimationTimeout = (callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(callback, delay);
    animationTimeoutsRef.current.push(timeoutId);
  };

  useEffect(() => {
    setIsLeadContextDismissed(false);
  }, [context]);

  useEffect(() => {
    setActiveLeadId(context.leadId || null);
  }, [context.leadId]);

  useEffect(() => {
    return () => {
      clearAnimationTimeouts();
    };
  }, []);

  const leadContext = isLeadContextDismissed
    ? undefined
    : buildLeadContext(context);

  const normalizedMessages = messages.map((message) => normalizeChatMessage(message));
  const leadFirstName = getLeadFirstName(leadContext?.leadName);
  const quickPrompts = buildQuickPrompts(leadContext);
  const inputPlaceholder = leadFirstName
    ? `Ex.: qual abordagem pode destravar ${leadFirstName} agora?`
    : 'Escreva aqui sua pergunta ou solicitação para a Aura';
  const loadingMessage = leadFirstName
    ? `Lendo o momento de ${leadFirstName} e montando uma resposta com direcao comercial.`
    : 'Organizando proximos passos, argumentos e mensagem comercial.';
  const userAvatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url;
  const userInitial = (
    user?.name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'U'
  )
    .trim()
    .charAt(0)
    .toUpperCase();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const fetchDeepLeadContext = async (id: string): Promise<AuraLeadChatContext | null> => {
    try {
      const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', id).single();
      if (leadError) throw leadError;

      const { data: timeline, error: timelineError } = await supabase
        .from('timeline_events')
        .select('description, created_at')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (timelineError) throw timelineError;

      if (!lead) return null;

      const nextContext: AuraLeadChatContext = {
        leadId: lead.id,
        leadName: lead.name,
        leadStatus: lead.status,
        propertyTitle: buildLeadInterestLabel(lead) || 'Perfil de interesse nao definido',
        timelineContext:
          timeline?.map((item) => {
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : 'Recente';
            return `[${date}] ${item.description}`;
          }) || [],
      };

      setContext(nextContext);
      setIsLeadContextDismissed(false);
      setActiveLeadId(id);
      setGlobalContext((prev) => ({ ...prev, activeLeadId: id }));

      return nextContext;
    } catch (error) {
      console.error('Aura: erro ao carregar contexto profundo do lead', error);
      addToast('Nao consegui carregar o historico desse lead agora.', 'error');
      return null;
    }
  };

  const searchLeadsForAura = async (query?: string): Promise<AuraRecentLeadOption[]> => {
    if (!user?.id) return [];

    try {
      let q = supabase
        .from('leads')
        .select('id, name, status')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (query) q = q.ilike('name', `%${query}%`);

      const { data, error } = await q.limit(MAX_AURA_LEAD_RESULTS);
      if (error) throw error;

      return (data || []).map((lead) => ({
        id: lead.id,
        name: lead.name,
        status: lead.status,
      }));
    } catch (error) {
      console.error('Aura: erro ao buscar leads do corretor', error);
      return [];
    }
  };

  const fetchGlobalContext = async (): Promise<AuraGlobalChatContext> => {
    if (!user?.id) return {};

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const [recentLeads, tasksRes] = await Promise.all([
        searchLeadsForAura(),
        supabase
          .from('tasks')
          .select('title, due_date, completed, status')
          .eq('user_id', user.id)
          .gte('due_date', startOfDay.toISOString())
          .lte('due_date', endOfDay.toISOString())
          .order('due_date', { ascending: true })
          .limit(MAX_AURA_LEAD_RESULTS),
      ]);

      if (tasksRes.error) throw tasksRes.error;

      const pendingTasks =
        tasksRes.data
          ?.filter((task) => {
            const normalizedStatus = normalizeSearchText(String((task as { status?: string | null }).status || ''));
            return !(task.completed || normalizedStatus === 'done' || normalizedStatus === 'completed' || normalizedStatus === 'concluida');
          })
          .map((task) => task.title)
          .filter((title): title is string => typeof title === 'string' && Boolean(title.trim())) || [];

      const nextGlobalContext: AuraGlobalChatContext = {
        recentLeads,
        pendingTasks,
        activeLeadId,
      };

      setGlobalContext(nextGlobalContext);
      return nextGlobalContext;
    } catch (error) {
      console.error('Aura: erro ao montar contexto global', error);
      return globalContext;
    }
  };

  useEffect(() => {
    if (isContentVisible) scrollToBottom();
  }, [messages, isContentVisible, isLoading]);

  useEffect(() => {
    if (animStage === 'open' && isContentVisible && !isLoading) {
      inputRef.current?.focus();
    }
  }, [animStage, isContentVisible, isLoading]);

  const appendAuraMessage = (text: string) => {
    setMessages((prev) => [...prev, normalizeChatMessage({ role: 'model', text })]);
  };

  const updateMessageAction = (messageIndex: number, actionId: string, updates: Partial<ChatMessageAction>) => {
    setMessages((prev) =>
      prev.map((message, index) => {
        const normalizedMessage = normalizeChatMessage(message);
        if (index !== messageIndex || !normalizedMessage.actions?.length) return normalizedMessage;

        return normalizeChatMessage({
          ...normalizedMessage,
          actions: normalizedMessage.actions.map((action) =>
            action.id === actionId ? { ...action, ...updates } : action
          ),
        });
      })
    );
  };

  const clearMessageActions = (messageIndex: number) => {
    setMessages((prev) =>
      prev.map((message, index) =>
        index === messageIndex
          ? normalizeChatMessage({
              ...normalizeChatMessage(message),
              messageType: 'text',
              actions: undefined,
            })
          : normalizeChatMessage(message)
      )
    );
  };

  const handleActionClick = async (messageIndex: number, action: ChatMessageAction) => {
    const actionKey = `${messageIndex}:${action.id}`;
    if (activeActionKey) return;

    setActiveActionKey(actionKey);

    try {
      const targetMessage = normalizeChatMessage(messages[messageIndex] ?? { role: 'model', text: '' });

      if (action.id === 'send_whatsapp') {
        const draftText = action.payload?.draftText?.trim() || targetMessage.text || '';
        if (!draftText) {
          addToast('Nao achei uma mensagem pronta para abrir no WhatsApp agora.', 'error');
          return;
        }

        window.open(`https://wa.me/?text=${encodeURIComponent(draftText)}`, '_blank', 'noopener,noreferrer');
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'WhatsApp aberto' });
        addToast('Abri o rascunho no WhatsApp Web.', 'success');
        return;
      }

      if (action.id === 'edit_whatsapp') {
        const targetLeadName = action.payload?.leadName || context.leadName || 'o lead';
        setInputValue(
          `Refine a ultima mensagem de WhatsApp para ${targetLeadName} com tom de corretor, mais curta, natural e facil de responder.`
        );
        inputRef.current?.focus();
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'Texto em ajuste' });
        addToast('Deixei um pedido de ajuste pronto na caixa de mensagem.', 'info');
        return;
      }

      if (action.id === 'create_task') {
        const taskTitle = action.payload?.taskTitle || buildFollowUpTaskTitle(context);
        appendAuraMessage(`Tarefa gerada: "${taskTitle}". Pode fecha-la na aba de tarefas do lead.`);
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'Tarefa pronta' });
        addToast('Deixei uma tarefa de follow-up rascunhada no chat.', 'success');
        return;
      }

      if (action.id === 'register_timeline') {
        appendAuraMessage('Nota adicionada com sucesso ao historico.');
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'Nota pronta' });
        addToast('Deixei uma nota pronta para o historico do lead.', 'success');
        return;
      }

      if (action.id === 'open_lead') {
        const targetLeadId = action.payload?.leadId || context.leadId;
        if (!targetLeadId) {
          addToast('Nao encontrei um lead em foco para abrir agora.', 'info');
          return;
        }

        window.location.assign(`/admin/leads?open=${encodeURIComponent(targetLeadId)}`);
        return;
      }

      if (action.id === 'cancel_actions') {
        clearMessageActions(messageIndex);
        addToast('Atalho recolhido.', 'info');
      }
    } catch (error: unknown) {
      console.error('Erro ao executar acao rapida da Aura:', error);
      addToast('Nao consegui executar esse atalho agora.', 'error');
    } finally {
      setActiveActionKey(null);
    }
  };

  const sendMessage = async (
    messageText: string,
    overrides?: { leadContext?: AuraLeadChatContext | null; globalContext?: AuraGlobalChatContext }
  ) => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isLoading) return;

    const currentHistory = messages.map((message) => normalizeChatMessage(message));
    const nextUserMessage = normalizeChatMessage({ role: 'user', text: trimmedMessage });
    const effectiveLeadContext = overrides?.leadContext === undefined ? leadContext : overrides.leadContext || undefined;
    const effectiveGlobalContext = overrides?.globalContext || globalContext;

    setMessages([...currentHistory, nextUserMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatWithAura(
        trimmedMessage,
        currentHistory,
        user?.name || user?.user_metadata?.name || 'Corretor',
        {
          leadContext: effectiveLeadContext,
          globalContext: effectiveGlobalContext,
        }
      );

      setMessages((prev) => [...prev, normalizeChatMessage(buildAuraReply(response, trimmedMessage, effectiveLeadContext))]);
    } catch (error: unknown) {
      const fallbackMessage =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Perdi o fio por um instante. Me chama de novo com o foco do atendimento que eu reorganizo.';

      setMessages((prev) => [...prev, normalizeChatMessage({ role: 'model', text: fallbackMessage })]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isLoading) return;

    const normalizedMessage = normalizeSearchText(trimmedMessage);
    const currentRecentLeads = globalContext.recentLeads || [];
    const referencedLead = findLeadByReference(trimmedMessage, currentRecentLeads);
    const explicitLookup = EXPLICIT_LEAD_LOOKUP_REGEX.test(normalizedMessage);
    const listIntent = LIST_LEADS_INTENT_REGEX.test(normalizedMessage);
    const looseLookup =
      !activeLeadId &&
      !GENERIC_ANALYSIS_REGEX.test(normalizedMessage) &&
      normalizedMessage.split(/\s+/).filter(Boolean).length <= 3;
    const leadQuery = extractPotentialLeadQuery(trimmedMessage);

    if (listIntent) {
      const nextGlobalContext = await fetchGlobalContext();

      if (!nextGlobalContext.recentLeads?.length) {
        setInputValue('');
        appendAuraMessage('Nao encontrei leads atribuidos a voce neste momento.');
        return;
      }

      await sendMessage(trimmedMessage, {
        leadContext: null,
        globalContext: nextGlobalContext,
      });
      return;
    }

    if (referencedLead?.id) {
      const nextLeadContext =
        leadContext?.leadId === referencedLead.id && activeLeadId === referencedLead.id
          ? leadContext
          : await fetchDeepLeadContext(referencedLead.id);

      if (nextLeadContext) {
        const nextGlobalContext = {
          ...globalContext,
          activeLeadId: referencedLead.id,
        };
        setGlobalContext(nextGlobalContext);

        await sendMessage(trimmedMessage, {
          leadContext: nextLeadContext,
          globalContext: nextGlobalContext,
        });
        return;
      }
    }

    if (leadQuery && (explicitLookup || looseLookup)) {
      const foundLeads = await searchLeadsForAura(leadQuery);

      if (foundLeads.length === 1) {
        const nextLeadContext = await fetchDeepLeadContext(foundLeads[0].id);
        if (nextLeadContext) {
          const nextGlobalContext = {
            ...globalContext,
            recentLeads: foundLeads,
            activeLeadId: foundLeads[0].id,
          };
          setGlobalContext(nextGlobalContext);

          await sendMessage(trimmedMessage, {
            leadContext: nextLeadContext,
            globalContext: nextGlobalContext,
          });
          return;
        }
      }

      if (foundLeads.length > 1) {
        const nextGlobalContext = {
          ...globalContext,
          recentLeads: foundLeads,
          activeLeadId: null,
        };
        setGlobalContext(nextGlobalContext);

        await sendMessage(trimmedMessage, {
          leadContext: null,
          globalContext: nextGlobalContext,
        });
        return;
      }

      if (explicitLookup) {
        setInputValue('');
        appendAuraMessage(`Nao encontrei um lead com "${leadQuery}" na sua carteira agora. Me passe o nome exato ou peça "meus leads".`);
        return;
      }
    }

    await sendMessage(trimmedMessage);
  };

  const handleOpenSequence = () => {
    if (animStage !== 'closed') return;

    clearAnimationTimeouts();
    void fetchGlobalContext();
    setIsOpen(true);
    setIsContentVisible(false);
    setAnimStage('pill');

    queueAnimationTimeout(() => {
      setAnimStage('open');

      queueAnimationTimeout(() => {
        setIsContentVisible(true);
        inputRef.current?.focus();
      }, 200);
    }, 250);
  };

  const handleCloseSequence = () => {
    if (!isOpen) return;

    clearAnimationTimeouts();
    setIsContentVisible(false);
    setAnimStage('pill');

    queueAnimationTimeout(() => {
      setAnimStage('closed');

      queueAnimationTimeout(() => {
        setIsOpen(false);
      }, 300);
    }, 200);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  const handleClearContext = () => {
    setIsLeadContextDismissed(true);
    setContext({});
    setActiveLeadId(null);
    setGlobalContext((prev) => ({ ...prev, activeLeadId: null }));
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end sm:bottom-6 sm:right-6">
      {animStage === 'closed' && context.leadName && (
        <span className="mb-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[11px] font-semibold text-brand-700 shadow-sm">
          Lead em foco: {context.leadName}
        </span>
      )}

      <div
        className={cn(
          'group relative max-w-[calc(100vw-2rem)] overflow-hidden shadow-2xl transition-all duration-300 ease-in-out',
          animStage === 'closed' && 'h-14 w-14 cursor-pointer rounded-full bg-slate-900 hover:bg-slate-800',
          animStage !== 'closed' && 'border border-slate-200 bg-white',
          animStage === 'pill' && 'w-[483px] h-14 rounded-[50px]',
          animStage === 'open' && 'w-[483px] h-[650px] rounded-[24px]',
          animStage === 'open' && 'max-h-[calc(100dvh-4rem)]'
        )}
        onClick={animStage === 'closed' ? handleOpenSequence : undefined}
        onKeyDown={
          animStage === 'closed'
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleOpenSequence();
                }
              }
            : undefined
        }
        role={animStage === 'closed' ? 'button' : undefined}
        tabIndex={animStage === 'closed' ? 0 : undefined}
        aria-label={animStage === 'closed' ? 'Abrir chat da Aura' : undefined}
      >
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-opacity duration-200',
            animStage === 'closed' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <Icons.Sparkles size={24} className="text-brand-400 transition-transform group-hover:rotate-12" />
        </div>

        {isOpen && (
          <div
            className={cn(
              'flex flex-col h-full w-full transition-opacity duration-300',
              isContentVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                  <Icons.Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Aura</h3>
                  <p className="text-[10px] text-slate-300">
                    {context.leadName ? `Em contexto com ${context.leadName}` : 'Seu Assistente Comercial do Plantao'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseSequence}
                className="text-slate-400 transition-colors hover:text-white"
                aria-label="Fechar chat da Aura"
              >
                <Icons.X size={18} />
              </button>
            </div>

            {leadContext?.leadId && leadContext.leadName && (
              <div className="border-b border-slate-800/60 bg-slate-900/50 px-6 py-2 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Icons.Target size={10} />
                      Foco Atual
                    </span>
                    <div className="flex max-w-[190px] items-center gap-1.5 rounded-md border border-brand-500/20 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-400">
                      <Icons.User size={10} />
                      <span className="max-w-[150px] truncate">{leadContext.leadName}</span>
                    </div>
                    {leadContext.leadStatus && (
                      <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {leadContext.leadStatus}
                      </span>
                    )}
                    {leadContext.propertyTitle && (
                      <span className="max-w-[150px] truncate rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        Imovel: {leadContext.propertyTitle}
                      </span>
                    )}
                    {leadContext.timelineContext?.length ? (
                      <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        Historico: {leadContext.timelineContext.length}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleClearContext}
                    className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-200"
                    title="Sair do modo contextual"
                    aria-label="Limpar contexto do lead"
                  >
                    Limpar <Icons.X size={12} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-100/70 p-4">
              {normalizedMessages.length === 0 ? (
                <EmptyState
                  onUsePrompt={handleQuickPrompt}
                  contextLeadName={context.leadName}
                  leadStatus={leadContext?.leadStatus}
                  propertyTitle={leadContext?.propertyTitle}
                  quickPrompts={quickPrompts}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {normalizedMessages.map((msg, idx) => {
                    const userLines = msg.text.split(/\r?\n/);

                    return (
                      <div
                        key={`message-${idx}`}
                        className={cn('flex w-full gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                      >
                        {msg.role === 'model' && (
                          <div className="mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 shadow-sm">
                            <Icons.Sparkles size={12} className="text-brand-400" />
                          </div>
                        )}

                        <div
                          className={cn(
                            'flex max-w-[82%] flex-col gap-1.5',
                            msg.role === 'user' ? 'items-end' : 'items-start'
                          )}
                        >
                          <div
                            className={cn(
                              'overflow-hidden rounded-[20px] px-4 py-3 text-[13px] leading-relaxed shadow-sm',
                              msg.role === 'user'
                                ? 'rounded-br-sm bg-brand-600 text-white'
                                : 'rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-100'
                            )}
                          >
                            {msg.role === 'user' ? (
                              userLines.map((line, lineIndex) => (
                                <React.Fragment key={`user-line-${idx}-${lineIndex}`}>
                                  {line}
                                  {lineIndex !== userLines.length - 1 && <br />}
                                </React.Fragment>
                              ))
                            ) : (
                              <AuraMessageBody text={msg.text} tone="inverse" />
                            )}
                          </div>

                          {msg.messageType === 'action_prompt' && msg.actions?.length ? (
                            <AuraMessageActions
                              actions={msg.actions}
                              isBusy={Boolean(activeActionKey)}
                              onActionClick={(action) => void handleActionClick(idx, action)}
                            />
                          ) : null}
                        </div>

                        {msg.role === 'user' && (
                          <div className="mt-auto flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700 shadow-sm">
                            {userAvatarUrl ? (
                              <img src={userAvatarUrl} alt="User" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold uppercase text-white">{userInitial}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div className="flex w-full justify-start gap-2.5">
                      <div className="mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 shadow-sm">
                        <Icons.Sparkles size={12} className="text-brand-400" />
                      </div>

                      <div className="max-w-[82%] rounded-[20px] rounded-bl-sm border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-300">
                          <Icons.Loader2 size={14} className="animate-spin" />
                          Aura montando a melhor abordagem
                        </div>
                        <p className="mt-2 text-[13px] leading-5 text-slate-300">{loadingMessage}</p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-slate-100 bg-white p-3">
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={inputPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-12 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                  aria-label="Enviar mensagem para a Aura"
                >
                  <Icons.Send size={14} />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
