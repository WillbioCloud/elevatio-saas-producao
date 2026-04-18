import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MessageSquare, Paperclip, Plus, Search, Send, Smile, Star } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';
import Loading from '../components/Loading';

type Priority = 'Alta' | 'Média' | 'Baixa';
type Status = 'Aberto' | 'Pendente' | 'Resolvido';

interface Message {
  id: string;
  sender: 'client' | 'admin';
  text: string;
  timestamp: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  priority: Priority;
  status: Status;
  timeElapsed: string;
  messages: Message[];
  createdAt: string;
  supportRating?: number | null;
  supportFeedback?: string | null;
}

interface TicketMessageRow {
  id: string;
  ticket_id: string;
  sender_type: string | null;
  message: string | null;
  created_at: string;
}

interface TicketRow {
  id: string;
  subject: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
  support_rating: number | null;
  support_feedback: string | null;
  saas_ticket_messages: TicketMessageRow[] | null;
}

const formatTimeElapsed = (createdAt: string) => {
  const created = new Date(createdAt).getTime();
  const diffHours = Math.floor(Math.max(0, Date.now() - created) / (1000 * 60 * 60));

  if (diffHours < 1) return 'Há poucos minutos';
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;

  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
};

const formatMessageTimestamp = (createdAt: string) =>
  new Date(createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const normalizePriority = (priority: string | null | undefined): Priority => {
  if (priority === 'Alta' || priority?.toLowerCase() === 'high') return 'Alta';
  if (priority === 'Baixa' || priority?.toLowerCase() === 'low') return 'Baixa';
  return 'Média';
};

const normalizeStatus = (status: string | null | undefined): Status => {
  if (status === 'Resolvido' || status?.toLowerCase() === 'resolved') return 'Resolvido';
  if (status === 'Pendente' || status?.toLowerCase() === 'pending') return 'Pendente';
  return 'Aberto';
};

const mapMessageRow = (message: TicketMessageRow): Message => ({
  id: message.id,
  sender: message.sender_type === 'admin' ? 'admin' : 'client',
  text: message.message || '',
  timestamp: formatMessageTimestamp(message.created_at),
  createdAt: message.created_at,
});

const appendMessageToTickets = (tickets: Ticket[], message: TicketMessageRow) =>
  tickets.map((ticket) => {
    if (ticket.id !== message.ticket_id || ticket.messages.some((item) => item.id === message.id)) {
      return ticket;
    }

    return {
      ...ticket,
      messages: [...ticket.messages, mapMessageRow(message)].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    };
  });

const getAttachmentUrl = (text: string) => text.match(/!\[Anexo\]\(([^)]+)\)/)?.[1] ?? null;

