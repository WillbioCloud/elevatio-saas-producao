import React, { useEffect, useState } from "react"
import { Search, Filter, Download, Plus, ChevronDown, Clock, Heart, MessageSquare, Check, Trash2, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts"
import { supabase } from '@/lib/supabase'

const chartData = [
  { name: "Jan", received: 200, pending: 150 },
  { name: "Feb", received: 250, pending: 180 },
  { name: "Mar", received: 220, pending: 160 },
  { name: "Apr", received: 300, pending: 200 },
  { name: "May", received: 280, pending: 190 },
  { name: "Jun", received: 350, pending: 250 },
  { name: "Jul", received: 320, pending: 230 },
  { name: "Aug", received: 400, pending: 280 },
  { name: "Sep", received: 380, pending: 260 },
  { name: "Oct", received: 450, pending: 300 },
  { name: "Nov", received: 420, pending: 290 },
  { name: "Dec", received: 500, pending: 350 },
]

const initialInvoice = {
  company_id: "",
  amount: "",
  reference_month: "",
  due_date: "",
}

export default function Payments() {
  const [searchTerm, setSearchTerm] = useState("")
  const [payments, setPayments] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newInvoice, setNewInvoice] = useState(initialInvoice)

  const fetchPayments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("saas_payments")
      .select("*, companies(name, slug)")
      .order("due_date", { ascending: false })

    if (error) {
      alert("Erro ao buscar faturas: " + error.message)
    } else {
      setPayments(data ?? [])
    }
    setLoading(false)
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
      setCompanies(data ?? [])
    }
  }

  useEffect(() => {
    fetchPayments()
    fetchCompanies()
  }, [])

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newInvoice.company_id || !newInvoice.amount || !newInvoice.reference_month || !newInvoice.due_date) {
      return
    }

    const { error } = await supabase.from("saas_payments").insert([
      {
        company_id: newInvoice.company_id,
        amount: Number(newInvoice.amount),
        reference_month: newInvoice.reference_month,
        due_date: newInvoice.due_date,
        status: "pending",
      }
    ])

    if (error) {
      alert("Erro ao criar fatura: " + error.message)
      return
    }

    setIsModalOpen(false)
    setNewInvoice(initialInvoice)
    fetchPayments()
  }

  const handleToggleStatus = async (payment: any) => {
    const nextStatus = payment.status === "pending" ? "paid" : "pending"

    const { error } = await supabase
      .from("saas_payments")
      .update({ status: nextStatus })
      .eq("id", payment.id)

    if (error) {
      alert("Erro ao atualizar status: " + error.message)
      return
    }

    fetchPayments()
  }

  const handleDeleteInvoice = async (paymentId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta fatura?")) return

    const { error } = await supabase
      .from("saas_payments")
      .delete()
      .eq("id", paymentId)

    if (error) {
      alert("Erro ao excluir fatura: " + error.message)
      return
    }

    fetchPayments()
  }

  const getStatusClasses = (status: string) => {
    if (status === "paid") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    }

    if (status === "overdue") {
      return "bg-red-50 text-red-700 border-red-200"
    }

    return "bg-amber-50 text-amber-700 border-amber-200"
  }

  const filteredPayments = payments.filter((payment) => {
    const term = searchTerm.toLowerCase()
    return (
      payment.companies?.name?.toLowerCase().includes(term) ||
      payment.reference_month?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Pagamentos (Sales Invoice)</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
            <Download className="mr-2 h-4 w-4" />
            Import/Export
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Invoice
          </Button>
        </div>
      </div>

      {/* Chart Section */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">Total Invoice Analytics</CardTitle>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-pink-400" />
                <span className="text-slate-500 dark:text-slate-400">Incoming Bills</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-indigo-400" />
                <span className="text-slate-500 dark:text-slate-400">Outgoing Bills</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
              <Clock className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              Monthly
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
              <Filter className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="bg-white dark:bg-slate-900">
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f472b6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f472b6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `$ ${value} K`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorReceived)"
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  stroke="#f472b6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPending)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 rounded-t-xl">
          <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium h-9">
            Status: All Invoice
            <ChevronDown className="ml-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Search"
                className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-9 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 h-9 px-3">
              <Filter className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              Filters
            </Button>
          </div>
        </div>

        <Table className="border-t border-slate-100 dark:border-slate-800">
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
              <TableHead className="w-12 pl-4">
                <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
              </TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Industry</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Id</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Status</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Product/Id</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Grand Total</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Comment</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <TableCell colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">
                  Carregando faturas...
                </TableCell>
              </TableRow>
            )}

            {!loading && filteredPayments.length === 0 && (
              <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <TableCell colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">
                  Nenhuma fatura encontrada.
                </TableCell>
              </TableRow>
            )}

            {!loading && filteredPayments.map((payment) => (
              <TableRow key={payment.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <TableCell className="pl-4">
                  <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                      <AvatarFallback className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-medium">
                        {payment.companies?.name?.slice(0, 2)?.toUpperCase() || "--"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{payment.companies?.name || "Empresa"}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{payment.companies?.slug || "-"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-900 dark:text-slate-50">{payment.id}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusClasses(payment.status)}`}>
                    {payment.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-slate-500 dark:text-slate-400">{payment.reference_month}</TableCell>
                <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {Number(payment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                    <span className="text-xs">{payment.due_date ? new Date(payment.due_date).toLocaleDateString("pt-BR") : "-"}</span>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="text-xs">01</span>
                    </div>
                    <Heart className="h-3.5 w-3.5" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStatus(payment)}
                      className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                      title="Dar baixa / Pagar"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteInvoice(payment.id)}
                      className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 rounded-b-xl">
          <Button variant="ghost" size="sm" className="text-slate-500 dark:text-slate-400 font-medium">
            <ChevronDown className="h-4 w-4 mr-1 rotate-90" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 dark:text-slate-400">1</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-medium">2</Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 dark:text-slate-400">3</Button>
            <span className="text-slate-400 dark:text-slate-500 px-1">...</span>
          </div>
          <Button variant="ghost" size="sm" className="text-slate-900 dark:text-slate-50 font-medium">
            Next
            <ChevronDown className="h-4 w-4 ml-1 -rotate-90" />
          </Button>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Nova Fatura</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Empresa</label>
                <select
                  className="w-full h-10 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  value={newInvoice.company_id}
                  onChange={(e) => setNewInvoice((prev) => ({ ...prev, company_id: e.target.value }))}
                  required
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Valor (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white"
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Mês de Referência</label>
                <Input
                  type="text"
                  placeholder="03/2026"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white"
                  value={newInvoice.reference_month}
                  onChange={(e) => setNewInvoice((prev) => ({ ...prev, reference_month: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Vencimento</label>
                <Input
                  type="date"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice((prev) => ({ ...prev, due_date: e.target.value }))}
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
                  Criar Fatura
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}