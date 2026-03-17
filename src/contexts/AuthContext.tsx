import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type ProfileData = {
  id?: string;
  role?: string;
  name?: string;
  phone?: string;
  avatar_url?: string;
  level?: number;
  xp_points?: number;
  active?: boolean;
  company_id?: string;
  company?: {
    name: string;
    plan: 'free' | 'starter' | 'basic' | 'profissional' | 'business' | 'premium' | 'elite';
  };
  [key: string]: unknown;
};

export type UserWithRole = User & {
  name?: string;
  phone?: string;
  role?: string;
  avatar_url?: string;
  level?: number;
  xp_points?: number;
  active?: boolean;
  company_id?: string;
  company?: {
    name: string;
    plan: 'free' | 'starter' | 'basic' | 'profissional' | 'business' | 'premium' | 'elite';
  };
  profile?: ProfileData | null;
};

interface AuthContextType {
  session: Session | null;
  user: UserWithRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (
    name: string,
    email: string,
    password: string,
    metaData?: Record<string, unknown>
  ) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Helpers para tratamento de dados seguros ---
const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildFallbackUser = (supabaseUser: User): UserWithRole => {
  const metadata = (supabaseUser.user_metadata as Record<string, unknown> | undefined) ?? {};
  return {
    ...supabaseUser,
    name: (metadata.name as string | undefined) ?? 'Usuário',
    role: (metadata.role as string | undefined) ?? 'corretor',
    avatar_url: (metadata.avatar_url as string | undefined) ?? undefined,
    level: toNumber(metadata.level, 1),
    xp_points: toNumber(metadata.xp_points ?? metadata.xp, 0),
    active: true,
    company_id: undefined,
    company: undefined,
    profile: null,
  };
};

const mergeUserWithProfile = (supabaseUser: User, profile: ProfileData | null): UserWithRole => {
  if (!profile) return buildFallbackUser(supabaseUser);
  return {
    ...supabaseUser,
    role: profile.role ?? 'corretor',
    name: profile.name ?? (supabaseUser.user_metadata?.name as string | undefined) ?? 'Usuário',
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    level: toNumber(profile.level, 1),
    xp_points: toNumber(profile.xp_points ?? profile.xp, 0),
    active: profile.active ?? true,
    company_id: profile.company_id,
    company: profile.company,
    profile,
  };
};


const isAbortError = (error: unknown): boolean => {
  if (!error) return false;
  const message = `${(error as { message?: string }).message ?? ''}`.toLowerCase();
  const name = `${(error as { name?: string }).name ?? ''}`;
  return name === 'AbortError' || message.includes('signal is aborted') || message.includes('aborted');
};

let lastTokenRefresh = 0;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Refs para controle de montagem e estado atual (evita dependências circulares)
  const isMounted = useRef(true);
  const currentUserRef = useRef<UserWithRole | null>(null);
  const currentSessionRef = useRef<Session | null>(null);

  // Mantém o ref sincronizado com o state
  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  useEffect(() => {
    currentSessionRef.current = session;
  }, [session]);

