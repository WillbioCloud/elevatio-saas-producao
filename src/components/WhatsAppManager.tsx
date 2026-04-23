import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  Loader2,
  Power,
  QrCode,
  RefreshCw,
  Smartphone,
  Unplug,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../contexts/ToastContext';
import { GlassCard } from './ui/GlassCard';
import { cn } from '../lib/utils';

type WhatsAppInstanceType = 'central' | 'personal';
type WhatsAppInstanceStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | string;

type WhatsAppInstance = {
  id: string;
  company_id?: string | null;
  user_id?: string | null;
  type?: WhatsAppInstanceType | null;
  instance_type?: WhatsAppInstanceType | null;
  status?: WhatsAppInstanceStatus | null;
  phone_number?: string | null;
  connected_number?: string | null;
  number?: string | null;
  display_name?: string | null;
  instance_token?: string | null;
  qr_code?: string | null;
  created_at?: string | null;
};

const getInstanceKind = (instance?: WhatsAppInstance | null): WhatsAppInstanceType | null => {
  if (!instance) return null;
  if (instance.type === 'central' || instance.type === 'personal') return instance.type;
  if (instance.instance_type === 'central' || instance.instance_type === 'personal') return instance.instance_type;
  return null;
};

const getConnectedNumber = (instance?: WhatsAppInstance | null) => {
  return instance?.phone_number || instance?.connected_number || instance?.number || null;
};

const getStatusMeta = (status?: WhatsAppInstanceStatus | null) => {
  switch (status) {
    case 'connected':
      return {
        label: 'Conectado',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
        icon: CheckCircle,
      };
    case 'connecting':
      return {
        label: 'Conectando',
        className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
        icon: Loader2,
      };
    case 'error':
      return {
        label: 'Erro',
        className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
        icon: Unplug,
      };
    default:
      return {
        label: 'Desconectado',
        className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        icon: Power,
      };
  }
};

const normalizeInstances = (rows: unknown[] | null): WhatsAppInstance[] => {
  return (rows ?? [])
    .map((row) => row as WhatsAppInstance)
    .filter((row) => typeof row.id === 'string');
};

const isAbortError = (error: unknown): boolean => {
  if (!error) return false;
  const message = `${(error as { message?: string }).message ?? ''}`.toLowerCase();
  const name = `${(error as { name?: string }).name ?? ''}`;
  return name === 'AbortError' || message.includes('aborted') || message.includes('signal is aborted');
};

