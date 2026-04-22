import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Megaphone,
  Pencil,
  Play,
  Plus,
  PlusCircle,
  RadioTower,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../contexts/ToastContext';
import { useProperties } from '../hooks/useProperties';

type LeadProvider = 'meta' | 'google' | 'tiktok';
type IntegrationStatus = 'active' | 'inactive' | 'draft';
type ExternalObjectType = 'campaign' | 'form';
type LeadMode = 'generic' | 'property_specific';
type WizardTab = 'connection' | 'mappings';

type LeadSourceIntegration = {
  id: string;
  company_id: string;
  name: string;
  provider: LeadProvider;
  status: IntegrationStatus;
  last_lead_received_at: string | null;
  created_at?: string | null;
};

type LeadSourceMapping = {
  id: string;
  company_id: string;
  integration_id: string;
  provider: LeadProvider;
  external_object_id: string;
  external_object_type: ExternalObjectType;
  lead_mode: LeadMode;
  property_id: string | null;
  assigned_user_id?: string | null;
  created_at?: string | null;
};

type ProviderConfig = {
  value: LeadProvider;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
  iconClassName: string;
};

const PROVIDERS: ProviderConfig[] = [
  {
    value: 'meta',
    label: 'Meta Ads',
    subtitle: 'Facebook e Instagram',
    Icon: Megaphone,
    iconClassName: 'bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50',
  },
  {
    value: 'google',
    label: 'Google Ads',
    subtitle: 'Google Lead Forms',
    Icon: Search,
    iconClassName: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50',
  },
  {
    value: 'tiktok',
    label: 'TikTok Ads',
    subtitle: 'TikTok Lead Gen',
    Icon: Play,
    iconClassName: 'bg-slate-100 text-slate-900 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700',
  },
];

const PROVIDER_LABELS = PROVIDERS.reduce<Record<LeadProvider, string>>(
  (acc, provider) => {
    acc[provider.value] = provider.label;
    return acc;
  },
  { meta: 'Meta Ads', google: 'Google Ads', tiktok: 'TikTok Ads' }
);

const STATUS_CONFIG: Record<
  IntegrationStatus,
  { label: string; className: string; Icon: LucideIcon }
> = {
  active: {
    label: 'Ativo',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60',
    Icon: CheckCircle2,
  },
  inactive: {
    label: 'Inativo',
    className:
      'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    Icon: RadioTower,
  },
  draft: {
    label: 'Rascunho',
    className:
      'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
    Icon: Settings2,
  },
};

const makeClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isLeadProvider = (value: unknown): value is LeadProvider =>
  value === 'meta' || value === 'google' || value === 'tiktok';

const isIntegrationStatus = (value: unknown): value is IntegrationStatus =>
  value === 'active' || value === 'inactive' || value === 'draft';

const isExternalObjectType = (value: unknown): value is ExternalObjectType =>
  value === 'campaign' || value === 'form';

const isLeadMode = (value: unknown): value is LeadMode =>
  value === 'generic' || value === 'property_specific';

const isMissingColumnError = (error: unknown): boolean => {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = `${maybeError?.message ?? ''}`.toLowerCase();

  return (
    maybeError?.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    (message.includes('column') && message.includes('does not exist'))
  );
};

const normalizeIntegration = (row: Record<string, unknown>): LeadSourceIntegration => {
  const provider = isLeadProvider(row.provider) ? row.provider : 'meta';

  return {
    id: String(row.id ?? makeClientId()),
    company_id: String(row.company_id ?? ''),
    name: String(row.name ?? PROVIDER_LABELS[provider]),
    provider,
    status: isIntegrationStatus(row.status) ? row.status : 'draft',
    last_lead_received_at:
      typeof row.last_lead_received_at === 'string' ? row.last_lead_received_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  };
};

