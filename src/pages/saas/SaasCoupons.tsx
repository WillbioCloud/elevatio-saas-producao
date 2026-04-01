import React, { useEffect, useState } from 'react'
import {
  BadgeDollarSign,
  Gift,
  Loader2,
  Percent,
  Plus,
  Tag,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'

type CouponType = 'percentage' | 'fixed' | 'free_month'

interface Coupon {
  id: string
  code: string
  type: CouponType
  discount_type?: CouponType
  value: number
  discount_value?: number
  duration_months: number
  max_uses?: number | null
  usage_limit?: number | null
  used_count: number
  active: boolean
  created_at?: string
}

const initialForm = {
  code: '',
  type: 'percentage' as CouponType,
  value: 0,
  durationMonths: 3,
  maxUses: 1,
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

    const normalizedCoupons = ((data || []) as Array<Record<string, any>>).map((coupon) => ({
      ...coupon,
      type: (coupon.discount_type ?? coupon.type) as CouponType,
      value: Number(coupon.discount_value ?? coupon.value ?? 0),
    }))

    setCoupons(normalizedCoupons as Coupon[])
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
      discount_type: form.type,
      discount_value: form.type === 'free_month' ? 0 : Number(form.value || 0),
      duration_months: Number(form.durationMonths || 0),
      used_count: 0,
      active: true,
    }

    let { error } = await supabase
      .from('saas_coupons')
      .insert([{ ...payload, max_uses: Number(form.maxUses || 0) }])

    if (error && /max_uses/i.test(error.message || '')) {
      const fallbackInsert = await supabase
        .from('saas_coupons')
        .insert([{ ...payload, usage_limit: Number(form.maxUses || 0) }])

      error = fallbackInsert.error
    }

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
                      {coupon.used_count || 0}/{coupon.max_uses ?? coupon.usage_limit ?? 0}
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

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código do Cupom</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="Ex: BEMVINDO50"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 uppercase outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Desconto</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as CouponType }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none"
                    >
                      <option value="percentage">Porcentagem (%)</option>
                      <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Valor do Desconto
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={form.value}
                        onChange={(e) => setForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
                        className="w-full pl-4 pr-10 py-2 rounded-lg border border-slate-200 outline-none"
                        placeholder="Ex: 20"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-sm">
                        {form.type === 'percentage' ? '%' : 'R$'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duração (Meses)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={form.durationMonths}
                        onChange={(e) => setForm((prev) => ({ ...prev, durationMonths: Number(e.target.value) }))}
                        className="w-full pl-4 pr-16 py-2 rounded-lg border border-slate-200 outline-none"
                        placeholder="Ex: 3"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-400 text-xs">Meses</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Tempo de validade na assinatura.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cupons Disponíveis</label>
                    <input
                      type="number"
                      value={form.maxUses}
                      onChange={(e) => setForm((prev) => ({ ...prev, maxUses: Number(e.target.value) }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none"
                      placeholder="Ex: 100"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Quantas vezes pode ser resgatado.</p>
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
