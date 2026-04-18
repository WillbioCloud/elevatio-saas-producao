import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  MoreVertical,
  Paperclip,
  Smile
} from "lucide-react"
import EmojiPicker from "emoji-picker-react"
import imageCompression from "browser-image-compression"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'

type Priority = "Alta" | "Média" | "Baixa"
type Status = "Aberto" | "Pendente" | "Resolvido"

interface Message {
  id: string
  sender: "client" | "admin"
  text: string
  timestamp: string
  createdAt: string
}

interface Ticket {
  id: string
  clientName: string
  subject: string
  priority: Priority
  status: Status
  timeElapsed: string
  messages: Message[]
  createdAt: string
}

interface TicketMessageRow {
  id: string
  ticket_id: string
  sender_type: string | null
  message: string | null
  created_at: string
}

interface TicketRow {
  id: string
  subject: string | null
  priority: string | null
  status: string | null
  created_at: string
  company?: {
    name: string | null
  } | null
  saas_ticket_messages: TicketMessageRow[] | null
}

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  switch (priority) {
    case "Alta":
      return <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">Alta</Badge>
    case "Média":
      return <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10">Média</Badge>
    case "Baixa":
      return <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10">Baixa</Badge>
  }
}

const StatusIcon = ({ status }: { status: Status }) => {
  switch (status) {
    case "Aberto":
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case "Pendente":
      return <Clock className="h-4 w-4 text-amber-500" />
    case "Resolvido":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  }
}

const normalizePriority = (priority: string | null | undefined): Priority => {
  if (priority === "Alta" || priority?.toLowerCase() === "high") return "Alta"
  if (priority === "Média" || priority === "Media" || priority?.toLowerCase() === "medium") return "Média"
  return "Baixa"
}

const normalizeStatus = (status: string | null | undefined): Status => {
  if (status === "Aberto" || status?.toLowerCase() === "open") return "Aberto"
  if (status === "Pendente" || status?.toLowerCase() === "pending") return "Pendente"
  return "Resolvido"
}

