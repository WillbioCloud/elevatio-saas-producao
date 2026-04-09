import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, LeadStatus, Property } from '../types';
import { Icons } from '../components/Icons';
import LeadDetailsSidebar from '../components/LeadDetailsSidebar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { TOOLTIPS } from '../constants/tooltips';
import Loading from '../components/Loading';
import { addXp } from '../services/gamification';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../../components/ui/alert-dialog';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';

// Configuração da animação suave ao soltar
const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: '0.5' }
    }
  })
};

// === COMPONENTES INTERNOS ===


const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  return maybe.name === 'AbortError' || maybe.message?.includes('AbortError') === true;
};

const formatTimeInStage = (dateString?: string) => {
  if (!dateString) return '0s';
  const diff = Date.now() - new Date(dateString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group inline-flex items-center hover:z-[999] ml-2">
    <Icons.Info size={14} className="text-slate-400 cursor-help hover:text-brand-500 transition-colors" />
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] pointer-events-none normal-case">
      {text}
    </div>
  </div>
);

const DroppableColumn = ({
  id,
  children,
  count,
  title,
  onClickTitle
}: {
  id: string;
  children: React.ReactNode;
  count: number;
  title: string;
  onClickTitle?: () => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 flex flex-col h-full rounded-2xl transition-colors duration-300 overflow-visible ${
        isOver ? 'bg-slate-200/70 ring-2 ring-brand-400 ring-inset' : 'bg-slate-100/80'
      }`}
    >
      {/* Header da Coluna */}
      <div className="p-4 flex justify-between items-center sticky top-0 bg-inherit rounded-t-2xl z-10 backdrop-blur-sm">
        <h3
          onClick={onClickTitle}
          className={`font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2 ${onClickTitle ? 'cursor-pointer hover:text-brand-600 transition-colors' : ''}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              title.toLowerCase().includes('aguardando') || title === 'Aguardando Atendimento'
                ? 'bg-blue-500'
                : title === 'Em Contato' || title === 'Tentando contato'
                ? 'bg-amber-500'
                : title === 'Fechado' || title === 'Venda Fechada'
                ? 'bg-emerald-500'
                : 'bg-slate-400'
            }`}
          />
          {title}
        </h3>
        <span className="bg-white px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-500 shadow-sm border border-slate-200">
          {count}
        </span>
      </div>

      {/* Área de Cards */}
      <div className="flex-1 overflow-y-auto overflow-x-visible px-3 pb-3 space-y-3 custom-scrollbar">{children}</div>
    </div>
  );
};

// O Card agora aceita props de estilo para quando está sendo arrastado (isOverlay)
const LeadCard = ({
  lead,
  onClick,
  isAdmin,
  isMasterView = false,
  isOverlay = false
}: {
  lead: Lead;
  onClick?: () => void;
  isAdmin: boolean;
  isMasterView?: boolean;
  isOverlay?: boolean;
}) => {
  const createdAt = (lead as any).createdAt ?? (lead as any).created_at ?? new Date().toISOString();
  const score = (lead as any).score ?? 0;
  const metadata = (lead as any).metadata;
  const visitedProps = (lead as any).navigation_data || metadata?.visited_properties || [];

  return (
    <div
      onClick={onClick}
      className={`
        bg-white p-4 rounded-xl border border-slate-200 group relative transition-all duration-200
        ${
          isOverlay
            ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing ring-2 ring-brand-500 z-50'
            : 'shadow-sm hover:shadow-md cursor-grab hover:border-brand-300'
        }
      `}
    >
      {/* Header do Card */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-bold text-slate-800 line-clamp-1 text-sm">{lead.name}</h4>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {new Date(createdAt).toLocaleDateString()} •{' '}
            {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {score > 70 && (
          <span className="bg-orange-50 text-orange-600 p-1 rounded-md" title="Lead Quente">
            <Icons.Flame size={14} />
          </span>
        )}
      </div>

      {/* Badges de Origem */}
      <div className="mb-3 flex flex-wrap gap-1">
        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 flex items-center w-fit gap-1 font-semibold">
          <Icons.User size={10} /> {(lead as any).assignee?.name?.split(' ')[0] || (isAdmin ? 'Aguardando' : 'Você')}
        </span>

        {visitedProps.length > 1 && (
          <span
            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 flex items-center w-fit gap-1 font-semibold"
            title="Visitou múltiplos imóveis"
          >
            <Icons.MapPin size={10} /> +{visitedProps.length - 1} vistos
          </span>
        )}
      </div>

      {/* Mensagem Curta */}
      {(lead as any).message && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2 bg-slate-50 p-2 rounded-lg italic border border-slate-100">
          "{(lead as any).message}"
        </p>
      )}

      {/* Footer do Card */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
          {(lead as any).property?.title || 'Interesse Geral'}
        </p>
        {isMasterView && (
          <p className="text-[11px] font-bold text-brand-600 bg-brand-50 w-fit px-2 py-0.5 rounded mt-2">{lead.status}</p>
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100/50">
          <div className="flex flex-col text-[10px] text-slate-400 font-medium">
            <span>Nesta etapa: {formatTimeInStage(lead.stage_updated_at || (lead as any).created_at || lead.createdAt)}</span>
            <span>Atualizado: {formatTimeInStage(lead.updated_at || (lead as any).created_at || lead.createdAt)} atrás</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  score > 60 ? 'bg-emerald-500' : score > 30 ? 'bg-amber-400' : 'bg-slate-300'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-600">{score}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper para DND Kit
const DraggableCardWrapper = ({
  lead,
  onClick,
  isAdmin,
  isMasterView
}: {
  lead: Lead;
  onClick: () => void;
  isAdmin: boolean;
  isMasterView: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="opacity-30 grayscale p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl h-[160px]"
      >
        {/* Placeholder vazio onde o card estava */}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <LeadCard lead={lead} onClick={onClick} isAdmin={isAdmin} isMasterView={isMasterView} />
    </div>
  );
};

// === PÁGINA PRINCIPAL ===

const AdminLeads: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFunnel = searchParams.get('funnel') || 'geral';
  const openLeadId = searchParams.get('open');
  const detailTabParam = searchParams.get('tab');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [kanbanConfig, setKanbanConfig] = useState<Record<string, string[]>>({
    pre_atendimento: ['Aguardando Atendimento', 'Tentando contato', 'Agendando'],
    atendimento: ['Aguardando atendimento', 'Sem Contato', 'Identificação de Interesse', 'Visita', 'Pedido'],
    proposta: ['Elaborando Proposta', 'Proposta em Aprovação', 'Proposta Fria', 'Proposta Aprovada', 'Proposta Recusada'],
    venda_ganha: ['Venda Fechada'],
    perdido: ['Sem contato', 'Apenas pesquisando', 'Contato Inválido', 'Valor Alto', 'Sem Entrada', 'Outros']
  });
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closingLead, setClosingLead] = useState<Lead | null>(null);
  const [dealValue, setDealValue] = useState('');
  const [isCustomValue, setIsCustomValue] = useState(false);
  const [savingClosing, setSavingClosing] = useState(false);
  const [availableProperties, setAvailableProperties] = useState<Property[]>([]);
  const [selectedSoldPropertyId, setSelectedSoldPropertyId] = useState<string>('');
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [savingNewLead, setSavingNewLead] = useState(false);
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean; lead: Lead | null; newFunnel: string; newStatus: string }>({
    isOpen: false,
    lead: null,
    newFunnel: '',
    newStatus: ''
  });
  const [transferForm, setTransferForm] = useState({ brokerId: '', note: '' });
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [updatingAdminToggle, setUpdatingAdminToggle] = useState(false);
  const [roleta, setRoleta] = useState<{
    stats: Array<{ id: string; name: string; count: number; lastTime: Date | null }>;
    rounds: number;
    loading: boolean;
  }>({ stats: [], rounds: 0, loading: false });
  const [showRoundAnimation, setShowRoundAnimation] = useState(false);
  const [draggedBrokerId, setDraggedBrokerId] = useState<string | null>(null);
  const [newLeadData, setNewLeadData] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
    source: 'manual'
  });

  const handleRoletaDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    // Pequeno delay para o visual do arrasto ficar fluido
    setTimeout(() => setDraggedBrokerId(id), 0);
  };

  const handleRoletaDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Obrigatório para permitir o Drop
    e.dataTransfer.dropEffect = 'move';
  };

  const handleRoletaDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedBrokerId || draggedBrokerId === targetId) return;

    setRoleta((prev) => {
      const oldIndex = prev.stats.findIndex((b) => b.id === draggedBrokerId);
      const newIndex = prev.stats.findIndex((b) => b.id === targetId);

      if (oldIndex === -1 || newIndex === -1) return prev;

      const newStats = [...prev.stats];
      const [movedItem] = newStats.splice(oldIndex, 1);
      newStats.splice(newIndex, 0, movedItem);

      // Atualiza também o dropdown da esquerda para já selecionar o novo "Primeiro da Fila"
      setTransferForm((f) => ({ ...f, brokerId: newStats[0].id }));

      return { ...prev, stats: newStats };
    });
    setDraggedBrokerId(null);
  };

  const fetchRoletaStats = async (withAdmins = includeAdmins) => {
    setRoleta((prev) => ({ ...prev, loading: true }));
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rolesToInclude = withAdmins ? ['corretor', 'admin', 'owner'] : ['corretor'];
      const { data: brokers } = await supabase.from('profiles').select('id, name').eq('active', true).in('role', rolesToInclude);

      const { data: leadsToday } = await supabase
        .from('leads')
        .select('assigned_to, stage_updated_at')
        .gte('stage_updated_at', today.toISOString())
        .not('assigned_to', 'is', null);

      if (brokers) {
        const stats = brokers.map((broker) => {
          const myLeads = (leadsToday || []).filter((l) => l.assigned_to === broker.id);
          const last = myLeads.sort((a, b) => new Date(b.stage_updated_at).getTime() - new Date(a.stage_updated_at).getTime())[0];
          return {
            id: broker.id,
            name: broker.name.split(' ')[0],
            count: myLeads.length,
            lastTime: last ? new Date(last.stage_updated_at) : null
          };
        });

        const rounds = stats.length > 0 ? Math.min(...stats.map((s) => s.count)) : 0;

        stats.sort((a, b) => {
          if (a.count !== b.count) return a.count - b.count;
          if (!a.lastTime) return -1;
          if (!b.lastTime) return 1;
          return a.lastTime.getTime() - b.lastTime.getTime();
        });

        setRoleta({ stats, rounds, loading: false });

        if (stats.length > 0) {
          setTransferForm((prev) => ({ ...prev, brokerId: stats[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
      setRoleta((prev) => ({ ...prev, loading: false }));
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const FUNNELS = [
    { id: 'pre_atendimento', label: 'Pré-Atendimento', adminOnly: true },
    { id: 'atendimento', label: 'Atendimento', adminOnly: false },
    { id: 'proposta', label: 'Proposta', adminOnly: false },
    { id: 'venda_ganha', label: 'Venda Fechada', adminOnly: false },
    { id: 'perdido', label: 'Perdidos', adminOnly: false }
  ];

  const effectiveFunnel = !isAdmin && currentFunnel === 'pre_atendimento' ? 'atendimento' : currentFunnel;
  const isMasterView = currentFunnel === 'geral';

  const currentColumns = isMasterView
    ? FUNNELS.filter((f) => isAdmin || !f.adminOnly).map((f) => f.id)
    : kanbanConfig[effectiveFunnel] || [];

  const getColumnTitle = (colId: string) => {
    if (isMasterView) return FUNNELS.find((f) => f.id === colId)?.label || colId;
    return colId;
  };

  const displayedLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (!isAdmin && lead.funnel_step === 'pre_atendimento') return false;

        const leadFunnel = lead.funnel_step || 'atendimento';
        if (!isMasterView && leadFunnel !== effectiveFunnel) return false;

        if (!isAdmin && lead.assigned_to !== user?.id) return false;

        return true;
      }),
    [effectiveFunnel, isAdmin, isMasterView, leads, user?.id]
  );

  const fetchLeads = async () => {
    if (!user?.id) return;
    const shouldShowInitialLoading = leads.length === 0;
    if (shouldShowInitialLoading) setLoading(true);

    try {
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('assigned_to', user.id);

      const { data: leadsData, error: leadsError } = await query;
      if (leadsError) throw leadsError;

      const propIds = Array.from(new Set((leadsData || []).map((l: any) => l.property_id || l.propertyId).filter(Boolean)));
      const propertiesMap = new Map();

      if (propIds.length > 0) {
        const { data: propsData } = await supabase.from('properties').select('id, title, price, agent_id, profiles(name)').in('id', propIds);
        (propsData || []).forEach((p: any) => {
          propertiesMap.set(p.id, {
            id: p.id,
            title: p.title,
            price: p.price,
            agent_id: p.agent_id,
            agent: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
          });
        });
      }

      const assigneeIds = Array.from(new Set((leadsData || []).map((l: any) => l.assigned_to).filter(Boolean)));
      const assigneesMap = new Map();
      if (assigneeIds.length > 0) {
        const { data: assigneesData } = await supabase.from('profiles').select('id, name').in('id', assigneeIds);
        (assigneesData || []).forEach((a: any) => assigneesMap.set(a.id, a));
      }

      const formattedLeads = (leadsData || []).map((lead: any) => {
        // Normaliza leads que entram de integrações/site com status "Novo" ou vazio para o padrão correto do CRM
        let status = lead.status;
        if (!status || status === 'Novo') {
          status = 'Aguardando Atendimento';
        }

        return {
          ...lead,
          status,
          property: propertiesMap.get(lead.property_id || lead.propertyId),
          assignee: assigneesMap.get(lead.assigned_to)
        };
      });

      setLeads(formattedLeads as Lead[]);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Erro ao buscar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  useEffect(() => {
    if (!isAdmin && currentFunnel === 'pre_atendimento') {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('funnel', 'atendimento');
        return next;
      }, { replace: true });
    }
  }, [currentFunnel, isAdmin, setSearchParams]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('kanban_config, include_admins_in_roulette').eq('id', 1).single();
      if (data) {
        if (data.kanban_config) {
          setKanbanConfig(data.kanban_config as Record<string, string[]>);
        }
        if (data.include_admins_in_roulette !== undefined) {
          setIncludeAdmins(data.include_admins_in_roulette);
        }
      }
    };

    fetchSettings();
  }, []);

  const fetchAvailableProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, price, status')
        .order('title', { ascending: true });

      if (error) throw error;
      if (data) {
        // Filtra usando apenas o status
        const available = data.filter((p: any) => p.status !== 'Vendido' && p.status !== 'Alugado');
        setAvailableProperties(available as any);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Erro ao buscar imóveis disponíveis:', error);
    }
  };

  useEffect(() => {
    fetchAvailableProperties();
  }, []);

  const selectedLead = useMemo(() => {
    if (!openLeadId) return null;
    return leads.find((lead) => lead.id === openLeadId) || null;
  }, [leads, openLeadId]);

  const handleToggleAdminsInRoulette = async (newValue: boolean) => {
    setUpdatingAdminToggle(true);
    setIncludeAdmins(newValue);
    try {
      await supabase.from('settings').update({ include_admins_in_roulette: newValue }).eq('id', 1);
      await fetchRoletaStats(newValue);
    } catch (e) {
      console.error('Erro ao atualizar config da roleta', e);
    } finally {
      setUpdatingAdminToggle(false);
    }
  };

  const openLeadDetails = (lead: Lead) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('open', lead.id);
      return next;
    }, { replace: true });
  };

  const closeLeadDetails = () => {
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (openLeadId && !selectedLead && !loading) {
      setSearchParams({}, { replace: true });
    }
  }, [loading, openLeadId, selectedLead, setSearchParams]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = String(over.id);
    const lead = leads.find((l) => l.id === leadId);

    if (!currentColumns.includes(newStatus)) return;

    if (lead && (isMasterView || lead.status !== newStatus)) {
      const newFunnel = isMasterView ? newStatus : effectiveFunnel;
      const targetStatus = isMasterView ? kanbanConfig[newFunnel]?.[0] || 'Aguardando Atendimento' : newStatus;

      if (isAdmin && lead.funnel_step === 'pre_atendimento' && newFunnel !== 'pre_atendimento') {
        setTransferModal({ isOpen: true, lead, newFunnel, newStatus: targetStatus });
        setTransferForm({ brokerId: '', note: '' });
        fetchRoletaStats(includeAdmins);
        return;
      }

      if (targetStatus === LeadStatus.CLOSED || (newFunnel === 'venda_ganha' && targetStatus.toLowerCase().includes('fechada'))) {
        setClosingLead(lead);
        // Busca o imóvel principal ou o primeiro adicionado manualmente nos interesses
        const mainProp = (lead as any).property || (lead as any).interested_properties?.[0];
        const suggestedValue = Number(mainProp?.price || 0);
        setSelectedSoldPropertyId(mainProp?.id || (lead as any).property_id || '');
        setIsCustomValue(false);
        setDealValue(suggestedValue > 0 ? String(Math.round(suggestedValue)) : '');
        return;
      }

      const now = new Date().toISOString();
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: targetStatus, funnel_step: newFunnel, stage_updated_at: now } : l)));
      const { error } = await supabase
        .from('leads')
        .update({ status: targetStatus, funnel_step: newFunnel, stage_updated_at: now })
        .eq('id', leadId);

      if (!error && lead.assigned_to && lead.assigned_to !== user?.id) {
        await supabase.from('notifications').insert([
          {
            user_id: lead.assigned_to,
            title: 'Etapa do Lead Atualizada',
            message: `O lead ${lead.name} foi movido para ${targetStatus}.`,
            type: 'system',
            read: false,
            company_id: user.company_id,
          }
        ]);
      }

      if (!error && user?.id && (targetStatus === LeadStatus.VISIT || targetStatus === LeadStatus.PROPOSAL)) {
        await addXp(user.id, 20);
      }
    }
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModal.lead || !transferForm.brokerId) return;
    setConfirmingTransfer(true);

    try {
      const now = new Date().toISOString();

      await supabase
        .from('leads')
        .update({
          funnel_step: transferModal.newFunnel,
          status: transferModal.newStatus,
          assigned_to: transferForm.brokerId,
          stage_updated_at: now
        })
        .eq('id', transferModal.lead.id);

      if (transferForm.note.trim()) {
        const authorName = user?.name?.split(' ')[0] || 'Admin';
        await supabase.from('timeline_events').insert([
          {
            lead_id: transferModal.lead.id,
            type: 'note',
            description: `${transferForm.note}\n\n(Transferido por ${authorName})`,
            company_id: user.company_id,
          }
        ]);
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === transferModal.lead?.id
            ? {
                ...l,
                status: transferModal.newStatus,
                funnel_step: transferModal.newFunnel,
                assigned_to: transferForm.brokerId,
                stage_updated_at: now
              }
            : l
        )
      );

      const targetBroker = roleta.stats.find((b) => b.id === transferForm.brokerId);
      if (targetBroker && targetBroker.count === roleta.rounds) {
        const others = roleta.stats.filter((b) => b.id !== targetBroker.id);
        const allOthersAbove = others.every((b) => b.count > roleta.rounds);
        if (allOthersAbove) {
          setShowRoundAnimation(true);
          setTimeout(() => setShowRoundAnimation(false), 3500);
        }
      }

      // Guarda os valores antes de limpar o modal
      const leadToClose = transferModal.lead;
      const targetFunnel = transferModal.newFunnel;
      const targetStatus = transferModal.newStatus;
      setTransferModal({ isOpen: false, lead: null, newFunnel: '', newStatus: '' });

      // Se a transferência foi direto para Fechado, abre o modal de Venda logo a seguir
      if (leadToClose && (targetStatus === LeadStatus.CLOSED || (targetFunnel === 'venda_ganha' && targetStatus.toLowerCase().includes('fechada')))) {
        setTimeout(() => {
          setClosingLead(leadToClose);
          const mainProp = (leadToClose as any).property || (leadToClose as any).interested_properties?.[0];
          const suggestedValue = Number(mainProp?.price || 0);
          setSelectedSoldPropertyId(mainProp?.id || (leadToClose as any).property_id || '');
          setIsCustomValue(false);
          setDealValue(suggestedValue > 0 ? String(Math.round(suggestedValue)) : '');
        }, 300);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao transferir.');
    } finally {
      setConfirmingTransfer(false);
    }
  };

  const handleCloseSale = async () => {
    if (!closingLead || !selectedSoldPropertyId || !dealValue) {
      addToast('Por favor, confirme o imóvel e o valor final negociado.', 'error');
      return;
    }

    setSavingClosing(true);
    try {
      const closedLeadId = closingLead.id;

      // 1. Atualizar o Lead para Venda Fechada
      const { error: leadError } = await supabase.from('leads').update({
        status: 'Fechado',
        funnel_step: 'venda_ganha',
        property_id: selectedSoldPropertyId,
        deal_value: Number(dealValue),
        stage_updated_at: new Date().toISOString()
      }).eq('id', closingLead.id);
      if (leadError) throw leadError;

      // 2. Dar baixa no Imóvel
      const { error: propError } = await supabase.from('properties').update({ status: 'Vendido' }).eq('id', selectedSoldPropertyId);
      if (propError) console.error('Erro ao dar baixa no imóvel:', propError);

      // 3. Adicionar o grande momento na Timeline
      await supabase.from('timeline_events').insert([{
        lead_id: closingLead.id,
        type: 'status_change',
        description: `🎉 VENDA FECHADA! Imóvel negociado por ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(dealValue))}.`,
        company_id: (user as any)?.company_id,
      }]);

      // 4. XP de gamificação
      if (user?.id) await addXp(user.id, 500);

      // 5. Finalizar a UI
      addToast('Venda Registada com Sucesso! Parabéns! 🎉', 'success');
      setClosingLead(null);
      setDealValue('');
      setSelectedSoldPropertyId('');
      setIsCustomValue(false);
      fetchLeads();
      fetchAvailableProperties();
      navigate(`/admin/clientes?editLeadId=${closedLeadId}`);
    } catch (error) {
      console.error('Erro ao fechar venda:', error);
      addToast('Erro ao processar o fechamento da venda.', 'error');
    } finally {
      setSavingClosing(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!newLeadData.name.trim() || !newLeadData.phone.trim()) {
      alert('Nome e telefone são obrigatórios.');
      return;
    }

    setSavingNewLead(true);

    const { data: settings } = await supabase.from('settings').select('route_to_central').single();
    const routeToCentral = settings?.route_to_central ?? true;

    const payload = {
      name: newLeadData.name.trim(),
      phone: newLeadData.phone.trim(),
      email: newLeadData.email.trim() || null,
      message: newLeadData.message.trim() || null,
      status: routeToCentral
        ? kanbanConfig.pre_atendimento?.[0] || 'Aguardando Atendimento'
        : kanbanConfig.atendimento?.[0] || 'Aguardando atendimento',
      source: newLeadData.source,
      assigned_to: isAdmin && routeToCentral ? null : user.id,
      funnel_step: routeToCentral ? 'pre_atendimento' : 'atendimento',
      stage_updated_at: new Date().toISOString(),
      company_id: user.company_id,
    };

    const { error } = await supabase.from('leads').insert(payload);

    if (error) {
      console.error('Erro ao criar lead manualmente:', error);
      alert(`Não foi possível criar o lead: ${error.message}`);
      setSavingNewLead(false);
      return;
    }

    setNewLeadData({ name: '', phone: '', email: '', message: '', source: 'manual' });
    setIsNewLeadModalOpen(false);
    await fetchLeads();
    setSavingNewLead(false);
  };

  const activeLead = useMemo(() => (activeId ? leads.find((l) => l.id === activeId) : null), [activeId, leads]);

  if (loading && leads.length === 0) return <Loading />;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col animate-fade-in">
      <div className="mb-6 flex flex-col lg:flex-row justify-between lg:items-center gap-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-800 flex items-center gap-2">
              Funil de Vendas
              <InfoTooltip text={TOOLTIPS.leads.pageTitle} />
            </h1>
            <p className="text-sm text-slate-500">Arraste os cards entre as etapas do funil selecionado.</p>
          </div>

          <span className={`text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase border w-fit ${
            isAdmin
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isAdmin ? 'Visão Admin (Total)' : 'Meus Leads'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
          <span className="text-xs font-semibold px-3 py-2 rounded-full bg-slate-100 text-slate-600 uppercase text-center sm:text-left border border-slate-200 w-full sm:w-auto">
            Funil: {isMasterView ? 'geral' : effectiveFunnel.replace('_', ' ')}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsNewLeadModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-5 py-2.5 sm:py-2 rounded-lg text-sm font-bold hover:bg-brand-700 transition-colors shadow-sm w-full sm:w-auto"
            >
              <Icons.Plus size={16} /> Novo Lead
            </button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex h-full gap-6 min-w-max px-1">
            {currentColumns.map((statusName) => (
              <DroppableColumn
                key={statusName}
                id={statusName}
                count={displayedLeads.filter((l) => (isMasterView ? l.funnel_step === statusName : l.status === statusName)).length}
                title={getColumnTitle(statusName)}
                onClickTitle={isMasterView ? () => setSearchParams({ funnel: statusName }) : undefined}
              >
                {displayedLeads
                  .filter((l) => (isMasterView ? l.funnel_step === statusName : l.status === statusName))
                  .map((lead) => (
                    <DraggableCardWrapper
                      key={lead.id}
                      lead={lead}
                      isAdmin={isAdmin}
                      isMasterView={isMasterView}
                      onClick={() => openLeadDetails(lead)}
                    />
                  ))}
              </DroppableColumn>
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeLead ? <LeadCard lead={activeLead} isAdmin={isAdmin} isMasterView={isMasterView} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {selectedLead && (
        <LeadDetailsSidebar
          lead={selectedLead}
          kanbanConfig={kanbanConfig}
          initialTab={detailTabParam === 'activity' ? 'timeline' : undefined}
          onClose={closeLeadDetails}
          onStageChange={async (newFunnel, newStatus) => {
            if (newStatus === LeadStatus.CLOSED || (newFunnel === 'venda_ganha' && newStatus.toLowerCase().includes('fechada'))) {
              closeLeadDetails();
              setClosingLead(selectedLead);
              const suggestedValue = Number((selectedLead as any)?.property?.price || 0);
              setSelectedSoldPropertyId('');
              setIsCustomValue(false);
              setDealValue(suggestedValue > 0 ? String(Math.round(suggestedValue)) : '');
              return;
            }
            const now = new Date().toISOString();
            setLeads((prev) =>
              prev.map((l) => (l.id === selectedLead.id ? { ...l, status: newStatus, funnel_step: newFunnel, stage_updated_at: now } : l))
            );
            const { error } = await supabase
              .from('leads')
              .update({ status: newStatus, funnel_step: newFunnel, stage_updated_at: now })
              .eq('id', selectedLead.id);

            if (!error && user?.id && (newStatus === LeadStatus.VISIT || newStatus === LeadStatus.PROPOSAL)) {
              await addXp(user.id, 20);
            }
          }}
          onLeadUpdate={(leadId, updates) => {
            setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...updates } : l)));
          }}
          onRequestTransfer={(newFunnel, newStatus) => {
            if (isAdmin && selectedLead) {
              setTransferModal({ isOpen: true, lead: selectedLead, newFunnel, newStatus });
              setTransferForm({ brokerId: '', note: '' });
              fetchRoletaStats(includeAdmins);
            }
          }}
        />
      )}

      {/* MODAL DE VENDA FECHADA (UI PREMIUM) */}
      {closingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">

            {/* Header de Celebração */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-white/30 shadow-inner">
                <Icons.Trophy size={32} className="text-yellow-300 drop-shadow-md" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Negócio Fechado! 🎉</h2>
              <p className="text-emerald-50 text-sm font-medium">
                Preencha os dados finais para registar a venda para <b className="text-white">{closingLead.name}</b>.
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Resumo do Imóvel de Interesse */}
              {(() => {
                const mainProp = (closingLead as any).property || (closingLead as any).interested_properties?.[0];
                if (!mainProp) return null;
                return (
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                      <Icons.Home size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Imóvel de Interesse do Lead</p>
                      <p className="font-bold text-slate-800 text-sm line-clamp-2">{mainProp.title}</p>
                      <p className="text-emerald-600 font-bold mt-1 text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mainProp.price || 0)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Seleção do Imóvel Fechado */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Confirmar Imóvel Fechado *</label>
                <div className="relative">
                  <Icons.Home className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    value={selectedSoldPropertyId}
                    onChange={(e) => {
                      setSelectedSoldPropertyId(e.target.value);
                      // Busca primeiro nos disponíveis, depois no imóvel do lead
                      const prop = availableProperties.find(p => p.id === e.target.value)
                        || (closingLead as any).property
                        || (closingLead as any).interested_properties?.find((p: any) => p.id === e.target.value);
                      if (prop && !isCustomValue) {
                        setDealValue(prop.price ? String(Math.round(Number(prop.price))) : '');
                      }
                    }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none font-medium"
                  >
                    <option value="">Selecione o imóvel vendido...</option>
                    {/* Fallback: se o imóvel pré-selecionado não está na lista de disponíveis, exibe mesmo assim */}
                    {selectedSoldPropertyId && !availableProperties.find(p => p.id === selectedSoldPropertyId) && (() => {
                      const mp = (closingLead as any).property
                        || (closingLead as any).interested_properties?.find((p: any) => p.id === selectedSoldPropertyId);
                      if (mp) return <option value={mp.id}>{mp.title}</option>;
                      return null;
                    })()}
                    {availableProperties.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <Icons.ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>

              {/* Valor Fechado */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-slate-700">Valor Final Negociado *</label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-600 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isCustomValue}
                      onChange={(e) => setIsCustomValue(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    Alterar valor do anúncio
                  </label>
                </div>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${!isCustomValue && selectedSoldPropertyId ? 'text-slate-400' : 'text-emerald-600'}`}>R$</span>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    readOnly={!isCustomValue && !!selectedSoldPropertyId}
                    className={`w-full pl-12 pr-4 py-3 rounded-xl border outline-none text-lg font-bold transition-colors ${
                      !isCustomValue && selectedSoldPropertyId
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                        : 'bg-white border-emerald-200 focus:ring-2 focus:ring-emerald-500 text-emerald-600'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {!isCustomValue && selectedSoldPropertyId && (
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <Icons.Info size={12} /> Valor bloqueado ao preço do anúncio. Marque a caixa acima para negociar desconto.
                  </p>
                )}
              </div>
            </div>

            {/* Footer de Ações */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setClosingLead(null); setDealValue(''); setIsCustomValue(false); setSelectedSoldPropertyId(''); }}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseSale}
                disabled={savingClosing || !selectedSoldPropertyId || !dealValue}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingClosing
                  ? <><Icons.Loader2 size={18} className="animate-spin" /> Confirmando...</>
                  : <><Icons.CheckCircle2 size={18} /> Confirmar Venda</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Novo Lead Manual</h3>
              <p className="text-sm text-slate-500 mt-1">Cadastre um contato recebido por telefone, portaria ou atendimento presencial.</p>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome *</label>
                <input
                  type="text"
                  value={newLeadData.name}
                  onChange={(e) => setNewLeadData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp/Telefone *</label>
                <input
                  type="tel"
                  value={newLeadData.phone}
                  onChange={(e) => setNewLeadData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Origem do Lead</label>
                <select
                  value={newLeadData.source}
                  onChange={(e) => setNewLeadData((prev) => ({ ...prev, source: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="manual">Manual (Balcão/Telefone)</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="google">Google</option>
                  <option value="indicacao">Indicação</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="site">Site</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  value={newLeadData.email}
                  onChange={(e) => setNewLeadData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="cliente@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observação Inicial</label>
                <textarea
                  value={newLeadData.message}
                  onChange={(e) => setNewLeadData((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 min-h-[96px]"
                  placeholder="Ex: Procura apartamento 3 quartos no centro"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewLeadModalOpen(false);
                    setNewLeadData({ name: '', phone: '', email: '', message: '', source: 'manual' });
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNewLead}
                  className="px-5 py-2 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingNewLead ? 'Salvando...' : 'Salvar Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferModal.isOpen && transferModal.lead && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
            <div className="flex-1 p-8 border-b md:border-b-0 md:border-r border-slate-100">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Distribuir Lead</h2>
              <p className="text-sm text-slate-500 mb-6">Qualifique e direcione o cliente para um corretor.</p>

              <form onSubmit={handleConfirmTransfer} className="space-y-5">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Cliente</label>
                    <input type="text" disabled value={transferModal.lead.name} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                    <input type="text" disabled value={transferModal.lead.phone} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalhes do Atendimento (Nota)</label>
                  <textarea
                    required
                    placeholder="Ex: Cliente busca 3 quartos até R$ 800k. Já tem financiamento aprovado..."
                    value={transferForm.note}
                    onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-600 uppercase mb-1">Selecionar Corretor</label>
                  <select
                    required
                    value={transferForm.brokerId}
                    onChange={(e) => setTransferForm({ ...transferForm, brokerId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-brand-200 outline-none focus:ring-2 focus:ring-brand-500 bg-brand-50 font-bold text-brand-800"
                  >
                    <option value="" disabled>
                      Escolha o corretor...
                    </option>
                    {roleta.stats.map((broker) => (
                      <option key={broker.id} value={broker.id}>
                        {broker.name} (Recebeu {broker.count} hoje)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTransferModal({ isOpen: false, lead: null, newFunnel: '', newStatus: '' })}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={confirmingTransfer || !transferForm.brokerId}
                    className="px-6 py-2.5 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {confirmingTransfer ? 'Transferindo...' : 'Transferir Lead'} <Icons.ArrowRight size={18} />
                  </button>
                </div>
              </form>
            </div>

            <div className="w-full md:w-96 bg-slate-50 p-8 relative overflow-hidden">
              {showRoundAnimation && (
                <div className="absolute inset-0 z-10 bg-emerald-500 flex flex-col items-center justify-center text-white animate-fade-in">
                  <Icons.CheckCircle size={64} className="mb-4 animate-bounce" />
                  <h3 className="text-2xl font-bold text-center">Rodada {roleta.rounds} Concluída!</h3>
                  <p className="text-emerald-100 text-center text-sm mt-2 px-6">Todos os corretores receberam leads. A roleta reiniciou!</p>
                </div>
              )}

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                  <Icons.RefreshCw size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Roleta de Leads</h3>
                  <p className="text-xs font-bold text-indigo-600">Rodada Atual: {roleta.rounds + 1}</p>
                </div>
              </div>

              {/* TOGGLE PARA INCLUIR ADMIN */}
              {isAdmin && (
                <div className="mb-6 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition-opacity">
                  <div className="flex items-center gap-2">
                    <Icons.Shield size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">Incluir Admin na Roleta</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={includeAdmins}
                      disabled={updatingAdminToggle}
                      onChange={(e) => handleToggleAdminsInRoulette(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                  </label>
                </div>
              )}

              {roleta.loading ? (
                <div className="flex justify-center py-10">
                  <Icons.Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    <div className="col-span-5">Corretor</div>
                    <div className="col-span-3 text-center">Nesta R.</div>
                    <div className="col-span-2 text-center">Qtd.</div>
                    <div className="col-span-2 text-right">Hora</div>
                  </div>

                  {roleta.stats.map((broker, idx) => {
                    const isInThisRound = broker.count > roleta.rounds;
                    const isNext = idx === 0; // O primeiro da lista é o próximo ideal

                    return (
                      <div
                        key={broker.id}
                        draggable
                        onDragStart={(e) => handleRoletaDragStart(e, broker.id)}
                        onDragOver={handleRoletaDragOver}
                        onDrop={(e) => handleRoletaDrop(e, broker.id)}
                        onDragEnd={() => setDraggedBrokerId(null)}
                        className={`grid grid-cols-12 items-center p-3 rounded-xl border cursor-move transition-all duration-200 ${
                          draggedBrokerId === broker.id ? 'opacity-40 scale-[0.98] border-dashed border-slate-400 bg-slate-100' : ''
                        } ${isNext && draggedBrokerId !== broker.id ? 'bg-white border-brand-300 shadow-sm ring-1 ring-brand-100' : 'bg-white/50 border-slate-200'
                        }`}
                      >
                        <div className="col-span-5 flex items-center gap-2">
                          <Icons.Menu size={14} className="text-slate-300 hover:text-slate-500 shrink-0" title="Arraste para reordenar" />
                          <div className={`w-2 h-2 rounded-full shrink-0 ${isNext ? 'bg-brand-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className={`text-sm truncate ${isNext ? 'font-bold text-brand-700' : 'font-semibold text-slate-600'}`}>{broker.name}</span>
                        </div>
                        <div className="col-span-3 flex justify-center">
                          {isInThisRound ? <Icons.CheckCircle size={14} className="text-emerald-500" /> : <span className="w-2 h-0.5 bg-slate-300 rounded" />}
                        </div>
                        <div className="col-span-2 text-center text-xs font-bold text-slate-500">{broker.count}</div>
                        <div className="col-span-2 text-right text-[10px] text-slate-400 font-medium">
                          {broker.lastTime ? broker.lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeads;
