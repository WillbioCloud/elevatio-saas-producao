import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { runWithSessionRecovery, supabase } from '../lib/supabase';
import { Task } from '../types';

interface TaskWithLead extends Task {
  leads: { name: string; phone: string } | null;
  user_id?: string;
}

interface ProfileOption {
  id: string;
  name: string;
}

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  return maybe.name === 'AbortError' || maybe.message?.includes('AbortError') === true;
};

const AdminTasks: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<TaskWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('me');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [quickTask, setQuickTask] = useState({ title: '', due_date: '', lead_id: '' });
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchProfiles();
    }
  }, [user?.role]);

  const fetchProfiles = async () => {
    const { data } = await runWithSessionRecovery(() => supabase.from('profiles').select('id, name').order('name'));
    setProfiles((data as ProfileOption[]) ?? []);
  };

  const fetchTasks = async () => {
    if (!user?.id) return;

    const shouldShowInitialLoading = tasks.length === 0;
    if (shouldShowInitialLoading) {
      setLoading(true);
    }

    let aborted = false;

    try {
      let query = supabase.from('tasks').select('*, leads(name, phone)').order('due_date', { ascending: true });

      if (filter === 'pending') query = query.eq('completed', false);
      if (filter === 'completed') query = query.eq('completed', true);

      if (user.role === 'admin' && assigneeFilter !== 'all') {
        query = query.eq('user_id', assigneeFilter === 'me' ? user.id : assigneeFilter);
      }

      if (user.role !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await runWithSessionRecovery(() => query);
      if (error) throw error;
      setTasks((data as TaskWithLead[]) ?? []);
    } catch (error) {
      if (isAbortError(error)) {
        aborted = true;
        return;
      }

      console.error('Erro ao carregar tarefas:', error);
    } finally {
      if (!aborted && shouldShowInitialLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter, assigneeFilter, user?.id, user?.role]);

  const toggleTask = async (task: TaskWithLead, event: React.MouseEvent) => {
    event.stopPropagation();
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: !item.completed } : item)));
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id);
  };

  const createQuickTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSavingTask(true);
    const payload = {
      title: quickTask.title,
      due_date: quickTask.due_date,
      lead_id: quickTask.lead_id || null,
      type: 'other',
      completed: false,
      user_id: user.role === 'admin' && assigneeFilter !== 'all' ? (assigneeFilter === 'me' ? user.id : assigneeFilter) : user.id,
    };

    const { error } = await supabase.from('tasks').insert([payload]);

    if (error) {
      alert('Não foi possível criar a tarefa. Verifique o Lead ID se obrigatório na sua base.');
    } else {
      setQuickTask({ title: '', due_date: '', lead_id: '' });
      await fetchTasks();
    }

    setSavingTask(false);
  };

  const getGroupLabel = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const dateKey = date.toDateString();

    if (dateKey === today.toDateString()) return 'Hoje';
    if (dateKey === tomorrow.toDateString()) return 'Amanhã';
    return 'Futuro';
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskWithLead[]> = { Hoje: [], Amanhã: [], Futuro: [] };
    tasks.forEach((task) => {
      const label = getGroupLabel(new Date(task.due_date));
      groups[label].push(task);
    });
    return groups;
  }, [tasks]);

  const isOverdue = (task: TaskWithLead) => !task.completed && new Date(task.due_date).getTime() < Date.now() - 86_400_000;
  const isUrgent = (task: TaskWithLead) => !task.completed && getGroupLabel(new Date(task.due_date)) === 'Hoje';

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-slate-800">Agenda Pessoal</h1>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="me">Ver minhas tarefas</option>
              <option value="all">Ver todos</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>Ver tarefas de {profile.name}</option>
              ))}
            </select>
          )}
          <div className="flex bg-white rounded-lg p-1 border border-brand-100 shadow-sm">
            {(['pending', 'completed', 'all'] as const).map((status) => (
              <button key={status} onClick={() => setFilter(status)} className={`px-3 py-1.5 text-sm font-bold rounded-md ${filter === status ? 'bg-brand-500 text-white' : 'text-gray-500'}`}>
                {status === 'pending' ? 'Pendentes' : status === 'completed' ? 'Concluídas' : 'Todas'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={createQuickTask} className="bg-white border border-gray-200 rounded-2xl p-4 grid md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="text-xs font-bold uppercase text-gray-500">Nova tarefa rápida</label>
          <input value={quickTask.title} onChange={(e) => setQuickTask((prev) => ({ ...prev, title: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200" placeholder="Ex: Retornar lead João" required />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500">Data</label>
          <input type="date" value={quickTask.due_date} onChange={(e) => setQuickTask((prev) => ({ ...prev, due_date: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200" required />
        </div>
        <button type="submit" disabled={savingTask} className="h-10 bg-slate-900 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          <Icons.Plus size={16} /> {savingTask ? 'Criando...' : 'Nova Tarefa'}
        </button>
      </form>

      {loading && tasks.length === 0 ? (
        <div className="p-12 text-center text-gray-400">Carregando...</div>
      ) : (
        <div className="space-y-5">
          {(['Hoje', 'Amanhã', 'Futuro'] as const).map((group) => (
            <div key={group}>
              <h2 className="text-sm uppercase tracking-widest font-bold text-gray-400 mb-2">{group}</h2>
              <div className="space-y-3">
                {groupedTasks[group].map((task) => (
                  <div
                    key={task.id}
                    onClick={() => task.lead_id && navigate(`/admin/leads?open=${task.lead_id}&tab=activity`)}
                    className={`p-4 rounded-xl border bg-white transition-all ${
                      isOverdue(task)
                        ? 'border-red-200 bg-red-50/40'
                        : isUrgent(task)
                          ? 'border-amber-200 bg-amber-50/40'
                          : 'border-gray-100 hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button onClick={(event) => toggleTask(task, event)} className="mt-0.5">
                        {task.completed ? (
                          <Icons.CheckCircle className="text-green-500" size={20} />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${task.completed ? 'line-through text-gray-400' : 'text-slate-800'}`}>{task.title}</p>
                          {isOverdue(task) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold uppercase">Atrasada</span>}
                          {isUrgent(task) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold uppercase">Urgente</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {task.leads?.name ? `Lead: ${task.leads.name}` : 'Sem lead vinculado'} • {new Date(task.due_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {groupedTasks[group].length === 0 && <div className="text-sm text-gray-400 p-3">Sem tarefas.</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTasks;