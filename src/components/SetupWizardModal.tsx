import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, CheckCircle, Globe, Loader2, Palette } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { PlanType } from '../config/plans';
import { supabase } from '../lib/supabase';

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
  const planFromNav = normalizePlanFromNav((location.state as { plan?: unknown } | null)?.plan);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    companyName: '',
    document: '',
    phone: '',
    domain: '',
    hasDomain: 'nao',
    template: 'professional',
    plan: planFromNav ?? 'profissional',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
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

        // Criar contrato de teste para exibir a barra de Trial no Dashboard
        try {
          // Buscar o ID do plano na tabela saas_plans
          const { data: planData } = await supabase
            .from('saas_plans')
            .select('id')
            .ilike('name', formData.plan)
            .single();

          await supabase.from('saas_contracts').insert([{
            company_id: newCompany.id,
            plan_id: planData?.id,
            status: 'pending',
            start_date: new Date().toISOString(),
            end_date: trialEnds.toISOString(),
          }]);
        } catch (contractError) {
          console.warn('Aviso: Falha ao criar contrato de teste.', contractError);
        }
      }

      try {
        await supabase.functions.invoke('create-asaas-checkout', {
          body: { company_id: newCompany.id, plan: formData.plan },
        });
      } catch (asaasError) {
        console.warn('Aviso: Falha ao integrar Asaas. Empresa criada.', asaasError);
      }

      onComplete();
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
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="setup-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-brand-400 font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Dados da Imobiliária
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nome da Imobiliária</label>
                  <input
                    required
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-brand-500"
                    placeholder="Ex: TR Imóveis"
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
              <h3 className="text-brand-400 font-bold flex items-center gap-2">
                <Palette className="w-5 h-5" /> Visual do Site
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`cursor-pointer border rounded-xl p-4 transition-all ${
                    formData.template === 'minimalista'
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 bg-[#1a1a1a] hover:border-white/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    className="hidden"
                    value="minimalista"
                    onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  />
                  <div className="font-bold text-white mb-1">Minimalista</div>
                </label>
                <label
                  className={`cursor-pointer border rounded-xl p-4 transition-all ${
                    formData.template === 'luxo'
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 bg-[#1a1a1a] hover:border-white/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    className="hidden"
                    value="luxo"
                    onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  />
                  <div className="font-bold text-yellow-400 mb-1">Padrão Luxo</div>
                </label>
              </div>
            </div>
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">{errorMsg}</div>
            )}
          </form>
        </div>
        <div className="p-6 border-t border-white/10 bg-[#111] flex justify-end">
          <button
            type="submit"
            form="setup-form"
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
      </div>
    </div>
  );
}