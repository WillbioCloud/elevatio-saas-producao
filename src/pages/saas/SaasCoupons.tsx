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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '../../../components/ui/skeleton'
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

  const resetForm = () => setForm(initialForm)

  const getTypeLabel = (type: CouponType) => {
    switch (type) {
      case 'percentage': return 'Porcentagem'
      case 'fixed': return 'Valor Fixo'
      case 'free_month': return 'Mensalidade Grátis'
      default: return type
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

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tag className="text-primary" />
            Gestão de Cupons
          </h1>
          <p className="text-muted-foreground">
            Crie cupons promocionais para campanhas, agrados estratégicos e onboarding comercial.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Novo Cupom
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider font-medium">Código</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Tipo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Duração</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Uso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum cupom ativo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon) => (
                  <TableRow key={coupon.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold text-foreground">{coupon.code}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold bg-muted text-muted-foreground">
                        {coupon.type === 'percentage' && <Percent className="h-3.5 w-3.5" />}
                        {coupon.type === 'fixed' && <BadgeDollarSign className="h-3.5 w-3.5" />}
                        {coupon.type === 'free_month' && <Gift className="h-3.5 w-3.5" />}
                        {getTypeLabel(coupon.type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground">{getValueLabel(coupon)}</TableCell>
                    <TableCell className="text-foreground">{coupon.duration_months} mês(es)</TableCell>
                    <TableCell className="text-foreground">
                      {coupon.used_count || 0}/{coupon.max_uses ?? coupon.usage_limit ?? 0}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal de criação de cupom */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Cupom</DialogTitle>
            <p className="text-sm text-muted-foreground">Configure um desconto promocional para uso controlado.</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código do Cupom</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="Ex: BEMVINDO50"
                className="uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Desconto</Label>
                <Select value={form.type} onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as CouponType }))}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Valor do Desconto</Label>
                <div className="relative">
                  <Input
                    id="value"
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
                    placeholder="Ex: 20"
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                    {form.type === 'percentage' ? '%' : 'R$'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Duração (Meses)</Label>
                <div className="relative">
                  <Input
                    id="durationMonths"
                    type="number"
                    value={form.durationMonths}
                    onChange={(e) => setForm((prev) => ({ ...prev, durationMonths: Number(e.target.value) }))}
                    placeholder="Ex: 3"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Meses</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Tempo de validade na assinatura.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Cupons Disponíveis</Label>
                <Input
                  id="maxUses"
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => setForm((prev) => ({ ...prev, maxUses: Number(e.target.value) }))}
                  placeholder="Ex: 100"
                />
                <p className="text-[10px] text-muted-foreground">Quantas vezes pode ser resgatado.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm() }}>Cancelar</Button>
            <Button onClick={handleCreateCoupon} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Cupom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}