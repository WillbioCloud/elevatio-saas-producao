import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  AppUserRole,
  CompanyPermissions,
  CompanySettings,
} from '../types';
import { DEFAULT_COMPANY_PERMISSIONS } from '../types';

type CompanyProfile = {
  name: string;
  plan: string;
  document?: string | null;
  logo_url?: string | null;
  admin_signature_url?: string | null;
  use_asaas?: boolean;
  default_commission?: number;
  broker_commission?: number;
  payment_api_key?: string;
  manual_discount_value?: number | null;
  manual_discount_type?: 'fixed' | 'percentage' | null;
};

type ProfileData = {
  id?: string;
  role?: AppUserRole;
  name?: string;
  phone?: string;
  avatar_url?: string;
  level?: number;
  xp_points?: number;
  active?: boolean;
  company_id?: string;
  company?: CompanyProfile;
  [key: string]: unknown;
};

export type UserWithRole = User & {
  name?: string;
  phone?: string;
  role?: AppUserRole;
  avatar_url?: string;
  level?: number;
  xp_points?: number;
  active?: boolean;
  company_id?: string;
  company?: CompanyProfile;
  profile?: ProfileData | null;
};

interface AuthContextType {
  session: Session | null;
  user: UserWithRole | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAtendente: boolean;
  hasPermission: (permissionName: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown; user?: UserWithRole | null }>;
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

const normalizeUserRole = (role: unknown): AppUserRole => {
  switch (role) {
    case 'owner':
    case 'manager':
    case 'admin':
    case 'atendente':
    case 'corretor':
    case 'super_admin':
      return role;
    default:
      return 'corretor';
  }
};

const normalizeCompanyPermissions = (permissions: unknown): CompanyPermissions => {
  const source =
    permissions && typeof permissions === 'object'
      ? (permissions as Partial<CompanyPermissions>)
      : {};

  return {
    brokers_can_create_properties:
      source.brokers_can_create_properties ?? DEFAULT_COMPANY_PERMISSIONS.brokers_can_create_properties,
    brokers_can_edit_properties:
      source.brokers_can_edit_properties ?? DEFAULT_COMPANY_PERMISSIONS.brokers_can_edit_properties,
    atendentes_can_assign_leads:
      source.atendentes_can_assign_leads ?? DEFAULT_COMPANY_PERMISSIONS.atendentes_can_assign_leads,
  };
};

const COMPANY_PROFILE_SELECT =
  'name, plan, document, logo_url, admin_signature_url, use_asaas, default_commission, broker_commission, payment_api_key, manual_discount_value, manual_discount_type';

const buildFallbackUser = (supabaseUser: User): UserWithRole => {
  const metadata = (supabaseUser.user_metadata as Record<string, unknown> | undefined) ?? {};
  return {
    ...supabaseUser,
    name:
      (metadata.name as string | undefined) ??
      (metadata.full_name as string | undefined) ??
      'Usuário',
    role: normalizeUserRole(metadata.role),
    avatar_url: (metadata.avatar_url as string | undefined) ?? undefined,
    level: toNumber(metadata.level, 1),
    xp_points: toNumber(metadata.xp_points ?? metadata.xp, 0),
    active: true,
    company_id: typeof metadata.company_id === 'string' ? metadata.company_id : undefined,
    company: undefined,
    profile: null,
  };
};

const mergeUserWithProfile = (supabaseUser: User, profile: ProfileData | null): UserWithRole => {
  if (!profile) return buildFallbackUser(supabaseUser);
  return {
    ...supabaseUser,
    role: normalizeUserRole(profile.role),
    name:
      profile.name ??
      (supabaseUser.user_metadata?.name as string | undefined) ??
      (supabaseUser.user_metadata?.full_name as string | undefined) ??
      'Usuário',
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
  const [companyPermissions, setCompanyPermissions] = useState<CompanyPermissions>({
    ...DEFAULT_COMPANY_PERMISSIONS,
  });
  
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

  // --- PERMISSOES GLOBAIS ---
  // isAdmin: Pode ver o CRM todo (Dono, Gerente, Admin e Super Admin do SaaS)
  const isAdmin = useMemo(
    () => ['owner', 'admin', 'manager', 'super_admin'].includes(user?.role ?? ''),
    [user?.role]
  );

  // isOwner: Poderes administrativos e financeiros (Dono e Super Admin)
  const isOwner = useMemo(
    () => ['owner', 'super_admin'].includes(user?.role ?? ''),
    [user?.role]
  );

  // isManager: Gestao operacional (Gerentes, Admins e Donos)
  const isManager = useMemo(
    () => ['manager', 'admin', 'owner', 'super_admin'].includes(user?.role ?? ''),
    [user?.role]
  );

  const isAtendente = user?.role === 'atendente';

  const hasPermission = useCallback(
    (permissionName: string) => {
      if (isOwner) return true; // Dono sempre pode tudo
      const permissions = companyPermissions ?? DEFAULT_COMPANY_PERMISSIONS;
      return !!permissions[permissionName as keyof CompanyPermissions];
    },
    [companyPermissions, isOwner]
  );

  useEffect(() => {
    if (!user?.company_id) {
      setCompanyPermissions({ ...DEFAULT_COMPANY_PERMISSIONS });
      return;
    }

    let isCancelled = false;

    const loadCompanyPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('permissions')
          .eq('company_id', user.company_id)
          .maybeSingle();

        if (error) {
          if (!isAbortError(error)) {
            console.warn('Falha ao carregar permissÃµes da empresa:', error.message);
          }
          if (!isCancelled) {
            setCompanyPermissions({ ...DEFAULT_COMPANY_PERMISSIONS });
          }
          return;
        }

        if (!isCancelled) {
          const settingsData = data as Pick<CompanySettings, 'permissions'> | null;
          setCompanyPermissions(normalizeCompanyPermissions(settingsData?.permissions));
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.warn('Falha ao carregar permissÃµes da empresa:', error);
        }
        if (!isCancelled) {
          setCompanyPermissions({ ...DEFAULT_COMPANY_PERMISSIONS });
        }
      }
    };

    void loadCompanyPermissions();

    return () => {
      isCancelled = true;
    };
  }, [user?.company_id]);