export default function AdminSupport() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('Média');
  const [newMessage, setNewMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isOtherPartyTyping, setIsOtherPartyTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const isSubmittingRef = useRef(false);
  const roomRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentUserRole = 'client' as const;

  const fetchMyTickets = useCallback(
    async (options?: { preferredTicketId?: string | null }) => {
      if (!user?.company_id) {
        setIsLoading(false);
        setTickets([]);
        setSelectedTicketId(null);
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase
        .from('saas_tickets')
        .select(
          'id, subject, priority, status, created_at, support_rating, support_feedback, saas_ticket_messages(id, ticket_id, sender_type, message, created_at)'
        )
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar chamados do tenant:', error);
        setIsLoading(false);
        return;
      }

      const mappedTickets: Ticket[] = ((data as TicketRow[] | null) ?? []).map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject || 'Sem assunto',
        priority: normalizePriority(ticket.priority),
        status: normalizeStatus(ticket.status),
        timeElapsed: formatTimeElapsed(ticket.created_at),
        createdAt: ticket.created_at,
        supportRating: ticket.support_rating,
        supportFeedback: ticket.support_feedback,
        messages: [...(ticket.saas_ticket_messages ?? [])]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(mapMessageRow),
      }));

      setTickets(mappedTickets);
      setSelectedTicketId((currentSelected) => {
        const preferredTicketId = options?.preferredTicketId;

        if (preferredTicketId && mappedTickets.some((ticket) => ticket.id === preferredTicketId)) {
          return preferredTicketId;
        }

        if (currentSelected && mappedTickets.some((ticket) => ticket.id === currentSelected)) {
          return currentSelected;
        }

        return mappedTickets[0]?.id ?? null;
      });
      setIsLoading(false);
    },
    [user?.company_id]
  );

  useEffect(() => {
    void fetchMyTickets();
  }, [fetchMyTickets]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [selectedTicketId, tickets]);

  useEffect(() => {
    setRatingValue(0);
    setFeedbackText('');
  }, [selectedTicketId]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    if (!selectedTicket?.id) return;

    const channel = supabase.channel(`ticket-room-${selectedTicket.id}`, {
      config: { broadcast: { ack: false } },
    });
    roomRef.current = channel;

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'saas_ticket_messages',
        filter: `ticket_id=eq.${selectedTicket.id}`,
      },
      () => {
        void fetchMyTickets({ preferredTicketId: selectedTicket.id });
      }
    );

    // Escuta mudanças de STATUS ou PRIORIDADE no próprio ticket
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'saas_tickets',
        filter: `id=eq.${selectedTicket.id}`,
      },
      () => {
        void fetchMyTickets({ preferredTicketId: selectedTicket.id });
      }
    );

    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload.sender !== currentUserRole) {
        setIsOtherPartyTyping(true);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setIsOtherPartyTyping(false);
        }, 3000);
      }
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (roomRef.current === channel) {
        roomRef.current = null;
      }
      setIsOtherPartyTyping(false);
    };
  }, [fetchMyTickets, selectedTicket?.id]);

  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => ticket.subject.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm, tickets]
  );

  const handleOpenCreateTicket = () => {
    setIsCreating(true);
    setSelectedTicketId(null);
  };

  const handleCancelCreateTicket = () => {
    setIsCreating(false);
    setNewSubject('');
    setNewMessage('');
    setNewPriority('Média');
    setSelectedTicketId(tickets[0]?.id ?? null);
  };

  const sendTypingBroadcast = useCallback(
    () => {
      if (!selectedTicket?.id) return;

      void roomRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender: currentUserRole },
      });
    },
    [selectedTicket?.id]
  );

  const handleReplyTextChange = (value: string) => {
    setReplyText(value);
    if (value.trim()) {
      sendTypingBroadcast();
    }
  };

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    setReplyText((current) => `${current}${emojiData.emoji}`);
    setShowEmojiPicker(false);
    sendTypingBroadcast();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTicket?.id) return;

    setIsUploadingImage(true);

    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `${selectedTicket.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('support_attachments')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('support_attachments').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('saas_ticket_messages').insert({
        ticket_id: selectedTicket.id,
        sender_type: 'client',
        message: `![Anexo](${publicUrl})`,
      });

      if (insertError) throw insertError;

      setShowEmojiPicker(false);
      await fetchMyTickets({ preferredTicketId: selectedTicket.id });
    } catch (error) {
      console.error('Erro no upload:', error);
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicketId) return;

    const { error } = await supabase.from('saas_ticket_messages').insert({
      ticket_id: selectedTicketId,
      sender_type: 'client',
      message: replyText.trim(),
    });

    if (error) {
      console.error('Erro ao enviar resposta do chamado:', error);
      return;
    }

    setReplyText('');
    await fetchMyTickets({ preferredTicketId: selectedTicketId });
  };

  const handleCreateTicket = async () => {
    if (isSubmitting) return;
    if (isSubmittingRef.current) return;
    if (!newSubject.trim() || !newMessage.trim() || !user?.company_id) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const { data: ticket, error } = await supabase
        .from('saas_tickets')
        .insert({
          company_id: user.company_id,
          subject: newSubject.trim(),
          priority: newPriority,
          status: 'Aberto',
        })
        .select('id')
        .single();

      if (error || !ticket) {
        console.error('Erro ao criar chamado do tenant:', error);
        return;
      }

      const { error: messageError } = await supabase.from('saas_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_type: 'client',
        message: newMessage.trim(),
      });

      if (messageError) {
        console.error('Erro ao salvar primeira mensagem do chamado:', messageError);
        return;
      }

      setIsCreating(false);
      setNewSubject('');
      setNewMessage('');
      setNewPriority('Média');
      await fetchMyTickets({ preferredTicketId: ticket.id });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!selectedTicketId || ratingValue === 0) return;

    setIsSubmittingRating(true);

    const { error } = await supabase
      .from('saas_tickets')
      .update({
        support_rating: ratingValue,
        support_feedback: feedbackText.trim() || null,
      })
      .eq('id', selectedTicketId);

    if (error) {
      console.error('Erro ao enviar avaliacao do suporte:', error);
      addToast('N\u00e3o foi poss\u00edvel enviar sua avalia\u00e7\u00e3o agora.', 'error');
      setIsSubmittingRating(false);
      return;
    }

    await fetchMyTickets({ preferredTicketId: selectedTicketId });
    setRatingValue(0);
    setFeedbackText('');
    addToast('Avalia\u00e7\u00e3o enviada com sucesso.', 'success');
    setIsSubmittingRating(false);
  };

  if (isLoading && tickets.length === 0 && !isCreating) {
    return <Loading />;
  }

  return (
    <div className="h-[calc(100vh-8rem)] max-w-7xl mx-auto flex flex-col animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Suporte Técnico</h2>
          <p className="mt-1 text-sm text-slate-500">
            Precisa de ajuda? Abra um chamado com nossa equipe.
          </p>
        </div>

        <button
          onClick={handleOpenCreateTicket}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700"
        >
          <Plus size={16} />
          Novo Chamado
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex w-full flex-col border-r border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 md:w-80">
          <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Buscar chamado..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-950"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedTicketId(ticket.id);
                  }}
                  className={cn(
                    'w-full border-b border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/50',
                    selectedTicketId === ticket.id
                      ? 'border-l-4 border-l-brand-500 bg-brand-50 dark:bg-brand-900/10'
                      : 'border-l-4 border-l-transparent'
                  )}
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <span className="truncate pr-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                      {ticket.subject}
                    </span>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-bold',
                        ticket.status === 'Resolvido'
                          ? 'bg-emerald-100 text-emerald-700'
                          : ticket.status === 'Pendente'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-brand-100 text-brand-700'
                      )}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Clock size={12} />
                      {ticket.timeElapsed}
                    </span>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-bold',
                        ticket.priority === 'Alta'
                          ? 'bg-rose-100 text-rose-700'
                          : ticket.priority === 'Baixa'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center p-8 text-center text-slate-400">
                <MessageSquare className="mb-3 h-8 w-8 opacity-20" />
                <p className="text-sm">Nenhum chamado encontrado.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-900">
          {isCreating ? (
            <div className="max-w-2xl animate-fade-in p-8">
              <h3 className="mb-6 text-xl font-bold text-slate-800 dark:text-white">Abrir Novo Chamado</h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Assunto
                  </label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(event) => setNewSubject(event.target.value)}
                    placeholder="Ex: Dúvida sobre contratos"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Prioridade
                  </label>
                  <select
                    value={newPriority}
                    onChange={(event) => setNewPriority(event.target.value as Priority)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <option value="Baixa">Baixa (Dúvida geral)</option>
                    <option value="Média">Média (Problema não urgente)</option>
                    <option value="Alta">Alta (Sistema travado/Erro crítico)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Como podemos ajudar?
                  </label>
                  <textarea
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    rows={6}
                    placeholder="Descreva o seu problema detalhadamente..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCreateTicket}
                    disabled={isSubmitting || !newSubject.trim() || !newMessage.trim()}
                    className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Chamado'}
                  </button>
                  <button
                    onClick={handleCancelCreateTicket}
                    className="rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : selectedTicket ? (
            <>
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-6 dark:border-slate-800">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                    <span className="truncate">{selectedTicket.subject}</span>
                    <span className="text-xs font-normal text-slate-500">
                      #{selectedTicket.id.split('-')[0]}
                    </span>
                  </h3>
                </div>

                <div className="ml-4 hidden items-center gap-2 sm:flex">
                  <span
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-bold',
                      selectedTicket.priority === 'Alta'
                        ? 'bg-rose-100 text-rose-700'
                        : selectedTicket.priority === 'Baixa'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                    )}
                  >
                    {selectedTicket.priority}
                  </span>
                  <span
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-bold',
                      selectedTicket.status === 'Resolvido'
                        ? 'bg-emerald-100 text-emerald-700'
                        : selectedTicket.status === 'Pendente'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-brand-100 text-brand-700'
                    )}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
              </div>

              <div
                ref={messagesContainerRef}
                className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-slate-950/50"
              >
                <div className="space-y-6">
                  {selectedTicket.messages.map((message, index) => {
                    const isMe = message.sender === 'client';
                    const showReadReceipt = index === selectedTicket.messages.length - 1 && !isMe;
                    const attachmentUrl = getAttachmentUrl(message.text);

                    return (
                      <div key={message.id} className={cn('flex w-full', isMe ? 'justify-end' : 'justify-start')}>
                        <div className={cn('flex max-w-[80%] flex-col', isMe ? 'items-end' : 'items-start')}>
                          <div className="mb-1 flex items-center gap-2 px-1">
                            <span className="text-[11px] font-bold text-slate-500">
                              {isMe ? 'Você' : 'Suporte (Elevatio)'}
                            </span>
                            <span className="text-[10px] text-slate-400">{message.timestamp}</span>
                          </div>

                          <div
                            className={cn(
                              'rounded-2xl px-4 py-3 text-sm shadow-sm',
                              isMe
                                ? 'rounded-tr-sm bg-brand-600 text-white'
                                : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            )}
                          >
                            {attachmentUrl ? (
                              <img src={attachmentUrl} className="max-w-xs rounded-lg mt-2" alt="Anexo" />
                            ) : (
                              message.text.split('\n').map((line, index) => (
                                <React.Fragment key={`${message.id}-${index}`}>
                                  {line}
                                  <br />
                                </React.Fragment>
                              ))
                            )}
                          </div>
                          {showReadReceipt && (
                            <span className="mt-1 px-1 text-[10px] text-slate-400">Visualizado agora</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                {selectedTicket.status === 'Resolvido' ? (
                  selectedTicket.supportRating != null ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center dark:border-emerald-900/30 dark:bg-emerald-900/10">
                      <div className="mb-2 flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            className={
                              star <= selectedTicket.supportRating!
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300 dark:text-slate-700'
                            }
                          />
                        ))}
                      </div>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Atendimento Avaliado</p>
                      <p className="mt-1 text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70">
                        Obrigado pelo seu feedback. Isso ajuda-nos a melhorar o Elevatio!
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 animate-fade-in dark:border-slate-800 dark:bg-slate-800/50">
                      <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                        {'Como voc\u00ea avalia este atendimento?'}
                      </p>
                      <div className="mb-4 flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setRatingValue(star)}
                            className="transition-transform hover:scale-110 focus:outline-none"
                          >
                            <Star
                              size={28}
                              className={cn(
                                'transition-colors',
                                ratingValue >= star
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 hover:text-amber-200 dark:text-slate-600'
                              )}
                            />
                          </button>
                        ))}
                      </div>
                      {ratingValue > 0 && (
                        <div className="flex w-full max-w-md flex-col gap-3 animate-fade-in">
                          <input
                            type="text"
                            placeholder={'Deixe um coment\u00e1rio opcional...'}
                            value={feedbackText}
                            onChange={(event) => setFeedbackText(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSubmitRating()}
                            disabled={isSubmittingRating}
                            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                          >
                            {isSubmittingRating ? 'Enviando...' : 'Enviar Avalia\u00e7\u00e3o'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    {isOtherPartyTyping && (
                      <span className="text-xs text-brand-500 animate-pulse ml-2 mb-1 block">
                        {currentUserRole === 'admin' ? 'O cliente está digitando...' : 'O suporte está digitando...'}
                      </span>
                    )}
                    {isUploadingImage && (
                      <p className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400">Enviando imagem...</p>
                    )}
                    <div className="relative flex items-center gap-2">
                      {showEmojiPicker && (
                        <div className="absolute bottom-12 left-12 z-50">
                          <EmojiPicker onEmojiClick={handleEmojiClick} />
                        </div>
                      )}
                      <label
                        className={cn(
                          'inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800',
                          isUploadingImage && 'pointer-events-none opacity-50'
                        )}
                      >
                        <Paperclip size={18} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingImage}
                          onChange={(event) => void handleImageUpload(event)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((current) => !current)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Smile size={18} />
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Escreva a sua resposta..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-950"
                          value={replyText}
                          onChange={(event) => handleReplyTextChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleSendReply();
                            }
                          }}
                        />

                        <button
                          onClick={() => void handleSendReply()}
                          disabled={isUploadingImage || !replyText.trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
              <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
              <p>Selecione um chamado ou crie um novo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
