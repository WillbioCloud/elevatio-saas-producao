import React, { useEffect, useState } from "react";
import { Icons } from "../../components/Icons";
import { supabase } from "../../lib/supabase";

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
  support_level: ""
};

const moduleLabels: Array<{ key: keyof Plan; label: string }> = [
  { key: "has_funnel", label: "Funil" },
  { key: "has_pipeline", label: "Pipeline" },
  { key: "has_gamification", label: "Gamificação" },
  { key: "has_erp", label: "ERP" },
  { key: "has_site", label: "Site" },
  { key: "has_portals", label: "Portais" },
  { key: "has_email_auto", label: "E-mail automático" },
  { key: "has_api", label: "API" }
];

export default function SaasPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const renderPlanIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case "rocket":
        return <Icons.Rocket size={28} className="text-brand-500" />;
      case "star":
        return <Icons.Star size={28} className="text-brand-500" />;
      case "crown":
        return <Icons.Crown size={28} className="text-brand-500" />;
      case "building":
        return <Icons.Building2 size={28} className="text-brand-500" />;
      case "zap":
        return <Icons.Zap size={28} className="text-brand-500" />;
      case "shield":
        return <Icons.Shield size={28} className="text-brand-500" />;
      default:
        return <Icons.Package size={28} className="text-brand-500" />;
    }
  };

  const fetchPlans = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("saas_plans")
      .select(
        "id, name, price, description, icon, badge, is_popular, features, max_users, max_properties, max_contracts, max_photos, has_funnel, has_pipeline, has_gamification, has_erp, ia_limit, aura_access, has_site, has_free_domain, has_portals, has_email_auto, has_api, support_level"
      )
      .order("price", { ascending: true });

    if (!error && data) {
      const normalizedPlans = (data as Partial<Plan>[]).map((plan) => ({
        ...newPlanTemplate,
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      }));

      setPlans(normalizedPlans);
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
      features: Array.isArray(plan.features) ? plan.features : []
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
      support_level: editingPlan.support_level
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Icons.Package className="text-brand-500" />
            Gestão de Planos
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Configure os preços, limites e funcionalidades do seu SaaS.</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm shadow-brand-500/20"
        >
          <Icons.Plus size={18} />
          Novo Plano
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Icons.RefreshCw size={32} className="animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col bg-white dark:bg-dark-card border rounded-3xl p-6 transition-all shadow-sm hover:shadow-md ${
                plan.is_popular ? "border-brand-500 ring-1 ring-brand-500/50" : "border-slate-200 dark:border-dark-border"
              }`}
            >
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                  <Icons.Star size={12} className="fill-current" />
                  Mais Popular
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-50 dark:bg-brand-900/20 rounded-xl">{renderPlanIcon(plan.icon)}</div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                    {plan.badge && (
                      <span className="inline-flex mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                  >
                    <Icons.Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Icons.Trash2 size={18} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 min-h-[40px] mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">R$ {plan.price.toFixed(2).replace(".", ",")}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/mês</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <span className="col-span-2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Locações Ativas: {plan.max_contracts > 0 ? plan.max_contracts : "Não incluído"}</span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">👥 {plan.max_users} usuários</span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">🏠 {plan.max_properties} imóveis</span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">📸 {plan.max_photos} fotos</span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">🧠 IA {plan.ia_limit || "-"}</span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">✨ Aura {plan.aura_access || "-"}</span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">🛟 {plan.support_level || "Suporte"}</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {plan.has_free_domain && (
                  <span className="inline-flex px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    🎁 Domínio Grátis (Anual)
                  </span>
                )}
                {moduleLabels.map((module) =>
                  plan[module.key] ? (
                    <span
                      key={module.key}
                      className="inline-flex px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      {module.label}
                    </span>
                  ) : null
                )}
              </div>

              <div className="space-y-3 flex-1 border-t border-slate-100 dark:border-dark-border pt-4">
                {plan.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Icons.CheckCircle2 size={18} className="text-brand-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditing && editingPlan && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-dark-card h-full border-l border-slate-200 dark:border-dark-border shadow-2xl flex flex-col animate-slide-left">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-dark-border">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Icons.Settings size={20} className="text-brand-500" />
                {editingPlan.id ? `Editar ${editingPlan.name}` : "Novo Plano"}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <Icons.X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome do Plano</label>
                  <input
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Badge do Plano</label>
                  <input
                    value={editingPlan.badge}
                    onChange={(e) => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                    placeholder="Ex: Recomendado"
                    className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Preço (R$)</label>
                  <input
                    type="number"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ícone (Nome)</label>
                  <input
                    value={editingPlan.icon}
                    onChange={(e) => setEditingPlan({ ...editingPlan, icon: e.target.value })}
                    placeholder="Ex: rocket, star, crown"
                    className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Descrição Curta</label>
                <textarea
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none h-20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_popular"
                  checked={editingPlan.is_popular}
                  onChange={(e) => setEditingPlan({ ...editingPlan, is_popular: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="is_popular" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Destacar como Mais Popular
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-dark-border space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white">Limites Numéricos</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Usuários</label>
                    <input
                      type="number"
                      value={editingPlan.max_users}
                      onChange={(e) => setEditingPlan({ ...editingPlan, max_users: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Imóveis</label>
                    <input
                      type="number"
                      value={editingPlan.max_properties}
                      onChange={(e) => setEditingPlan({ ...editingPlan, max_properties: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Máx. Locações Ativas</label>
                    <input
                      type="number"
                      value={editingPlan.max_contracts}
                      onChange={(e) => setEditingPlan({ ...editingPlan, max_contracts: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Fotos</label>
                    <input
                      type="number"
                      value={editingPlan.max_photos}
                      onChange={(e) => setEditingPlan({ ...editingPlan, max_photos: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white">Limites de Texto</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Limite IA</label>
                    <input
                      value={editingPlan.ia_limit}
                      onChange={(e) => setEditingPlan({ ...editingPlan, ia_limit: e.target.value })}
                      placeholder="Ex: 50/dia"
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Acesso Aura</label>
                    <input
                      value={editingPlan.aura_access}
                      onChange={(e) => setEditingPlan({ ...editingPlan, aura_access: e.target.value })}
                      placeholder="Ex: Liberada"
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nível de Suporte</label>
                    <input
                      value={editingPlan.support_level}
                      onChange={(e) => setEditingPlan({ ...editingPlan, support_level: e.target.value })}
                      placeholder="Ex: Prioritário"
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white">Módulos do CRM</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {moduleLabels.map((module) => (
                    <label
                      key={module.key}
                      className="flex items-center justify-between bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{module.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan[module.key])}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            [module.key]: e.target.checked
                          })
                        }
                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white">Benefícios</h4>
                <label className="flex items-center justify-between bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Domínio Grátis no Anual</span>
                  <input
                    type="checkbox"
                    checked={editingPlan.has_free_domain}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        has_free_domain: e.target.checked
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-dark-border">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Funcionalidades</label>
                <div className="space-y-2">
                  {editingPlan.features?.map((feature, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        value={feature}
                        onChange={(e) => {
                          const newFeats = [...editingPlan.features];
                          newFeats[idx] = e.target.value;
                          setEditingPlan({ ...editingPlan, features: newFeats });
                        }}
                        className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                      />
                      <button
                        onClick={() => {
                          const newFeats = editingPlan.features.filter((_, i) => i !== idx);
                          setEditingPlan({ ...editingPlan, features: newFeats });
                        }}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <Icons.Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setEditingPlan({ ...editingPlan, features: [...(editingPlan.features || []), ""] })}
                    className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-dark-border rounded-xl text-sm font-bold text-slate-500 hover:text-brand-600 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex items-center justify-center gap-2 mt-2"
                  >
                    <Icons.Plus size={16} />
                    Adicionar Item
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-dark-border flex gap-3 bg-slate-50 dark:bg-slate-900/20">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-500/20"
              >
                <Icons.Save size={18} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
