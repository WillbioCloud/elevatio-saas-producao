import React, { useEffect, useState } from "react";
import { Icons } from "../../components/Icons";
import { supabase } from '../../lib/supabase';

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
  icon: "star",
  is_popular: false,
  features: []
};

export default function SaasPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const renderPlanIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'rocket':
        return <Icons.Rocket size={28} className="text-brand-500" />;
      case 'star':
        return <Icons.Star size={28} className="text-brand-500" />;
      case 'crown':
        return <Icons.Crown size={28} className="text-brand-500" />;
      case 'building':
        return <Icons.Building2 size={28} className="text-brand-500" />;
      case 'zap':
        return <Icons.Zap size={28} className="text-brand-500" />;
      case 'shield':
        return <Icons.Shield size={28} className="text-brand-500" />;
      default:
        return <Icons.Package size={28} className="text-brand-500" />;
    }
  };

  const fetchPlans = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("saas_plans")
      .select("id, name, price, description, icon, is_popular, features")
      .order("price", { ascending: true });

    if (!error && data) {
      setPlans(data as Plan[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEdit = (plan: Plan) => {
    setEditingPlan({ ...plan, features: plan.features || [] });
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
      is_popular: editingPlan.is_popular,
      features: editingPlan.features
    };

    if (!editingPlan.id) {
      await supabase.from("saas_plans").insert([payload]);
    } else {
      await supabase.from("saas_plans").update(payload).eq("id", editingPlan.id);
    }

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
                plan.is_popular ? 'border-brand-500 ring-1 ring-brand-500/50' : 'border-slate-200 dark:border-dark-border'
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
                  <div className="p-2.5 bg-brand-50 dark:bg-brand-900/20 rounded-xl">
                    {renderPlanIcon(plan.icon)}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
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

              <p className="text-sm text-slate-500 dark:text-slate-400 min-h-[40px] mb-4">
                {plan.description}
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  R$ {plan.price.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/mês</span>
              </div>

              <div className="space-y-3 flex-1 border-t border-slate-100 dark:border-dark-border pt-4">
                {plan.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Icons.CheckCircle2 size={18} className="text-brand-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDITOR MODAL LADO DIREITO */}
      {isEditing && editingPlan && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-dark-card h-full border-l border-slate-200 dark:border-dark-border shadow-2xl flex flex-col animate-slide-left">
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

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome do Plano</label>
                <input
                  value={editingPlan.name}
                  onChange={e => setEditingPlan({...editingPlan, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Preço (R$)</label>
                <input
                  type="number"
                  value={editingPlan.price}
                  onChange={e => setEditingPlan({...editingPlan, price: Number(e.target.value)})}
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Descrição Curta</label>
                <textarea
                  value={editingPlan.description}
                  onChange={e => setEditingPlan({...editingPlan, description: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none h-20"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ícone (Nome)</label>
                  <input
                    value={editingPlan.icon}
                    onChange={e => setEditingPlan({...editingPlan, icon: e.target.value})}
                    placeholder="Ex: rocket, star, crown"
                    className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 mt-7">
                  <input
                    type="checkbox"
                    id="is_popular"
                    checked={editingPlan.is_popular}
                    onChange={e => setEditingPlan({...editingPlan, is_popular: e.target.checked})}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <label htmlFor="is_popular" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Destaque</label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-dark-border">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Funcionalidades</label>
                <div className="space-y-2">
                  {editingPlan.features?.map((feat, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        value={feat.text}
                        onChange={e => {
                          const newFeats = [...editingPlan.features];
                          newFeats[idx].text = e.target.value;
                          setEditingPlan({...editingPlan, features: newFeats});
                        }}
                        className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                      />
                      <button
                        onClick={() => {
                          const newFeats = editingPlan.features.filter((_, i) => i !== idx);
                          setEditingPlan({...editingPlan, features: newFeats});
                        }}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <Icons.Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setEditingPlan({...editingPlan, features: [...(editingPlan.features || []), { text: '' }]})}
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