const normalizeMapping = (row: Record<string, unknown>): LeadSourceMapping => {
  const provider = isLeadProvider(row.provider) ? row.provider : 'meta';
  const externalObjectType = isExternalObjectType(row.external_object_type)
    ? row.external_object_type
    : typeof row.form_id === 'string' && row.form_id
      ? 'form'
      : 'campaign';
  const externalObjectId =
    typeof row.external_object_id === 'string'
      ? row.external_object_id
      : externalObjectType === 'form' && typeof row.form_id === 'string'
        ? row.form_id
        : typeof row.campaign_id === 'string'
          ? row.campaign_id
          : '';

  return {
    id: String(row.id ?? makeClientId()),
    company_id: String(row.company_id ?? ''),
    integration_id: String(row.integration_id ?? ''),
    provider,
    external_object_id: externalObjectId,
    external_object_type: externalObjectType,
    lead_mode: isLeadMode(row.lead_mode) ? row.lead_mode : 'generic',
    property_id: typeof row.property_id === 'string' ? row.property_id : null,
    assigned_user_id: typeof row.assigned_user_id === 'string' ? row.assigned_user_id : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  };
};

const formatLeadDate = (date: string | null) => {
  if (!date) return 'Ainda sem leads';

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return 'Data indisponivel';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate);
};

