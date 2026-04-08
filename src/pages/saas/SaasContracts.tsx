import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  FileText,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileWarning,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "../../../components/ui/skeleton"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'

type ContractStatus = "active" | "pending" | "expired" | "canceled"

interface Contract {
  id: string
  company_id: string
  plan_name: string
  status: ContractStatus
  start_date: string
  end_date: string
  created_at: string
  companies?: {
    name: string
    slug: string
  } | null
}

interface Company {
  id: string
  name: string
  slug: string
}

const initialNewContract = {
  company_id: "",
  plan_name: "Starter",
  start_date: "",
  end_date: "",
  status: "pending" as ContractStatus,
}

const ActionMenu = ({
  contractId,
  onEdit,
  onUpdateStatus,
  onDelete,
}: {
  contractId: string
  onEdit: (id: string) => void
  onUpdateStatus: (id: string, status: ContractStatus) => void
  onDelete: (id: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-popover border border-border z-[100]">
          <div className="py-1" role="menu">
            <button className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visualizar PDF
            </button>
            <button className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Reenviar para Assinatura
            </button>
            <button
              onClick={() => {
                onEdit(contractId)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Editar Detalhes
            </button>
            <div className="h-px bg-border my-1"></div>
            <button
              onClick={() => {
                onUpdateStatus(contractId, "active")
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2"
            >
              Aprovar/Ativar
            </button>
            <button
              onClick={() => {
                onUpdateStatus(contractId, "canceled")
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2"
            >
              Cancelar Contrato
            </button>
            <button
              onClick={() => {
                onDelete(contractId)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const StatusBadge = ({ status }: { status: ContractStatus }) => {
  switch (status) {
    case "active":
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ativo</Badge>
    case "pending":
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pendente</Badge>
    case "expired":
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Expirado</Badge>
    case "canceled":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Cancelado</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

const formatDate = (date?: string | null) => {
  if (!date) return "-"
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR")
}

export default function Contracts() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const [planFilter, setPlanFilter] = useState("Todos")
  const [contracts, setContracts] = useState<Contract[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newContract, setNewContract] = useState(initialNewContract)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [editForm, setEditForm] = useState<Partial<Contract>>({})

  const fetchContracts = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("saas_contracts")
      .select("*, companies(name, slug)")
      .order("created_at", { ascending: false })
    if (error) alert("Erro ao buscar contratos: " + error.message)
    else setContracts((data as Contract[]) ?? [])
    setIsLoading(false)
  }

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug")
      .eq("active", true)
      .order("name", { ascending: true })
    if (error) alert("Erro ao buscar empresas: " + error.message)
    else setCompanies((data as Company[]) ?? [])
  }

  useEffect(() => {
    fetchContracts()
    fetchCompanies()
  }, [])

  const handleUpdateStatus = async (id: string, newStatus: ContractStatus) => {
    const { error } = await supabase.from("saas_contracts").update({ status: newStatus }).eq("id", id)
    if (error) alert("Erro ao atualizar contrato: " + error.message)
    else fetchContracts()
  }

  const handleDeleteContract = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este contrato?")) return
    const { error } = await supabase.from("saas_contracts").delete().eq("id", id)
    if (error) alert("Erro ao excluir contrato: " + error.message)
    else fetchContracts()
  }

  const handleCreateContract = async (e: FormEvent) => {
    e.preventDefault()
    if (!newContract.company_id || !newContract.plan_name || !newContract.start_date || !newContract.end_date) return
    const { error } = await supabase.from("saas_contracts").insert([{
      company_id: newContract.company_id,
      plan_name: newContract.plan_name,
      start_date: newContract.start_date,
      end_date: newContract.end_date,
      status: newContract.status,
    }])
    if (error) alert("Erro ao criar contrato: " + error.message)
    else {
      setIsModalOpen(false)
      setNewContract(initialNewContract)
      fetchContracts()
    }
  }

  const handleUpdateContractDetails = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingContract) return
    const payload = {
      plan_name: editForm.plan_name,
      status: editForm.status,
      start_date: editForm.start_date,
      end_date: editForm.end_date,
    }
    const { error } = await supabase.from("saas_contracts").update(payload).eq("id", editingContract.id)
    if (error) alert("Erro ao atualizar detalhes do contrato: " + error.message)
    else {
      await fetchContracts()
      setEditingContract(null)
      setEditForm({})
    }
  }

  const totalAtivos = contracts.filter(c => c.status === "active").length
  const aguardando = contracts.filter(c => c.status === "pending").length
  const expirando = contracts.filter(c => c.status === "expired").length
  const cancelados = contracts.filter(c => c.status === "canceled").length

  const filteredContracts = contracts.filter(contract => {
    const clientName = contract.companies?.name?.toLowerCase() ?? ""
    const clientSlug = contract.companies?.slug?.toLowerCase() ?? ""
    const matchesSearch = clientName.includes(searchTerm.toLowerCase()) || clientSlug.includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "Todos" || contract.status === statusFilter
    const matchesPlan = planFilter === "Todos" || contract.plan_name === planFilter
    return matchesSearch && matchesStatus && matchesPlan
  })

  if (isLoading && contracts.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Contratos e Assinaturas</h2>
          <p className="text-sm text-muted-foreground mt-1">Gira os contratos de prestação de serviços com as imobiliárias.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shrink-0 gap-2">
          <FileText className="h-4 w-4" />
          Gerar Novo Contrato
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Ativos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalAtivos}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando Assinatura</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{aguardando}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Expirar (30 dias)</CardTitle>
            <FileWarning className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{expirando}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelados/Inativos</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{cancelados}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Procurar por imobiliária ou slug..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status: Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Status: Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Plano: Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Plano: Todos</SelectItem>
                <SelectItem value="Starter">Starter</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
                <SelectItem value="Pro">Pro</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Elite">Elite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider font-medium pl-4">ID do Contrato</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Cliente / Imobiliária</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Plano Subscrito</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Data de Início</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Data de Fim</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Status</TableHead>
                <TableHead className="w-12 text-right pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Carregando contratos...</TableCell></TableRow>
              ) : filteredContracts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nenhum contrato encontrado.</TableCell></TableRow>
              ) : (
                filteredContracts.map((contract) => (
                  <TableRow key={contract.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{contract.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{contract.companies?.name ?? "Empresa removida"}</span>
                        <span className="text-xs text-muted-foreground">{contract.companies?.slug ? `@${contract.companies.slug}` : "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm font-medium">{contract.plan_name}</span></TableCell>
                    <TableCell className="text-sm">{formatDate(contract.start_date)}</TableCell>
                    <TableCell className="text-sm">{formatDate(contract.end_date)}</TableCell>
                    <TableCell><StatusBadge status={contract.status} /></TableCell>
                    <TableCell className="text-right pr-4">
                      <ActionMenu
                        contractId={contract.id}
                        onEdit={(id) => {
                          const c = contracts.find((x) => x.id === id)
                          if (c) { setEditingContract(c); setEditForm(c) }
                        }}
                        onUpdateStatus={handleUpdateStatus}
                        onDelete={handleDeleteContract}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal de Criar Contrato */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Gerar Novo Contrato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateContract} className="space-y-4">
            <div>
              <Label>Empresa</Label>
              <Select value={newContract.company_id} onValueChange={(v) => setNewContract(prev => ({ ...prev, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={newContract.plan_name} onValueChange={(v) => setNewContract(prev => ({ ...prev, plan_name: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Elite">Elite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data de Início</Label><Input type="date" value={newContract.start_date} onChange={(e) => setNewContract(prev => ({ ...prev, start_date: e.target.value }))} required /></div>
              <div><Label>Data de Fim</Label><Input type="date" value={newContract.end_date} onChange={(e) => setNewContract(prev => ({ ...prev, end_date: e.target.value }))} required /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar Contrato</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Editar Contrato */}
      <Dialog open={!!editingContract} onOpenChange={(open) => !open && setEditingContract(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Detalhes do Contrato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateContractDetails} className="space-y-4">
            <div>
              <Label>Empresa</Label>
              <Input value={editingContract?.companies?.name ?? "Empresa removida"} disabled readOnly className="bg-muted" />
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={editForm.plan_name ?? "Starter"} onValueChange={(v) => setEditForm(prev => ({ ...prev, plan_name: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Elite">Elite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status ?? "pending"} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v as ContractStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data de Início</Label><Input type="date" value={editForm.start_date ?? ""} onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))} required /></div>
              <div><Label>Data de Fim</Label><Input type="date" value={editForm.end_date ?? ""} onChange={(e) => setEditForm(prev => ({ ...prev, end_date: e.target.value }))} required /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingContract(null)}>Cancelar</Button>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}