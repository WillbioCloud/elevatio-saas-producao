import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icons } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useProperties } from '../hooks/useProperties';
import type { FinanceConfig, SiteData } from '../types';

type OnboardingTask = {
  id: string;
  title: string;
  href?: string;
  actionLabel?: string;
  locked?: boolean;
};

type OnboardingCompanyData = {
  subdomain?: string | null;
  domain?: string | null;
  domain_secondary?: string | null;
  logo_url?: string | null;
  admin_signature_url?: string | null;
  site_data?: SiteData | string | null;
  finance_config?: FinanceConfig | string | null;
  use_asaas?: boolean | null;
  payment_api_key?: string | null;
};

const DEFAULT_COMPLETED_TASK_IDS = ['create-company'];

const ONBOARDING_TASKS: OnboardingTask[] = [
  {
    id: 'create-company',
    title: 'Criar a Imobiliária',
    locked: true,
  },
  {
    id: 'custom-domain',
    title: 'Configurar o Domínio Personalizado',
    locked: true,
  },
  {
    id: 'first-property',
    title: 'Criar o primeiro imóvel',
    href: '/admin/imoveis/novo',
    actionLabel: 'Criar',
  },
  {
    id: 'site-showcase',
    title: 'Configurar a Vitrine/Site',
    href: '/admin/config?tab=site',
    actionLabel: 'Abrir site',
  },
  {
    id: 'company-branding',
    title: 'Configurar a Empresa: Logo e Assinatura',
    href: '/admin/config?tab=company',
    actionLabel: 'Editar',
  },
  {
    id: 'invite-broker',
    title: 'Convidar um Corretor',
    href: '/admin/config?tab=team',
    actionLabel: 'Equipe',
  },
  {
    id: 'traffic-routing',
    title: 'Configurar o Tráfego e Distribuição de Leads',
    href: '/admin/config?tab=traffic',
    actionLabel: 'Tráfego',
  },
  {
    id: 'pix-receivables',
    title: 'Configurar Chave PIX e Recebimentos',
    href: '/admin/config?tab=finance',
    actionLabel: 'Financeiro',
  },
];

const normalizeCompletedTaskIds = (ids: string[]) => {
  const allowedIds = new Set(ONBOARDING_TASKS.map((task) => task.id));
  const nextIds = new Set(DEFAULT_COMPLETED_TASK_IDS);

  ids.forEach((id) => {
    if (allowedIds.has(id)) nextIds.add(id);
  });

  return Array.from(nextIds);
};

const readCompletedTaskIds = (storageKey: string) => {
  if (typeof window === 'undefined') return DEFAULT_COMPLETED_TASK_IDS;

  try {
    const saved = window.localStorage.getItem(storageKey);
    const parsed = saved ? JSON.parse(saved) : [];

    if (Array.isArray(parsed)) {
      return normalizeCompletedTaskIds(parsed.filter((id): id is string => typeof id === 'string'));
    }
  } catch (error) {
    console.warn('Checklist de onboarding inválido. Reiniciando progresso local.', error);
  }

  return DEFAULT_COMPLETED_TASK_IDS;
};

const hasTextValue = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

const parseObjectValue = <T extends object>(value: unknown): Partial<T> | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Partial<T>) : null;
    } catch {
      return null;
    }
  }

  return typeof value === 'object' && !Array.isArray(value) ? (value as Partial<T>) : null;
};

const areTaskIdsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

const mergeCompletedTaskIds = (currentIds: string[], idsToAdd: string[]) => {
  const normalizedCurrentIds = normalizeCompletedTaskIds(currentIds);
  const nextIds = normalizeCompletedTaskIds([...normalizedCurrentIds, ...idsToAdd]);

  return areTaskIdsEqual(normalizedCurrentIds, nextIds) ? currentIds : nextIds;
};

const getAutoDetectedTaskIds = (propertiesCount: number, company?: OnboardingCompanyData | null) => {
  const detectedIds = new Set<string>();

  if (propertiesCount > 0) {
    detectedIds.add('first-property');
  }

  if (!company) return Array.from(detectedIds);

  const siteData = parseObjectValue<SiteData>(company.site_data);
  const siteContact = parseObjectValue<NonNullable<SiteData['contact']>>(siteData?.contact);
  const financeConfig = parseObjectValue<FinanceConfig>(company.finance_config);

  if ([company.domain, company.domain_secondary, company.subdomain].some(hasTextValue)) {
    detectedIds.add('custom-domain');
  }

  if (
    [
      siteData?.hero_title,
      siteData?.hero_subtitle,
      siteData?.hero_image_url,
      siteData?.about_image_url,
      siteData?.about_text,
      siteData?.contact_email,
      siteData?.contact_phone,
      siteContact?.email,
      siteContact?.phone,
    ].some(hasTextValue)
  ) {
    detectedIds.add('site-showcase');
  }

  if ((hasTextValue(company.logo_url) || hasTextValue(siteData?.logo_url)) && hasTextValue(company.admin_signature_url)) {
    detectedIds.add('company-branding');
  }

  if (hasTextValue(financeConfig?.pix_key) || (company.use_asaas === true && hasTextValue(company.payment_api_key))) {
    detectedIds.add('pix-receivables');
  }

  return Array.from(detectedIds);
};

