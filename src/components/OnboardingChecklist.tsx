import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icons } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { supabase } from '../lib/supabase';

type OnboardingTask = {
  id: string;
  title: string;
  href?: string;
  actionLabel?: string;
  locked?: boolean;
  isAuto?: boolean;
};

const ONBOARDING_TASKS: OnboardingTask[] = [
  { id: 'create-company', title: 'Criar a Imobiliária', locked: true, isAuto: true },
  { id: 'custom-domain', title: 'Configurar o Domínio Personalizado', locked: true, isAuto: true },
  { id: 'first-property', title: 'Criar o primeiro imóvel', href: '/admin/imoveis/novo', actionLabel: 'Criar' },
  { id: 'site-showcase', title: 'Configurar a Vitrine/Site', href: '/admin/config?tab=site', actionLabel: 'Abrir site' },
  { id: 'company-branding', title: 'Configurar a Empresa: Logo', href: '/admin/config?tab=company', actionLabel: 'Editar' },
  { id: 'invite-broker', title: 'Convidar um Corretor', href: '/admin/config?tab=team', actionLabel: 'Equipe' },
  { id: 'traffic-routing', title: 'Configurar Distribuição de Leads', href: '/admin/config?tab=traffic', actionLabel: 'Tráfego' },
  { id: 'pix-receivables', title: 'Configurar Chave PIX', href: '/admin/config?tab=finance', actionLabel: 'Financeiro' },
];

const OnboardingChecklist: React.FC = () => {
  const { user } = useAuth();
  const { state, toggleChecklistTask } = useOnboarding();
  const [isExpanded, setIsExpanded] = useState(true);
  const [stats, setStats] = useState({ properties: 0, team: 0 });

  useEffect(() => {
    if (!user?.company_id) return;
    Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('company_id', user.company_id),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', user.company_id)
    ]).then(([propsRes, teamRes]) => {
      setStats({
        properties: propsRes.count || 0,
        team: teamRes.count || 0
      });
    });
  }, [user?.company_id]);

  // Auto-detecção blindada lendo os dados reais da empresa
  const autoCompletedTasks = new Set(['create-company']);

  if (user?.company?.domain || user?.company?.subdomain) autoCompletedTasks.add('custom-domain');
  if (user?.company?.logo_url) autoCompletedTasks.add('company-branding');
  if (stats.properties > 0) autoCompletedTasks.add('first-property');
  if (stats.team > 1) autoCompletedTasks.add('invite-broker'); // Mais de 1 significa que convidou alguém

  // Tratamento seguro do JSON do finance_config
  let hasPix = false;
  if (user?.company?.finance_config) {
    try {
      const financeCfg = typeof user.company.finance_config === 'string'
        ? JSON.parse(user.company.finance_config)
        : user.company.finance_config;
      if (financeCfg?.pix_key) hasPix = true;
    } catch (e) {}
  }
  if (hasPix) autoCompletedTasks.add('pix-receivables');

  const completedCount = ONBOARDING_TASKS.filter(t => state.checklist.includes(t.id) || autoCompletedTasks.has(t.id)).length;
  const progress = Math.round((completedCount / ONBOARDING_TASKS.length) * 100);
  const isExpert = completedCount === ONBOARDING_TASKS.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_16px_45px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0f1c]/90">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03]"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20">
              {isExpert ? <Icons.Award size={22} /> : <Icons.CheckSquare size={22} />}
            </div>
            <div className="min-w-0">
              {isExpanded && <p className="text-xs font-black uppercase tracking-widest text-brand-600 dark:text-brand-300">Primeiros passos</p>}
              <h2 className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {isExpert ? 'Parabéns, você é um Expert!' : `Progresso: ${completedCount}/${ONBOARDING_TASKS.length} Concluídos`}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-40 max-w-[48vw]">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-brand-500 to-sky-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <span className="w-10 text-right text-sm font-black text-slate-700 dark:text-slate-200">{progress}%</span>
            <Icons.ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-slate-100 px-5 pb-5 pt-2 dark:border-white/10">
              <ul className="divide-y divide-slate-100 dark:divide-white/10">
                {ONBOARDING_TASKS.map((task) => {
                  const isCompleted = state.checklist.includes(task.id) || autoCompletedTasks.has(task.id);
                  const isDisabled = task.locked || task.isAuto || autoCompletedTasks.has(task.id);

                  return (
                    <li key={task.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className={`flex min-w-0 flex-1 items-center gap-3 ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          disabled={isDisabled}
                          onChange={() => !isDisabled && toggleChecklistTask(task.id)}
                          className="sr-only"
                        />
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                          <Icons.Check size={14} strokeWidth={3} />
                        </span>
                        <span className={`truncate text-sm font-bold ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                          {task.title}
                        </span>
                      </label>

                      {task.href ? (
                        <Link to={task.href} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-brand-50">
                          {task.actionLabel || 'Abrir'} <Icons.ArrowRight size={13} />
                        </Link>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                          <Icons.CheckCircle2 size={13} /> Concluído
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">
                          <Icons.Lock size={13} /> Automático
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default OnboardingChecklist;
