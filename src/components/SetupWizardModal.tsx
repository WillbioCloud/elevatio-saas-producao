import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, CheckCircle, Globe, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { PlanType } from '../config/plans';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';

type SetupWizardModalProps = {
  onComplete: () => void;
};

type DomainMode = 'novo' | 'sim';
type DomainStatus = 'idle' | 'loading' | 'available' | 'taken' | 'error';
type SaasTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'construction' | 'exclusive';
  exclusive_company_id: string | null;
};

const normalizePlanFromNav = (value: unknown): PlanType | undefined => {
  if (typeof value !== 'string') return undefined;

  const v = value.trim().toLowerCase();
  if (!v) return undefined;

  // Compatibilidade com slugs antigos/ingles vindos da Landing Page
  if (v === 'professional' || v === 'profissional') return 'profissional';

  if (v === 'free') return 'free';
  if (v === 'starter') return 'starter';
  if (v === 'basic') return 'basic';
  if (v === 'business') return 'business';
  if (v === 'premium') return 'premium';
  if (v === 'elite') return 'elite';

  return undefined;
};

const sanitizeNewDomainLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const sanitizeExistingDomain = (value: string) =>
  value
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/+$/, '')
    .trim();

export default function SetupWizardModal({ onComplete }: SetupWizardModalProps) {
  const { user } = useAuth();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dbTemplates, setDbTemplates] = useState<SaasTemplate[]>([]);

  // Normaliza o nome do plano para evitar falhas na busca do banco de dados
  const initialPlanRaw =
    location.state?.plan ||
    localStorage.getItem('trimoveis_selected_plan') ||
    localStorage.getItem('elevatio_selected_plan') ||
    localStorage.getItem('selectedPlan') ||
    'profissional';
  const initialPlan = normalizePlanFromNav(initialPlanRaw) || 'profissional';
  const initialCompanyName =
    location.state?.companyName ||
    localStorage.getItem('trimoveis_company_name') ||
    localStorage.getItem('elevatio_company_name') ||
    '';

  const [formData, setFormData] = useState<{
    companyName: string;
    document: string;
    phone: string;
    domain: string;
    hasDomain: DomainMode;
    template: string;
    plan: PlanType;
    billingCycle: string;
  }>({
    companyName: initialCompanyName,
    document: '',
    phone: '',
    domain: '',
    hasDomain: 'novo',
    template: 'minimalist',
    plan: initialPlan,
    billingCycle:
      location.state?.cycle ||
      localStorage.getItem('trimoveis_billing_cycle') ||
      'monthly',
  });
  const [domainExtension, setDomainExtension] = useState('.com.br');
  const [domainStatus, setDomainStatus] = useState<DomainStatus>('idle');

  useEffect(() => {
    const fetchWizardTemplates = async () => {
      const { data } = await supabase
        .from('saas_templates')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        setDbTemplates(data as SaasTemplate[]);
        setFormData((prev) => ({ ...prev, template: data[0].slug }));
      }
    };

    fetchWizardTemplates();
  }, []);

  const getTemplateStyle = (slug: string) => {
    switch (slug) {
      case 'basico':
        return { icon: Icons.LayoutTemplate, color: 'text-slate-600', bg: 'bg-slate-100' };
      case 'modern':
        return { icon: Icons.Sparkles, color: 'text-brand-600', bg: 'bg-brand-100' };
      case 'luxury':
        return { icon: Icons.Gem, color: 'text-purple-600', bg: 'bg-purple-100' };
      default:
        return { icon: Icons.LayoutTemplate, color: 'text-brand-600', bg: 'bg-brand-100' };
    }
  };

  const sanitizedProductionDomain = sanitizeNewDomainLabel(formData.domain) || 'minhacorretora';
  const normalizedExistingDomain = sanitizeExistingDomain(formData.domain);
  const selectedProductionDomain =
    formData.hasDomain === 'novo'
      ? `${sanitizedProductionDomain}${domainExtension}`
      : normalizedExistingDomain;
  const shouldBlockNewDomainSubmit =
    formData.hasDomain === 'novo' && domainStatus !== 'available';

  useEffect(() => {
    setDomainStatus('idle');
  }, [formData.domain, formData.hasDomain, domainExtension]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Validacoes manuais antes de qualquer chamada ao Supabase
      if (!formData.companyName.trim()) {
        throw new Error('Por favor, preencha o nome da imobiliaria.');
      }
      if (!formData.document.trim()) {
        throw new Error('Por favor, preencha o CPF ou CNPJ para emissao da fatura.');
      }
      if (!formData.phone.trim()) {
        throw new Error('Por favor, preencha o telefone de contato.');
      }
      if (!formData.domain.trim()) {
        throw new Error('Por favor, preencha o endereco do site.');
      }
      if (formData.hasDomain === 'novo' && !sanitizeNewDomainLabel(formData.domain)) {
        throw new Error('Digite um dominio valido para continuar.');
      }
      if (formData.hasDomain === 'sim' && !normalizedExistingDomain) {
        throw new Error('Informe o dominio completo para continuar.');
      }
      if (formData.hasDomain === 'novo' && domainStatus === 'taken') {
        throw new Error('Esse dominio ja esta em uso. Escolha outra opcao antes de concluir.');
      }
      if (formData.hasDomain === 'novo' && domainStatus !== 'available') {
        throw new Error('Verifique a disponibilidade do dominio antes de concluir.');
      }

      if (!user?.id) throw new Error('Sessao invalida. Faca login novamente.');

      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 7);

      const slug = formData.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');

      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            name: formData.companyName,
            subdomain: slug,
            document: formData.document,
            phone: formData.phone,
            template: formData.template,
            plan_status: 'trial',
            plan: formData.plan,
            trial_ends_at: trialEnds.toISOString(),
            // SALVANDO O DOMINIO DIRETAMENTE NA CRIACAO (Fim das falhas parciais!)
            domain: selectedProductionDomain,
            domain_type: formData.hasDomain === 'novo' ? 'new' : 'existing',
            domain_status: 'pending',
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (companyError) throw new Error('Erro ao criar imobiliaria: ' + companyError.message);

      if (newCompany) {
        // Vincula o perfil do usuario logado (Admin) a nova imobiliaria
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            company_id: newCompany.id,
            role: 'admin',
            active: true,
            phone: formData.phone,
          })
          .eq('id', user.id);

        if (profileError) {
          // Se der erro ao vincular o perfil, a gente deleta a empresa recem-criada para fazer um "Rollback" manual
          await supabase.from('companies').delete().eq('id', newCompany.id);
          throw new Error('Erro ao vincular perfil de administrador: ' + profileError.message);
        }

        // Busca o UUID real do plano selecionado na nova tabela saas_plans
        const { data: planRecord } = await supabase
          .from('saas_plans')
          .select('id')
          .ilike('name', formData.plan)
          .maybeSingle();

        const { error: contractError } = await supabase.from('saas_contracts').insert([
          {
            company_id: newCompany.id,
            plan_id: planRecord?.id || null,
            plan_name: formData.plan,
            status: 'pending',
            start_date: new Date().toISOString(),
            end_date: trialEnds.toISOString(),
            billing_cycle: formData.billingCycle,
          },
        ]);

        if (contractError) {
          throw new Error('Erro ao criar contrato inicial: ' + contractError.message);
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-asaas-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
              company_id: newCompany.id,
              new_plan: formData.plan,
              billing_cycle: formData.billingCycle,
              has_fidelity: false
            })
          });

          if (!response.ok) {
            console.error("Erro na Edge Function Asaas:", await response.text());
          }
        } catch (asaasError) {
          console.error("Erro ao sincronizar com Asaas no Wizard:", asaasError);
          // Nao travamos o fluxo se o Asaas falhar, o auto-heal da function resolve no futuro
        }
      }

      // Limpar o cache do navegador apos sucesso
      localStorage.removeItem('trimoveis_selected_plan');
      localStorage.removeItem('elevatio_selected_plan');
      localStorage.removeItem('selectedPlan');
      localStorage.removeItem('trimoveis_billing_cycle');
      localStorage.removeItem('trimoveis_company_name');
      localStorage.removeItem('elevatio_company_name');

      onComplete();

      // Forca o recarregamento total da aplicacao para o SessionManager
      // ler a nova empresa e o novo contrato direto do banco
      window.location.href = '/admin/dashboard';
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao configurar a sua conta.';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const isEligibleForFreeDomain =
    formData.billingCycle === 'yearly' &&
    ['profissional', 'business', 'premium', 'elite'].includes(formData.plan.toLowerCase());

  const trialSubdomainPreview =
    formData.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sua-imobiliaria';

  const checkDomainAvailability = async () => {
    const cleanDomain = sanitizeNewDomainLabel(formData.domain);
    if (!cleanDomain) return;
    setDomainStatus('loading');

    try {
      const fullDomain = `${cleanDomain}${domainExtension}`;
      const { data, error } = await supabase.functions.invoke('check-domain', {
        body: { domain: fullDomain }
      });

      if (error) throw error;

      setDomainStatus(data.available ? 'available' : 'taken');
    } catch (error) {
      console.error('Erro ao verificar domínio:', error);
      setDomainStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-slate-900/35 p-4 pt-16 sm:pt-4 overflow-y-auto backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-white via-brand-50/40 to-white p-6">
          <h2 className="text-2xl font-bold text-slate-900">Bem-vindo ao Elevatio Vendas!</h2>
          <p className="mt-1 text-sm text-slate-600">
            Faltam apenas alguns detalhes para liberar o seu CRM com 7 dias gratis.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-bold text-brand-700">
                  <Building2 className="h-5 w-5" /> Dados da Imobiliaria
                </h3>

                <div className="mb-4 flex w-fit rounded-xl border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billingCycle: 'monthly' })}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                      formData.billingCycle === 'monthly'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billingCycle: 'yearly' })}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                      formData.billingCycle === 'yearly'
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Anual
                    <span className="rounded-md border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                      -15%
                    </span>
                  </button>
                </div>

                <div className="mb-4">
                  <label className="mb-1 block text-sm font-bold text-slate-600">
                    Confirme seu Plano
                  </label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value as PlanType })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                  >
                    <option value="starter">Starter</option>
                    <option value="basic">Basic</option>
                    <option value="profissional">Profissional</option>
                    <option value="business">Business</option>
                    <option value="premium">Premium</option>
                    <option value="elite">Elite</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-600">Nome da Imobiliaria</label>
                    <input
                      required
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                      placeholder="Nome da sua imobiliaria"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-600">
                      CPF ou CNPJ (para a fatura)
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-600">Telefone (WhatsApp)</label>
                    <input
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-200" />

              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-bold text-brand-700">
                  <Globe className="h-5 w-5" /> Endereco do Site
                </h3>

                <div className="space-y-4">
                  <div className="rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
                    <p className="text-sm font-semibold text-brand-900">
                      Ambiente de teste incluso automaticamente
                    </p>
                    <p className="mt-1 text-sm text-brand-700">
                      Um subdominio temporario sera criado para voce comecar rapido:
                      {' '}
                      <span className="font-semibold">{trialSubdomainPreview}.elevatio.com.br</span>
                    </p>
                  </div>

                  <label className="block text-sm text-slate-600">
                    Para o dominio de producao, o que voce precisa?
                  </label>

                  <select
                    value={formData.hasDomain}
                    onChange={(e) => {
                      const nextMode = e.target.value as DomainMode;
                      setFormData({ ...formData, hasDomain: nextMode, domain: '' });
                      setDomainStatus('idle');
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                  >
                    <option value="novo">
                      {isEligibleForFreeDomain
                        ? '🎁 Quero resgatar meu Domínio Grátis (1º Ano)'
                        : '🛒 Comprar e registrar um novo domínio (R$ 40,00/ano)'}
                    </option>
                    <option value="sim">Ja possuo um dominio registrado</option>
                  </select>

                  {formData.hasDomain === 'sim' && (
                    <div className="space-y-2">
                      <input
                        required
                        type="text"
                        value={formData.domain}
                        onChange={(e) => {
                          setFormData({ ...formData, domain: e.target.value });
                          setDomainStatus('idle');
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                        placeholder="Ex: minhacorretora.com.br"
                      />
                      <p className="text-xs text-slate-500">
                        Informe o dominio completo, sem https://
                      </p>
                    </div>
                  )}

                  {formData.hasDomain === 'novo' && (
                    <div className="space-y-3">
                      {isEligibleForFreeDomain && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          Seu plano anual inclui o 1o ano do dominio de producao como cortesia.
                        </div>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          required
                          type="text"
                          value={formData.domain}
                          onChange={(e) => {
                            setFormData({ ...formData, domain: e.target.value });
                            setDomainStatus('idle');
                          }}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                          placeholder="Ex: minhacorretora"
                        />
                        <select
                          value={domainExtension}
                          onChange={(e) => {
                            setDomainExtension(e.target.value);
                            setDomainStatus('idle');
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500"
                        >
                          <option value=".com.br">.com.br</option>
                          <option value=".com">.com</option>
                        </select>
                        <button
                          type="button"
                          onClick={checkDomainAvailability}
                          disabled={!formData.domain.trim() || domainStatus === 'loading'}
                          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {domainStatus === 'loading' && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Verificar
                        </button>
                      </div>

                      <p className="text-xs text-slate-500">
                        Digite apenas o nome desejado sem acentos ou espaços. Vamos consultar a disponibilidade de
                        {' '}
                        <span className="font-semibold text-slate-700">
                          {sanitizedProductionDomain}
                          {domainExtension}
                        </span>
                        .
                      </p>

                      {domainStatus === 'available' && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          Dominio disponivel para registro.
                        </div>
                      )}

                      {domainStatus === 'taken' && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Esse dominio ja esta em uso. Tente outra combinacao.
                        </div>
                      )}

                      {domainStatus === 'error' && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          Nao foi possivel verificar o dominio agora. Tente novamente em instantes.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-slate-200" />

              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm text-brand-700">
                    3
                  </span>
                  Visual do Site
                </h3>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {dbTemplates.map((t) => {
                    const style = getTemplateStyle(t.slug);
                    const Icon = style.icon;

                    return (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => setFormData({ ...formData, template: t.slug })}
                        className={`relative flex flex-col items-center rounded-xl border-2 p-4 text-center transition-all ${
                          formData.template === t.slug
                            ? 'border-brand-600 bg-brand-50 shadow-md'
                            : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50'
                        }`}
                      >
                        {formData.template === t.slug && (
                          <div className="absolute -right-2 -top-2 rounded-full bg-brand-600 p-1 text-white shadow-sm">
                            <CheckCircle className="h-4 w-4" />
                          </div>
                        )}
                        <div className={`mb-3 rounded-full ${style.bg} p-3 ${style.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <h4 className="mb-1 text-sm font-bold text-slate-800">{t.name}</h4>
                        <p className="text-xs text-slate-500">{t.description}</p>
                      </button>
                    );
                  })}
                </div>

                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Trabalhamos somente com templates pre-definidos para garantir velocidade,
                  estabilidade e suporte continuo.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 p-6">
            {shouldBlockNewDomainSubmit ? (
              <p className="text-xs font-medium text-amber-700">
                Verifique a disponibilidade de <span className="font-bold">{selectedProductionDomain}</span> para concluir.
              </p>
            ) : (
              <div />
            )}
            <button
              type="submit"
              disabled={isLoading || shouldBlockNewDomainSubmit}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 font-bold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Configurando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" /> Concluir e Acessar CRM
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
