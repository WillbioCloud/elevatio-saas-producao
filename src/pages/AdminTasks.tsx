import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  DragOverEvent,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Icons } from '../components/Icons';
import { processVisitFeedback } from '../services/ai';
import type { Lead, Task } from '../types';
import Loading from '../components/Loading';
import WelcomeBalloon from '../components/ui/WelcomeBalloon';

type TaskStatus = 'pendente' | 'concluida';
type ColumnId = 'atrasadas' | 'hoje' | 'proximas' | 'concluida';

type BoardTask = Task & {
  status?: TaskStatus | string | null;
  priority?: string | null;
  leads?: { name?: string | null } | null;
  profiles?: { name?: string | null; avatar_url?: string | null } | null;
  completed?: boolean | null;
};

const BOARD_COLUMNS: ColumnId[] = ['atrasadas', 'hoje', 'proximas', 'concluida'];
const AURA_MARKER = 'Aura:';

const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  const message = `${maybe.message ?? ''}`.toLowerCase();
  return maybe.name === 'AbortError' || message.includes('aborted') || message.includes('signal is aborted');
};

const cleanTaskTitle = (title: string) => {
  const markerIndex = title.indexOf(AURA_MARKER);
  return markerIndex >= 0 ? title.slice(markerIndex + AURA_MARKER.length).trim() : title.trim();
};

const normalizeTaskPriority = (priority?: string | null) => {
  const value = `${priority ?? ''}`.toLowerCase().trim();
  if (value === 'baixa' || value === 'media' || value === 'alta') return value;
  if (value === 'critica' || value === 'crítica') return 'alta';
  return 'media';
};

const formatTaskPriority = (priority?: string | null) => {
  const value = `${priority ?? ''}`.toLowerCase().trim();
  if (value === 'baixa') return 'Baixa';
  if (value === 'media') return 'Média';
  if (value === 'alta') return 'Alta';
  if (value === 'critica' || value === 'crítica') return 'Crítica';
  return 'Normal';
};

const isTaskOwner = (
  task: Pick<BoardTask, 'user_id'> | null | undefined,
  currentUserId?: string
) => Boolean(task?.user_id && currentUserId && task.user_id === currentUserId);

const isVisitTask = (task: Pick<BoardTask, 'title' | 'lead_id'> | null | undefined) =>
  Boolean(task?.lead_id && task.title.toLowerCase().includes('visita'));