export default function IntegrationsManager() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const { properties, loading: propertiesLoading } = useProperties();

  const companyId = user?.company_id ?? tenant?.id ?? null;
  const [integrations, setIntegrations] = useState<LeadSourceIntegration[]>([]);
  const [mappings, setMappings] = useState<LeadSourceMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [wizardTab, setWizardTab] = useState<WizardTab>('connection');
  const [draftIntegration, setDraftIntegration] = useState<LeadSourceIntegration | null>(null);
  const [draftMappings, setDraftMappings] = useState<LeadSourceMapping[]>([]);
  const [removedMappingIds, setRemovedMappingIds] = useState<string[]>([]);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const mappingsCountByIntegration = useMemo(() => {
    return mappings.reduce<Record<string, number>>((acc, mapping) => {
      acc[mapping.integration_id] = (acc[mapping.integration_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [mappings]);

  const webhookUrl = useMemo(() => {
    if (!draftIntegration) return '';

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/ingest-external-lead?integration_id=${encodeURIComponent(
      draftIntegration.id
    )}&provider=${encodeURIComponent(draftIntegration.provider)}`;
  }, [draftIntegration?.id, draftIntegration?.provider]);

  const fetchIntegrations = useCallback(
    async (showSpinner = true) => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      if (showSpinner) {
        setLoading(true);
      }

      try {
        const [integrationsResponse, mappingsResponse] = await Promise.all([
          supabase
            .from('lead_source_integrations')
            .select('*')
            .eq('company_id', companyId),
          supabase
            .from('lead_source_mappings')
            .select('*')
            .eq('company_id', companyId),
        ]);

        if (integrationsResponse.error) throw integrationsResponse.error;
        if (mappingsResponse.error) throw mappingsResponse.error;

        setIntegrations(
          ((integrationsResponse.data ?? []) as Record<string, unknown>[])
            .map(normalizeIntegration)
            .sort((a, b) => {
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateB - dateA;
            })
        );
        setMappings(
          ((mappingsResponse.data ?? []) as Record<string, unknown>[])
            .map(normalizeMapping)
            .sort((a, b) => {
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateA - dateB;
            })
        );
      } catch (error) {
        console.error('Erro ao carregar integracoes de leads:', error);
        addToast('Nao foi possivel carregar as integracoes.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [addToast, companyId]
  );

  useEffect(() => {
    void fetchIntegrations();
  }, [fetchIntegrations]);

  const createDraftMapping = useCallback(
    (integration: LeadSourceIntegration): LeadSourceMapping => ({
      id: makeClientId(),
      company_id: integration.company_id,
      integration_id: integration.id,
      provider: integration.provider,
      external_object_id: '',
      external_object_type: 'campaign',
      lead_mode: 'generic',
      property_id: null,
    }),
    []
  );

  const handleOpenNewIntegration = () => {
    if (!companyId) {
      addToast('Nao foi possivel identificar a empresa ativa.', 'error');
      return;
    }

    const integration: LeadSourceIntegration = {
      id: makeClientId(),
      company_id: companyId,
      name: PROVIDER_LABELS.meta,
      provider: 'meta',
      status: 'draft',
      last_lead_received_at: null,
    };

    setDraftIntegration(integration);
    setDraftMappings([]);
    setRemovedMappingIds([]);
    setCopiedWebhook(false);
    setWizardTab('connection');
    setModalOpen(true);
  };

  const handleOpenEditIntegration = (integration: LeadSourceIntegration) => {
    setDraftIntegration({ ...integration });
    setDraftMappings(
      mappings
        .filter((mapping) => mapping.integration_id === integration.id)
        .map((mapping) => ({ ...mapping }))
    );
    setRemovedMappingIds([]);
    setCopiedWebhook(false);
    setWizardTab('connection');
    setModalOpen(true);
  };

  const handleProviderChange = (provider: LeadProvider) => {
    setDraftIntegration((current) => {
      if (!current) return current;

      const currentDefaultName = PROVIDER_LABELS[current.provider];
      const shouldUseProviderName = !current.name.trim() || current.name === currentDefaultName;

      return {
        ...current,
        provider,
        name: shouldUseProviderName ? PROVIDER_LABELS[provider] : current.name,
      };
    });
    setDraftMappings((current) => current.map((mapping) => ({ ...mapping, provider })));
  };

  const handleDraftMappingChange = (mappingId: string, patch: Partial<LeadSourceMapping>) => {
    setDraftMappings((current) =>
      current.map((mapping) => {
        if (mapping.id !== mappingId) return mapping;

        const nextMapping = { ...mapping, ...patch };
        if (patch.lead_mode === 'generic') {
          nextMapping.property_id = null;
        }

        return nextMapping;
      })
    );
  };

  const handleAddMapping = () => {
    if (!draftIntegration) return;
    setDraftMappings((current) => [...current, createDraftMapping(draftIntegration)]);
  };

  const handleRemoveMapping = (mappingId: string) => {
    setDraftMappings((current) => current.filter((mapping) => mapping.id !== mappingId));
    setRemovedMappingIds((current) => Array.from(new Set([...current, mappingId])));
  };

  const handleCopyWebhookUrl = async () => {
    if (!webhookUrl) return;

    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      addToast('URL do webhook copiada.', 'success');
      window.setTimeout(() => setCopiedWebhook(false), 1800);
    } catch (error) {
      console.error('Erro ao copiar webhook:', error);
      addToast('Nao foi possivel copiar a URL.', 'error');
    }
  };

  const handleSaveIntegration = useCallback(
    async (integration: LeadSourceIntegration) => {
      if (!companyId) {
        throw new Error('Empresa nao identificada.');
      }

      const payload = {
        id: integration.id,
        company_id: companyId,
        name: integration.name.trim() || PROVIDER_LABELS[integration.provider],
        provider: integration.provider,
        status: integration.status,
      };

      const { data, error } = await supabase
        .from('lead_source_integrations')
        .upsert(payload)
        .select('*')
        .single();

      if (error) throw error;
      return normalizeIntegration(data as Record<string, unknown>);
    },
    [companyId]
  );

  const upsertMappingPayload = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('lead_source_mappings')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return normalizeMapping(data as Record<string, unknown>);
  };

  const handleSaveMapping = useCallback(
    async (mapping: LeadSourceMapping, integration: LeadSourceIntegration) => {
      if (!companyId) {
        throw new Error('Empresa nao identificada.');
      }

      const objectId = mapping.external_object_id.trim();
      const propertyId = mapping.lead_mode === 'property_specific' ? mapping.property_id : null;
      const sharedPayload = {
        id: mapping.id,
        company_id: companyId,
        integration_id: integration.id,
        provider: integration.provider,
        lead_mode: mapping.lead_mode,
        property_id: propertyId,
      };
      const modernPayload = {
        ...sharedPayload,
        external_object_id: objectId,
        external_object_type: mapping.external_object_type,
      };
      const legacyPayload = {
        ...sharedPayload,
        form_id: mapping.external_object_type === 'form' ? objectId : null,
        campaign_id: mapping.external_object_type === 'campaign' ? objectId : null,
      };

      try {
        return await upsertMappingPayload({ ...modernPayload, ...legacyPayload });
      } catch (error) {
        if (!isMissingColumnError(error)) throw error;
      }

      try {
        return await upsertMappingPayload(legacyPayload);
      } catch (error) {
        if (!isMissingColumnError(error)) throw error;
      }

      return await upsertMappingPayload(modernPayload);
    },
    [companyId]
  );

  const validateDraft = () => {
    if (!draftIntegration) return false;

    if (!draftIntegration.name.trim()) {
      addToast('Informe o nome da integracao.', 'error');
      setWizardTab('connection');
      return false;
    }

    const invalidObject = draftMappings.find((mapping) => !mapping.external_object_id.trim());
    if (invalidObject) {
      addToast('Informe o ID da campanha ou formulario em todas as regras.', 'error');
      setWizardTab('mappings');
      return false;
    }

    const missingProperty = draftMappings.find(
      (mapping) => mapping.lead_mode === 'property_specific' && !mapping.property_id
    );

    if (missingProperty) {
      addToast('Selecione o imovel das regras especificas.', 'error');
      setWizardTab('mappings');
      return false;
    }

    return true;
  };

  const handleSaveWizard = async () => {
    if (!draftIntegration || !validateDraft()) return;

    setSaving(true);

    try {
      const savedIntegration = await handleSaveIntegration(draftIntegration);

      if (removedMappingIds.length > 0 && companyId) {
        const { error } = await supabase
          .from('lead_source_mappings')
          .delete()
          .eq('company_id', companyId)
          .in('id', removedMappingIds);

        if (error) throw error;
      }

      const savedMappings = await Promise.all(
        draftMappings.map((mapping) => handleSaveMapping(mapping, savedIntegration))
      );

      setIntegrations((current) => [
        savedIntegration,
        ...current.filter((integration) => integration.id !== savedIntegration.id),
      ]);
      setMappings((current) => [
        ...current.filter((mapping) => mapping.integration_id !== savedIntegration.id),
        ...savedMappings,
      ]);
      setModalOpen(false);
      setDraftIntegration(null);
      setDraftMappings([]);
      setRemovedMappingIds([]);
      addToast('Integracao salva com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao salvar integracao:', error);
      addToast('Nao foi possivel salvar a integracao.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIntegration = async (integration: LeadSourceIntegration) => {
    if (!companyId) return;
    if (!window.confirm(`Apagar a integracao ${integration.name}?`)) return;

    setDeletingId(integration.id);

    try {
      const { error: mappingsError } = await supabase
        .from('lead_source_mappings')
        .delete()
        .eq('company_id', companyId)
        .eq('integration_id', integration.id);

      if (mappingsError) throw mappingsError;

      const { error: integrationError } = await supabase
        .from('lead_source_integrations')
        .delete()
        .eq('company_id', companyId)
        .eq('id', integration.id);

      if (integrationError) throw integrationError;

      setIntegrations((current) => current.filter((item) => item.id !== integration.id));
      setMappings((current) => current.filter((mapping) => mapping.integration_id !== integration.id));
      addToast('Integracao removida.', 'success');
    } catch (error) {
      console.error('Erro ao remover integracao:', error);
      addToast('Nao foi possivel remover a integracao.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (!companyId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-black">Empresa nao identificada</h3>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Recarregue a sessao para gerenciar as integracoes de captacao.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Fontes externas</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure webhooks e regras de entrada para leads de Ads.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenNewIntegration}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nova Integracao
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando integracoes...
        </div>
      ) : integrations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <RadioTower className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-4 text-base font-black text-slate-800 dark:text-white">
            Nenhuma integracao criada
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Crie uma fonte para gerar a URL do webhook e mapear campanhas.
          </p>
          <button
            type="button"
            onClick={handleOpenNewIntegration}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <PlusCircle className="h-4 w-4" />
            Criar primeira integracao
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {integrations.map((integration) => {
            const provider = PROVIDERS.find((item) => item.value === integration.provider) ?? PROVIDERS[0];
            const status = STATUS_CONFIG[integration.status];
            const StatusIcon = status.Icon;
            const ProviderIcon = provider.Icon;

            return (
              <article
                key={integration.id}
                className="group flex min-h-[230px] flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-900/70"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${provider.iconClassName}`}
                    >
                      <ProviderIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-black text-slate-900 dark:text-white">
                        {integration.name}
                      </h4>
                      <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                        {provider.subtitle}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase ring-1 ${status.className}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-950/60">
                    <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <CalendarClock className="h-4 w-4" />
                      Ultimo lead
                    </span>
                    <span className="text-right font-bold text-slate-700 dark:text-slate-200">
                      {formatLeadDate(integration.last_lead_received_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-950/60">
                    <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Link2 className="h-4 w-4" />
                      Regras
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {mappingsCountByIntegration[integration.id] ?? 0}
                    </span>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditIntegration(integration)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:text-brand-300"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteIntegration(integration)}
                    disabled={deletingId === integration.id}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-red-900/70 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    aria-label="Apagar integracao"
                    title="Apagar"
                  >
                    {deletingId === integration.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && draftIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-black uppercase text-brand-600 dark:text-brand-400">
                  Integracao de captacao
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                  {draftIntegration.name || 'Nova integracao'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setWizardTab('connection')}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-black transition ${
                    wizardTab === 'connection'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <Settings2 className="h-4 w-4" />
                  Conexao
                </button>
                <button
                  type="button"
                  onClick={() => setWizardTab('mappings')}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-black transition ${
                    wizardTab === 'mappings'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <Link2 className="h-4 w-4" />
                  Mapeamento
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {wizardTab === 'connection' ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                      Nome da integracao
                    </label>
                    <input
                      type="text"
                      value={draftIntegration.name}
                      onChange={(event) =>
                        setDraftIntegration((current) =>
                          current ? { ...current, name: event.target.value } : current
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                      Provider
                    </label>
                    <select
                      value={draftIntegration.provider}
                      onChange={(event) => handleProviderChange(event.target.value as LeadProvider)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      {PROVIDERS.map((provider) => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                      Status
                    </label>
                    <select
                      value={draftIntegration.status}
                      onChange={(event) =>
                        setDraftIntegration((current) =>
                          current
                            ? { ...current, status: event.target.value as IntegrationStatus }
                            : current
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                      <option value="draft">Rascunho</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                      URL de Webhook
                    </label>
                    <div className="flex min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-xs text-slate-600 outline-none dark:text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCopyWebhookUrl()}
                        className="inline-flex shrink-0 items-center justify-center gap-2 border-l border-slate-200 px-4 text-sm font-black text-slate-600 transition hover:bg-white hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-brand-400"
                      >
                        {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        Copiar URL
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">
                        Regras de campanhas
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Direcione formularios ou campanhas para leads genericos ou imoveis.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMapping}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:text-brand-300"
                    >
                      <Plus className="h-4 w-4" />
                      Nova regra
                    </button>
                  </div>

                  {draftMappings.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950/60">
                      <Link2 className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
                      <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
                        Nenhuma regra de mapeamento cadastrada.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {draftMappings.map((mapping, index) => (
                        <div
                          key={mapping.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                              Regra {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMapping(mapping.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                              aria-label="Remover regra"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="xl:col-span-2">
                              <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                                ID da Campanha ou Form
                              </label>
                              <input
                                type="text"
                                value={mapping.external_object_id}
                                onChange={(event) =>
                                  handleDraftMappingChange(mapping.id, {
                                    external_object_id: event.target.value,
                                  })
                                }
                                placeholder="Ex: 1234567890"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                                Tipo
                              </label>
                              <select
                                value={mapping.external_object_type}
                                onChange={(event) =>
                                  handleDraftMappingChange(mapping.id, {
                                    external_object_type: event.target.value as ExternalObjectType,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              >
                                <option value="campaign">campaign</option>
                                <option value="form">form</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                                Modo
                              </label>
                              <select
                                value={mapping.lead_mode}
                                onChange={(event) =>
                                  handleDraftMappingChange(mapping.id, {
                                    lead_mode: event.target.value as LeadMode,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              >
                                <option value="generic">Lead Generico</option>
                                <option value="property_specific">Imovel Especifico</option>
                              </select>
                            </div>

                            {mapping.lead_mode === 'property_specific' && (
                              <div className="md:col-span-2 xl:col-span-4">
                                <label className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                                  Imovel
                                </label>
                                <select
                                  value={mapping.property_id ?? ''}
                                  disabled={propertiesLoading || properties.length === 0}
                                  onChange={(event) =>
                                    handleDraftMappingChange(mapping.id, {
                                      property_id: event.target.value || null,
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                  <option value="">
                                    {propertiesLoading
                                      ? 'Carregando imoveis...'
                                      : properties.length === 0
                                        ? 'Nenhum imovel disponivel'
                                        : 'Selecione um imovel'}
                                  </option>
                                  {properties.map((property) => (
                                    <option key={property.id} value={property.id}>
                                      {property.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveWizard()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Integracao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
