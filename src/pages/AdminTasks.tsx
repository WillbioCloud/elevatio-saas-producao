import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';
import { runWithSessionRecovery, supabase } from '../lib/supabase';
import { generateCRMInsights } from '../services/ai';
import { getLevelInfo } from '../services/gamification';
import { Task } from '../types';

interface TaskWithLead extends Task {
  leads: { name: string; phone: string } | null;
}

interface SmartInsight {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  actionText: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  return maybe.name === 'AbortError' || maybe.message?.includes('AbortError') === true;
};

const parseDueDate = (value: string) => {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function AdminTasks() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const { notifications, unreadCount } = useNotification();

  const [tasks, setTasks] = useState<TaskWithLead[]>([]);
  const [insights, setInsights] = useState<SmartInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickTask, setQuickTask] = useState({ title: '', due_date: '', lead_id: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [copilotBriefing, setCopilotBriefing] = useState('');
  const [generatingCopilot, setGeneratingCopilot] = useState(false);

  const generateAIInsights = useCallback(async () => {
    if (!user?.company_id) {
      setInsights([]);
      return;
    }

    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
      const overdueCutoff = new Date(now.getTime() - 86_400_000);

      const [coldLeadsResponse, pendingContractsResponse, overdueTasksResponse] = await Promise.all([
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', user.company_id)
          .not('status', 'in', '("Venda Fechada","Perdido","Fechado","Venda Ganha")')
          .lt('updated_at', threeDaysAgo.toISOString()),
        supabase
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', user.company_id)
          .eq('status', 'pending'),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', user.company_id)
          .eq('completed', false)
          .lt('due_date', overdueCutoff.toISOString()),
      ]);

      if (coldLeadsResponse.error) throw coldLeadsResponse.error;
      if (pendingContractsResponse.error) throw pendingContractsResponse.error;
      if (overdueTasksResponse.error) throw overdueTasksResponse.error;

      const coldLeadsCount = coldLeadsResponse.count ?? 0;
      const pendingContractsCount = pendingContractsResponse.count ?? 0;
      const overdueTasksCount = overdueTasksResponse.count ?? 0;
      const nextInsights: SmartInsight[] = [];

      if (coldLeadsCount > 0) {
        nextInsights.push({
          id: 'cold_leads',
          type: 'danger',
          title: 'Leads Esfriando',
          description: `Você tem ${coldLeadsCount} lead(s) sem contato há mais de 3 dias. Eles podem procurar a concorrência.`,
          actionText: 'Ver Leads',
          icon: <Icons.Flame size={20} className="text-red-500" />,
          onClick: () => navigate('/admin/leads'),
        });
      }

      if (pendingContractsCount > 0) {
        nextInsights.push({
          id: 'pending_contracts',
          type: 'warning',
          title: 'Assinaturas Pendentes',
          description: `Existem ${pendingContractsCount} contrato(s) aguardando assinatura dos clientes.`,
          actionText: 'Cobrar Assinaturas',
          icon: <Icons.PenTool size={20} className="text-amber-500" />,
          onClick: () => navigate('/admin/contratos'),
        });
      }

      if (overdueTasksCount > 0) {
        nextInsights.push({
          id: 'overdue_tasks',
          type: 'info',
          title: 'Tarefas Acumuladas',
          description: `Há ${overdueTasksCount} tarefa(s) atrasadas. Organize sua agenda para não perder vendas.`,
          actionText: 'Organizar Agenda',
          icon: <Icons.Clock size={20} className="text-blue-500" />,
          onClick: () => document.getElementById('tasks-board')?.scrollIntoView({ behavior: 'smooth' }),
        });
      }

      setInsights(nextInsights);
    } catch (error: any) {
      if (isAbortError(error)) return;
      console.error('Erro ao gerar insights do CRM Copilot:', error);
      addToast(error?.message || 'Falha ao conectar com a IA do Copilot.', 'error');
    }
  }, [addToast, navigate, user?.company_id]);

  const generateCopilotBriefing = useCallback(async () => {
    if (!user?.id || !user.company_id) {
      setCopilotBriefing('');
      return;
    }

    setGeneratingCopilot(true);

    try {
      let leadsQuery = supabase
        .from('leads')
        .select('id, status')
        .eq('company_id', user.company_id);

      if (!isAdmin) {
        leadsQuery = leadsQuery.eq('assigned_to', user.id);
      }

      const [{ data: leadsData, error: leadsError }, { data: eventsData, error: eventsError }] = await Promise.all([
        leadsQuery,
        supabase
          .from('gamification_events')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (leadsError) throw leadsError;
      if (eventsError) {
        console.warn('Erro ao buscar eventos para o Copilot:', eventsError);
      }

      const userTotalXp = Number(user.xp_points || 0);
      const { currentLevel } = getLevelInfo(userTotalXp);

      try {
        const insight = await generateCRMInsights(
          leadsData || [],
          tasks,
          eventsData || [],
          notifications || [],
          user.name || 'Corretor',
          { title: currentLevel.title, level: currentLevel.level }
        );

        setCopilotBriefing(insight);
      } catch (aiError: any) {
        if (isAbortError(aiError)) return;
        console.error('Erro ao gerar insights do CRM Copilot:', aiError);
        setCopilotBriefing('');

        // Tratamento infalível contra o "objeto vazio" do SDK do Google
        let errorMsg = 'Falha ao conectar com o Copilot. Verifique sua conexão.';

        if (aiError && typeof aiError === 'object') {
          if (aiError.message && aiError.message.trim() !== '') {
            errorMsg = aiError.message;
          } else if (Object.keys(aiError).length === 0) {
            // Captura exatamente o maldito erro {}
            errorMsg = 'A API da IA rejeitou a conexão automática. Tente clicar em Gerar novamente.';
          } else {
            errorMsg = JSON.stringify(aiError);
          }
        } else if (typeof aiError === 'string' && aiError.trim() !== '') {
          errorMsg = aiError;
        }

        addToast(`Aviso Copilot: ${errorMsg}`, 'error');
      }
    } catch (error: any) {
      if (isAbortError(error)) return;
      console.error('Erro ao preparar leitura tática do CRM Copilot:', error);
      addToast(error?.message || 'Não foi possível reunir os dados do Copilot.', 'error');
    } finally {
      setGeneratingCopilot(false);
    }
  }, [addToast, isAdmin, notifications, tasks, unreadCount, user?.company_id, user?.id, user?.name, user?.xp_points]);

  const fetchTasks = useCallback(async () => {
    if (!user?.id || !user.company_id) {
      setTasks([]);
      setInsights([]);
      setCopilotBriefing('');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from('tasks')
        .select('*, leads(name, phone)')
        .eq('company_id', user.company_id)
        .eq('completed', false)
        .order('due_date', { ascending: true });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await runWithSessionRecovery(() => query);
      if (error) throw error;

      setTasks((data as TaskWithLead[]) ?? []);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Erro ao carregar tarefas:', error);
      addToast('Não foi possível carregar as tarefas agora.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, isAdmin, user?.company_id, user?.id]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!user?.company_id) return;

    const channel = supabase
      .channel(`crm-copilot-${user.company_id}-${user.id ?? 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `company_id=eq.${user.company_id}` },
        () => {
          void fetchTasks();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `company_id=eq.${user.company_id}` },
        () => {
          void generateAIInsights();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contracts', filter: `company_id=eq.${user.company_id}` },
        () => {
          void generateAIInsights();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchTasks, generateAIInsights, user?.company_id, user?.id]);

  const toggleTask = async (task: TaskWithLead, event: React.MouseEvent) => {
    event.stopPropagation();

    const previousTasks = tasks;
    setTasks((prev) => prev.filter((item) => item.id !== task.id));

    try {
      const { error } = await supabase.from('tasks').update({ completed: true }).eq('id', task.id);
      if (error) throw error;

      addToast('Tarefa concluída! Parabéns.', 'success');
      await generateAIInsights();
    } catch (error) {
      console.error('Erro ao concluir tarefa:', error);
      setTasks(previousTasks);
      addToast('Não foi possível concluir a tarefa.', 'error');
    }
  };

  const createQuickTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id || !user.company_id) return;

    setSavingTask(true);

    try {
      const payload = {
        title: quickTask.title,
        due_date: quickTask.due_date,
        lead_id: quickTask.lead_id || null,
        type: 'other',
        completed: false,
        user_id: user.id,
        company_id: user.company_id,
      };

      const { error } = await supabase.from('tasks').insert([payload]);
      if (error) throw error;

      setQuickTask({ title: '', due_date: '', lead_id: '' });
      addToast('Tarefa criada com sucesso!', 'success');
      await fetchTasks();
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      addToast('Não foi possível criar a tarefa.', 'error');
    } finally {
      setSavingTask(false);
    }
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<'Atrasadas' | 'Hoje' | 'Futuro', TaskWithLead[]> = {
      Atrasadas: [],
      Hoje: [],
      Futuro: [],
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toDateString();

    tasks.forEach((task) => {
      const taskDate = parseDueDate(task.due_date);
      if (!taskDate) {
        groups.Futuro.push(task);
        return;
      }

      if (taskDate.getTime() < today.getTime()) {
        groups.Atrasadas.push(task);
        return;
      }

      if (taskDate.toDateString() === todayKey) {
        groups.Hoje.push(task);
        return;
      }

      groups.Futuro.push(task);
    });

    return groups;
  }, [tasks]);

  const copilotLines = useMemo(
    () =>
      copilotBriefing
        .split('\n')
        .map((line) => line.replace(/^(?:[-*]|\u2022)\s*/, ''))
        .map((line) => line.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean),
    [copilotBriefing]
  );

  return (
    <div className="mx-auto max-w-6xl animate-fade-in space-y-8 pb-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-slate-800 dark:text-white">
            <Icons.BrainCircuit className="text-brand-600" /> CRM Copilot
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Sua central de inteligência e produtividade diária.</p>
        </div>
      </div>

      <section className="rounded-3xl bg-gradient-to-r from-brand-600 via-emerald-500 to-sky-500 p-1 shadow-xl">
        <div className="rounded-[22px] bg-white p-6 dark:bg-slate-900">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                <Icons.BrainCircuit size={16} className="text-brand-500" /> Leitura do Campeonato
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Cruze tarefas, leads e eventos recentes de gamificaÃ§Ã£o para receber um direcionamento tÃ¡tico da IA.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {copilotLines.length > 0 && (
                <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                  {copilotLines.length} foco(s) sugerido(s)
                </div>
              )}
              <button
                type="button"
                onClick={() => void generateCopilotBriefing()}
                disabled={generatingCopilot || loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {generatingCopilot ? (
                  <Icons.Loader2 size={16} className="animate-spin" />
                ) : (
                  <Icons.Sparkles size={16} className="text-brand-400 dark:text-brand-600" />
                )}
                {copilotBriefing ? 'Atualizar leitura tÃ¡tica' : 'Gerar leitura tÃ¡tica'}
              </button>
            </div>
          </div>

          {generatingCopilot ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-10 text-sm font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
              <Icons.Loader2 size={18} className="mr-2 animate-spin" /> Lendo seu momento no campeonato...
            </div>
          ) : copilotLines.length > 0 ? (
            <div className="space-y-3">
              {copilotLines.map((line, index) => (
                <div
                  key={`${line}-${index}`}
                  className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-500/20 dark:bg-brand-500/10"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{line}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700">
              <Icons.Sparkles size={22} className="mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-600 dark:text-slate-200">Nenhuma leitura tÃ¡tica gerada ainda.</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Clique em "Gerar leitura tÃ¡tica" para cruzar sua liga atual, pontuaÃ§Ã£o recente e agenda.
              </p>
            </div>
          )}
        </div>
      </section>

      {insights.length > 0 && (
        <section className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-1 shadow-xl">
          <div className="rounded-[22px] bg-white p-6 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
              <Icons.Sparkles size={16} className="text-brand-500" /> Ações Recomendadas
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`rounded-2xl border p-5 ${
                    insight.type === 'danger'
                      ? 'border-red-100 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/10'
                      : insight.type === 'warning'
                        ? 'border-amber-100 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/10'
                        : 'border-blue-100 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-500/10'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-xl bg-white p-2 shadow-sm dark:bg-slate-800">{insight.icon}</div>
                    <h3 className="font-bold text-slate-800 dark:text-white">{insight.title}</h3>
                  </div>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{insight.description}</p>
                  <button
                    onClick={insight.onClick}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  >
                    {insight.actionText} <Icons.ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <form
        onSubmit={createQuickTask}
        className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row"
      >
        <div className="relative flex-1">
          <Icons.CheckSquare size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={quickTask.title}
            onChange={(event) => setQuickTask({ ...quickTask, title: event.target.value })}
            className="w-full rounded-xl border-none bg-transparent py-3 pl-11 pr-4 font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 dark:text-white"
            placeholder="O que você precisa fazer?"
            required
          />
        </div>
        <div className="relative w-full border-t border-slate-100 dark:border-slate-800 md:w-48 md:border-l md:border-t-0">
          <Icons.Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={quickTask.due_date}
            onChange={(event) => setQuickTask({ ...quickTask, due_date: event.target.value })}
            className="w-full cursor-pointer rounded-xl border-none bg-transparent py-3 pl-11 pr-4 text-sm text-slate-600 focus:ring-0 dark:text-slate-300"
            required
          />
        </div>
        <button
          type="submit"
          disabled={savingTask}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60 md:w-auto"
        >
          {savingTask ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.Plus size={18} />} Adicionar
        </button>
      </form>

      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          <Icons.Loader2 size={22} className="mr-2 animate-spin text-brand-500" /> Analisando seu CRM...
        </div>
      ) : (
        <div id="tasks-board" className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-3">
          {(['Atrasadas', 'Hoje', 'Futuro'] as const).map((group) => (
            <div key={group} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2 dark:border-slate-800">
                <h2
                  className={`text-sm font-black uppercase tracking-wider ${
                    group === 'Atrasadas' ? 'text-red-500' : group === 'Hoje' ? 'text-brand-600' : 'text-slate-400'
                  }`}
                >
                  {group}
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {groupedTasks[group].length}
                </span>
              </div>

              <div className="mt-2 space-y-3">
                {groupedTasks[group].map((task) => (
                  <div
                    key={task.id}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 bg-slate-200 transition-colors group-hover:bg-brand-400 dark:bg-slate-700" />

                    <div className="flex items-start gap-3 pl-2">
                      <button
                        onClick={(event) => void toggleTask(task, event)}
                        className="mt-1 shrink-0 text-slate-300 transition-colors hover:text-green-500"
                        aria-label={`Concluir tarefa ${task.title}`}
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current">
                          <Icons.Check size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </button>

                      <div
                        className="flex-1"
                        onClick={() => task.lead_id && navigate(`/admin/leads?open=${task.lead_id}&tab=activity`)}
                      >
                        <p className="mb-1 leading-tight text-slate-800 dark:text-white">
                          <span className="font-bold">{task.title}</span>
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {parseDueDate(task.due_date)?.toLocaleDateString('pt-BR') || 'Sem data definida'}
                        </p>
                        {task.leads?.name && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            <Icons.User size={12} /> {task.leads.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {groupedTasks[group].length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                    <Icons.Sparkles size={24} className="mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-400">Tudo limpo por aqui</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