export default function AdminTasks() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [leads, setLeads] = useState<Partial<Lead>[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'minhas' | 'equipe'>('minhas');
  const [visitFeedbackModal, setVisitFeedbackModal] = useState<{ isOpen: boolean; task: BoardTask | null }>({
    isOpen: false,
    task: null,
  });
  const [visitFeedbackText, setVisitFeedbackText] = useState('');
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<ColumnId | null>(null);
  const [spotlightedTask, setSpotlightedTask] = useState<{ id: string; token: number } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().slice(0, 16),
    priority: 'media',
    lead_id: '',
  });
  const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    void fetchTasks();
    void fetchLeads();
  }, [user?.id, activeTab]);

  useEffect(() => {
    if (!spotlightedTask) return;

    const timeoutId = setTimeout(() => {
      setSpotlightedTask((current) =>
        current?.token === spotlightedTask.token ? null : current
      );
    }, 2600);

    return () => clearTimeout(timeoutId);
  }, [spotlightedTask]);

  const fetchTasks = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('tasks')
        .select('*, leads(name), profiles:user_id(name, avatar_url)')
        .order('due_date', { ascending: true });

      if (activeTab === 'minhas') {
        // Aba Minhas: Traz rigorosamente apenas as do corretor logado
        query = query.eq('user_id', user.id);
      } else if (user.company_id) {
        // Aba Equipe: Traz todas da imobiliária (se o user tiver company_id na sessão)
        query = query.eq('company_id', user.company_id);
      } else {
        // Fallback de segurança para ambiente de teste/single-tenant
        // Se company_id falhar, trazemos as tarefas e o frontend filtra
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks((data as BoardTask[] | null) || []);
    } catch (error) {
      if (isAbortError(error)) return;
      addToast('Erro ao carregar tarefas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name')
        .eq('assigned_to', user.id);

      if (error) throw error;
      if (data) setLeads(data);
    } catch (error) {
      if (isAbortError(error)) return;
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim() || !user?.id) return;

    const parsedDueDate = new Date(newTask.due_date);
    if (Number.isNaN(parsedDueDate.getTime())) {
      addToast('Data da tarefa inválida.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('tasks').insert([
        {
          company_id: user.company_id,
          user_id: user.id,
          lead_id: newTask.lead_id || null,
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          priority: normalizeTaskPriority(newTask.priority),
          due_date: parsedDueDate.toISOString(),
          status: 'pendente',
        },
      ]);

      if (error) throw error;

      addToast('Tarefa criada!', 'success');
      setIsModalOpen(false);
      setNewTask({
        title: '',
        description: '',
        due_date: new Date().toISOString().slice(0, 16),
        priority: 'media',
        lead_id: '',
      });
      void fetchTasks();
    } catch (error) {
      addToast('Erro ao criar.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim() || !user?.id) return;
    if (!isTaskOwner(editingTask, user.id)) {
      setEditingTask(null);
      return;
    }

    const parsedDueDate = new Date(editingTask.due_date ?? '');
    if (Number.isNaN(parsedDueDate.getTime())) {
      addToast('Data da tarefa inválida.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editingTask.title.trim(),
          description: editingTask.description?.trim() || null,
          priority: normalizeTaskPriority(editingTask.priority),
          due_date: parsedDueDate.toISOString(),
          lead_id: editingTask.lead_id || null,
        })
        .eq('id', editingTask.id)
        .eq('user_id', user.id);

      if (error) throw error;

      addToast('Tarefa atualizada com sucesso!', 'success');
      setEditingTask(null);
      void fetchTasks();
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Erro ao atualizar tarefa.';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTask = async (taskId: string, currentStatus: string) => {
    const taskToComplete = tasks.find((item) => item.id === taskId);
    if (!taskToComplete) return;

    if (taskToComplete.user_id !== user?.id) {
      addToast('Você não tem permissão para concluir tarefas de outros usuários.', 'error');
      return;
    }

    const newStatus = currentStatus === 'pendente' ? 'concluida' : 'pendente';

    if (newStatus === 'concluida' && isVisitTask(taskToComplete)) {
      setVisitFeedbackText('');
      setVisitFeedbackModal({ isOpen: true, task: taskToComplete });
      return;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: newStatus, completed: newStatus === 'concluida' }
          : task
      )
    );

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, completed: newStatus === 'concluida' })
      .eq('id', taskId)
      .eq('user_id', user?.id);

    if (error) {
      void fetchTasks();
      addToast('Erro ao atualizar tarefa.', 'error');
    }
  };

  const handleSubmitVisitFeedback = async () => {
    if (!visitFeedbackModal.task || !visitFeedbackText.trim() || !user?.id) return;
    if (!user.company_id) {
      addToast('Não foi possível identificar a empresa para registrar o feedback.', 'error');
      return;
    }

    setIsProcessingFeedback(true);

    try {
      const task = visitFeedbackModal.task;
      const analysis = await processVisitFeedback(task.leads?.name || 'Cliente', visitFeedbackText.trim());

      const { error: completeTaskError } = await supabase
        .from('tasks')
        .update({ status: 'concluida', completed: true })
        .eq('id', task.id)
        .eq('user_id', user.id);

      if (completeTaskError) throw completeTaskError;

      if (task.lead_id) {
        const lastInteraction = new Date().toISOString();

        const { error: updateLeadError } = await supabase
          .from('leads')
          .update({
            status: analysis.status_suggestion,
            last_interaction: lastInteraction,
          })
          .eq('id', task.lead_id);

        if (updateLeadError) throw updateLeadError;

        const { error: timelineError } = await supabase.from('timeline_events').insert([
          {
            lead_id: task.lead_id,
            type: 'system',
            description: `🎯 Visita Realizada:\n"${visitFeedbackText.trim()}"\n\n🤖 Aura: ${analysis.timeline_note}\n(Avançou o lead para ${analysis.status_suggestion})`,
            company_id: user.company_id,
            created_by: user.id,
          },
        ]);

        if (timelineError) throw timelineError;

        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + (analysis.next_task_hours || 24));

        const { error: createTaskError } = await supabase.from('tasks').insert([
          {
            company_id: user.company_id,
            user_id: user.id,
            lead_id: task.lead_id,
            title: analysis.next_task_title,
            description: analysis.next_task_desc,
            priority: 'alta',
            due_date: dueDate.toISOString(),
            status: 'pendente',
            completed: false,
          },
        ]);

        if (createTaskError) throw createTaskError;
      }

      addToast('Feedback processado e funil atualizado!', 'success');
      setVisitFeedbackModal({ isOpen: false, task: null });
      setVisitFeedbackText('');
      void fetchTasks();
    } catch (error) {
      console.error('Erro ao processar feedback da visita:', error);
      addToast('Erro ao processar feedback. Tente concluir manualmente.', 'error');
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const nextActiveId = event.active.id as string;
    const activeTask = tasks.find((task) => task.id === nextActiveId);
    if (!isTaskOwner(activeTask, user?.id)) {
      setActiveId(null);
      setOverColumnId(null);
      return;
    }

    setActiveId(nextActiveId);
    setOverColumnId(resolveColumnId(nextActiveId));
  };

  const { auraRecommendations, columns, agendaTasks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cols: Record<ColumnId, BoardTask[]> = {
      atrasadas: [],
      hoje: [],
      proximas: [],
      concluida: [],
    };
    const auraRecs: BoardTask[] = [];
    const agenda: BoardTask[] = [];

    const selectedStart = new Date(selectedDate);
    selectedStart.setHours(0, 0, 0, 0);
    const selectedEnd = new Date(selectedDate);
    selectedEnd.setHours(23, 59, 59, 999);

    tasks.forEach((task) => {
      const status = task.status === 'concluida' || task.completed ? 'concluida' : 'pendente';
      if (status === 'pendente' && task.title.includes(AURA_MARKER)) auraRecs.push(task);

      const tDate = new Date(task.due_date || new Date());
      const tDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());

      if (status === 'concluida') cols.concluida.push(task);
      else if (tDay < today) cols.atrasadas.push(task);
      else if (tDay.getTime() === today.getTime()) cols.hoje.push(task);
      else cols.proximas.push(task);

      if (tDate >= selectedStart && tDate <= selectedEnd) {
        agenda.push(task);
      }
    });

    agenda.sort((a, b) => {
      const aTime = new Date(a.due_date || '').getTime();
      const bTime = new Date(b.due_date || '').getTime();
      return aTime - bTime;
    });

    return {
      auraRecommendations: auraRecs.slice(0, 3),
      columns: cols,
      agendaTasks: agenda,
    };
  }, [tasks, selectedDate]);

  const resolveColumnId = (id: string): ColumnId | null => {
    if (BOARD_COLUMNS.includes(id as ColumnId)) {
      return id as ColumnId;
    }

    return BOARD_COLUMNS.find((columnId) => columns[columnId].some((task) => task.id === id)) ?? null;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverColumnId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumn = resolveColumnId(String(over.id));
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !targetColumn || !isTaskOwner(task, user?.id)) return;

    if (targetColumn === 'concluida' && isVisitTask(task)) {
      setVisitFeedbackText('');
      setVisitFeedbackModal({ isOpen: true, task });
      return;
    }

    const now = new Date();
    let newStatus = task.status;
    let newDueDate = new Date(task.due_date || now);

    if (targetColumn === 'concluida') {
      newStatus = 'concluida';
    } else {
      newStatus = 'pendente';
      if (targetColumn === 'hoje') newDueDate = new Date();
      else if (targetColumn === 'proximas') newDueDate = new Date(now.setDate(now.getDate() + 1));
      else if (targetColumn === 'atrasadas') newDueDate = new Date(now.setDate(now.getDate() - 1));
    }

    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: newStatus,
              completed: newStatus === 'concluida',
              due_date: newDueDate.toISOString(),
            }
          : item
      )
    );

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed: newStatus === 'concluida',
        due_date: newDueDate.toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', user?.id);

    if (error) {
      void fetchTasks();
      addToast('Erro ao mover tarefa.', 'error');
    }
  };

  const activeTask = useMemo(() => tasks.find((task) => task.id === activeId), [activeId, tasks]);
  const activeColumnId = useMemo(
    () => (activeTask ? resolveColumnId(activeTask.id) : null),
    [activeTask, columns]
  );
  const previewColumnId =
    activeTask && overColumnId && activeColumnId !== overColumnId ? overColumnId : null;

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      setOverColumnId(null);
      return;
    }

    setOverColumnId(resolveColumnId(String(event.over.id)));
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverColumnId(null);
  };

  const handleAgendaTaskClick = (taskId: string) => {
    setSpotlightedTask({ id: taskId, token: Date.now() });
  };

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    ).getDay();

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        index - firstDayOfMonth + 1
      );

      const hasTask = tasks.some((task) => {
        const taskDate = new Date(task.due_date || '');
        return (
          taskDate.getDate() === date.getDate() &&
          taskDate.getMonth() === date.getMonth() &&
          taskDate.getFullYear() === date.getFullYear()
        );
      });

      return {
        date,
        isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
        hasTask,
      };
    });
  }, [currentMonth, tasks]);

  if (loading && tasks.length === 0) return <Loading />;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in font-sans text-slate-800">
      <WelcomeBalloon pageId="tasks" icon="CheckSquare" title="Organização é Tudo" description="Visitas, ligações, reuniões... não deixe nenhum cliente esfriar. Arraste suas tarefas diárias neste Kanban e mantenha sua mente livre." />

      <div className="mb-6 shrink-0">
        <div className="w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Tarefas</h1>
          <p className="text-sm font-medium text-slate-500">
            {columns.hoje.length} tarefas para hoje • {columns.atrasadas.length} em atraso
              </p>
            </div>
            <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm"
          type="button"
        >
          <Icons.Plus size={16} /> Nova
        </button>
          </div>
          <div className="flex gap-6 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('minhas')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === 'minhas'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              type="button"
            >
              Minhas tarefas
            </button>
            <button
              onClick={() => setActiveTab('equipe')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === 'equipe'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              type="button"
            >
              Tarefas da equipe
            </button>
          </div>
        </div>
      </div>

      {auraRecommendations.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Icons.Sparkles size={16} /> <span>Sugestões da Aura</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {auraRecommendations.map((task) => {
              const isOwner = isTaskOwner(task, user?.id);

              return (
                <div
                  key={task.id}
                  className="bg-indigo-50/50 border border-indigo-100/80 rounded-xl p-4 flex justify-between items-center gap-3 group"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-indigo-900 text-sm mb-1">
                      {cleanTaskTitle(task.title)}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-md">
                        Recomendado
                      </span>
                      {!isOwner && task.profiles?.name && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded-md">
                          <span className="w-4 h-4 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[8px] text-slate-600">
                            {task.profiles.avatar_url ? (
                              <img
                                src={task.profiles.avatar_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              task.profiles.name.charAt(0)
                            )}
                          </span>
                          {task.profiles.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOwner ? (
                    <button
                      onClick={() => handleCompleteTask(task.id, 'pendente')}
                      className="p-2 text-indigo-400 hover:text-indigo-600 bg-white rounded-lg shadow-sm"
                      type="button"
                    >
                      <Icons.Check size={16} strokeWidth={3} />
                    </button>
                  ) : (
                    <div className="p-2 text-slate-300 bg-white/80 rounded-lg shadow-sm">
                      <Icons.Lock size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-1 gap-6 overflow-hidden min-w-0">
        <div className="flex-1 min-w-0 flex gap-4 md:gap-6 overflow-x-auto pb-6 pt-2 custom-scrollbar snap-x snap-mandatory md:snap-none min-h-[60vh] md:h-[calc(100vh-220px)] items-start">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <KanbanColumn
              id="atrasadas"
              title="Atrasadas"
              icon={<Icons.AlertCircle size={14} className="text-rose-500" />}
              tasks={columns.atrasadas}
              onToggle={handleCompleteTask}
              onEdit={setEditingTask}
              currentUserId={user?.id}
              isDropTarget={previewColumnId === 'atrasadas'}
              dropPreviewTask={previewColumnId === 'atrasadas' ? activeTask : null}
              spotlightedTask={spotlightedTask}
            />
            <KanbanColumn
              id="hoje"
              title="Hoje"
              icon={<Icons.Clock size={14} className="text-amber-500" />}
              tasks={columns.hoje}
              onToggle={handleCompleteTask}
              onEdit={setEditingTask}
              currentUserId={user?.id}
              isDropTarget={previewColumnId === 'hoje'}
              dropPreviewTask={previewColumnId === 'hoje' ? activeTask : null}
              spotlightedTask={spotlightedTask}
            />
            <KanbanColumn
              id="proximas"
              title="Próximas"
              icon={<Icons.Calendar size={14} className="text-slate-400" />}
              tasks={columns.proximas}
              onToggle={handleCompleteTask}
              onEdit={setEditingTask}
              currentUserId={user?.id}
              isDropTarget={previewColumnId === 'proximas'}
              dropPreviewTask={previewColumnId === 'proximas' ? activeTask : null}
              spotlightedTask={spotlightedTask}
            />
            <KanbanColumn
              id="concluida"
              title="Concluídas"
              icon={<Icons.CheckCircle2 size={14} className="text-emerald-500" />}
              tasks={columns.concluida}
              onToggle={handleCompleteTask}
              onEdit={setEditingTask}
              currentUserId={user?.id}
              isCompleted
              isDropTarget={previewColumnId === 'concluida'}
              dropPreviewTask={previewColumnId === 'concluida' ? activeTask : null}
              spotlightedTask={spotlightedTask}
            />

            <DragOverlay
              dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                  styles: { active: { opacity: '0.4' } },
                }),
              }}
            >
              {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        </div>

        <div className="hidden lg:flex w-[280px] shrink-0 border-l border-slate-100 pl-6 flex-col overflow-y-auto custom-scrollbar pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">
              {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  setCurrentMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                type="button"
              >
                <Icons.ChevronLeft size={16} />
              </button>
              <button
                onClick={() =>
                  setCurrentMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                type="button"
              >
                <Icons.ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
              <div key={index}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 mb-6">
            {calendarDays.map((day, index) => {
              const isSelected = day.date.toDateString() === selectedDate.toDateString();
              const isToday = day.date.toDateString() === new Date().toDateString();

              return (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedDate(day.date);
                    if (!day.isCurrentMonth) {
                      setCurrentMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                    }
                  }}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all relative
                    ${!day.isCurrentMonth ? 'text-slate-300' : 'text-slate-700 hover:bg-slate-100'}
                    ${isSelected ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}
                    ${isToday && !isSelected ? 'text-brand-600 font-black' : ''}
                  `}
                  type="button"
                >
                  {day.date.getDate()}
                  {day.hasTask && (
                    <span
                      className={`absolute bottom-1 w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-brand-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Agenda do Dia
            </h4>
            <div className="space-y-3">
              {agendaTasks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Dia livre de tarefas.</p>
              ) : (
                agendaTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleAgendaTaskClick(task.id)}
                    className="w-full flex gap-3 items-start group rounded-xl p-2 -m-2 text-left transition-colors hover:bg-slate-50"
                    type="button"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0 group-hover:bg-brand-500 transition-colors" />
                    <div>
                      <p className="text-sm font-bold text-slate-700 leading-tight mb-0.5">
                        {cleanTaskTitle(task.title)}
                      </p>
                      <p className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <Icons.Clock size={10} />
                        {new Date(task.due_date || '').toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {task.leads?.name && (
                          <span className="truncate ml-1">· {task.leads.name}</span>
                        )}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-2xl">
            <div className="flex justify-between p-4 pb-0">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Nova Tarefa</span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100"
                type="button"
              >
                <Icons.X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4 p-5">
              <input
                autoFocus
                placeholder="Título da tarefa..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full border-0 bg-transparent px-0 text-2xl font-black text-slate-800 placeholder-slate-300 transition-colors focus:ring-0"
                required
              />
              <textarea
                placeholder="Adicione uma descrição..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full resize-none border-0 bg-transparent px-0 text-sm text-slate-600 placeholder-slate-400 focus:ring-0"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Data/Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Prioridade
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Lead Associado
                </label>
                <select
                  value={newTask.lead_id}
                  onChange={(e) => setNewTask({ ...newTask, lead_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Nenhum lead</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !newTask.title.trim()}
                  className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {visitFeedbackModal.isOpen && visitFeedbackModal.task && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <Icons.Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Como foi a visita?</h3>
                <p className="text-sm text-slate-500">Com {visitFeedbackModal.task.leads?.name || 'Cliente'}</p>
              </div>
            </div>

            <textarea
              value={visitFeedbackText}
              onChange={(e) => setVisitFeedbackText(e.target.value)}
              placeholder="Ex: Ele adorou a varanda, mas achou o condomínio caro. Vou tentar conseguir um desconto..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              rows={4}
              autoFocus
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setVisitFeedbackModal({ isOpen: false, task: null });
                  setVisitFeedbackText('');
                }}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
                disabled={isProcessingFeedback}
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitVisitFeedback}
                disabled={isProcessingFeedback || !visitFeedbackText.trim()}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                type="button"
              >
                {isProcessingFeedback ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Check size={16} />}
                {isProcessingFeedback ? 'Aura analisando...' : 'Concluir e Atualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/60">
            <div className="flex justify-between p-4 pb-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icons.Edit3 size={14} /> Editar Tarefa
              </span>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:bg-slate-100 p-1 rounded-md transition-colors"
                type="button"
              >
                <Icons.X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateTask} className="p-5 space-y-4">
              <input
                autoFocus
                placeholder="Título da tarefa..."
                value={cleanTaskTitle(editingTask.title)}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full text-2xl font-black text-slate-800 placeholder-slate-300 border-0 focus:ring-0 px-0 transition-colors bg-transparent"
                required
              />
              <textarea
                placeholder="Adicione uma descrição..."
                value={editingTask.description || ''}
                onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                className="w-full text-sm text-slate-600 placeholder-slate-400 border-0 focus:ring-0 px-0 resize-none bg-transparent"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Data/Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={editingTask.due_date ? editingTask.due_date.slice(0, 16) : ''}
                    onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                    className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Prioridade
                  </label>
                  <select
                    value={editingTask.priority || 'media'}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                    className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Lead Associado
                </label>
                <select
                  value={editingTask.lead_id || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, lead_id: e.target.value })}
                  className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Nenhum lead</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !editingTask.title.trim()}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-6 rounded-lg text-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Atualizando...' : 'Atualizar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  id,
  title,
  icon,
  tasks,
  onToggle,
  onEdit,
  currentUserId,
  isCompleted,
  isDropTarget,
  dropPreviewTask,
  spotlightedTask,
}: {
  id: ColumnId;
  title: string;
  icon: React.ReactNode;
  tasks: BoardTask[];
  onToggle: (id: string, s: string) => void;
  onEdit: (t: BoardTask) => void;
  currentUserId?: string;
  isCompleted?: boolean;
  isDropTarget?: boolean;
  dropPreviewTask?: BoardTask | null;
  spotlightedTask?: { id: string; token: number } | null;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      className={`flex-none w-[85vw] sm:w-[320px] shrink-0 snap-center md:snap-align-none max-h-full flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 transition-all duration-200 ${
        isDropTarget
          ? 'ring-2 ring-brand-300 shadow-inner'
          : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-3 px-2 py-1">
        {icon}
        <h3 className="text-sm font-bold text-slate-700 flex-1">{title}</h3>
        <span className="text-xs font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar p-1">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onEdit={onEdit}
              currentUserId={currentUserId}
              isCompleted={isCompleted}
              spotlightedTask={spotlightedTask}
            />
          ))}
        </SortableContext>
        {dropPreviewTask && (
          <div className="rounded-xl border border-dashed border-brand-300 bg-white/90 p-3 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand-300 bg-brand-50 text-brand-500">
                <Icons.Check size={11} strokeWidth={4} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-brand-500">
                  Soltar em {title}
                </p>
                <h4 className="text-xs md:text-sm font-bold leading-snug text-slate-700">
                  {cleanTaskTitle(dropPreviewTask.title)}
                </h4>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableTaskItem({
  task,
  onToggle,
  onEdit,
  currentUserId,
  isCompleted,
  spotlightedTask,
}: {
  task: BoardTask;
  onToggle: (id: string, s: string) => void;
  onEdit: (t: BoardTask) => void;
  currentUserId?: string;
  isCompleted?: boolean;
  spotlightedTask?: { id: string; token: number } | null;
}) {
  const isOwner = isTaskOwner(task, currentUserId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !isOwner,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isOwner ? attributes : {})}
      {...(isOwner ? listeners : {})}
    >
      <TaskCard
        task={task}
        onToggle={onToggle}
        onEdit={onEdit}
        isOwner={isOwner}
        isCompleted={isCompleted}
        isSpotlighted={spotlightedTask?.id === task.id}
        spotlightToken={spotlightedTask?.id === task.id ? spotlightedTask.token : 0}
      />
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
  onEdit,
  isCompleted,
  isOverlay,
  isOwner = true,
  isSpotlighted,
  spotlightToken,
}: {
  task: BoardTask;
  onToggle?: (id: string, s: string) => void;
  onEdit?: (t: BoardTask) => void;
  isCompleted?: boolean;
  isOverlay?: boolean;
  isOwner?: boolean;
  isSpotlighted?: boolean;
  spotlightToken?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cleanTitle = cleanTaskTitle(task.title);

  useEffect(() => {
    if (isOverlay || !spotlightToken) return;

    setIsExpanded(true);
    cardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [isOverlay, spotlightToken]);

  const handleClick = (e: React.MouseEvent) => {
    if (isOverlay) return;
    // O e.detail conta quantos cliques aconteceram sequencialmente.
    // Se for > 1, é um duplo clique, então abortamos o clique simples para não dar conflito.
    if (e.detail > 1) return;

    // Toggle perfeito: se estiver fechado abre, se estiver aberto fecha.
    setIsExpanded(!isExpanded);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOverlay || !isOwner) return;
    onEdit?.(task);
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`bg-white border rounded-xl p-3 md:p-4 flex items-start gap-3 transition-all duration-200 overflow-hidden ${
        isOverlay
          ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing border-slate-200'
          : isSpotlighted
            ? `shadow-lg ring-2 ring-brand-300 border-brand-300 ${isOwner ? 'cursor-grab' : 'cursor-pointer'}`
            : `shadow-sm ${isOwner ? 'hover:shadow-md cursor-grab hover:border-brand-200 border-slate-200' : 'cursor-pointer border-slate-100 bg-slate-50/50'}`
      }`}
    >
      {isOwner ? (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(task.id, task.status || 'pendente');
          }}
          className={`mt-0.5 shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors border ${
            isCompleted
              ? 'bg-brand-500 border-brand-500 text-white'
              : 'border-slate-300 hover:border-brand-500 text-transparent hover:text-brand-500'
          }`}
          type="button"
        >
          <Icons.Check size={12} strokeWidth={4} />
        </button>
      ) : (
        <div className="mt-0.5 shrink-0 w-4 h-4 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-300">
          <Icons.Lock size={10} />
        </div>
      )}
      <div className="flex-1 min-w-0 pointer-events-none select-none">
        <h4
          className={`text-xs md:text-sm font-bold leading-snug transition-all ${
            isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
          } ${isExpanded ? 'mb-2' : ''}`}
        >
          {cleanTitle}
        </h4>
        {!isOwner && task.profiles?.name && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-2">
            <div className="w-4 h-4 rounded-full bg-slate-200 overflow-hidden">
              {task.profiles.avatar_url ? (
                <img src={task.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[8px]">
                  {task.profiles.name.charAt(0)}
                </div>
              )}
            </div>
            {task.profiles.name}
          </div>
        )}
        {isExpanded && (
          <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100 animate-fade-in">
            {task.leads?.name && (
              <Link
                to={`/admin/leads?open=${task.lead_id}`}
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit transition-all pointer-events-auto ${
                  isOwner
                    ? 'text-slate-500 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 hover:shadow-sm'
                    : 'text-slate-400 bg-slate-100'
                }`}
              >
                <Icons.User size={12} /> {task.leads.name}
              </Link>
            )}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                <Icons.Clock size={10} />
                {new Date(task.due_date || '').toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider text-slate-400">
                {formatTaskPriority(task.priority)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
