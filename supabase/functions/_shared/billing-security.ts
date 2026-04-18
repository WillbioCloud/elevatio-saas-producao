import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const BILLING_ROLES = new Set(['owner', 'manager', 'admin'])

export class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Variavel de ambiente ${name} nao configurada.`)
  return value
}

export const getAsaasApiUrl = () => getRequiredEnv('ASAAS_API_URL').replace(/\/+$/, '')

export const createSupabaseAdmin = () => createClient(
  getRequiredEnv('SUPABASE_URL'),
  getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
)

const getAuthorizationHeader = (req: Request) => {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader) throw new HttpError('Acesso negado: token ausente.', 401)

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new HttpError('Acesso negado: token ausente.', 401)

  return authHeader
}

export const createSupabaseForRequest = (req: Request) => {
  const authHeader = getAuthorizationHeader(req)

  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } }
  )
}

export const requireBillingCompanyAccess = async (req: Request, companyId: string) => {
  if (!companyId) throw new HttpError('ID da empresa nao informado.', 400)

  const supabaseUser = createSupabaseForRequest(req)
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

  if (authError || !user) {
    throw new HttpError('Acesso negado: sessao invalida.', 401)
  }

  const { data: profile, error: profileError } = await supabaseUser
    .from('profiles')
    .select('id, email, name, phone, company_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw new HttpError('Acesso negado: perfil do usuario nao encontrado.', 403)
  }

  const role = String(profile.role ?? '')
  const isSuperAdmin = role === 'super_admin'

  if (isSuperAdmin) {
    return { supabaseUser, user, profile, isSuperAdmin }
  }

  if (profile.company_id !== companyId || !BILLING_ROLES.has(role)) {
    throw new HttpError('Acesso negado: voce nao pode gerenciar esta assinatura.', 403)
  }

  return { supabaseUser, user, profile, isSuperAdmin }
}

export const getErrorStatus = (error: unknown) => {
  const status = Number((error as { status?: unknown })?.status)
  return Number.isInteger(status) && status >= 400 ? status : 400
}
