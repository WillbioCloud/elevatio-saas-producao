import React, { useEffect, useState } from "react";
import { Icons } from "../../components/Icons";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "../../../components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  icon: string;
  badge: string;
  is_popular: boolean;
  features: string[];
  max_users: number;
  max_properties: number;
  max_contracts: number;
  max_photos: number;
  has_funnel: boolean;
  has_pipeline: boolean;
  has_gamification: boolean;
  has_erp: boolean;
  ia_limit: string;
  aura_access: string;
  has_site: boolean;
  has_free_domain: boolean;
  has_portals: boolean;
  has_email_auto: boolean;
  has_api: boolean;
  support_level: string;
}

const newPlanTemplate: Plan = {
  id: "",
  name: "",
  price: 0,
  description: "",
  icon: "star",
  badge: "",
  is_popular: false,
  features: [],
  max_users: 0,
  max_properties: 0,
  max_contracts: 0,
  max_photos: 0,
  has_funnel: false,
  has_pipeline: false,
  has_gamification: false,
  has_erp: false,
  ia_limit: "",
  aura_access: "",
  has_site: false,
  has_free_domain: false,
  has_portals: false,
  has_email_auto: false,
  has_api: false,
  support_level: "",
};

const moduleLabels: Array<{ key: keyof Plan; label: string }> = [
  { key: "has_funnel", label: "Funil" },
  { key: "has_pipeline", label: "Pipeline" },
  { key: "has_gamification", label: "Gamificação" },
  { key: "has_erp", label: "ERP" },
  { key: "has_site", label: "Site" },
  { key: "has_portals", label: "Portais" },
  { key: "has_email_auto", label: "E-mail automático" },
  { key: "has_api", label: "API" },
];

const renderPlanIcon = (iconName: string) => {
  switch (iconName?.toLowerCase()) {
    case "rocket": return <Icons.Rocket size={28} className="text-primary" />;
    case "star": return <Icons.Star size={28} className="text-primary" />;
    case "crown": return <Icons.Crown size={28} className="text-primary" />;
    case "building": return <Icons.Building2 size={28} className="text-primary" />;
    case "zap": return <Icons.Zap size={28} className="text-primary" />;
    case "shield": return <Icons.Shield size={28} className="text-primary" />;
    default: return <Icons.Package size={28} className="text-primary" />;
  }
};

