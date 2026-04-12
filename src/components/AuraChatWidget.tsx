import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  AuraLeadChatContext,
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

interface AuraChatWidgetProps extends AuraLeadChatContext {
  onClearContext?: () => void;
}

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

const ACTION_VARIANT_CLASSNAME: Record<ChatMessageActionVariant, string> = {
  primary:
    'border-transparent bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500',
  secondary:
    'border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100 disabled:border-brand-100 disabled:bg-brand-50/60 disabled:text-brand-300',
  ghost:
    'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400',
} as const;

const truncateText = (value: string, maxLength = MAX_TIMELINE_CONTEXT_LENGTH) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length <= maxLength) return trimmedValue;
  return `${trimmedValue.slice(0, maxLength - 3).trimEnd()}...`;
};

const getLeadFirstName = (leadName?: string) => leadName?.trim().split(/\s+/)[0] || '';

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

  const normalizedContext: AuraLeadChatContext = {
    leadId: leadContext.leadId?.trim() || undefined,
    leadName: leadContext.leadName?.trim() || undefined,
    leadStatus: leadContext.leadStatus?.trim() || undefined,
    propertyTitle: leadContext.propertyTitle?.trim() || undefined,
    timelineContext: timelineContext.length ? timelineContext : undefined,
  };

  if (
    !normalizedContext.leadId &&
    !normalizedContext.leadName &&
    !normalizedContext.leadStatus &&
    !normalizedContext.propertyTitle &&
    !normalizedContext.timelineContext?.length
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

const renderInlineContent = (text: string, keyPrefix: string) =>
  parseInlineTokens(text).map((token, index) => {
    if (token.type === 'strong') {
      return (
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-slate-900">
          {token.value}
        </strong>
      );
    }

    if (token.type === 'emphasis') {
      return (
        <em key={`${keyPrefix}-em-${index}`} className="font-medium italic text-brand-700">
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

function AuraMessageBody({ text }: { text: string }) {
  const safeText = text.trim() || 'Posso te ajudar a destravar esse atendimento.';
  const blocks = parseMessageBlocks(safeText);

  if (blocks.length === 0) {
    return <p className="text-[13px] leading-6 text-slate-700">{safeText}</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'heading') {
          const headingClassName =
            block.level === 1
              ? 'text-[11px] font-black uppercase tracking-[0.18em] text-brand-600'
              : block.level === 2
                ? 'text-sm font-bold text-slate-900'
                : 'text-xs font-bold uppercase tracking-[0.14em] text-slate-500';

          return (
            <p key={`heading-${blockIndex}`} className={headingClassName}>
              {renderInlineContent(block.text, `heading-${blockIndex}`)}
            </p>
          );
        }

        if (block.type === 'list') {
          return (
            <ul
              key={`list-${blockIndex}`}
              className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-3"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`list-item-${blockIndex}-${itemIndex}`} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span className="min-w-0 flex-1 text-[13px] leading-6 text-slate-700">
                    {renderInlineContent(item, `list-item-${blockIndex}-${itemIndex}`)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`} className="text-[13px] leading-6 text-slate-700">
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={`paragraph-line-${blockIndex}-${lineIndex}`}>
                {renderInlineContent(line, `paragraph-line-${blockIndex}-${lineIndex}`)}
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
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const IconComponent = action.icon ? ACTION_ICON_MAP[action.icon] : null;
          const variant = action.variant || 'ghost';

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onActionClick(action)}
              disabled={isBusy || action.disabled}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${ACTION_VARIANT_CLASSNAME[variant]}`}
            >
              {IconComponent && <IconComponent size={13} />}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  onUsePrompt,
  leadName,
  leadStatus,
  propertyTitle,
  quickPrompts,
}: {
  onUsePrompt: (prompt: string) => void;
  leadName?: string;
  leadStatus?: string;
  propertyTitle?: string;
  quickPrompts: string[];
}) {
  const leadFirstName = getLeadFirstName(leadName);
  const title = leadFirstName
    ? `Vamos destravar ${leadFirstName}?`
    : 'Sua copiloto comercial para destravar conversas e acelerar negociações.';
  const description = leadFirstName
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
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">Aura no plantão</p>
            <h4 className="mt-1 text-base font-bold text-slate-900">{title}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

            {leadName && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
                  <Icons.User size={12} />
                  <span className="truncate">Conversando sobre: {leadName}</span>
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

export default function AuraChatWidget({
  leadId,
  leadName,
  leadStatus,
  propertyTitle,
  timelineContext,
  onClearContext,
}: AuraChatWidgetProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLeadContextDismissed, setIsLeadContextDismissed] = useState(false);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsLeadContextDismissed(false);
  }, [leadId, leadName, leadStatus, propertyTitle]);

  const leadContext = isLeadContextDismissed
    ? undefined
    : buildLeadContext({
        leadId,
        leadName,
        leadStatus,
        propertyTitle,
        timelineContext,
      });

  const normalizedMessages = messages.map((message) => normalizeChatMessage(message));
  const leadFirstName = getLeadFirstName(leadContext?.leadName);
  const quickPrompts = buildQuickPrompts(leadContext);
  const inputPlaceholder = leadFirstName
    ? `Ex.: qual abordagem pode destravar ${leadFirstName} agora?`
    : 'Ex.: monte uma resposta de WhatsApp ou diga o prÃ³ximo passo';
  const contextualHint = leadContext
    ? 'Aura vai considerar o lead em foco e o histÃ³rico resumido deste atendimento.'
    : 'VocÃª pode pedir resumo, mensagem de WhatsApp, prÃ³ximo passo ou leitura de risco.';
  const loadingMessage = leadFirstName
    ? `Lendo o momento de ${leadFirstName} e montando uma resposta com direÃ§Ã£o comercial.`
    : 'Organizando prÃ³ximos passos, argumentos e mensagem comercial.';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isLoading]);

  useEffect(() => {
    if (isOpen && !isLoading) inputRef.current?.focus();
  }, [isOpen, isLoading]);

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
          addToast('NÃ£o achei uma mensagem pronta para abrir no WhatsApp agora.', 'error');
          return;
        }

        window.open(`https://wa.me/?text=${encodeURIComponent(draftText)}`, '_blank', 'noopener,noreferrer');
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'WhatsApp aberto' });
        addToast('Abri o rascunho no WhatsApp Web.', 'success');
        return;
      }

      if (action.id === 'edit_whatsapp') {
        const targetLeadName = action.payload?.leadName || leadContext?.leadName || 'o lead';
        setInputValue(
          `Refine a Ãºltima mensagem de WhatsApp para ${targetLeadName} com tom de corretor, mais curta, natural e fÃ¡cil de responder.`
        );
        inputRef.current?.focus();
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'Texto em ajuste' });
        addToast('Deixei um pedido de ajuste pronto na caixa de mensagem.', 'info');
        return;
      }

      if (action.id === 'create_task') {
        const taskTitle = action.payload?.taskTitle || buildFollowUpTaskTitle(leadContext);

        appendAuraMessage(`Tarefa gerada: "${taskTitle}". Pode fechá-la na aba de tarefas do lead.`);
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'Tarefa pronta' });
        addToast('Deixei uma tarefa de follow-up rascunhada no chat.', 'success');
        return;
      }

      if (action.id === 'register_timeline') {
        appendAuraMessage(`Nota adicionada com sucesso ao histórico!`);
        updateMessageAction(messageIndex, action.id, { disabled: true, label: 'Nota pronta' });
        addToast('Deixei uma nota pronta para o histÃ³rico do lead.', 'success');
        return;
      }

      if (action.id === 'open_lead') {
        const targetLeadId = action.payload?.leadId || leadContext?.leadId;
        if (!targetLeadId) {
          addToast('NÃ£o encontrei um lead em foco para abrir agora.', 'info');
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
      console.error('Erro ao executar aÃ§Ã£o rÃ¡pida da Aura:', error);
      addToast('NÃ£o consegui executar esse atalho agora.', 'error');
    } finally {
      setActiveActionKey(null);
    }
  };

  const sendMessage = async (messageText: string) => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isLoading) return;

    const currentHistory = messages.map((message) => normalizeChatMessage(message));
    const nextUserMessage = normalizeChatMessage({ role: 'user', text: trimmedMessage });

    setMessages([...currentHistory, nextUserMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatWithAura(
        trimmedMessage,
        currentHistory,
        user?.name || user?.user_metadata?.name || 'Corretor',
        { leadContext }
      );

      setMessages((prev) => [...prev, normalizeChatMessage(buildAuraReply(response, trimmedMessage, leadContext))]);
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
    await sendMessage(inputValue);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  const handleClearContext = () => {
    setIsLeadContextDismissed(true);
    onClearContext?.();
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end sm:bottom-6 sm:right-6">
      {isOpen && (
        <div className="mb-4 flex h-[650px] max-h-[calc(100dvh-4rem)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in sm:w-[460px]">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                <Icons.Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold">Aura</h3>
                <p className="text-[10px] text-slate-300">
                  {leadFirstName ? `Em contexto com ${leadFirstName}` : 'Copiloto comercial do plantÃ£o'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 transition-colors hover:text-white"
              aria-label="Fechar chat da Aura"
            >
              <Icons.X size={18} />
            </button>
          </div>

          {leadContext && (
            <div className="border-b border-brand-100 bg-brand-50/80 px-4 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">Modo contextual</p>
                  <p className="truncate text-xs font-semibold text-slate-800">
                    Conversando sobre: {leadContext.leadName || 'Lead selecionado'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClearContext}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                  aria-label="Limpar contexto do lead"
                >
                  <Icons.X size={12} />
                  Limpar
                </button>
              </div>

              {(leadContext.leadStatus || leadContext.propertyTitle || leadContext.timelineContext?.length) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {leadContext.leadStatus && (
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {leadContext.leadStatus}
                    </span>
                  )}

                  {leadContext.propertyTitle && (
                    <span className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      ImÃ³vel: {leadContext.propertyTitle}
                    </span>
                  )}

                  {leadContext.timelineContext?.length ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      HistÃ³rico recente: {leadContext.timelineContext.length}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-100/70 p-4">
            {normalizedMessages.length === 0 ? (
              <EmptyState
                onUsePrompt={handleQuickPrompt}
                leadName={leadContext?.leadName}
                leadStatus={leadContext?.leadStatus}
                propertyTitle={leadContext?.propertyTitle}
                quickPrompts={quickPrompts}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {normalizedMessages.map((msg, idx) => {
                  if (msg.role === 'user') {
                    const lines = msg.text.split(/\r?\n/);

                    return (
                      <div key={`message-${idx}`} className="flex justify-end">
                        <div className="max-w-[82%] rounded-[22px] rounded-tr-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm">
                          {lines.map((line, lineIndex) => (
                            <React.Fragment key={`user-line-${idx}-${lineIndex}`}>
                              {line}
                              {lineIndex !== lines.length - 1 && <br />}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`message-${idx}`} className="flex justify-start">
                      <div className="flex max-w-[92%] items-start gap-2.5">
                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 shadow-sm">
                          <Icons.Sparkles size={16} />
                        </div>

                        <div className="min-w-0 flex-1 overflow-hidden rounded-[24px] rounded-tl-md border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                          <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50 via-white to-white px-4 py-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">Aura</p>
                            <p className="text-[11px] text-slate-500">
                              {msg.messageType === 'action_prompt'
                                ? 'Movimento sugerido pela Aura'
                                : 'Copiloto comercial do plantÃ£o'}
                            </p>
                          </div>

                          <div className="px-4 py-3.5">
                            <AuraMessageBody text={msg.text} />
                          </div>

                          {msg.messageType === 'action_prompt' && msg.actions?.length ? (
                            <AuraMessageActions
                              actions={msg.actions}
                              isBusy={Boolean(activeActionKey)}
                              onActionClick={(action) => void handleActionClick(idx, action)}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex max-w-[92%] items-start gap-2.5">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 shadow-sm">
                        <Icons.Sparkles size={16} />
                      </div>

                      <div className="overflow-hidden rounded-[24px] rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
                          <Icons.Loader2 size={14} className="animate-spin" />
                          Aura montando a melhor abordagem
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{loadingMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-slate-100 bg-white p-3">
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Comece por aqui</p>
                {leadFirstName ? (
                  <span className="text-[11px] font-medium text-brand-600">Lead em foco: {leadFirstName}</span>
                ) : null}
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={isLoading}
                    className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

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

            <p className="mt-2 px-1 text-[11px] leading-5 text-slate-500">{contextualHint}</p>
          </form>
        </div>
      )}

      {!isOpen && (
        <>
          {leadFirstName ? (
            <span className="mb-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[11px] font-semibold text-brand-700 shadow-sm">
              Lead em foco: {leadFirstName}
            </span>
          ) : null}

          <button
            onClick={() => setIsOpen(true)}
            className="group flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition-all hover:scale-105 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20"
            aria-label="Abrir chat da Aura"
          >
            <Icons.Sparkles size={24} className="text-brand-400 transition-transform group-hover:rotate-12" />
          </button>
        </>
      )}
    </div>
  );
}