const WhatsAppManager: React.FC = () => {
  const { user, isOwner } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<WhatsAppInstanceType>('personal');
  const [actionLoading, setActionLoading] = useState<WhatsAppInstanceType | string | null>(null);

  const companyId = user?.company_id ?? tenant?.id ?? null;
  const canManageCentral = isOwner || user?.role === 'admin';

  const centralInstance = useMemo(
    () => instances.find((instance) => getInstanceKind(instance) === 'central') ?? null,
    [instances]
  );

  const personalInstance = useMemo(
    () =>
      instances.find((instance) => {
        const kind = getInstanceKind(instance);
        return kind === 'personal' || (!kind && instance.user_id === user?.id);
      }) ?? null,
    [instances, user?.id]
  );

  const selectedInstance = selectedType === 'central' ? centralInstance : personalInstance;

  const fetchInstances = useCallback(
    async (showSpinner = true) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      if (showSpinner) {
        setLoading(true);
      }

      try {
        const { data, error } = await supabase.from('whatsapp_instances').select('*');

        if (error) throw error;
        setInstances(normalizeInstances(data as unknown[] | null));
      } catch (error) {
        if (isAbortError(error)) return;
        console.error('Erro ao carregar instancias de WhatsApp:', error);
        addToast('Nao foi possivel carregar as conexoes de WhatsApp.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [addToast, user?.id]
  );

  useEffect(() => {
    void fetchInstances();
  }, [fetchInstances]);

  const handleConnect = async (type: WhatsAppInstanceType) => {
    if (!companyId || !user?.id) {
      addToast('Nao foi possivel identificar a empresa ou o usuario ativo.', 'error');
      return;
    }

    const currentInstance = type === 'central' ? centralInstance : personalInstance;
    setActionLoading(type);
    setSelectedType(type);

    try {
      const payload = {
        ...(currentInstance?.id ? { id: currentInstance.id } : {}),
        company_id: companyId,
        user_id: type === 'personal' ? user.id : null,
        type,
        status: 'connecting',
        instance_token: null,
        qr_code: null,
      };

      const { error } = await supabase.from('whatsapp_instances').upsert(payload);
      if (error) throw error;

      await fetchInstances(false);
      setQrModalOpen(true);
      addToast('Conexao iniciada. Aguarde o QR Code do backend.', 'info');
    } catch (error) {
      console.error('Erro ao iniciar conexao do WhatsApp:', error);
      addToast('Nao foi possivel iniciar a conexao do WhatsApp.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualRefresh = async () => {
    setActionLoading('refresh');

    try {
      const refreshResult = await Promise.race([
        supabase.auth.refreshSession().then(() => 'refreshed' as const),
        new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), 3000)),
      ]);

      if (refreshResult === 'timeout') {
        window.location.reload();
        return;
      }

      await fetchInstances();
    } catch (error) {
      if (!isAbortError(error)) {
        console.warn('Nao foi possivel renovar a sessao antes do refresh:', error);
      }
      await fetchInstances();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setActionLoading(id);

    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          instance_token: null,
          qr_code: null,
        })
        .eq('id', id);

      if (error) throw error;

      await fetchInstances(false);
      addToast('WhatsApp desconectado com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao desconectar WhatsApp:', error);
      addToast('Nao foi possivel desconectar o WhatsApp.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const renderConnectionCard = (
    type: WhatsAppInstanceType,
    title: string,
    description: string,
    instance: WhatsAppInstance | null
  ) => {
    const status = instance?.status ?? 'disconnected';
    const statusMeta = getStatusMeta(status);
    const StatusIcon = statusMeta.icon;
    const connectedNumber = getConnectedNumber(instance);
    const isConnected = status === 'connected';
    const isConnecting = status === 'connecting';
    const isBusy = actionLoading === type || actionLoading === instance?.id;

    return (
      <GlassCard variant={type === 'central' ? 'accent' : 'elevated'} className="overflow-hidden">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                type === 'central'
                  ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
              )}
            >
              <Smartphone size={24} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-slate-800 dark:text-white">{title}</h3>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', statusMeta.className)}>
                  <StatusIcon size={13} className={status === 'connecting' ? 'animate-spin' : ''} />
                  {statusMeta.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-slate-700 dark:text-slate-200">Numero:</span>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                  {connectedNumber || 'Nenhum numero conectado'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
            {isConnected && instance?.id ? (
              <button
                type="button"
                onClick={() => void handleDisconnect(instance.id)}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
              >
                {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                Desconectar
              </button>
            ) : (
              <>
                {isConnecting && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType(type);
                      setQrModalOpen(true);
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <QrCode size={16} />
                    Ver QR
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleConnect(type)}
                  disabled={isBusy || loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  {isBusy ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                  Conectar
                </button>
              </>
            )}
          </div>
        </div>
      </GlassCard>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white">Numeros conectados</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie os canais usados para atendimento, notificacoes e cobrancas automaticas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleManualRefresh()}
          disabled={loading || actionLoading === 'refresh'}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw size={15} className={loading || actionLoading === 'refresh' ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {canManageCentral &&
        renderConnectionCard(
          'central',
          'WhatsApp Central (SDR / Financeiro)',
          'Canal compartilhado para distribuicao de leads, avisos de pagamento e comunicacoes da empresa.',
          centralInstance
        )}

      {renderConnectionCard(
        'personal',
        'Meu WhatsApp Pessoal',
        'Canal individual do corretor para contato direto com leads e acompanhamento de oportunidades.',
        personalInstance
      )}

      {qrModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Conectar WhatsApp</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedType === 'central' ? 'Canal central da imobiliaria' : 'Canal pessoal do corretor'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950/50">
              {selectedInstance?.qr_code ? (
                <img
                  src={selectedInstance.qr_code}
                  alt="QR Code do WhatsApp"
                  className="mx-auto h-56 w-56 rounded-xl border border-slate-200 bg-white object-contain p-3 dark:border-slate-700"
                />
              ) : (
                <div className="mx-auto flex h-56 w-56 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                  <QrCode size={84} />
                  <span className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-300">Aguardando backend</span>
                </div>
              )}
              <p className="mx-auto mt-4 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Assim que o servico gerar o QR Code, ele aparecera aqui para leitura no app do WhatsApp.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppManager;