export default function SaasPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const fetchPlans = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("saas_plans")
      .select("*")
      .order("price", { ascending: true });
    if (!error && data) {
      const normalizedPlans = (data as Partial<Plan>[]).map((plan) => ({
        ...newPlanTemplate,
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : [],
      }));
      setPlans(normalizedPlans as Plan[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEdit = (plan: Plan) => {
    setEditingPlan({
      ...newPlanTemplate,
      ...plan,
      features: Array.isArray(plan.features) ? plan.features : [],
    });
    setIsEditing(true);
  };

  const handleCreate = () => {
    setEditingPlan({ ...newPlanTemplate, features: [] });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editingPlan) return;
    const payload = {
      name: editingPlan.name,
      price: editingPlan.price,
      description: editingPlan.description,
      icon: editingPlan.icon,
      badge: editingPlan.badge,
      is_popular: editingPlan.is_popular,
      features: editingPlan.features,
      max_users: Number(editingPlan.max_users),
      max_properties: Number(editingPlan.max_properties),
      max_contracts: Number(editingPlan.max_contracts),
      max_photos: Number(editingPlan.max_photos),
      has_funnel: editingPlan.has_funnel,
      has_pipeline: editingPlan.has_pipeline,
      has_gamification: editingPlan.has_gamification,
      has_erp: editingPlan.has_erp,
      ia_limit: editingPlan.ia_limit,
      aura_access: editingPlan.aura_access,
      has_site: editingPlan.has_site,
      has_free_domain: editingPlan.has_free_domain,
      has_portals: editingPlan.has_portals,
      has_email_auto: editingPlan.has_email_auto,
      has_api: editingPlan.has_api,
      support_level: editingPlan.support_level,
    };
    const { error } = editingPlan.id
      ? await supabase.from("saas_plans").update(payload).eq("id", editingPlan.id)
      : await supabase.from("saas_plans").insert([payload]);
    if (error) {
      alert("Erro ao salvar o plano. Verifique os dados e tente novamente.");
      return;
    }
    alert("Plano salvo com sucesso!");
    await fetchPlans();
    setIsEditing(false);
    setEditingPlan(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este plano?")) return;
    await supabase.from("saas_plans").delete().eq("id", id);
    await fetchPlans();
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-96 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Icons.Package className="text-primary" />
            Gestão de Planos
          </h1>
          <p className="text-muted-foreground">Configure os preços, limites e funcionalidades do seu SaaS.</p>
        </div>
        <Button onClick={handleCreate} className="gap-2 shadow-sm border">
          <Icons.Plus size={18} />
          Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              "relative flex flex-col border overflow-visible transition-all shadow-sm hover:shadow-md",
              plan.is_popular
                ? "border-primary ring-1 ring-primary/50 shadow-primary/10"
                : "border-border/50"
            )}
          >
            {plan.is_popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                <Icons.Star size={12} className="fill-current" />
                Mais Popular
              </div>
            )}
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl">{renderPlanIcon(plan.icon)}</div>
                  <div>
                    <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    {plan.badge && (
                      <Badge variant="outline" className="mt-1 text-xs font-semibold bg-primary/5 border-primary/20">
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Icons.Edit2 size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Icons.Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground min-h-[40px] mt-2">{plan.description}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight">R$ {plan.price.toFixed(2).replace(".", ",")}</span>
                <span className="text-sm font-medium text-muted-foreground">/mês</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="col-span-2 px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">
                  Locações Ativas: {plan.max_contracts > 0 ? plan.max_contracts : "Não incluído"}
                </span>
                <span className="px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">👥 {plan.max_users} usuários</span>
                <span className="px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">🏠 {plan.max_properties} imóveis</span>
                <span className="px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">📸 {plan.max_photos} fotos</span>
                <span className="px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">🧠 IA {plan.ia_limit || "-"}</span>
                <span className="px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">✨ Aura {plan.aura_access || "-"}</span>
                <span className="px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">🛟 {plan.support_level || "Suporte"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {plan.has_free_domain && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400">
                    🎁 Domínio Grátis (Anual)
                  </Badge>
                )}
                {moduleLabels.map((module) =>
                  plan[module.key] ? (
                    <Badge key={module.key} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
                      {module.label}
                    </Badge>
                  ) : null
                )}
              </div>
              <div className="space-y-3 pt-2 border-t border-border/50">
                {plan.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Icons.CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Drawer de edição/criação */}
      <Dialog open={isEditing} onOpenChange={(open) => !open && setIsEditing(false)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Icons.Settings size={20} className="text-primary" />
              {editingPlan?.id ? `Editar ${editingPlan.name}` : "Novo Plano"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            {editingPlan && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Nome do Plano</Label><Input value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} /></div>
                  <div><Label>Badge do Plano</Label><Input value={editingPlan.badge} onChange={(e) => setEditingPlan({ ...editingPlan, badge: e.target.value })} placeholder="Ex: Recomendado" /></div>
                  <div><Label>Preço (R$)</Label><Input type="number" value={editingPlan.price} onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })} /></div>
                  <div><Label>Ícone (Nome)</Label><Input value={editingPlan.icon} onChange={(e) => setEditingPlan({ ...editingPlan, icon: e.target.value })} placeholder="Ex: rocket, star, crown" /></div>
                </div>
                <div><Label>Descrição Curta</Label><Textarea value={editingPlan.description} onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })} rows={3} /></div>
                <div className="flex items-center gap-2"><Switch checked={editingPlan.is_popular} onCheckedChange={(v) => setEditingPlan({ ...editingPlan, is_popular: v })} /><Label>Destacar como Mais Popular</Label></div>

                <div className="space-y-4 pt-2 border-t border-border"><h4 className="font-bold">Limites Numéricos</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><Label className="text-xs">Usuários</Label><Input type="number" value={editingPlan.max_users} onChange={(e) => setEditingPlan({ ...editingPlan, max_users: Number(e.target.value) })} /></div><div><Label className="text-xs">Imóveis</Label><Input type="number" value={editingPlan.max_properties} onChange={(e) => setEditingPlan({ ...editingPlan, max_properties: Number(e.target.value) })} /></div><div><Label className="text-xs">Máx. Locações Ativas</Label><Input type="number" value={editingPlan.max_contracts} onChange={(e) => setEditingPlan({ ...editingPlan, max_contracts: Number(e.target.value) })} /></div><div><Label className="text-xs">Fotos</Label><Input type="number" value={editingPlan.max_photos} onChange={(e) => setEditingPlan({ ...editingPlan, max_photos: Number(e.target.value) })} /></div></div></div>

                <div className="space-y-4"><h4 className="font-bold">Limites de Texto</h4><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><Label className="text-xs">Limite IA</Label><Input value={editingPlan.ia_limit} onChange={(e) => setEditingPlan({ ...editingPlan, ia_limit: e.target.value })} placeholder="Ex: 50/dia" /></div><div><Label className="text-xs">Acesso Aura</Label><Input value={editingPlan.aura_access} onChange={(e) => setEditingPlan({ ...editingPlan, aura_access: e.target.value })} placeholder="Ex: Liberada" /></div><div><Label className="text-xs">Nível de Suporte</Label><Input value={editingPlan.support_level} onChange={(e) => setEditingPlan({ ...editingPlan, support_level: e.target.value })} placeholder="Ex: Prioritário" /></div></div></div>

                <div className="space-y-4"><h4 className="font-bold">Módulos do CRM</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{moduleLabels.map((module) => (<div key={module.key} className="flex items-center justify-between"><Label>{module.label}</Label><Switch checked={Boolean(editingPlan[module.key])} onCheckedChange={(v) => setEditingPlan({ ...editingPlan, [module.key]: v })} /></div>))}</div></div>

                <div className="space-y-4"><h4 className="font-bold">Benefícios</h4><div className="flex items-center justify-between"><Label>Domínio Grátis no Anual</Label><Switch checked={editingPlan.has_free_domain} onCheckedChange={(v) => setEditingPlan({ ...editingPlan, has_free_domain: v })} /></div></div>

                <div className="space-y-4"><h4 className="font-bold">Funcionalidades</h4><div className="space-y-2">{editingPlan.features?.map((feat, idx) => (<div key={idx} className="flex gap-2"><Input value={feat} onChange={(e) => { const newFeats = [...editingPlan.features]; newFeats[idx] = e.target.value; setEditingPlan({ ...editingPlan, features: newFeats }); }} /><Button variant="ghost" size="icon" onClick={() => { const newFeats = editingPlan.features.filter((_, i) => i !== idx); setEditingPlan({ ...editingPlan, features: newFeats }); }}><Icons.Trash2 size={16} className="text-destructive" /></Button></div>))}<Button variant="outline" onClick={() => setEditingPlan({ ...editingPlan, features: [...(editingPlan.features || []), ""] })} className="w-full gap-2"><Icons.Plus size={16} /> Adicionar Item</Button></div></div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="p-6 pt-0 border-t border-border mt-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2"><Icons.Save size={18} /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}