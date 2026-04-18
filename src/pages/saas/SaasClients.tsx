import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Search, Filter, Plus, X, ChevronDown, Download } from "lucide-react"
import { Icons } from "../../components/Icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "../../../components/ui/skeleton"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'
import { getPlanMonthlyPrice, useSaasPlans } from '../../hooks/useSaasPlans'

type DomainStatus = 'pending' | 'active' | 'error' | 'idle' | 'expired' | null

type ClientCompany = {
  id: string
  name: string
  email: string | null
  document: string | null
  phone: string | null
  created_at: string
  plan: string
  active: boolean
  subdomain: string | null
  domain: string | null
  domain_secondary: string | null
  plan_status: string | null
  domain_status: DomainStatus
  domain_secondary_status: DomainStatus
  manual_discount_value?: number | null
  manual_discount_type?: 'fixed' | 'percentage' | null
}

export default function Clients() {
  const [clients, setClients] = useState<ClientCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClient, setSelectedClient] = useState<ClientCompany | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [discountModal, setDiscountModal] = useState<{ isOpen: boolean; company: ClientCompany | null }>({ isOpen: false, company: null })
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed')
  const [isSavingDiscount, setIsSavingDiscount] = useState(false)
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false)
  const [newCompany, setNewCompany] = useState({ name: "", plan: "business" })
  const [isCreating, setIsCreating] = useState(false)
  const { plans: saasPlans } = useSaasPlans()

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, document, phone, created_at, plan, plan_status, active, subdomain, domain, domain_secondary, domain_status, domain_secondary_status')
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients((data || []) as ClientCompany[])
    } catch (err) {
      console.error('Erro ao buscar empresas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompanies() }, [])

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompany.name.trim()) return
    setIsCreating(true)
    const generatedSlug = newCompany.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
    const { error } = await supabase.from("companies").insert([{
      name: newCompany.name,
      subdomain: generatedSlug,
      plan: newCompany.plan,
      active: true
    }])
    if (error) alert("Erro ao criar empresa: " + error.message)
    else {
      setIsNewClientModalOpen(false)
      setNewCompany({ name: "", plan: "business" })
      fetchCompanies()
    }
    setIsCreating(false)
  }

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta imobiliária? TODOS os dados e acessos de login da equipe serão apagados permanentemente (Ação irreversível).")) return
    try {
      const { data, error } = await supabase.functions.invoke('delete-tenant', { body: { company_id: id } })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setClients(clients.filter(c => c.id !== id))
      setSelectedClient(null)
      alert("Imobiliária e equipe excluídos com sucesso.")
    } catch (error: any) {
      console.error('Erro ao deletar:', error)
      alert("Erro ao excluir imobiliária: " + error.message)
    } finally {
      setOpenDropdownId(null)
    }
  }

  const handleToggleStatus = async (client: ClientCompany) => {
    const { error } = await supabase.from("companies").update({ active: !client.active }).eq("id", client.id)
    if (error) alert("Erro ao atualizar status: " + error.message)
    else { setSelectedClient({ ...client, active: !client.active }); fetchCompanies() }
  }

  const filteredClients = clients.filter(client => {
    const term = searchTerm.toLowerCase()
    return client.name?.toLowerCase().includes(term) || client.subdomain?.toLowerCase().includes(term) || client.email?.toLowerCase().includes(term)
  })

  const hasPendingDomain = (client: ClientCompany | null | undefined) => Boolean(client?.active && ((client?.domain && client?.domain_status === 'pending') || (client?.domain_secondary && client?.domain_secondary_status === 'pending')))
  const pendingDomainsCount = clients?.filter(hasPendingDomain).length || 0
  const firstPendingDomainClient = clients?.find(hasPendingDomain) || null

  const accessHost = selectedClient?.domain_status === 'active' && selectedClient.domain ? selectedClient.domain : selectedClient?.domain_secondary_status === 'active' && selectedClient.domain_secondary ? selectedClient.domain_secondary : selectedClient?.subdomain ? `${selectedClient.subdomain}.elevatiovendas.com.br` : null
  const accessUrl = accessHost ? `https://${accessHost}` : null

  const getDomainStatusClasses = (status: DomainStatus) => {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (status === 'error' || status === 'expired') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    if (status === 'idle') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse'
  }

  const getDomainStatusLabel = (status: DomainStatus) => {
    if (status === 'active') return 'Configurado'
    if (status === 'error') return 'Erro DNS'
    if (status === 'expired') return 'Expirado'
    if (status === 'idle') return 'Ocioso'
    return 'Pendente'
  }

  const getFinancialStatus = (status: string | null, isActive: boolean) => {
    if (!isActive) return { label: 'Bloqueado', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200' }
    switch (status) {
      case 'active': return { label: 'Pago (Ativo)', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      case 'trial': return { label: 'Em Teste (Trial)', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 border-blue-200' }
      case 'past_due': return { label: 'Atrasado', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' }
      case 'canceled': return { label: 'Cancelado', dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
      default: return { label: 'Aguardando Pagamento', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' }
    }
  }

  const findSaasPlan = (planValue?: string | null) => {
    const normalizedPlan = String(planValue || '').toLowerCase()
    return saasPlans.find((plan) =>
      String(plan.id || '').toLowerCase() === normalizedPlan ||
      String(plan.name || '').toLowerCase() === normalizedPlan
    ) || null
  }

  if (loading && clients.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 relative p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">Faça a gestão das imobiliárias que utilizam a plataforma.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={() => setIsNewClientModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {pendingDomainsCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10">
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                <Icons.Globe size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-800 dark:text-amber-500">Ação Necessária: Domínios Pendentes</h3>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400/80">
                  Você tem {pendingDomainsCount} domínio(s) de cliente(s) pagante(s) aguardando o registro ou apontamento DNS.
                </p>
              </div>
            </div>
            <Button 
              variant="default" 
              onClick={() => firstPendingDomainClient && setSelectedClient(firstPendingDomainClient)}
              className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
            >
              Resolver Agora
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar clientes..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider font-medium">Imobiliária</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Plano</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Status do Plano</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Estado</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Data de Adesão</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Carregando empresas...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhuma empresa cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedClient(client)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarFallback className="bg-muted text-foreground font-medium">
                            {client.name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.subdomain ? `${client.subdomain}.elevatiovendas.com.br` : "Subdomínio pendente"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{client.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const status = getFinancialStatus(client.plan_status, client.active)
                        return <Badge variant="outline" className={status.badge}>{status.label}</Badge>
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge className={client.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                        {client.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(client.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="relative">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDiscountModal({ isOpen: true, company: client })
                            setDiscountValue(client.manual_discount_value || 0)
                            setDiscountType(client.manual_discount_type || 'fixed')
                          }}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Aplicar Desconto Manual"
                        >
                          <Icons.BadgeDollarSign size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenDropdownId(openDropdownId === client.id ? null : client.id)
                          }}
                          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Icons.MoreHorizontal size={20} />
                        </button>
                      </div>
                      {openDropdownId === client.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
                          <div className="absolute right-8 top-10 w-48 bg-popover border border-border rounded-xl shadow-lg z-20 py-1 animate-fade-in">
                            <button
                              onClick={() => {
                                setOpenDropdownId(null)
                                handleToggleStatus(client)
                              }}
                              className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-muted flex items-center gap-2"
                            >
                              {client.active ? (
                                <><Icons.Lock size={16} className="text-amber-500" /> Bloquear Acesso</>
                              ) : (
                                <><Icons.Unlock size={16} className="text-emerald-500" /> Desbloquear</>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setOpenDropdownId(null)
                                handleDeleteClient(client.id)
                              }}
                              className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-destructive/10 text-destructive flex items-center gap-2"
                            >
                              <Icons.Trash2 size={16} /> Excluir Empresa
                            </button>
                          </div>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/10">
          <p className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium text-foreground">{filteredClients.length}</span> de{" "}
            <span className="font-medium text-foreground">{clients.length}</span> resultados
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Próxima</Button>
          </div>
        </div>
      </Card>

      {/* Sidebar de Detalhes do Cliente */}
      {selectedClient && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedClient(null)} />
          <div className="relative w-full max-w-md h-screen bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
              <div>
                <h2 className="text-lg font-black">Ficha da Imobiliária</h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                  Cliente desde {new Date(selectedClient.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-full">
                <Icons.X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Icons.Building2 size={32} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{selectedClient.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Icons.Mail size={14} /> {selectedClient.email || "Sem e-mail"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Assinatura & Domínio</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status Financeiro</p>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const status = getFinancialStatus(selectedClient.plan_status, selectedClient.active)
                          return (
                            <>
                              <span className="relative flex h-3 w-3">
                                {status.label === 'Pago (Ativo)' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex h-3 w-3 rounded-full ${status.dot}`}></span>
                              </span>
                              <p className="text-sm font-black">{status.label}</p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plano Atual</p>
                      <p className="text-lg font-black text-primary">{selectedClient.plan || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="col-span-2 rounded-2xl border border-border bg-muted/30 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ambiente Web</p>
                      <Icons.Globe size={14} className="text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
                        <div>
                          <p className="text-sm font-bold">{selectedClient.subdomain ? `${selectedClient.subdomain}.elevatiovendas.com.br` : 'Pendente'}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">Subdomínio Gratuito</p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Operacional
                        </span>
                      </div>
                      {selectedClient.domain && (
                        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
                          <div>
                            <p className="text-sm font-bold">{selectedClient.domain}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">Domínio Principal</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getDomainStatusClasses(selectedClient.domain_status)}`}>
                            {getDomainStatusLabel(selectedClient.domain_status)}
                          </span>
                        </div>
                      )}
                      {selectedClient.domain_secondary && (
                        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
                          <div>
                            <p className="text-sm font-bold">{selectedClient.domain_secondary}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">Domínio Secundário</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getDomainStatusClasses(selectedClient.domain_secondary_status)}`}>
                            {getDomainStatusLabel(selectedClient.domain_secondary_status)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Dados Cadastrais</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <Icons.FileText size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Documento (CPF/CNPJ)</p>
                      <p className="text-sm font-bold">{selectedClient.document || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <Icons.Phone size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Telefone / WhatsApp</p>
                      <p className="text-sm font-bold">{selectedClient.phone || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border bg-muted/20">
              <Button 
                onClick={() => accessUrl && window.open(accessUrl, "_blank")} 
                disabled={!accessUrl} 
                className="w-full gap-2"
              >
                {accessUrl ? <><Icons.ExternalLink size={18} /> Acessar Painel do Cliente</> : "Site não disponível"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Nova Empresa */}
      <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCompany} className="space-y-4">
            <div>
              <Label>Nome da Imobiliária</Label>
              <Input
                placeholder="Ex: TR Imóveis"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Plano Inicial</Label>
              <Select value={newCompany.plan} onValueChange={(v) => setNewCompany({ ...newCompany, plan: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {saasPlans.map((plan) => (
                    <SelectItem key={plan.id || plan.name} value={String(plan.id || plan.name).toLowerCase()}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewClientModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isCreating}>{isCreating ? "Criando..." : "Criar Empresa"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Desconto Manual */}
      <Dialog open={discountModal.isOpen} onOpenChange={(open) => !open && setDiscountModal({ isOpen: false, company: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desconto / Agrado</DialogTitle>
            <DialogDescription>
              Aplicar desconto recorrente para <strong>{discountModal.company?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Desconto</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={discountType === 'fixed'} onChange={() => setDiscountType('fixed')} className="text-primary" />
                  Valor Fixo (R$)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={discountType === 'percentage'} onChange={() => setDiscountType('percentage')} className="text-primary" />
                  Porcentagem (%)
                </label>
              </div>
            </div>
            <div>
              <Label>Valor do Desconto</Label>
              <Input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                placeholder="Ex: 50"
              />
            </div>
            <div className="bg-muted/30 p-4 rounded-xl border border-border">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Resumo da Mensalidade</h4>
              {(() => {
                const plan = findSaasPlan(discountModal.company?.plan)
                const basePrice = plan ? getPlanMonthlyPrice(plan) : 0
                const discount = discountType === 'fixed' ? discountValue : (basePrice * (discountValue / 100))
                const finalPrice = Math.max(0, basePrice - discount)
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Valor Base ({plan?.name || discountModal.company?.plan || 'Plano'}):</span>
                      <span className="font-medium">R$ {basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Desconto Manual:</span>
                      <span>- R$ {discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-border flex justify-between font-bold">
                      <span>Mensalidade Final:</span>
                      <span className="text-primary">R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountModal({ isOpen: false, company: null })}>Cancelar</Button>
            <Button 
              onClick={async () => {
                if (!discountModal.company) return
                setIsSavingDiscount(true)
                const plan = findSaasPlan(discountModal.company.plan)
                const basePrice = plan ? getPlanMonthlyPrice(plan) : 0
                const finalPrice = discountType === 'percentage' ? basePrice - (basePrice * (discountValue / 100)) : Math.max(0, basePrice - discountValue)
                const { error: companyError } = await supabase.from('companies').update({
                  manual_discount_value: discountValue,
                  manual_discount_type: discountType
                }).eq('id', discountModal.company.id)
                if (companyError) {
                  alert('Erro ao salvar desconto: ' + companyError.message)
                  setIsSavingDiscount(false)
                  return
                }
                const { error: contractError } = await supabase.from('saas_contracts').update({
                  price: finalPrice,
                  discount_value: discountValue,
                  discount_type: discountType
                }).eq('company_id', discountModal.company.id)
                if (contractError) {
                  alert('Erro ao sincronizar contrato: ' + contractError.message)
                  setIsSavingDiscount(false)
                  return
                }
                setClients(prev => prev.map(c => c.id === discountModal.company.id ? { ...c, manual_discount_value: discountValue, manual_discount_type: discountType } : c))
                setSelectedClient(prev => prev?.id === discountModal.company.id ? { ...prev, manual_discount_value: discountValue, manual_discount_type: discountType } : prev)
                setIsSavingDiscount(false)
                setDiscountModal({ isOpen: false, company: null })
              }}
              disabled={isSavingDiscount}
              className="gap-2"
            >
              {isSavingDiscount ? <Icons.Loader2 className="animate-spin" size={16} /> : <Icons.Check size={16} />}
              Salvar Agrado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