const OnboardingChecklist: React.FC = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const company = user?.company;
  const storageKey = useMemo(
    () => `elevatio_onboarding_checklist_${user?.company_id || user?.id || 'guest'}`,
    [user?.company_id, user?.id],
  );
  const expandedStorageKey = `${storageKey}_expanded`;

  const [completedIds, setCompletedIds] = useState<string[]>(DEFAULT_COMPLETED_TASK_IDS);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    setCompletedIds(readCompletedTaskIds(storageKey));

    try {
      const savedExpanded = window.localStorage.getItem(expandedStorageKey);
      setIsExpanded(savedExpanded === null ? true : savedExpanded === 'true');
    } catch {
      setIsExpanded(true);
    }

    setHydratedKey(storageKey);
  }, [expandedStorageKey, storageKey]);

  useEffect(() => {
    if (hydratedKey !== storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(completedIds));
  }, [completedIds, hydratedKey, storageKey]);

  const autoDetectedTaskIds = useMemo(
    () => getAutoDetectedTaskIds(properties.length, company),
    [company, properties.length],
  );

  useEffect(() => {
    if (hydratedKey !== storageKey || autoDetectedTaskIds.length === 0) return;
    if (autoDetectedTaskIds.every((id) => completedIds.includes(id))) return;

    setCompletedIds((currentIds) => mergeCompletedTaskIds(currentIds, autoDetectedTaskIds));
  }, [autoDetectedTaskIds, completedIds, hydratedKey, storageKey]);

  useEffect(() => {
    if (hydratedKey !== storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(expandedStorageKey, String(isExpanded));
  }, [expandedStorageKey, hydratedKey, isExpanded, storageKey]);

  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const completedCount = ONBOARDING_TASKS.filter((task) => completedSet.has(task.id)).length;
  const progress = Math.round((completedCount / ONBOARDING_TASKS.length) * 100);
  const isExpert = completedCount === ONBOARDING_TASKS.length;

  const toggleTask = (task: OnboardingTask) => {
    if (task.locked || autoDetectedTaskIds.includes(task.id)) return;

    setCompletedIds((currentIds) => {
      const normalizedCurrentIds = normalizeCompletedTaskIds(currentIds);
      const isAlreadyCompleted = normalizedCurrentIds.includes(task.id);
      const nextIds = isAlreadyCompleted
        ? normalizedCurrentIds.filter((id) => id !== task.id)
        : [...normalizedCurrentIds, task.id];

      return normalizeCompletedTaskIds(nextIds);
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_16px_45px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0f1c]/90">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="w-full px-5 py-4 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03]"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20">
              {isExpert ? <Icons.Award size={22} /> : <Icons.CheckSquare size={22} />}
            </div>
            <div className="min-w-0">
              {isExpanded && (
                <p className="text-xs font-black uppercase tracking-widest text-brand-600 dark:text-brand-300">
                  Primeiros passos
                </p>
              )}
              <h2 className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {isExpert ? 'Parabéns, você é um Expert!' : `Progresso: ${completedCount}/${ONBOARDING_TASKS.length} Concluídos`}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-40 max-w-[48vw]">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-brand-500 to-sky-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="w-10 text-right text-sm font-black text-slate-700 dark:text-slate-200">{progress}%</span>
            <Icons.ChevronDown
              size={18}
              className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-5 pb-5 pt-2 dark:border-white/10">
              <ul className="divide-y divide-slate-100 dark:divide-white/10">
                {ONBOARDING_TASKS.map((task) => {
                  const isCompleted = completedSet.has(task.id);
                  const isAutoDetected = autoDetectedTaskIds.includes(task.id);
                  const isCheckboxDisabled = task.locked || isAutoDetected;
                  const inputId = `onboarding-task-${task.id}`;

                  return (
                    <li key={task.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <label
                        htmlFor={inputId}
                        className={`flex min-w-0 flex-1 items-center gap-3 ${
                          isCheckboxDisabled ? 'cursor-default' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={isCompleted}
                          disabled={isCheckboxDisabled}
                          onChange={() => toggleTask(task)}
                          className="sr-only"
                        />
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                            isCompleted
                              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                              : 'border-slate-300 bg-white text-transparent hover:border-brand-400 dark:border-slate-600 dark:bg-slate-900'
                          }`}
                        >
                          <Icons.Check size={14} strokeWidth={3} />
                        </span>
                        <span
                          className={`truncate text-sm font-bold ${
                            isCompleted ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                        </span>
                      </label>

                      {isCompleted ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <Icons.CheckCircle2 size={13} />
                          Concluído
                        </span>
                      ) : task.href ? (
                        <Link
                          to={task.href}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/30 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
                        >
                          {task.actionLabel || 'Abrir'}
                          <Icons.ArrowRight size={13} />
                        </Link>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          <Icons.Lock size={13} />
                          Automático
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {isExpert && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  Parabéns, você é um Expert!
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default OnboardingChecklist;
