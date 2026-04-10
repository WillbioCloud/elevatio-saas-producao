import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lead, LeadMatch, LeadStatus, Task, TimelineEvent, Property } from '../types';
import { Icons } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { findSmartMatches, mapPropertyToCandidate, SmartMatchResult } from '../services/ai';
import { calculateDealPoints } from '../services/gamification';
import { Kbd } from './ui/kbd';
import { Textarea } from './ui/textarea';

interface Template {
  id: string;
  title: string;
  content: string;
}

interface LeadProfileForm {
  budget: string;
  desired_type: string;
  desired_bedrooms: string;
  desired_location: string;
}

interface SmartMatchView {
  property_id: string;
  property: Property;
  match_score: number;
  match_reason: string;
}

interface AiTaskSuggestion {
  title: string;
  description?: string;
  priority?: string;
  due_in_hours?: number;
}

const normalizeAiTaskSuggestion = (value: unknown): AiTaskSuggestion | null => {
  if (!value) return null;

  let suggestion = value;
  if (typeof value === 'string') {
    try {
      suggestion = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!suggestion || typeof suggestion !== 'object') return null;

  const candidate = suggestion as Partial<AiTaskSuggestion>;
  if (!candidate.title || typeof candidate.title !== 'string') return null;

  return {
    title: candidate.title,
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    priority: typeof candidate.priority === 'string' ? candidate.priority : undefined,
    due_in_hours: Number.isFinite(Number(candidate.due_in_hours)) ? Number(candidate.due_in_hours) : undefined
  };
};

const getLeadAiSuggestion = (lead: Lead): AiTaskSuggestion | null => {
  const leadWithMetadata = lead as Lead & {
    aiSuggestion?: unknown;
    ai_suggestion?: unknown;
    metadata?: {
      aiSuggestion?: unknown;
      ai_suggestion?: unknown;
    };
  };

  return normalizeAiTaskSuggestion(
    leadWithMetadata.aiSuggestion
      ?? leadWithMetadata.ai_suggestion
      ?? leadWithMetadata.metadata?.aiSuggestion
      ?? leadWithMetadata.metadata?.ai_suggestion
  );
};

const DEFAULT_TEMPLATES: Template[] = [
  { id: '1', title: '👋 Saudação Inicial', content: 'Olá {nome}, tudo bem? Sou da TR Imóveis. Vi que se interessou pelo {imovel}. Podemos conversar?' },
  { id: '2', title: '📅 Agendar Visita', content: 'Oi {nome}, gostaria de agendar uma visita para conhecer o {imovel}? Tenho horários livres.' },
  { id: '3', title: '❓ Falta de Resposta', content: 'Olá {nome}, ainda tem interesse no {imovel}? Se não, vou encerrar seu atendimento por enquanto.' }
];

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface LeadDetailsSidebarProps {
  lead: Lead;
  kanbanConfig: Record<string, string[]>;
  onClose: () => void;
  initialTab?: TabId;
  onStageChange?: (newFunnel: string, newStatus: string) => void;
  onStatusChange?: (status: LeadStatus | string) => void;
  onLeadUpdate?: (leadId: string, updates: Partial<Lead>) => void;
  onRequestTransfer?: (newFunnel: string, newStatus: string) => void;
}

type TabId = 'timeline' | 'smart_match' | 'whatsapp' | 'history' | 'tasks' | 'info';
type InfoTabId = 'profile' | 'smart_match';

const LeadDetailsSidebar: React.FC<LeadDetailsSidebarProps> = ({ lead, kanbanConfig, onClose, initialTab, onStageChange, onStatusChange, onLeadUpdate, onRequestTransfer }) => {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const Maps = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (initialTab) return initialTab;
    const storedTab = localStorage.getItem('lead_sidebar_last_tab');
    return (storedTab as TabId) || 'timeline';
  });
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTabId>('profile');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newNote, setNewNote] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [originProperty, setOriginProperty] = useState<Property | null>(null);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [interestedProps, setInterestedProps] = useState<any[]>([]);
  const [selectedNewProp, setSelectedNewProp] = useState('');
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [aiSuggestion, setAiSuggestion] = useState<AiTaskSuggestion | null>(() => getLeadAiSuggestion(lead));
  const [changingAgent, setChangingAgent] = useState(false);
  const [profileForm, setProfileForm] = useState<LeadProfileForm>({
    budget: lead.budget ? String(lead.budget) : '',
    desired_type: lead.desired_type || '',
    desired_bedrooms: lead.desired_bedrooms ? String(lead.desired_bedrooms) : '',
    desired_location: lead.desired_location || ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingSmartMatch, setLoadingSmartMatch] = useState(false);
  const [smartMatches, setSmartMatches] = useState<SmartMatchView[]>([]);
  const [smartMatchMessage, setSmartMatchMessage] = useState('');
  const [hasStoredSmartMatches, setHasStoredSmartMatches] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const FUNNELS = [
    { id: 'pre_atendimento', label: 'Pré-atend.', color: 'bg-slate-400' },
    { id: 'atendimento', label: 'Atend.', color: 'bg-blue-500' },
    { id: 'proposta', label: 'Proposta', color: 'bg-amber-500' },
    { id: 'venda_ganha', label: 'Fechado', color: 'bg-emerald-500' },
    { id: 'perdido', label: 'Perdido', color: 'bg-red-500' }
  ];

  const [selectedFunnel, setSelectedFunnel] = useState(lead.funnel_step || 'atendimento');
  const [selectedStatus, setSelectedStatus] = useState(lead.status);

  useEffect(() => {
    setSelectedFunnel(lead.funnel_step || 'atendimento');
    setSelectedStatus(lead.status);
  }, [lead.funnel_step, lead.status]);

  useEffect(() => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [newNote, activeTab]);

  useEffect(() => {
    setAiSuggestion(getLeadAiSuggestion(lead));
  }, [lead]);

  const handleStageChange = async () => {
    if (lead.funnel_step === 'pre_atendimento' && selectedFunnel !== 'pre_atendimento') {
      if (onRequestTransfer) {
        onRequestTransfer(selectedFunnel, selectedStatus);
        return;
      }
    }

    // Se o Pai mandou o onStageChange, DELEGAMOS 100% PARA ELE.
    // Não damos toast nem gravamos timeline aqui, pois se for Venda Fechada, o modal precisa ser confirmado primeiro!
    if (onStageChange) {
      onStageChange(selectedFunnel, selectedStatus);
      return;
    }

    // Fallback de segurança
    const now = new Date().toISOString();
    const { error } = await supabase.from('leads').update({ 
      funnel_step: selectedFunnel, 
      status: selectedStatus,
      stage_updated_at: now
    }).eq('id', lead.id);

    if (error) {
      console.error(error);
      addToast('Erro ao atualizar status', 'error');
      return;
    }

    if (typeof onStatusChange === 'function') onStatusChange(selectedStatus as string);
    onLeadUpdate?.(lead.id, { funnel_step: selectedFunnel, status: String(selectedStatus) });
    await addTimelineLog('status_change', `Avançou para: ${selectedStatus}`);
    addToast('Status atualizado!', 'success');
  };


  const leadFirstName = useMemo(() => (lead.name || '').trim().split(' ')[0] || 'Cliente', [lead.name]);
  const leadPhoneClean = useMemo(() => (lead.phone || '').replace(/\D/g, ''), [lead.phone]);

  const addTimelineLog = async (type: TimelineEvent['type'], description: string) => {
    const { error } = await supabase.from('timeline_events').insert([{ 
      lead_id: lead.id, 
      type, 
      description: description,
      company_id: (user as any)?.company_id,
      created_by: user?.id
    }]);

    if (error) console.error("Erro na timeline:", error);

    const { data } = await supabase
      .from('timeline_events')
      .select('*, profiles!timeline_events_created_by_fkey(name, avatar_url)')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });

    if (data) setEvents(data as any);
  };

  useEffect(() => {
    setProfileForm({
      budget: lead.budget ? String(lead.budget) : '',
      desired_type: lead.desired_type || '',
      desired_bedrooms: lead.desired_bedrooms ? String(lead.desired_bedrooms) : '',
      desired_location: lead.desired_location || ''
    });
  }, [lead]);

  useEffect(() => {
    const fetchData = async () => {
      if (!lead?.id) return;

      const [tasksRes, eventsRes, templatesRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('lead_id', lead.id).order('due_date', { ascending: true }),
        supabase.from('timeline_events').select('*, profiles!timeline_events_created_by_fkey(name, avatar_url)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
        supabase.from('message_templates').select('*').eq('active', true)
      ]);

      const { data: propsData } = await supabase.from('properties').select('id, title, price, status').eq('status', 'Disponível');
      if (propsData) setAllProperties(propsData as any[]);

      const savedInterests = (lead as any).interested_properties || [];
      setInterestedProps(savedInterests);

      if (tasksRes.data) setTasks(tasksRes.data as any);
      // Tratamento de erro explícito para a Timeline
      if (eventsRes.error) {
        console.error('🚨 Erro ao buscar Timeline (Possível falha de Cache/Foreign Key):', eventsRes.error);
        addToast('Aviso: Falha ao carregar alguns itens do histórico.', 'error');
      } else if (eventsRes.data) {
        setEvents(eventsRes.data as any);
      }
      if (templatesRes.data && templatesRes.data.length > 0) setTemplates(templatesRes.data as any);

      const { data: storedMatches } = await supabase
        .from('lead_matches')
        .select('id, lead_id, property_id, match_score, match_reason, property:properties!leads_property_id_fkey(*)')
        .eq('lead_id', lead.id)
        .order('match_score', { ascending: false });

      if (storedMatches && storedMatches.length > 0) {
        const loadedMatches = (storedMatches as LeadMatch[])
          .filter((match) => Boolean(match.property))
          .map((match) => ({
            property_id: match.property_id,
            property: match.property as Property,
            match_score: match.match_score,
            match_reason: match.match_reason
          }));

        setSmartMatches(loadedMatches);
        setHasStoredSmartMatches(loadedMatches.length > 0);
      } else {
        setSmartMatches([]);
        setHasStoredSmartMatches(false);
      }

      const joinedProperty = (lead as any).property;
      const propId = (lead as any).property_id || (lead as any).propertyId;

      if (joinedProperty) {
        setOriginProperty(joinedProperty);
      } else if (propId) {
        const { data: p } = await supabase.from('properties').select('*').eq('id', propId).single();
        if (p) {
          setOriginProperty(p as any);
        }
      }
    };

    fetchData();
  }, [lead.id]);

  const handleAddInterest = async () => {
    if (!selectedNewProp) return;
    const prop = allProperties.find(p => p.id === selectedNewProp);
    if (!prop) return;

    const newList = [...interestedProps, { id: prop.id, title: prop.title, price: prop.price }];
    setInterestedProps(newList);
    setSelectedNewProp('');

    await supabase.from('leads').update({ interested_properties: newList }).eq('id', lead.id);
    await addTimelineLog('system', `Adicionou interesse no imóvel: ${prop.title}`);
  };

  const handleRemoveInterest = async (indexToRemove: number) => {
    if (!window.confirm('Remover este imóvel dos interesses?')) return;

    const propToRemove = interestedProps[indexToRemove];
    const newList = interestedProps.filter((_, i) => i !== indexToRemove);
    setInterestedProps(newList);

    await supabase.from('leads').update({ interested_properties: newList }).eq('id', lead.id);
    await addTimelineLog('system', `Removeu o interesse no imóvel: ${propToRemove.title}`);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    const payload = { 
      title: newTask, 
      lead_id: lead.id, 
      completed: false, 
      type: 'call', 
      due_date: new Date().toISOString(),
      user_id: user.id,
      company_id: user.company_id,
    };
    const { data } = await supabase.from('tasks').insert([payload]).select().single();
    if (data) {
      setTasks((prev) => [...prev, data as any]);
      setNewTask('');
      await addTimelineLog('system', `Criou a tarefa: ${payload.title}`);
    }
  };

  const handleAcceptAiSuggestion = async () => {
    if (!user?.id || !user.company_id || !lead || !aiSuggestion?.title) return;

    try {
      // Calcula a data de vencimento baseada nas horas sugeridas pela Aura.
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + (aiSuggestion.due_in_hours || 24));

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          company_id: user.company_id,
          user_id: user.id,
          lead_id: lead.id,
          title: aiSuggestion.title,
          description: aiSuggestion.description,
          priority: aiSuggestion.priority,
          due_date: dueDate.toISOString(),
          status: 'pendente',
          completed: false,
          type: 'other'
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTasks((prev) => [...prev, data as any]);
      }

      addToast('Tarefa adicionada com sucesso à sua agenda!', 'success');
      setAiSuggestion(null);
    } catch (err: any) {
      console.error('Erro ao salvar tarefa da Aura:', err);
      addToast('Falha ao salvar a tarefa sugerida.', 'error');
    }
  };

  const saveNote = async () => {
    const trimmedNote = newNote.trim();
    if (!trimmedNote) return;

    const { data, error } = await supabase.from('timeline_events').insert([{ 
      type: 'note', 
      description: trimmedNote,
      lead_id: lead.id,
      company_id: (user as any)?.company_id,
      created_by: user?.id
    }]).select('*, profiles!timeline_events_created_by_fkey(name, avatar_url)').single();
    if (error) {
      console.error("Erro ao salvar nota:", error);
      addToast("Erro ao salvar nota", "error");
      return;
    }
    if (data) {
      setEvents((prev) => [data as any, ...prev]);
      setNewNote('');

      // Atualiza o relógio de "Atualizado" do lead
      const now = new Date().toISOString();
      await supabase.from('leads').update({ updated_at: now }).eq('id', lead.id);
      onLeadUpdate?.(lead.id, { updated_at: now });

      // Notifica o responsável se a gestão comentou no lead
      if (isAdmin && (lead as any).assigned_to && (lead as any).assigned_to !== user?.id) {
        await supabase.from('notifications').insert([{
          user_id: (lead as any).assigned_to,
          title: 'Nova Nota no Lead',
          message: `A gestão adicionou uma nota no lead ${lead.name}`,
          type: 'system',
          read: false,
          company_id: user.company_id,
          link: `/admin/leads?open=${lead.id}`,
          sender_id: user.id,
        }]);
      }
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveNote();
  };

  const toggleTask = async (id: string, completed: boolean) => {
    const { error } = await supabase.from('tasks').update({ completed: !completed }).eq('id', id);
    if (!error) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
      if (!completed) await addTimelineLog('system', `Concluiu a tarefa: ${tasks.find((t) => t.id === id)?.title}`);
    }
  };

  const visitedFromMetadata = useMemo(() => {
    // Pega o formato novo (navigation_data) ou faz fallback pro antigo
    const arr = lead.navigation_data || (lead as any).metadata?.visited_properties;
    if (!Array.isArray(arr)) return [];

    // Filtra duplicatas baseadas na URL/slug
    const uniqueVisits: any[] = [];
    const seenUrls = new Set();

    arr.forEach((visit) => {
      const url = visit.url || visit.slug;
      // Se ainda não vimos essa URL nesta sessão, adicionamos à lista visual
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        uniqueVisits.push(visit);
      }
    });

    return uniqueVisits;
  }, [lead]);

  const leadOwnerName = useMemo(() => {
    const owner = (lead as any).assignee?.name;
    if (owner) return owner;
    if ((lead as any).assigned_to && (lead as any).assigned_to === user?.id) return 'Você';
    return 'Não atribuído';
  }, [lead, user?.id]);

  // --- GAMIFICAÇÃO: Cálculo de Recompensa Estimada ---
  const estimatedPoints = useMemo(() => {
    if (!lead) return 0;

    const leadProperty = (lead as any).property;
    const propertyWeight = Number(leadProperty?.strategic_weight ?? 1.0) || 1.0;
    const behavioralScore = Number((lead as any).behavioral_score ?? 0) || 0;
    const leadScoreMult = behavioralScore ? (1 + behavioralScore / 100) : 1.0;
    const dealType = `${leadProperty?.listing_type ?? ''}`.toLowerCase() === 'locacao' ? 'locacao' : 'venda';

    return calculateDealPoints(dealType, propertyWeight, leadScoreMult, 1.0);
  }, [lead]);

  useEffect(() => {
    const fetchAgents = async () => {
      if (!isAdmin) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, name, active')
        .eq('active', true)
        .in('role', ['corretor', 'admin', 'owner'])
        .order('name', { ascending: true });

      if (data) setAgents(data as Array<{ id: string; name: string; active: boolean }>);
    };

    fetchAgents();
  }, [isAdmin]);

  const handleAgentTransfer = async (agentId: string) => {
    if (!isAdmin || !agentId || changingAgent) return;
    setChangingAgent(true);
    const { error } = await supabase.from('leads').update({ assigned_to: agentId }).eq('id', lead.id);
    if (!error) {
      addToast('Corretor atribuído com sucesso!', 'success');
      onLeadUpdate?.(lead.id, { assigned_to: agentId });
      await addTimelineLog('system', 'Lead transferido para outro corretor.');
    }
    setChangingAgent(false);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const payload = {
        budget: profileForm.budget ? Number(profileForm.budget) : null,
        desired_type: profileForm.desired_type.trim() || null,
        desired_bedrooms: profileForm.desired_bedrooms ? Number(profileForm.desired_bedrooms) : null,
        desired_location: profileForm.desired_location.trim() || null
      };

      const { error } = await supabase.from('leads').update(payload).eq('id', lead.id);
      if (!error) {
        await addTimelineLog('system', 'Perfil de preferências do lead atualizado para Match IA.');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const buildWhatsAppSmartMatchLink = (match: SmartMatchView) => {
    if (!leadPhoneClean) return '#';
    const propertyUrl = `${window.location.origin}/imoveis/${match.property.slug}`;
    const text = `Olá ${leadFirstName}! Separei um imóvel com ${match.match_score}% de compatibilidade para você: ${match.property.title}. ${match.match_reason} Veja: ${propertyUrl}`;
    return `https://wa.me/${leadPhoneClean}?text=${encodeURIComponent(text)}`;
  };

  const handleFindSmartMatches = async () => {
    setLoadingSmartMatch(true);
    setSmartMatchMessage('');
    try {
      const budget = Number(profileForm.budget || lead.budget || 0);
      const desiredType = profileForm.desired_type.trim() || lead.desired_type || '';
      const desiredBedrooms = Number(profileForm.desired_bedrooms || lead.desired_bedrooms || 0);
      const desiredLocation = profileForm.desired_location.trim() || lead.desired_location || '';

      let query = supabase.from('properties').select('*').limit(40);

      if (budget > 0) {
        query = query.gte('price', budget * 0.8).lte('price', budget * 1.2);
      }

      if (desiredType) {
        query = query.eq('type', desiredType as any);
      }

      if (desiredBedrooms > 0) {
        query = query.gte('bedrooms', desiredBedrooms);
      }

      if (desiredLocation) {
        query = query.or(`city.ilike.%${desiredLocation}%,neighborhood.ilike.%${desiredLocation}%`);
      }

      const { data: candidates, error: candidatesError } = await query;

      if (candidatesError) {
        setSmartMatchMessage('Não foi possível carregar candidatos para análise da IA.');
        return;
      }

      const candidateProperties = (candidates || []) as Property[];
      if (candidateProperties.length === 0) {
        setSmartMatches([]);
        setSmartMatchMessage('Nenhum imóvel encontrado no pré-filtro (+/- 20% orçamento e critérios).');
        return;
      }

      if (hasStoredSmartMatches) {
        await supabase.from('lead_matches').delete().eq('lead_id', lead.id);
      }

      const leadForAI: Lead = {
        ...lead,
        budget: budget || undefined,
        desired_type: desiredType || undefined,
        desired_bedrooms: desiredBedrooms || undefined,
        desired_location: desiredLocation || undefined
      };

      const aiMatches = await findSmartMatches(
        leadForAI,
        candidateProperties.map(mapPropertyToCandidate),
        lead.navigation_data
      );

      if (!aiMatches.length) {
        setSmartMatches([]);
        setHasStoredSmartMatches(false);
        setSmartMatchMessage('A IA não retornou matches válidos desta vez. Tente novamente em instantes.');
        return;
      }

      const byId = new Map(candidateProperties.map((property) => [property.id, property]));
      const hydrated: SmartMatchView[] = aiMatches
        .map((aiMatch: SmartMatchResult) => {
          const property = byId.get(aiMatch.property_id) || (aiMatch.property as Property | undefined);
          if (!property) return null;
          return {
            property_id: aiMatch.property_id,
            property,
            match_score: aiMatch.match_score,
            match_reason: aiMatch.match_reason
          };
        })
        .filter(Boolean) as SmartMatchView[];

      if (!hydrated.length) {
        setSmartMatches([]);
        setHasStoredSmartMatches(false);
        setSmartMatchMessage('A IA retornou imóveis fora dos candidatos do pré-filtro.');
        return;
      }

      const payload = hydrated.map((match) => ({
        lead_id: lead.id,
        property_id: match.property_id,
        match_score: match.match_score,
        match_reason: match.match_reason,
        company_id: user.company_id,
      }));

      const { error: insertError } = await supabase.from('lead_matches').insert(payload);
      if (insertError) {
        setSmartMatchMessage('Matches gerados, mas ocorreu erro ao persistir no banco.');
      }

      setSmartMatches(hydrated);
      setHasStoredSmartMatches(true);
    } catch (error) {
      console.error('Erro no match inteligente:', error);
      setSmartMatchMessage('Erro ao consultar a IA para encontrar matches.');
    } finally {
      setLoadingSmartMatch(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('lead_sidebar_last_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={sidebarRef}
      className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-[60] transform transition-transform duration-300 ease-out flex flex-col border-l border-slate-100"
    >
      
      {/* 1. HEADER FIXO (Mínimo) */}
      <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0 z-20 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-xl font-serif font-bold text-slate-800">{lead.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500 font-medium">{lead.phone}</span>
            <span
              className={`cursor-help text-[10px] font-bold px-2 py-0.5 rounded-full ${(lead as any).score > 70 ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-600'}`}
              title={`Visitas: ${(lead as any).score_visit || 0} | WhatsApp: ${(lead as any).score_whatsapp || 0}`}
            >
              Score: {(lead as any).score || 0}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
          <Icons.X size={20} />
        </button>
      </div>

      {/* 2. ÁREA DE ROLAGEM GERAL */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-50">
        {/* BANNER DA LIGA DOS CORRETORES (GAMIFICAÇÃO) */}
        <div className="mx-6 mb-4 mt-2 bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Icons.Trophy size={80} className="text-amber-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Icons.Target size={12} /> Liga dos Corretores
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-900">Fechar este negócio rende aprox.</span>
              <span className="text-2xl font-black text-amber-600 flex items-center gap-1.5">
                {estimatedPoints} <span className="text-sm font-bold">pts</span>
              </span>
            </div>
          </div>
        </div>

        {/* BLOCO DE INFORMAÇÕES */}
        <div className="p-6 bg-white space-y-6">
          
          {/* PROGRESSO DO FUNIL (STEPPER) */}
          <div className="mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Etapa do Funil</p>
            <div className="flex items-center justify-between relative isolate">
              <div className="absolute left-4 right-4 top-4 h-[2px] bg-slate-200 -z-10" />
              {FUNNELS.map((funnel, index) => {
                const isActive = selectedFunnel === funnel.id;
                if (funnel.id === 'pre_atendimento' && !isAdmin) return null;

                return (
                  <div 
                    key={funnel.id} 
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                    onClick={() => {
                      setSelectedFunnel(funnel.id);
                      const defaultStatus = kanbanConfig[funnel.id]?.[0] || 'Novo';
                      setSelectedStatus(defaultStatus);
                    }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                      isActive 
                        ? `${funnel.color} text-white border-transparent ring-4 ring-slate-100` 
                        : 'bg-white border-slate-300 text-slate-400 group-hover:border-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                      {funnel.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <label className="block text-xs font-bold text-slate-600 mb-2">Status em {FUNNELS.find(f => f.id === selectedFunnel)?.label}</label>
              <div className="flex gap-3">
                <select 
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-brand-500"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  {(kanbanConfig[selectedFunnel] || []).map(stat => (
                    <option key={stat} value={stat}>{stat}</option>
                  ))}
                </select>
                
                {(selectedFunnel !== lead.funnel_step || selectedStatus !== lead.status) && (
                  <button 
                    onClick={handleStageChange}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm animate-fade-in whitespace-nowrap"
                  >
                    Salvar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ACORDEÃO DE ORIGEM E INTERESSES */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
  <div onClick={() => setIsOpen(!isOpen)} className="p-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors select-none">
    <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Icons.MapPin size={12} /> Imóveis de Interesse</p>
    <Icons.ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
  </div>
  
  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
    <div className="p-3 pt-0 border-t border-slate-50 space-y-3">

      {/* Imóvel Original */}
      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
        <span className="text-[9px] font-bold text-brand-600 uppercase">Origem Principal</span>
        <p className="text-sm font-bold text-slate-700 truncate">{originProperty?.title || 'Interesse Geral'}</p>
        {originProperty && (
          <button type="button" onClick={() => { onClose(); Maps(`/admin/imoveis?preview_id=${originProperty.id}`); }} className="mt-2 text-xs text-brand-600 font-bold hover:text-brand-700 flex items-center gap-1"><Icons.Eye size={14}/> Ver Imóvel</button>
        )}
      </div>

      {/* Lista Adicional */}
      {interestedProps.map((ip, i) => (
        <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center group gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-700 truncate">{ip.title}</p>
            <p className="text-[10px] text-emerald-600 font-bold">R$ {Number(ip.price || 0).toLocaleString('pt-BR')}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button type="button" onClick={() => { onClose(); Maps(`/admin/imoveis?preview_id=${ip.id}`); }} className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors" title="Ver Imóvel">
              <Icons.Eye size={16}/>
            </button>
            <button type="button" onClick={() => handleRemoveInterest(i)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Remover Interesse">
              <Icons.Trash2 size={16}/>
            </button>
          </div>
        </div>
      ))}

      {/* Adicionar Novo - CORRIGIDO AQUI */}
          <div className="flex gap-2 pt-2 border-t border-slate-100 w-full">
            <select 
              value={selectedNewProp} 
              onChange={e => setSelectedNewProp(e.target.value)} 
              className="flex-1 min-w-0 text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none bg-white"
            >
              <option value="">Adicionar interesse...</option>
              {allProperties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
              <button 
                onClick={handleAddInterest} 
                className="flex-shrink-0 bg-brand-600 text-white p-1.5 rounded-lg hover:bg-brand-700 transition-colors"
              >
                <Icons.Plus size={16}/>
              </button>
            </div>

          </div>
        </div>
      </div>

          {/* MENSAGEM */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1">
              <Icons.MessageCircle size={12} /> Detalhes da Solicitação
            </p>
            <p className="text-sm text-slate-600 italic">
              {(lead as any).message ? `"${(lead as any).message}"` : 'Nenhum detalhe adicional.'}
            </p>
          </div>
        </div>

        {/* 3. TABS (GRUDAM NO TOPO QUANDO ROLA) */}
        <div className="flex border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
          {[
            { id: 'timeline', label: 'Timeline', icon: Icons.Clock },
            { id: 'smart_match', label: 'Match IA', icon: Icons.Sparkles },
            { id: 'whatsapp', label: 'WhatsApp', icon: Icons.MessageCircle },
            { id: 'history', label: 'Navegação', icon: Icons.MapPin },
            { id: 'tasks', label: 'Tarefas', icon: Icons.CheckSquare },
            { id: 'info', label: 'Infos', icon: Icons.Info }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`flex-1 py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-brand-600 text-brand-600 bg-brand-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={16} className={tab.id === 'smart_match' && activeTab !== 'smart_match' ? 'text-amber-500 animate-pulse' : ''} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 4. CONTEÚDO DA ABA (Sem overflow para não conflitar) */}
        <div className="p-6">
          {activeTab === 'smart_match' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Icons.Sparkles size={80} />
                </div>
                <h3 className="text-xl font-serif font-bold flex items-center gap-2 mb-2 relative z-10">
                  <Icons.Sparkles size={20} className="text-amber-400" /> Inteligência Artificial
                </h3>
                <p className="text-brand-100 text-sm mb-6 relative z-10 max-w-[90%]">
                  Nossa IA cruza os dados, orçamento e interesses do lead com todo o seu catálogo para sugerir os imóveis perfeitos.
                </p>
                <button
                  onClick={handleFindSmartMatches}
                  disabled={loadingSmartMatch}
                  className="relative z-10 w-full bg-white text-brand-900 hover:bg-brand-50 text-sm font-bold py-3 rounded-xl transition-all disabled:opacity-80 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  {loadingSmartMatch ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.BrainCircuit size={18} />}
                  {loadingSmartMatch ? 'Analisando Catálogo...' : hasStoredSmartMatches ? '🔄 Recalcular Compatibilidade' : '🔍 Gerar Sugestões de Imóveis'}
                </button>
              </div>

              {smartMatchMessage && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 text-amber-700 text-xs p-3 rounded-xl flex gap-2">
                  <Icons.AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>{smartMatchMessage}</p>
                </div>
              )}

              {smartMatches.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Melhores Resultados</h4>
                  {smartMatches.map((match) => (
                    <div key={match.property.id} className="group bg-white dark:bg-dark-card p-3 rounded-2xl border-2 border-slate-100 dark:border-white/5 hover:border-brand-400 dark:hover:border-brand-500/50 transition-all shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 relative">
                          <img
                            src={match.property.images?.[0] || 'https://placehold.co/100'}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            alt={match.property.title}
                          />
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1 pr-2">{match.property.title}</h4>
                            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-1 shadow-sm">
                              <Icons.CheckCircle size={10} /> {match.match_score}% Match
                            </span>
                          </div>
                          <p className="text-brand-600 font-bold text-sm mb-2">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(match.property.price)}
                          </p>
                          <div className="bg-slate-50 dark:bg-white/5 p-2.5 rounded-lg border border-slate-100 dark:border-white/5 relative">
                            <div className="absolute -top-2 left-3 bg-white dark:bg-dark-card px-1">
                              <Icons.Sparkles size={10} className="text-amber-500" />
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-2">"{match.match_reason}"</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10 flex gap-2">
                        <button
                          onClick={() => Maps(`/admin/imoveis?preview_id=${match.property_id}`)}
                          className="flex-1 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          Detalhes do Imóvel
                        </button>
                        <a
                          href={buildWhatsAppSmartMatchLink(match)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 text-xs font-bold px-3 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-500/20 dark:hover:bg-green-500/30 dark:text-green-400 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Icons.MessageCircle size={14} /> Enviar Sugestão
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl mb-4">
                <p className="text-xs text-green-800 font-bold mb-1 flex items-center gap-2">
                  <Icons.MessageCircle size={14} /> Mensagem Rápida
                </p>
                <p className="text-xs text-green-700">Edite a mensagem antes de enviar.</p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  placeholder="Digite sua mensagem ou escolha um modelo abaixo..."
                  className="w-full text-sm outline-none resize-none text-slate-700"
                />
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      if (!customMessage.trim()) return addToast('Digite uma mensagem', 'error');
                      if (window.confirm('Deseja abrir o WhatsApp para enviar esta mensagem?')) {
                        window.open(`https://wa.me/${leadPhoneClean}?text=${encodeURIComponent(customMessage)}`, '_blank');
                        addTimelineLog('whatsapp', `Enviou msg: "${customMessage}"`);
                      }
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Icons.Send size={14} /> Enviar no WhatsApp
                  </button>
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-400 uppercase mt-4 mb-2">Modelos Prontos</h4>
              <div className="grid grid-cols-1 gap-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      const imovel = originProperty?.title || 'imóvel';
                      const text = tpl.content.replaceAll('{nome}', leadFirstName).replaceAll('{imovel}', imovel);
                      setCustomMessage(text);
                    }}
                    className="w-full text-left bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-brand-400 transition-all"
                  >
                    <span className="font-bold text-slate-700 block text-sm">{tpl.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <form onSubmit={handleAddNote} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <Textarea
                  ref={noteTextareaRef}
                  className="min-h-[44px] resize-none overflow-hidden border-0 bg-transparent p-0 text-sm text-slate-700 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Nova nota interna..."
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    // Atalho Ninja: envia com Shift+Enter.
                    if (e.shiftKey && e.key === 'Enter') {
                      e.preventDefault();
                      if (newNote.trim()) {
                        void saveNote();
                      }
                    }
                  }}
                />
                <div className="flex justify-end mt-2 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                      <Kbd>Shift</Kbd>
                      <span>+</span>
                      <Kbd>Enter</Kbd>
                    </div>
                    <button type="submit" className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Salvar Nota</button>
                  </div>
                </div>
              </form>
              <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4 mt-6">
                {events.map((event: any) => {
                  const authorName = event.profiles?.name || 'Sistema Elevatio';
                  const authorAvatar = event.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`;

                  return (
                    <div key={event.id} className="relative pl-8 animate-fade-in">
                      <div className="absolute -left-[17px] top-0 w-8 h-8 bg-white rounded-full p-0.5 border-2 border-slate-200 shadow-sm z-10">
                        <img src={authorAvatar} alt={authorName} className="w-full h-full rounded-full object-cover" />
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-white ${
                          event.type === 'whatsapp' ? 'bg-green-500' : event.type === 'note' ? 'bg-amber-400' : 'bg-brand-500'
                        }`} title={event.type} />
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] text-slate-800 font-bold uppercase tracking-wider">{authorName}</p>
                          <p className="text-[10px] font-bold text-slate-400">{formatDate(event.created_at)}</p>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{event.description}</p>
                      </div>
                    </div>
                  );
                })}

                <div className="relative pl-8">
                  <div className="absolute -left-[17px] top-0 w-8 h-8 bg-white rounded-full p-0.5 border-2 border-slate-200 shadow-sm z-10 flex items-center justify-center text-slate-400">
                    <Icons.Star size={16} />
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Sistema</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {formatDate((lead as any).created_at || (lead as any).createdAt || new Date().toISOString())}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 font-bold">Lead cadastrado no sistema</p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Icons.Link size={12} /> Origem: <span className="font-bold">{lead.source || 'Não identificada'}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Sessão</h3>
              {visitedFromMetadata.length > 0 ? (
                <div className="space-y-4">
                  {visitedFromMetadata.map((visit: any, i: number) => {
                    // Compatibilidade: lida com formato novo (url/timestamp) e antigo (slug/visited_at/title)
                    const url = visit.url || `/imoveis/${visit.slug}`;
                    const date = visit.timestamp || visit.visited_at;

                    // Extrai o slug da URL para usar como título se 'title' não existir
                    const fallbackTitle = visit.url ? visit.url.split('/').pop()?.replace(/-/g, ' ') : 'Imóvel';
                    const title = visit.title || fallbackTitle;

                    return (
                      <div key={i} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center group">
                        <div className="min-w-0 pr-4">
                          <p className="text-sm font-bold text-slate-700 capitalize truncate">{title}</p>
                          <p className="text-[10px] text-slate-400">{date ? new Date(date).toLocaleString('pt-BR') : ''}</p>
                        </div>
                        <a href={`${window.location.origin}/#${url}`} target="_blank" className="p-2 shrink-0 text-slate-300 hover:text-brand-600 bg-slate-50 hover:bg-brand-50 rounded-lg transition-colors" rel="noreferrer">
                          <Icons.ArrowRight size={16} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm italic">Nenhuma navegação recente.</div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {aiSuggestion && (
                <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl shadow-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                      <Icons.Sparkles size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Sugestão da Aura</p>
                      <h4 className="text-sm font-bold text-slate-800 mt-1">{aiSuggestion.title}</h4>
                      {aiSuggestion.description && (
                        <p className="text-xs text-slate-600 mt-1 leading-5">{aiSuggestion.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Vence em {aiSuggestion.due_in_hours || 24}h
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleAcceptAiSuggestion()}
                      className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                    >
                      Aceitar Sugestão +
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
                <input
                  type="text"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="Nova tarefa..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                />
                <button className="bg-brand-600 text-white p-2 rounded-lg" type="submit">
                  <Icons.Plus size={20} />
                </button>
              </form>
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                  <button onClick={() => toggleTask(task.id, task.completed)} className={`w-5 h-5 rounded border flex items-center justify-center ${task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                    {task.completed && <Icons.CheckSquare size={12} />}
                  </button>
                  <span className={`text-sm flex-1 ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="font-bold text-slate-700">{lead.email || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Telefone</p>
                  <p className="font-bold text-slate-700">{lead.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Corretor Responsável</p>
                  {isAdmin ? (
                    <select
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
                      value={(lead as any).assigned_to || ''}
                      onChange={(e) => handleAgentTransfer(e.target.value)}
                      disabled={changingAgent}
                    >
                      <option value="">Selecione um corretor</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="font-bold text-slate-700">{leadOwnerName}</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 space-y-3">
                  <label className="block">
                    <span className="text-xs text-slate-500">Orçamento (R$)</span>
                    <input
                      type="number"
                      min={0}
                      value={profileForm.budget}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, budget: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Tipo desejado</span>
                    <input
                      type="text"
                      value={profileForm.desired_type}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, desired_type: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Ex.: Apartamento"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Quartos mínimos</span>
                    <input
                      type="number"
                      min={0}
                      value={profileForm.desired_bedrooms}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, desired_bedrooms: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Localização desejada</span>
                    <input
                      type="text"
                      value={profileForm.desired_location}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, desired_location: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Ex.: Centro, Itapuã"
                    />
                  </label>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold py-2 rounded-lg disabled:opacity-60"
                  >
                    {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsSidebar;
