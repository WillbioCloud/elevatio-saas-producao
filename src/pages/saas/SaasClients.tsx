import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Search,
  Filter,
  Plus,
  X,
  ChevronDown,
  Download
} from "lucide-react"
import { Icons } from "../../components/Icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from '@/lib/supabase'
import { PLANS } from '../../config/plans'

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

  // Estados para o Modal de Nova Empresa
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false)
  const [newCompany, setNewCompany] = useState({ name: "", plan: "business" })
  const [isCreating, setIsCreating] = useState(false)
  const [, setIsDeleting] = useState(false)
  const [, setIsUpdatingStatus] = useState(false)

  // Busca as empresas no banco de dados
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

  useEffect(() => {
    fetchCompanies()
  }, [])

  // Cria uma nova empresa e gera o subdomínio
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompany.name.trim()) return

    setIsCreating(true)

    // Gera o subdomínio limpo (ex: "TR Imóveis" -> "tr-imoveis")
    const generatedSlug = newCompany.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    const { error } = await supabase.from("companies").insert([
      {
        name: newCompany.name,
        subdomain: generatedSlug,
        plan: newCompany.plan,
        active: true
      }
    ])

    if (error) {
      alert("Erro ao criar empresa: " + error.message)
    } else {
      setIsNewClientModalOpen(false)
      setNewCompany({ name: "", plan: "business" })
      fetchCompanies() // Recarrega a lista
    }
    setIsCreating(false)
  }

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta imobiliária? TODOS os dados e acessos de login da equipe serão apagados permanentemente (Ação irreversível).")) return
    setIsDeleting(true)
    try {
      // Chama a Edge Function que tem privilégios de Service Role para apagar os Logins (Auth)
      const { data, error } = await supabase.functions.invoke('delete-tenant', {
        body: { company_id: id }
      });

      if (error) throw new Error(error.message || "Erro na Edge Function");
      if (data?.error) throw new Error(data.error);

      setClients(clients.filter(c => c.id !== id))
      setSelectedClient(null)
      alert("Imobiliária e equipe excluídos com sucesso. Nenhum dado restou no sistema.")
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      alert("Erro ao excluir imobiliária: " + error.message)
    } finally {
      setIsDeleting(false)
      setOpenDropdownId(null)
    }
  }

  // Função para Suspender/Ativar
  const handleToggleStatus = async (client: ClientCompany) => {
    setIsUpdatingStatus(true)
    const { error } = await supabase
      .from("companies")
      .update({ active: !client.active })
      .eq("id", client.id)
    setIsUpdatingStatus(false)

    if (error) {
      alert("Erro ao atualizar status: " + error.message)
    } else {
      setSelectedClient({ ...client, active: !client.active })
      fetchCompanies()
    }
  }

  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase()
    return (
      client.name?.toLowerCase().includes(term) ||
      client.subdomain?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term)
    )
  })

  const hasPendingDomain = (client: ClientCompany | null | undefined) =>
    Boolean(
      client?.active && (
        (client?.domain && client?.domain_status === 'pending') ||
        (client?.domain_secondary && client?.domain_secondary_status === 'pending')
      )
    )

  const pendingDomainsCount = clients?.filter(hasPendingDomain).length || 0
  const firstPendingDomainClient = clients?.find(hasPendingDomain) || null

  const accessHost = selectedClient?.domain_status === 'active' && selectedClient.domain
    ? selectedClient.domain
    : selectedClient?.domain_secondary_status === 'active' && selectedClient.domain_secondary
      ? selectedClient.domain_secondary
      : selectedClient?.subdomain
        ? `${selectedClient.subdomain}.elevatiovendas.com.br`
        : null

  const accessUrl = accessHost ? `https://${accessHost}` : null

  const getDomainStatusClasses = (status: DomainStatus) => {
    if (status === 'active') {
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    }

    if (status === 'error' || status === 'expired') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }

    if (status === 'idle') {
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    }

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
      case 'active':
        return { label: 'Pago (Ativo)', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      case 'trial':
        return { label: 'Em Teste (Trial)', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 border-blue-200' }
      case 'past_due':
        return { label: 'Atrasado', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' }
      case 'canceled':
        return { label: 'Cancelado', dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
      default:
        return { label: 'Aguardando Pagamento', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' }
    }
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Clientes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Faça a gestão das imobiliárias que utilizam a plataforma.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 h-9">
            <Download className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            Exportar
          </Button>
          <Button onClick={() => setIsNewClientModalOpen(true)} className="bg-brand-600 hover:bg-brand-700">
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {pendingDomainsCount > 0 && (
        <div className="mb-8 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/30 dark:bg-amber-900/10">
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
          <button
            type="button"
            onClick={() => firstPendingDomainClient && setSelectedClient(firstPendingDomainClient)}
            className="whitespace-nowrap rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-amber-600"
          >
            Resolver Agora
          </button>
        </div>
      )}

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium h-9">
              Status: Todos
              <ChevronDown className="ml-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            </Button>
            <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium h-9">
              Plano: Todos
              <ChevronDown className="ml-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            </Button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Pesquisar clientes..."
                className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-9 text-sm dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 h-9 px-3">
              <Filter className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              Filtros
            </Button>
          </div>
        </div>
        <Table className="border-t border-slate-100 dark:border-slate-800">
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Imobiliária</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Plano</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Status do Plano</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Estado</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Data de Adesão</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400">
                  Carregando empresas...
                </TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800"
                  onClick={() => setSelectedClient(client)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                          {client.name?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-50">{client.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {client.subdomain ? `${client.subdomain}.elevatiovendas.com.br` : "Subdomínio pendente"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200">
                      {client.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const status = getFinancialStatus(client.plan_status, client.active)
                      return (
                        <Badge variant="outline" className={`${status.badge} font-bold`}>
                          {status.label}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge className={client.active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" : "bg-red-50 text-red-700 hover:bg-red-100 border-red-200"}>
                      {client.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400">
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
                        className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Aplicar Desconto Manual"
                      >
                        <Icons.BadgeDollarSign size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === client.id ? null : client.id);
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        <Icons.MoreHorizontal size={20} />
                      </button>
                    </div>
                    {openDropdownId === client.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                        <div className="absolute right-8 top-10 w-48 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-fade-in">
                          <button
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleToggleStatus(client);
                            }}
                            className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2"
                          >
                            {client.active ? (
                              <Icons.Lock size={16} className="text-amber-500" />
                            ) : (
                              <Icons.Unlock size={16} className="text-emerald-500" />
                            )}
                            {client.active ? 'Bloquear Acesso' : 'Desbloquear'}
                          </button>
                          <button
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleDeleteClient(client.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 flex items-center gap-2"
                          >
                            <Icons.Trash2 size={16} />
                            Excluir Empresa
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

        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mostrando <span className="font-medium text-slate-900 dark:text-slate-50">{loading ? 0 : filteredClients.length === 0 ? 0 : 1}</span> a <span className="font-medium text-slate-900 dark:text-slate-50">{filteredClients.length}</span> de <span className="font-medium text-slate-900 dark:text-slate-50">{clients.length}</span> resultados
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-slate-500 dark:text-slate-400 font-medium h-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              Anterior
            </Button>
            <Button variant="outline" size="sm" className="text-slate-900 dark:text-slate-50 font-medium h-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      {/* SIDEBAR DE DETALHES DO CLIENTE (PORTAL) */}
      {selectedClient && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end font-['DM_Sans']">
          {/* Backdrop Escuro (Fundo Blur) */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedClient(null)}
          />

          {/* Sidebar / Painel Lateral */}
          <div className="relative w-full max-w-md h-screen bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header do Sidebar */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white">Ficha da Imobiliária</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Cliente desde {new Date(selectedClient.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <Icons.X size={20} />
              </button>
            </div>

            {/* Corpo do Sidebar */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Informações Principais */}
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center border border-brand-200 dark:border-brand-800">
                    <Icons.Building2 size={32} className="text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedClient.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                      <Icons.Mail size={14} /> {selectedClient.email || "Sem e-mail"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Métricas Financeiras, Status e Domínios */}
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Assinatura & Domínio</h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Status do Plano */}
                  <div className="col-span-2 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status Financeiro</p>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const status = getFinancialStatus(selectedClient.plan_status, selectedClient.active)
                          return (
                            <>
                              <span className="relative flex h-3 w-3">
                                {status.label === 'Pago (Ativo)' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex h-3 w-3 rounded-full ${status.dot}`}></span>
                              </span>
                              <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                {status.label}
                              </p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plano Atual</p>
                      <p className="text-lg font-black text-[#1a56db] dark:text-brand-400">{selectedClient.plan || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ambiente Web</p>
                      <Icons.Globe size={14} className="text-slate-400" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {selectedClient.subdomain ? `${selectedClient.subdomain}.elevatiovendas.com.br` : 'Pendente'}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">Subdomínio Gratuito</p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Operacional
                        </span>
                      </div>

                      {selectedClient.domain && (
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {selectedClient.domain}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">Domínio Principal</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getDomainStatusClasses(selectedClient.domain_status)}`}>
                            {getDomainStatusLabel(selectedClient.domain_status)}
                          </span>
                        </div>
                      )}

                      {selectedClient.domain_secondary && (
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {selectedClient.domain_secondary}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">Domínio Secundário</p>
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

              {/* Informações Cadastrais */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Dados Cadastrais</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                      <Icons.FileText size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Documento (CPF/CNPJ)</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedClient.document || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                      <Icons.Phone size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Telefone / WhatsApp</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedClient.phone || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer de Ações do Sidebar */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => accessUrl && window.open(accessUrl, "_blank", "noopener,noreferrer")}
                disabled={!accessUrl}
                className="w-full py-3 bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <Icons.ExternalLink size={18} /> Acessar Painel do Cliente
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Nova Empresa */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Adicionar Nova Empresa</h3>
              <button onClick={() => setIsNewClientModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Nome da Imobiliária</label>
                <Input
                  placeholder="Ex: TR Imóveis"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
                {newCompany.name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Subdomínio gerado: <strong className="text-brand-600">{newCompany.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}</strong>.elevatiovendas.com.br
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Plano Inicial</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newCompany.plan}
                  onChange={(e) => setNewCompany({ ...newCompany, plan: e.target.value })}
                >
                  <option value="starter">Starter</option>
                  <option value="basic">Basic</option>
                  <option value="profissional">Profissional</option>
                  <option value="business">Business</option>
                  <option value="premium">Premium</option>
                  <option value="elite">Elite</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsNewClientModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700" disabled={isCreating}>
                  {isCreating ? "Criando..." : "Criar Empresa"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Desconto Manual */}
      {discountModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Desconto / Agrado</h3>
            <p className="text-sm text-slate-500 mb-6">Aplicar desconto recorrente para <strong>{discountModal.company?.name}</strong></p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Desconto</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={discountType === 'fixed'} onChange={() => setDiscountType('fixed')} className="text-brand-600" />
                    <span className="text-sm">Valor Fixo (R$)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={discountType === 'percentage'} onChange={() => setDiscountType('percentage')} className="text-brand-600" />
                    <span className="text-sm">Porcentagem (%)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor do Desconto</label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2"
                  placeholder="Ex: 50"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Resumo da Mensalidade</h4>
              
              {(() => {
                const plan = PLANS.find(p => p.id === discountModal.company?.plan) || PLANS[0]
                const basePrice = plan.price
                const discount = discountType === 'fixed' 
                  ? discountValue 
                  : (basePrice * (discountValue / 100))
                const finalPrice = Math.max(0, basePrice - discount)

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Valor Base ({plan.name}):</span>
                      <span className="font-medium">R$ {basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Desconto Manual:</span>
                      <span>- R$ {discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-600 flex justify-between font-bold text-slate-900 dark:text-white">
                      <span>Mensalidade Final:</span>
                      <span className="text-brand-600">R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setDiscountModal({ isOpen: false, company: null })} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button
                onClick={async () => {
                  if (!discountModal.company) return

                  setIsSavingDiscount(true)
                  const plan = PLANS.find(p => p.id === discountModal.company.plan) || PLANS[0]
                  const basePrice = plan.price
                  const finalPrice = discountType === 'percentage'
                    ? basePrice - (basePrice * (discountValue / 100))
                    : Math.max(0, basePrice - discountValue)

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
                className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg flex items-center gap-2"
              >
                {isSavingDiscount ? <Icons.Loader2 className="animate-spin" size={16} /> : <Icons.Check size={16} />} Salvar Agrado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