  // Busca dados do perfil
  const fetchProfileData = useCallback(async (currentSession: Session): Promise<UserWithRole> => {
    if (!currentSession.user) return buildFallbackUser(currentSession.user);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, company:companies(name, plan)')
        .eq('id', currentSession.user.id)
        .maybeSingle();

      if (error) {
        return buildFallbackUser(currentSession.user);
      }

      return mergeUserWithProfile(currentSession.user, (data as ProfileData | null) ?? null);
    } catch {
      return buildFallbackUser(currentSession.user);
    }
  }, []);

  // Aplica a sessão ao estado (Lógica Principal)
  const applySession = useCallback(async (currentSession: Session | null, forceUpdate = false) => {
    if (!isMounted.current) return;

    if (!currentSession) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    // --- CORREÇÃO CRÍTICA DO LOOP ---
    // Se já temos um usuário carregado e o ID é o mesmo da nova sessão,
    // significa que é apenas um refresh de token (mudança de aba, etc).
    // NÃO recarregamos o perfil para evitar piscar a tela ou loop.
    if (!forceUpdate && currentUserRef.current?.id === currentSession.user.id) {
      if (currentSessionRef.current?.access_token === currentSession.access_token) {
        setLoading(false);
        return;
      }

      console.log('Sessão renovada (Token Refresh). Mantendo estado do usuário.');
      setSession(currentSession); // Apenas atualiza o token novo
      setLoading(false);
      return; 
    }

    // Se chegou aqui, é um login novo ou troca de usuário real
    setSession(currentSession);

    // Busca dados completos primeiro, DEPOIS atualiza o state para evitar falhas de company_id
    const fullUser = await fetchProfileData(currentSession);

    if (isMounted.current) {
      setUser(fullUser);
      setLoading(false);
    }
  }, [fetchProfileData]);

  const recoverSessionFromHash = useCallback(async (): Promise<boolean> => {
    const rawHash = window.location.hash || '';
    if (!rawHash) return false;

    const tokenStart = rawHash.indexOf('access_token=');
    if (tokenStart === -1) return false;

    const tokenHash = rawHash.slice(tokenStart);
    const params = new URLSearchParams(tokenHash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) return false;

    try {
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;

      if (window.location.hash.includes('access_token=')) {
        const cleanHash = rawHash.slice(0, tokenStart).replace(/[?#&]+$/, '');
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleanHash}`);
      }

      await applySession(data.session ?? null);
      return true;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Falha ao recuperar sessão manualmente via hash:', error);
      }
      return false;
    }
  }, [applySession]);

  useEffect(() => {
    let isActive = true;

    const initializeAuth = async () => {
      try {
        console.log('🚨 [DEBUG] 1. Iniciando getSession...');
        const recoveredFromHash = await recoverSessionFromHash();
        if (recoveredFromHash) return;

        const { data: { session: initSession }, error } = await supabase.auth.getSession();
        console.log('🚨 [DEBUG] 2. getSession finalizado. Sucesso:', !error);

        if (isActive && !error) {
          await applySession(initSession);
        } else if (isActive && error) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro na inicialização:', err);
        if (isActive) setLoading(false);
      }
    };

    initializeAuth();

    // Variável de controle para impedir o Deadlock (Race Condition) no Chrome/Android
    let isFirstListenerEvent = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isActive) return;

      // BLOQUEIO ANTI-DEADLOCK: O Supabase dispara o listener imediatamente ao ser registrado.
      // Ignoramos esse primeiro disparo porque o `initializeAuth` já está carregando os dados com segurança.
      if (isFirstListenerEvent) {
        console.log(`🚨 [DEBUG] Ignorando evento inicial do listener (${event}) para evitar deadlock.`);
        isFirstListenerEvent = false;
        return;
      }

      if (event === 'INITIAL_SESSION') return;

      if (event === 'TOKEN_REFRESHED') {
        const now = Date.now();
        if (now - lastTokenRefresh < 2000) return;
        lastTokenRefresh = now;
      }

      console.log(`🚨 [DEBUG] Auth Event Real: ${event}`);

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession) {
          try {
            await applySession(newSession, false);
          } catch (error) {
            if (!isAbortError(error)) console.error('Erro ao aplicar sessão:', error);
          }
        }
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [applySession, recoverSessionFromHash]);

  const refreshUser = async () => {
    if (!session) return;
    const { data } = await supabase.auth.refreshSession();
    // Aqui usamos forceUpdate = true porque o usuário pediu explicitamente para atualizar
    if (data.session) await applySession(data.session, true);
  };

  const signIn = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, company:companies(name, plan)')
        .eq('id', authData.user.id)
        .single();

      const signedUser = mergeUserWithProfile(authData.user, (profile as ProfileData | null) ?? null);
      setUser(signedUser);
    }

    return { error };
  };

  const signUp = async (
    name: string, 
    email: string, 
    password: string, 
    metaData?: Record<string, unknown>
  ) => {
    try {
      // Validação básica antes de enviar pro Supabase
      if (!email || !email.includes('@')) {
        return { error: { message: 'Formato de e-mail inválido.' } };
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(), // .trim() remove espaços acidentais
        password,
        options: {
          data: {
            name: name.trim(),
            ...metaData,
          },
        },
      });

      return { error };
    } catch (err) {
      return { error: err };
    }
  };

  const signOut = async () => {
    setSession(null);
    setUser(null);
    setLoading(false);

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error && !isAbortError(error)) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};