const formatTimeElapsed = (createdAt: string) => {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - created)
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))
    return `há ${diffMinutes} min`
  }

  if (diffHours < 24) {
    return `há ${diffHours} hora${diffHours > 1 ? "s" : ""}`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`
}

const formatMessageTimestamp = (createdAt: string) => {
  const date = new Date(createdAt)
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
}

const mapMessageRow = (message: TicketMessageRow): Message => ({
  id: message.id,
  sender: message.sender_type === "admin" ? "admin" : "client",
  text: message.message ?? "",
  timestamp: formatMessageTimestamp(message.created_at),
  createdAt: message.created_at
})

const mapTicketRow = (ticket: TicketRow): Ticket => ({
  id: ticket.id,
  clientName: ticket.company?.name ?? "ImobiliÃ¡ria",
  subject: ticket.subject ?? "Sem assunto",
  priority: normalizePriority(ticket.priority),
  status: normalizeStatus(ticket.status),
  timeElapsed: formatTimeElapsed(ticket.created_at),
  createdAt: ticket.created_at,
  messages: [...(ticket.saas_ticket_messages ?? [])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(mapMessageRow)
})

const appendMessageToTickets = (tickets: Ticket[], message: TicketMessageRow) =>
  tickets.map((ticket) => {
    if (ticket.id !== message.ticket_id || ticket.messages.some((item) => item.id === message.id)) {
      return ticket
    }

    return {
      ...ticket,
      messages: [...ticket.messages, mapMessageRow(message)].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    }
  })

const getAttachmentUrl = (text: string) => text.match(/!\[Anexo\]\(([^)]+)\)/)?.[1] ?? null

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const [replyText, setReplyText] = useState("")
  const [isOtherPartyTyping, setIsOtherPartyTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const roomRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const currentUserRole = "admin" as const

  const fetchTickets = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("saas_tickets")
      .select("*, company:companies(name), saas_ticket_messages(*)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar tickets:", error)
      setIsLoading(false)
      return
    }

    if (data) {
      const mappedTickets: Ticket[] = (data as TicketRow[]).map(mapTicketRow)
      setTickets(mappedTickets)
      setSelectedTicketId((currentSelected) => {
        if (currentSelected && mappedTickets.some((ticket) => ticket.id === currentSelected)) {
          return currentSelected
        }
        return mappedTickets[0]?.id ?? null
      })
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId),
    [tickets, selectedTicketId]
  )

  useEffect(() => {
    if (!selectedTicket?.id) return

    const channel = supabase.channel(`ticket-room-${selectedTicket.id}`, {
      config: { broadcast: { ack: false } }
    })
    roomRef.current = channel

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "saas_ticket_messages",
        filter: `ticket_id=eq.${selectedTicket.id}`
      },
      () => {
        void fetchTickets()
      }
    )

    channel.on("broadcast", { event: "typing" }, (payload) => {
      if (payload.payload.sender !== currentUserRole) {
        setIsOtherPartyTyping(true)

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
          setIsOtherPartyTyping(false)
        }, 3000)
      }
    })

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      if (roomRef.current === channel) {
        roomRef.current = null
      }
      setIsOtherPartyTyping(false)
    }
  }, [selectedTicket?.id])

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [selectedTicketId, selectedTicket?.messages.length])

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = ticket.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "Todos" || ticket.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const sendTypingBroadcast = useCallback(
    () => {
      if (!selectedTicket?.id) return

      void roomRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { sender: currentUserRole }
      })
    },
    [selectedTicket?.id]
  )

  const handleReplyTextChange = (value: string) => {
    setReplyText(value)
    if (value.trim()) {
      sendTypingBroadcast()
    }
  }

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    setReplyText((current) => `${current}${emojiData.emoji}`)
    setShowEmojiPicker(false)
    sendTypingBroadcast()
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedTicket?.id) return

    setIsUploadingImage(true)

    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true }
      const compressedFile = await imageCompression(file, options)
      const fileExt = file.name.split(".").pop() || "jpg"
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
      const filePath = `${selectedTicket.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("support_attachments")
        .upload(filePath, compressedFile)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl }
      } = supabase.storage.from("support_attachments").getPublicUrl(filePath)

      const { error: insertError } = await supabase.from("saas_ticket_messages").insert({
        ticket_id: selectedTicket.id,
        sender_type: "admin",
        message: `![Anexo](${publicUrl})`
      })

      if (insertError) throw insertError

      setShowEmojiPicker(false)
      await fetchTickets()
    } catch (error) {
      console.error("Erro no upload:", error)
    } finally {
      setIsUploadingImage(false)
      event.target.value = ""
    }
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicketId) return
    const message = replyText.trim()

    try {
      const { error } = await supabase.from("saas_ticket_messages").insert({
        ticket_id: selectedTicketId,
        sender_type: "admin",
        message
      })

      if (error) throw error

      setReplyText("")
      await fetchTickets()
    } catch (error) {
      console.error("Erro ao enviar resposta:", error)
    }
  }

  const handleStatusChange = async (status: Status) => {
    if (!selectedTicketId) return
    const { error } = await supabase
      .from("saas_tickets")
      .update({ status })
      .eq("id", selectedTicketId)

    if (error) {
      console.error("Erro ao atualizar status do ticket:", error)
      return
    }

    await fetchTickets()
  }

  if (isLoading && tickets.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Help Desk</h2>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os pedidos de suporte das imobiliárias.</p>
      </div>

      <div className="flex-1 flex overflow-hidden bg-card border border-border/50 rounded-xl shadow-sm">
        {/* Left Column: Ticket List */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col border-r border-border bg-muted/10">
          {/* List Header & Filters */}
          <div className="p-4 border-b border-border space-y-3 bg-card">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Procurar tickets..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Todos">Todos os Estados</option>
                <option value="Aberto">Aberto</option>
                <option value="Pendente">Pendente</option>
                <option value="Resolvido">Resolvido</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Ticket Items */}
          <div className="flex-1 overflow-y-auto">
            {filteredTickets.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={cn(
                      "w-full text-left p-4 transition-colors hover:bg-muted/30",
                      selectedTicketId === ticket.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "border-l-2 border-l-transparent"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm truncate pr-2">
                        {ticket.clientName}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {ticket.timeElapsed}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-3">
                      {ticket.subject}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={ticket.status} />
                        <span className="text-xs font-medium text-muted-foreground">{ticket.status}</span>
                      </div>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Nenhum ticket encontrado.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ticket View / Chat */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col min-w-0 bg-card">
            {/* Chat Header */}
            <div className="h-16 px-6 border-b border-border flex items-center justify-between shrink-0 bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {selectedTicket.clientName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate flex items-center gap-2">
                    {selectedTicket.clientName}
                    <span className="text-xs font-normal text-muted-foreground">({selectedTicket.id})</span>
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">{selectedTicket.subject}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {selectedTicket.status !== "Resolvido" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleStatusChange("Resolvido")}
                    className="hidden sm:flex h-8 bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Marcar como Resolvido
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10">
              {selectedTicket.messages.map((msg, index) => {
                const isAdmin = msg.sender === "admin"
                const showReadReceipt = index === selectedTicket.messages.length - 1 && !isAdmin
                const attachmentUrl = getAttachmentUrl(msg.text)
                return (
                  <div key={msg.id} className={cn("flex w-full", isAdmin ? "justify-end" : "justify-start")}>
                    <div className={cn("flex max-w-[80%] gap-3", isAdmin ? "flex-row-reverse" : "flex-row")}>
                      <Avatar className="h-8 w-8 shrink-0 mt-1">
                        {isAdmin ? (
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">AD</AvatarFallback>
                        ) : (
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {selectedTicket.clientName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className={cn("flex flex-col", isAdmin ? "items-end" : "items-start")}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {isAdmin ? "Você (Suporte)" : selectedTicket.clientName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                        </div>
                        <div
                          className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                            isAdmin
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-card text-foreground border border-border rounded-tl-sm"
                          )}
                        >
                          {attachmentUrl ? (
                            <img src={attachmentUrl} className="max-w-xs rounded-lg mt-2" alt="Anexo" />
                          ) : (
                            msg.text
                          )}
                        </div>
                        {showReadReceipt && (
                          <span className="mt-1 text-[10px] text-muted-foreground">Visualizado agora</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Chat Input Footer */}
            <div className="p-4 bg-card border-t border-border">
              {selectedTicket.status === "Resolvido" ? (
                <div className="text-center p-3 bg-muted/20 rounded-lg border border-border text-sm text-muted-foreground">
                  Este ticket foi marcado como resolvido. Não é possível enviar novas mensagens.
                </div>
              ) : (
                <div className="space-y-2">
                  {isOtherPartyTyping && (
                    <span className="text-xs text-brand-500 animate-pulse ml-2 mb-1 block">
                      {currentUserRole === "admin" ? "O cliente está digitando..." : "O suporte está digitando..."}
                    </span>
                  )}
                  {isUploadingImage && (
                    <p className="px-1 text-xs font-medium text-muted-foreground">Enviando imagem...</p>
                  )}
                  <div className="relative flex items-end gap-2">
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-12 z-50">
                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                      </div>
                    )}
                    <label
                      className={cn(
                        "inline-flex shrink-0 h-10 w-10 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        isUploadingImage && "pointer-events-none opacity-50"
                      )}
                    >
                      <Paperclip className="h-5 w-5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingImage}
                        onChange={(event) => void handleImageUpload(event)}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-10 w-10 text-muted-foreground"
                      onClick={() => setShowEmojiPicker((current) => !current)}
                    >
                      <Smile className="h-5 w-5" />
                    </Button>
                    <Textarea
                      placeholder="Escreva a sua resposta..."
                      className="min-h-[40px] max-h-32 resize-none py-3"
                      value={replyText}
                      onChange={(e) => handleReplyTextChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendReply()
                        }
                      }}
                    />
                    <Button
                      className="shrink-0 h-10 w-10 p-0 rounded-full"
                      onClick={handleSendReply}
                      disabled={isUploadingImage || !replyText.trim()}
                    >
                      <Send className="h-4 w-4 ml-0.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p>Selecione um ticket para visualizar a conversa.</p>
          </div>
        )}
      </div>
    </div>
  )
}
