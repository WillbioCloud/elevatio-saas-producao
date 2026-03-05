import React, { useEffect, useState } from "react"
import {
  Search,
  Filter,
  MoreHorizontal,
  Plus,
  Building2,
  Calendar,
  X,
  ChevronDown,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from '@/lib/supabase'

export default function Clients() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClient, setSelectedClient] = useState<any | null>(null)

  // Estados para o Modal de Nova Empresa
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false)
  const [newCompany, setNewCompany] = useState({ name: "", plan: "business" })
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Busca as empresas no banco de dados
  const fetchCompanies = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      setClients(data)
    }
    setLoading(false)
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
        slug: generatedSlug,
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

  // Função para Deletar Empresa (Hard Delete via Edge Function)
  const handleDeleteCompany = async (id: string) => {
    if (!window.confirm("ATENÇÃO: Esta é uma exclusão DESTRUTIVA! Todos os imóveis, leads, contratos e logins vinculados a esta imobiliária serão APAGADOS PERMANENTEMENTE. Tem certeza absoluta?")) return

    setIsDeleting(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-tenant', {
        body: { company_id: id }
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      alert("Empresa excluída com sucesso!")
      setSelectedClient(null)
      fetchCompanies()
    } catch (error: any) {
      alert("Erro ao excluir empresa: " + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // Função para Suspender/Ativar
  const handleToggleStatus = async (client: any) => {
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
      client.slug?.toLowerCase().includes(term)
    )
  })

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
                        <p className="text-xs text-slate-500 dark:text-slate-400">{client.slug}.elevatiovendas.com</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200">
                      {client.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={client.active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" : "bg-red-50 text-red-700 hover:bg-red-100 border-red-200"}>
                      {client.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400">
                    {new Date(client.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
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

      {/* Detalhes do Cliente (Sidebar Lateral) */}
      {selectedClient && (
        <>
          {/* Overlay (Fundo Escuro) - Clicar nele também fecha a sidebar */}
          <div 
            className="fixed inset-0 bg-slate-950/70 z-40 transition-opacity"
            onClick={() => setSelectedClient(null)}
          />
          
          {/* Painel da Sidebar Fixado na Direita */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right-8 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-start sticky top-0 bg-white dark:bg-slate-900 backdrop-blur-md z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedClient.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider">{selectedClient.plan}</Badge>
                  <Badge className={selectedClient.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                    {selectedClient.active ? "Ativo" : "Suspenso"}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedClient(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 flex-1 flex flex-col gap-6">
              {/* Informações Essenciais */}
              <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Dados da Imobiliária
                </h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Subdomínio (Acesso)</p>
                    <a href={`https://${selectedClient.slug}.elevatiovendas.com`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600 hover:underline flex items-center gap-1">
                      {selectedClient.slug}.elevatiovendas.com
                    </a>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Cliente Desde</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      {new Date(selectedClient.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                <p className="text-xs text-indigo-800 font-medium">Métricas detalhadas (MRR, Total de Imóveis e Usuários) serão exibidas aqui nas próximas atualizações do painel.</p>
              </div>

              {/* Ações */}
              <div className="pt-4 mt-auto flex flex-col gap-3">
                <Button
                  onClick={() => handleToggleStatus(selectedClient)}
                  disabled={isUpdatingStatus}
                  variant="outline"
                  className={selectedClient.active ? "text-amber-600 border-amber-200 hover:bg-amber-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"}
                >
                  {isUpdatingStatus ? "Atualizando..." : (selectedClient.active ? "Bloquear / Suspender Acesso" : "Reativar Acesso do Cliente")}
                </Button>

                <Button
                  onClick={() => handleDeleteCompany(selectedClient.id)}
                  disabled={isDeleting}
                  variant="outline"
                  className="text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                >
                  {isDeleting ? "Excluindo..." : "Excluir Empresa Definitivamente"}
                </Button>
              </div>
            </div>
          </div>
        </>
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
                    Subdomínio gerado: <strong className="text-brand-600">{newCompany.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}</strong>.elevatiovendas.com
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
                  <option value="professional">Professional</option>
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
    </div>
  )
}