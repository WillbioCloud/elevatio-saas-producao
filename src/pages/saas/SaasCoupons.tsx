import React, { useEffect, useState } from 'react'
import {
  BadgeDollarSign,
  Calendar,
  Gift,
  Loader2,
  Percent,
  Plus,
  Tag,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'

type CouponType = 'percentage' | 'fixed' | 'free_month'

interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number
  duration_months: number
  usage_limit: number
  used_count: number
  active: boolean
  created_at?: string
}

const initialForm = {
  code: '',
  type: 'percentage' as CouponType,
  value: 0,
  durationMonths: 3,
  usageLimit: 1,
}

export default function SaasCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(initialForm)

  const fetchCoupons = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('saas_coupons')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar cupons:', error)
      setCoupons([])
      setLoading(false)
      return
    }

    setCoupons((data || []) as Coupon[])
    setLoading(false)
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const resetForm = () => {
    setForm(initialForm)
  }

  const getTypeLabel = (type: CouponType) => {
    switch (type) {
      case 'percentage':
        return 'Porcentagem'
      case 'fixed':
        return 'Valor Fixo'
      case 'free_month':
        return 'Mensalidade Grátis'
      default:
        return type
    }
  }

  const getValueLabel = (coupon: Coupon) => {
    if (coupon.type === 'percentage') return `${coupon.value}%`
    if (coupon.type === 'free_month') return '100% da mensalidade'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(coupon.value || 0)
  }

  const handleCreateCoupon = async () => {
    if (!form.code.trim()) {
      alert('Informe um código para o cupom.')
      return
    }

    setIsSaving(true)

    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.type === 'free_month' ? 0 : Number(form.value || 0),
      duration_months: Number(form.durationMonths || 0),
      usage_limit: Number(form.usageLimit || 0),
      used_count: 0,
      active: true,
    }

    const { error } = await supabase.from('saas_coupons').insert([payload])

    if (error) {
      alert('Erro ao criar cupom: ' + error.message)
      setIsSaving(false)
      return
    }

    await fetchCoupons()
    setIsSaving(false)
    setIsModalOpen(false)
    resetForm()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="text-brand-500" />
            Gestão de Cupons
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Crie cupons promocionais para campanhas, agrados estratégicos e onboarding comercial.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="bg-brand-600 hover:bg-brand-700">
          <Plus className="mr-2 h-4 w-4" />
          Novo Cupom
        </Button>
      </div>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-950 border-slate-100 dark:border-slate-800">
                <TableHead className="text-xs uppercase tracking-wider text-slate-500">Código</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-500">Tipo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-500">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-500">Duração</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-500">Uso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand-500" />
                    Carregando cupons...
                  </TableCell>
                </TableRow>
              ) : coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                    Nenhum cupom ativo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon) => (
                  <TableRow key={coupon.id} className="border-slate-100 dark:border-slate-800">
                    <TableCell className="font-bold text-slate-900 dark:text-white">{coupon.code}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {coupon.type === 'percentage' && <Percent className="h-3.5 w-3.5" />}
                        {coupon.type === 'fixed' && <BadgeDollarSign className="h-3.5 w-3.5" />}
                        {coupon.type === 'free_month' && <Gift className="h-3.5 w-3.5" />}
                        {getTypeLabel(coupon.type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300">{getValueLabel(coupon)}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300">{coupon.duration_months} mês(es)</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300">
                      {coupon.used_count || 0}/{coupon.usage_limit || 0}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Novo Cupom</h3>
                <p className="text-sm text-slate-500">Configure um desconto promocional para uso controlado.</p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Ex: PRIMEIROCLIENTE"
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as CouponType }))}
                    className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="percentage">Porcentagem</option>
                    <option value="fixed">Valor Fixo</option>
                    <option value="free_month">Mensalidade Grátis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor</label>
                  <Input
                    type="number"
                    value={form.type === 'free_month' ? 0 : form.value}
                    onChange={(e) => setForm((prev) => ({ ...prev, value: Number(e.target.value) || 0 }))}
                    disabled={form.type === 'free_month'}
                    placeholder={form.type === 'percentage' ? 'Ex: 20' : 'Ex: 50'}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duração</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      value={form.durationMonths}
                      onChange={(e) => setForm((prev) => ({ ...prev, durationMonths: Number(e.target.value) || 0 }))}
                      className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Limite de Uso</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      value={form.usageLimit}
                      onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: Number(e.target.value) || 0 }))}
                      className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateCoupon} disabled={isSaving} className="bg-brand-600 hover:bg-brand-700">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Criar Cupom
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
