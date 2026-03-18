import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, CheckCircle, Globe, Loader2, Palette } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { PlanType } from '../config/plans';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';

type SetupWizardModalProps = {
  onComplete: () => void;
};

const normalizePlanFromNav = (value: unknown): PlanType | undefined => {
  if (typeof value !== 'string') return undefined;

  const v = value.trim().toLowerCase();
  if (!v) return undefined;

  // Compatibilidade com slugs antigos/inglês vindos da Landing Page
  if (v === 'professional' || v === 'profissional') return 'profissional';

  if (v === 'free') return 'free';
  if (v === 'starter') return 'starter';
  if (v === 'basic') return 'basic';
  if (v === 'business') return 'business';
  if (v === 'premium') return 'premium';
  if (v === 'elite') return 'elite';

  return undefined;
};

export default function SetupWizardModal({ onComplete }: SetupWizardModalProps) {
  const { user } = useAuth();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Normaliza o nome do plano para evitar falhas na busca do banco de dados (ex: professional -> profissional)
  const initialPlanRaw = location.state?.plan || localStorage.getItem('trimoveis_selected_plan') || localStorage.getItem('elevatio_selected_plan') || 'profissional';
  const initialPlan = normalizePlanFromNav(initialPlanRaw) || 'profissional';
  
  const [formData, setFormData] = useState({
    companyName: '',
    document: '',
    phone: '',
    domain: '',
    hasDomain: 'nao',
    template: 'minimalist', // Default para o template minimalista
    plan: initialPlan,
    billingCycle: location.state?.cycle || localStorage.getItem('trimoveis_billing_cycle') || 'monthly'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Validações manuais antes de qualquer chamada ao Supabase
      if (!formData.companyName.trim()) {
        throw new Error('Por favor, preencha o nome da imobiliária.');
      }
      if (!formData.document.trim()) {
        throw new Error('Por favor, preencha o CPF ou CNPJ para emissão da fatura.');
      }
      if (!formData.phone.trim()) {
        throw new Error('Por favor, preencha o telefone de contato.');
      }
      if (!formData.domain.trim()) {
        throw new Error('Por favor, preencha o endereço do site.');
      }

      if (!user?.id) throw new Error('Sessão inválida. Faça login novamente.');

      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 7);

      const slug = formData.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([{
          name: formData.companyName,
          subdomain: slug,
          document: formData.document,
          phone: formData.phone,
          template: formData.template, // Agora lê o template escolhido nos radio buttons
          plan_status: 'trial',
          plan: formData.plan,
          trial_ends_at: trialEnds.toISOString(),
        }])
        .select()
        .single();

      if (companyError) throw new Error('Erro ao criar imobiliária: ' + companyError.message);

      if (newCompany) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            company_id: newCompany.id,
            role: 'admin',
            active: true,
            phone: formData.phone,
          })
          .eq('id', user.id);

        if (profileError) throw new Error('Erro ao vincular perfil: ' + profileError.message);

        // Criar contrato de SaaS (obrigatório para liberar fluxo de assinatura/trial)
        const nowIso = new Date().toISOString();
        const { error: contractError } = await supabase.from('saas_contracts').insert([{
          company_id: newCompany.id,
          plan_id: null, // Ignoramos a tabela saas_plans, usamos o config local
          plan_name: formData.plan, // Nome oficial do plano (ex: 'profissional', 'elite')
          status: 'pending', // Status vital para liberar o trial via Front-end
          start_date: nowIso,
          end_date: trialEnds.toISOString(),
          billing_cycle: formData.billingCycle
        }]);

        if (contractError) {
          throw new Error('Erro ao criar contrato inicial: ' + contractError.message);
        }

        // Fire-and-Forget: Chama a Edge Function do Asaas sem bloquear a UI
        supabase.functions.invoke('create-asaas-checkout', {
          body: { company_id: newCompany.id, plan: formData.plan, cycle: formData.billingCycle }
        }).catch((e) => {
          console.error('Falha ao chamar webhook Asaas (Fire-and-Forget):', e);
        });
      }

      // Limpar o cache do navegador após sucesso
      localStorage.removeItem('trimoveis_selected_plan');
      localStorage.removeItem('elevatio_selected_plan');
      localStorage.removeItem('trimoveis_billing_cycle'); // CORREÇÃO DO BUG ANUAL

      onComplete();

      // Força o recarregamento total da aplicação para o SessionManager 
      // ler a nova empresa (trial) e o novo contrato (pending) direto do banco!
      window.location.href = '/admin/dashboard';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao configurar a sua conta.';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/10 bg-[#111]">
          <h2 className="text-2xl font-bold text-white">Bem-vindo ao Elevatio Vendas! 🎉</h2>
          <p className="text-gray-400 mt-1 text-sm">Faltam apenas alguns detalhes para liberar o seu CRM com 7 dias grátis.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-brand-400 font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5" /> Dados da Imobiliária
                </h3>
                <div className="mb-4 flex bg-[#1a1a1a] p-1 rounded-xl w-fit border border-white/10">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, billingCycle: 'monthly'})}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      formData.billingCycle === 'monthly' 
                        ? 'bg-white text-slate-900' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, billingCycle: 'yearly'})}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                      formData.billingCycle === 'yearly' 
                        ? 'bg-brand-600 text-white' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Anual
                    <span className="bg-brand-500/30 text-brand-200 text-[10px] px-1.5 py-0.5 rounded-md border border-brand-400/20">-20%</span>
                  </button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-400 mb-1">Confirme seu Plano</label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-brand-500"
                  >
                    <option value="starter">Starter</option>
                    <option value="basic">Basic</option>
                    <option value="profissional">Profissional</option>
                    <option value="business">Business</option>
                    <option value="premium">Premium</option>
                    <option value="elite">Elite</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nome da Imobiliária</label>
                    <input
                      required
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-brand-500"
                      placeholder="Nome da Sua Imobiliária"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">CPF ou CNPJ (Para a fatura)</label>
                    <input
                      required
                      type="text"
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-brand-500"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Telefone (WhatsApp)</label>
                    <input
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-brand-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>
              <hr className="border-white/5" />
              <div className="space-y-4">
                <h3 className="text-brand-400 font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5" /> Endereço do Site
                </h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Você já possui um domínio registrado?</label>
                  <select
                    value={formData.hasDomain}
                    onChange={(e) => setFormData({ ...formData, hasDomain: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-brand-500 mb-3"
                  >
                    <option value="nao">Não, quero usar um subdomínio grátis do Elevatio</option>
                    <option value="sim">Sim, já tenho o meu próprio domínio</option>
                  </select>
                  <input
                    required
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-brand-500"
                    placeholder={formData.hasDomain === 'sim' ? 'Ex: minhacorretora.com.br' : 'Ex: minhacorretora'}
                  />
                </div>
              </div>
              <hr className="border-white/5" />
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-500 flex items-center justify-center text-sm">3</span>
                  Visual do Site
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label
                    className={`cursor-pointer border rounded-xl p-4 transition-all relative overflow-hidden ${
                      formData.template === 'minimalist'
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-white/10 bg-[#1a1a1a] hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      className="hidden"
                      value="minimalist"
                      checked={formData.template === 'minimalist'}
                      onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                    />
                    <div className="font-bold text-white mb-1">Minimalista</div>
                    <p className="text-xs text-slate-400">Design limpo, claro e focado nos imóveis.</p>
                  </label>
                  <label
                    className={`cursor-pointer border rounded-xl p-4 transition-all relative overflow-hidden ${
                      formData.template === 'luxury'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-white/10 bg-[#1a1a1a] hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      className="hidden"
                      value="luxury"
                      checked={formData.template === 'luxury'}
                      onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                    />
                    <div className="font-bold text-amber-400 mb-1 flex items-center gap-1">
                      Luxo <Icons.Crown size={14} />
                    </div>
                    <p className="text-xs text-slate-400">Tons escuros e elegantes para alto padrão.</p>
                  </label>
                  <label
                    className={`cursor-pointer border rounded-xl p-4 transition-all relative overflow-hidden ${
                      formData.template === 'modern'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-[#1a1a1a] hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      className="hidden"
                      value="modern"
                      checked={formData.template === 'modern'}
                      onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                    />
                    <div className="font-bold text-blue-400 mb-1 flex items-center gap-1">
                      Moderno <Icons.Zap size={14} />
                    </div>
                    <p className="text-xs text-slate-400">Layout arrojado, cantos arredondados e cores vivas.</p>
                  </label>
                  <label
                    className={`cursor-pointer border rounded-xl p-4 transition-all relative overflow-hidden ${
                      formData.template === 'custom'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/10 bg-[#1a1a1a] hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      className="hidden"
                      value="custom"
                      checked={formData.template === 'custom'}
                      onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                    />
                    <div className="font-bold text-purple-400 mb-1 flex items-center gap-1">
                      Sob Medida <Icons.Code size={14} />
                    </div>
                    <p className="text-xs text-slate-400">Design exclusivo feito pela nossa equipe.</p>
                  </label>
                </div>
              </div>
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">{errorMsg}</div>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-white/10 bg-[#111] flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Configurando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" /> Concluir e Acessar CRM
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
