import React, { useEffect, useState } from "react"
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  Star,
  X,
  Save
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'

interface PlanFeature {
  text: string;
  highlight?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  icon: string;
  is_popular: boolean;
  features: PlanFeature[];
}

const newPlanTemplate: Plan = {
  id: "",
  name: "",
  price: 0,
  description: "",
  icon: "🌟",
  is_popular: false,
  features: []
}

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

  const fetchPlans = async () => {
    setIsLoading(true)

    const { data, error } = await supabase
      .from("saas_plans")
      .select("id, name, price, description, icon, is_popular, features")
      .order("price", { ascending: true })

    if (error) {
      console.error("Erro ao buscar planos:", error)
      setIsLoading(false)
      return
    }

    const normalizedPlans: Plan[] = (data || []).map((plan) => ({
      id: String(plan.id || ""),
      name: plan.name ?? "",
      price: Number(plan.price ?? 0),
      description: plan.description ?? "",
      icon: plan.icon ?? "🌟",
      is_popular: Boolean(plan.is_popular),
      features: Array.isArray(plan.features)
        ? plan.features.map((feature: PlanFeature) => ({
            text: feature?.text ?? "",
            highlight: feature?.highlight
          }))
        : []
    }))

    setPlans(normalizedPlans)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleEdit = (plan: Plan) => {
    setEditingPlan({ ...plan, features: [...plan.features] })
    setIsEditing(true)
  }

  const handleCreate = () => {
    setEditingPlan({ ...newPlanTemplate, features: [] })
    setIsEditing(true)
  }

  const handleCloseEditor = () => {
    setIsEditing(false)
    setEditingPlan(null)
  }

  const handleSave = async () => {
    if (!editingPlan) return

    const payload = {
      name: editingPlan.name,
      price: editingPlan.price,
      description: editingPlan.description,
      icon: editingPlan.icon,
      is_popular: editingPlan.is_popular,
      features: editingPlan.features
    }

    if (!editingPlan.id) {
      const { error } = await supabase.from("saas_plans").insert(payload)
      if (error) {
        console.error("Erro ao criar plano:", error)
        return
      }
    } else {
      const { error } = await supabase
        .from("saas_plans")
        .update(payload)
        .eq("id", editingPlan.id)

      if (error) {
        console.error("Erro ao atualizar plano:", error)
        return
      }
    }

    await fetchPlans()
    handleCloseEditor()
  }

  const handleDelete = async (id: string) => {
    const shouldDelete = window.confirm("Tem certeza que deseja excluir este plano?")
    if (!shouldDelete) return

    const { error } = await supabase.from("saas_plans").delete().eq("id", id)

    if (error) {
      console.error("Erro ao excluir plano:", error)
      return
    }

    await fetchPlans()
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Gestão de Planos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure os preços, limites e funcionalidades do seu SaaS.</p>
        </div>
        <Button onClick={handleCreate} className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading && (
          <div className="col-span-full text-sm text-slate-500 dark:text-slate-400">Carregando planos...</div>
        )}

        {!isLoading && plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              "relative flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 transition-all hover:shadow-lg dark:hover:shadow-indigo-500/10",
              plan.is_popular && "border-indigo-500/50 shadow-md shadow-indigo-500/10 dark:bg-slate-900/80"
            )}
          >
            {plan.is_popular && (
              <div className="absolute -top-3 left-0 right-0 flex justify-center">
                <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white border-none flex items-center gap-1 shadow-sm">
                  <Star className="h-3 w-3 fill-current" /> Mais Popular
                </Badge>
              </div>
            )}

            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{plan.icon}</span>
                  <CardTitle className="text-xl text-slate-900 dark:text-slate-50">{plan.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => handleEdit(plan)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400" onClick={() => handleDelete(plan.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="text-sm text-slate-500 dark:text-slate-400 min-h-[40px] mt-2">
                {plan.description}
              </CardDescription>
              <div className="mt-4 flex items-baseline text-slate-900 dark:text-slate-50">
                <span className="text-3xl font-bold tracking-tight">R$ {plan.price.toFixed(2).replace('.', ',')}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">/mês</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5 bg-indigo-50 dark:bg-indigo-500/10 p-1 rounded-full shrink-0">
                      <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-700 dark:text-slate-200 font-medium">{feature.text}</span>
                      {feature.highlight && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{feature.highlight}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isEditing && editingPlan && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/50">
              <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-indigo-500" />
                {editingPlan.id ? `Editar Plano ${editingPlan.name}` : "Novo Plano"}
              </h3>
              <Button variant="ghost" size="icon" onClick={handleCloseEditor}>
                <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-slate-700 dark:text-slate-200">Nome do Plano</Label>
                  <Input
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-700 dark:text-slate-200">Preço Mensal (R$)</Label>
                  <Input
                    type="number"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) || 0 })}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-700 dark:text-slate-200">Descrição Comercial</Label>
                  <textarea
                    value={editingPlan.description}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    className="w-full min-h-[80px] rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-none"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-700 dark:text-slate-200">Ícone</Label>
                  <Input
                    value={editingPlan.icon}
                    onChange={(e) => setEditingPlan({ ...editingPlan, icon: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                  <Label className="text-slate-700 dark:text-slate-200">Mais Popular</Label>
                  <input
                    type="checkbox"
                    checked={editingPlan.is_popular}
                    onChange={(e) => setEditingPlan({ ...editingPlan, is_popular: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
                <h4 className="font-medium text-sm text-slate-900 dark:text-slate-50 mb-4">Funcionalidades do Plano</h4>
                <div className="space-y-3">
                  {editingPlan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={feature.text}
                        onChange={(e) => {
                          const updatedFeatures = [...editingPlan.features]
                          updatedFeatures[idx] = { ...updatedFeatures[idx], text: e.target.value }
                          setEditingPlan({ ...editingPlan, features: updatedFeatures })
                        }}
                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-slate-400"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          const updatedFeatures = editingPlan.features.filter((_, featureIndex) => featureIndex !== idx)
                          setEditingPlan({ ...editingPlan, features: updatedFeatures })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    onClick={() => setEditingPlan({ ...editingPlan, features: [...editingPlan.features, { text: "" }] })}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Funcionalidade
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <Button variant="outline" onClick={handleCloseEditor} className="border-slate-200 dark:border-slate-700">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-indigo-600 text-white hover:bg-indigo-700">
                <Save className="mr-2 h-4 w-4" /> Guardar Alterações
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}