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
        className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-100 dark:hover:bg-slate-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="fixed right-8 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-slate-900 ring-1 ring-black ring-opacity-5 dark:ring-slate-800 z-[100] border border-slate-200 dark:border-slate-700">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visualizar PDF
            </button>
            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Reenviar para Assinatura
            </button>
            <button
              onClick={() => {
                onEdit(contractId)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 flex items-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Editar Detalhes
            </button>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
            <button
              onClick={() => {
                onUpdateStatus(contractId, "active")
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
            >
              Aprovar/Ativar
            </button>
            <button
              onClick={() => {
                onUpdateStatus(contractId, "canceled")
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2"
            >
              Cancelar Contrato
            </button>
            <button
              onClick={() => {
                onDelete(contractId)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
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
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Ativo
        </span>
      )
    case "pending":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-500/10 text-amber-500 border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          Pendente
        </span>
      )
    case "expired":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-orange-500/10 text-orange-500 border-orange-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5"></span>
          Expirado
        </span>
      )
    case "canceled":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-500/10 text-red-500 border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
          Cancelado
        </span>
      )
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

    if (error) {
      alert("Erro ao buscar contratos: " + error.message)
    } else {
      setContracts((data as Contract[]) ?? [])
    }

    setIsLoading(false)
  }

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug")
      .eq("active", true)
      .order("name", { ascending: true })

    if (error) {
      alert("Erro ao buscar empresas: " + error.message)
    } else {
      setCompanies((data as Company[]) ?? [])
    }
  }

  useEffect(() => {
    fetchContracts()
    fetchCompanies()
  }, [])

  const handleUpdateStatus = async (id: string, newStatus: ContractStatus) => {
    const { error } = await supabase
      .from("saas_contracts")
      .update({ status: newStatus })
      .eq("id", id)

    if (error) {
      alert("Erro ao atualizar contrato: " + error.message)
      return
    }

    fetchContracts()
  }

  const handleDeleteContract = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este contrato?")) return

    const { error } = await supabase
      .from("saas_contracts")
      .delete()
      .eq("id", id)

    if (error) {
      alert("Erro ao excluir contrato: " + error.message)
      return
    }

    fetchContracts()
  }

  const handleCreateContract = async (e: FormEvent) => {
    e.preventDefault()

    if (!newContract.company_id || !newContract.plan_name || !newContract.start_date || !newContract.end_date) {
      return
    }

    const { error } = await supabase.from("saas_contracts").insert([
      {
        company_id: newContract.company_id,
        plan_name: newContract.plan_name,
        start_date: newContract.start_date,
        end_date: newContract.end_date,
        status: newContract.status,
      }
    ])

    if (error) {
      alert("Erro ao criar contrato: " + error.message)
      return
    }

    setIsModalOpen(false)
    setNewContract(initialNewContract)
    fetchContracts()
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

    const { error } = await supabase
      .from("saas_contracts")
      .update(payload)
      .eq("id", editingContract.id)

    if (error) {
      alert("Erro ao atualizar detalhes do contrato: " + error.message)
      return
    }

    await fetchContracts()
    setEditingContract(null)
    setEditForm({})
  }

  const totalAtivos = contracts.filter((contract) => contract.status === "active").length
  const aguardando = contracts.filter((contract) => contract.status === "pending").length
  const expirando = contracts.filter((contract) => contract.status === "expired").length
  const cancelados = contracts.filter((contract) => contract.status === "canceled").length

  const filteredContracts = contracts.filter((contract) => {
    const clientName = contract.companies?.name?.toLowerCase() ?? ""
    const clientSlug = contract.companies?.slug?.toLowerCase() ?? ""

    const matchesSearch = clientName.includes(searchTerm.toLowerCase()) || clientSlug.includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "Todos" || contract.status === statusFilter
    const matchesPlan = planFilter === "Todos" || contract.plan_name === planFilter

    return matchesSearch && matchesStatus && matchesPlan
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Contratos e Assinaturas</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gira os contratos de prestação de serviços com as imobiliárias.</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 h-10 px-4"
        >
          <FileText className="mr-2 h-4 w-4" />
          Gerar Novo Contrato
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Contratos Ativos
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{totalAtivos}</div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Aguardando Assinatura
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{aguardando}</div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
              A Expirar (30 dias)
            </CardTitle>
            <FileWarning className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{expirando}</div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Cancelados/Inativos
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{cancelados}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Procurar por imobiliária ou slug..."
                className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 h-9 text-sm dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative">
              <select
                className="h-9 pl-3 pr-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Todos">Status: Todos</option>
                <option value="active">Ativo</option>
                <option value="pending">Pendente</option>
                <option value="expired">Expirado</option>
                <option value="canceled">Cancelado</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                className="h-9 pl-3 pr-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
              >
                <option value="Todos">Plano: Todos</option>
                <option value="Starter">Starter</option>
                <option value="Basic">Basic</option>
                <option value="Pro">Pro</option>
                <option value="Business">Business</option>
                <option value="Premium">Premium</option>
                <option value="Elite">Elite</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800/50">
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider pl-4">ID do Contrato</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Cliente / Imobiliária</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Plano Subscrito</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Data de Início</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Data de Fim</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="w-12 text-right pr-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Carregando contratos...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && filteredContracts.map((contract) => (
              <TableRow key={contract.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800/50 transition-colors">
                <TableCell className="pl-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {contract.id}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{contract.companies?.name ?? "Empresa removida"}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{contract.companies?.slug ? `@${contract.companies.slug}` : "-"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{contract.plan_name}</span>
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {formatDate(contract.start_date)}
                </TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                  {formatDate(contract.end_date)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={contract.status} />
                </TableCell>
                <TableCell className="text-right pr-4">
                  <ActionMenu
                    contractId={contract.id}
                    onEdit={(id) => {
                      const c = contracts.find((x) => x.id === id)
                      if (c) {
                        setEditingContract(c)
                        setEditForm(c)
                      }
                    }}
                    onUpdateStatus={handleUpdateStatus}
                    onDelete={handleDeleteContract}
                  />
                </TableCell>
              </TableRow>
            ))}

            {!isLoading && filteredContracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Nenhum contrato encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Gerar Novo Contrato</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateContract} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Empresa</label>
                <select
                  className="w-full h-10 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  value={newContract.company_id}
                  onChange={(e) => setNewContract((prev) => ({ ...prev, company_id: e.target.value }))}
                  required
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Plano</label>
                <select
                  className="w-full h-10 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  value={newContract.plan_name}
                  onChange={(e) => setNewContract((prev) => ({ ...prev, plan_name: e.target.value }))}
                  required
                >
                  <option value="Starter">Starter</option>
                  <option value="Basic">Basic</option>
                  <option value="Pro">Pro</option>
                  <option value="Business">Business</option>
                  <option value="Premium">Premium</option>
                  <option value="Elite">Elite</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Data de Início</label>
                <Input
                  type="date"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white"
                  value={newContract.start_date}
                  onChange={(e) => setNewContract((prev) => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Data de Fim</label>
                <Input
                  type="date"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white"
                  value={newContract.end_date}
                  onChange={(e) => setNewContract((prev) => ({ ...prev, end_date: e.target.value }))}
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">
                  Criar Contrato
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingContract && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Editar Detalhes do Contrato</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingContract(null)
                  setEditForm({})
                }}
                className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleUpdateContractDetails} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Empresa</label>
                <Input
                  type="text"
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                  value={editingContract.companies?.name ?? "Empresa removida"}
                  disabled
                  readOnly
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Plano</label>
                <select
                  className="w-full h-10 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  value={editForm.plan_name ?? "Starter"}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, plan_name: e.target.value }))}
                  required
                >
                  <option value="Starter">Starter</option>
                  <option value="Basic">Basic</option>
                  <option value="Pro">Pro</option>
                  <option value="Business">Business</option>
                  <option value="Premium">Premium</option>
                  <option value="Elite">Elite</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
                <select
                  className="w-full h-10 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  value={editForm.status ?? "pending"}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as ContractStatus }))}
                  required
                >
                  <option value="active">Ativo</option>
                  <option value="pending">Pendente</option>
                  <option value="expired">Expirado</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Data de Início</label>
                <Input
                  type="date"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white"
                  value={editForm.start_date ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Data de Fim</label>
                <Input
                  type="date"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white"
                  value={editForm.end_date ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingContract(null)
                    setEditForm({})
                  }}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}