  useEffect(() => {
    const handlePermissionsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        companyId?: string;
        permissions?: CompanyPermissions;
      }>).detail;

      if (detail?.companyId !== user?.company_id || !detail.permissions) return;
      setCompanyPermissions(normalizeCompanyPermissions(detail.permissions));
    };

    window.addEventListener('company-permissions-updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('company-permissions-updated', handlePermissionsUpdated);
    };
  }, [user?.company_id]);

  // Busca dados do perfil
  const fetchProfileData = useCallback(async (currentSession: Session): Promise<UserWithRole> => {
    if (!currentSession.user) return buildFallbackUser(currentSession.user);

    const currentAuthUser = currentSession.user;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, company:companies(${COMPANY_PROFILE_SELECT})`)
        .eq('id', currentAuthUser.id)
        .maybeSingle();

      if (!error && data) {
        return mergeUserWithProfile(currentAuthUser, (data as ProfileData | null) ?? null);
      }

      if (error && !isAbortError(error)) {
        console.warn('Falha ao carregar perfil completo. Tentando fallback simples...', error.message);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.warn('Falha ao carregar perfil com empresa vinculada. Tentando fallback simples...', error);
      }
    }

    try {
      const { data: rawProfile, error: rawProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentAuthUser.id)
        .maybeSingle();

      if (rawProfileError) {
        throw rawProfileError;
      }

      const normalizedProfile = (rawProfile as ProfileData | null) ?? null;
      if (!normalizedProfile) {
        return buildFallbackUser(currentAuthUser);
      }

      let company: CompanyProfile | undefined;

      if (normalizedProfile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select(COMPANY_PROFILE_SELECT)
          .eq('id', normalizedProfile.company_id)
          .maybeSingle();

        if (companyError) {
          if (!isAbortError(companyError)) {
            console.warn('Falha ao carregar dados da empresa no fallback do perfil:', companyError.message);
          }
        } else if (companyData) {
          company = companyData as CompanyProfile;
        }
      }

      return mergeUserWithProfile(currentAuthUser, {
        ...normalizedProfile,
        company,
      });
    } catch (error) {
      if (!isAbortError(error)) {
        console.warn('Falha ao carregar perfil no fallback simples. Usando metadata local.', error);
      }
      return buildFallbackUser(currentAuthUser);
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
    let signedUser: UserWithRole | null = null;

    if (!error && authData?.user) {
      signedUser = authData.session
        ? await fetchProfileData(authData.session)
        : buildFallbackUser(authData.user);
      setUser(signedUser);
    }

    return { error, user: signedUser };
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
            role: 'owner', // Todo novo cadastro via Landing Page nasce como Dono
            ...metaData,
          },
          emailRedirectTo: `${window.location.origin}/admin/login`,
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
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isOwner,
        isAdmin,
        isManager,
        isAtendente,
        hasPermission,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
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
