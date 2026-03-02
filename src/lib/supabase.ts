import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificação de segurança para não quebrar o app silenciosamente
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Erro Crítico: Variáveis de ambiente do Supabase não encontradas.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'trimoveis-auth-token',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: { 'x-application-name': 'trimoveis-crm' },
  },
});

// --- FUNÇÕES AUXILIARES (Mantidas para compatibilidade) ---

export const isRecoverableAuthError = (error: unknown): boolean => {
  if (!error) return false;
  const message = `${(error as { message?: string }).message ?? ''}`.toLowerCase();
  return (
    message.includes('jwt') ||
    message.includes('expired') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  );
};

export async function runWithSessionRecovery<T>(executor: () => Promise<T>): Promise<T> {
  try {
    return await executor();
  } catch (error) {
    if (isRecoverableAuthError(error)) {
      console.warn('Sessão expirada ou erro de rede. Tentando recuperar...');
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !data.session) {
        throw error; // Não conseguiu recuperar, joga o erro original
      }
      
      // Tenta novamente com a sessão renovada
      return await executor();
    }
    throw error;
  }
}