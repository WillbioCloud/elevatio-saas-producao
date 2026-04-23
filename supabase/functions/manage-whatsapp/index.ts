import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ManageAction = 'connect' | 'disconnect'
type JsonRecord = Record<string, any>

type RequestPayload = {
  action?: unknown
  company_id?: unknown
  user_id?: unknown
}

class HttpError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '')

const EVOLUTION_API_URL = normalizeBaseUrl(Deno.env.get('EVOLUTION_API_URL') ?? '')
const EVOLUTION_GLOBAL_API_KEY = normalizeString(Deno.env.get('EVOLUTION_GLOBAL_API_KEY') ?? '')

if (!EVOLUTION_API_URL) {
  console.warn('[manage-whatsapp] EVOLUTION_API_URL nao configurada.')
}

if (!EVOLUTION_GLOBAL_API_KEY) {
  console.warn('[manage-whatsapp] EVOLUTION_GLOBAL_API_KEY nao configurada.')
}

const jsonResponse = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getErrorStatus = (error: unknown) => {
  const status = Number((error as { status?: unknown })?.status)
  return Number.isInteger(status) && status >= 400 ? status : 500
}

const getAuthToken = (req: Request) => {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader) throw new HttpError('Acesso negado: token ausente.', 401)

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new HttpError('Acesso negado: token ausente.', 401)

  return token
}

const createSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError('Erro interno: variaveis do Supabase ausentes.', 500)
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

const requireEvolutionConfig = () => {
  if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
    throw new HttpError('Evolution API nao configurada no servidor.', 500)
  }
}

const parsePayload = async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as RequestPayload
  const action = normalizeString(body.action) as ManageAction
  const companyId = normalizeString(body.company_id)
  const userId = normalizeString(body.user_id) || null

  if (action !== 'connect' && action !== 'disconnect') {
    throw new HttpError('Acao invalida. Use connect ou disconnect.', 400)
  }

  if (!companyId) {
    throw new HttpError('company_id e obrigatorio.', 400)
  }

  return { action, companyId, userId }
}

const buildInstanceName = (companyId: string, userId: string | null) => {
  return userId ? `tenant_${companyId}_user_${userId}` : `tenant_${companyId}_central`
}

const validateCompanyAccess = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  token: string,
  companyId: string,
  requestedUserId: string | null
) => {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  const authUser = authData?.user

  if (authError || !authUser) {
    throw new HttpError('Acesso negado: sessao invalida.', 401)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, company_id, role')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw new HttpError('Acesso negado: perfil do usuario nao encontrado.', 403)
  }

  const role = String(profile.role ?? '')
  const isSuperAdmin = role === 'super_admin'
  const canManageCentral = ['owner', 'admin', 'super_admin'].includes(role)
  const canManageOtherUsers = ['owner', 'admin', 'super_admin'].includes(role)

  if (!isSuperAdmin && profile.company_id !== companyId) {
    throw new HttpError('Acesso negado: empresa invalida.', 403)
  }

  if (!requestedUserId && !canManageCentral) {
    throw new HttpError('Acesso negado: apenas administradores podem gerenciar o WhatsApp central.', 403)
  }

  if (requestedUserId && requestedUserId !== authUser.id) {
    if (!canManageOtherUsers) {
      throw new HttpError('Acesso negado: usuario invalido.', 403)
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', requestedUserId)
      .maybeSingle()

    if (targetProfileError || !targetProfile) {
      throw new HttpError('Usuario alvo nao encontrado.', 404)
    }

    if (!isSuperAdmin && targetProfile.company_id !== companyId) {
      throw new HttpError('Acesso negado: usuario alvo pertence a outra empresa.', 403)
    }
  }

  return { authUser, profile, role }
}

const parseEvolutionResponse = async (response: Response) => {
  const rawText = await response.text()

  try {
    return rawText ? JSON.parse(rawText) : {}
  } catch {
    return { raw: rawText }
  }
}

const buildEvolutionHeaders = (headers?: HeadersInit) => {
  const mergedHeaders = new Headers(headers)

  mergedHeaders.set('apikey', EVOLUTION_GLOBAL_API_KEY)
  mergedHeaders.set('Accept', 'application/json')
  mergedHeaders.set('Content-Type', 'application/json')

  return mergedHeaders
}

const callEvolutionApi = async (
  path: string,
  options: RequestInit & { allowNotFound?: boolean } = {}
) => {
  requireEvolutionConfig()

  const { allowNotFound, headers, ...requestOptions } = options
  const response = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...requestOptions,
    headers: buildEvolutionHeaders(headers),
  })

  const responseBody = await parseEvolutionResponse(response)

  if (!response.ok && !(allowNotFound && response.status === 404)) {
    console.error('[manage-whatsapp] Evolution API error:', response.status, responseBody)
    const message =
      responseBody?.message ||
      responseBody?.error ||
      responseBody?.response?.message ||
      'Falha ao comunicar com a Evolution API.'

    throw new HttpError(String(message), response.status >= 400 ? response.status : 502)
  }

  return responseBody
}

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (normalized) return normalized
    }
  }

  return null
}

const extractInstanceToken = (response: JsonRecord) => {
  return firstString(
    response?.hash?.apikey,
    response?.hash?.apiKey,
    response?.instance?.apikey,
    response?.instance?.apiKey,
    response?.apikey,
    response?.apiKey
  )
}

const extractQrCode = (response: JsonRecord) => {
  return firstString(
    response?.qrcode?.base64,
    response?.qrcode?.qrCode,
    response?.qrcode?.code,
    response?.qrCode?.base64,
    response?.qr_code,
    response?.qrcode,
    response?.base64
  )
}

const handleConnect = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  userId: string | null
) => {
  const instanceName = buildInstanceName(companyId, userId)

  const evolutionResponse = await callEvolutionApi('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName,
      qrcode: true,
    }),
  })

  const instanceToken = extractInstanceToken(evolutionResponse)
  const qrCode = extractQrCode(evolutionResponse)

  if (!instanceToken) {
    console.warn('[manage-whatsapp] Evolution API nao retornou hash.apikey.', evolutionResponse)
  }

  if (!qrCode) {
    console.warn('[manage-whatsapp] Evolution API nao retornou QR Code.', evolutionResponse)
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_instances')
    .upsert(
      {
        company_id: companyId,
        user_id: userId,
        instance_name: instanceName,
        instance_token: instanceToken,
        qr_code: qrCode,
        connection_status: 'connecting',
      },
      { onConflict: 'instance_name' }
    )
    .select('id, company_id, user_id, instance_name, qr_code, connection_status')
    .maybeSingle()

  if (error) throw error

  return jsonResponse({
    success: true,
    action: 'connect',
    instance_name: instanceName,
    connection_status: 'connecting',
    qr_code: qrCode,
    instance: data,
  })
}

const findCurrentInstance = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  userId: string | null
) => {
  let query = supabaseAdmin
    .from('whatsapp_instances')
    .select('id, instance_name')
    .eq('company_id', companyId)

  query = userId ? query.eq('user_id', userId) : query.is('user_id', null)

  const { data, error } = await query.maybeSingle()

  if (error) throw error
  if (!data?.instance_name) {
    throw new HttpError('Instancia de WhatsApp nao encontrada.', 404)
  }

  return data as { id: string; instance_name: string }
}

const handleDisconnect = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  userId: string | null
) => {
  const currentInstance = await findCurrentInstance(supabaseAdmin, companyId, userId)
  const encodedInstanceName = encodeURIComponent(currentInstance.instance_name)

  await callEvolutionApi(`/instance/logout/${encodedInstanceName}`, {
    method: 'DELETE',
    allowNotFound: true,
  })

  await callEvolutionApi(`/instance/delete/${encodedInstanceName}`, {
    method: 'DELETE',
    allowNotFound: true,
  })

  const { data, error } = await supabaseAdmin
    .from('whatsapp_instances')
    .update({
      connection_status: 'disconnected',
      qr_code: null,
      instance_token: null,
    })
    .eq('id', currentInstance.id)
    .select('id, company_id, user_id, instance_name, connection_status')
    .maybeSingle()

  if (error) throw error

  return jsonResponse({
    success: true,
    action: 'disconnect',
    instance_name: currentInstance.instance_name,
    connection_status: 'disconnected',
    instance: data,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
  }

  try {
    const token = getAuthToken(req)
    const { action, companyId, userId } = await parsePayload(req)
    const supabaseAdmin = createSupabaseAdmin()

    await validateCompanyAccess(supabaseAdmin, token, companyId, userId)

    if (action === 'connect') {
      return await handleConnect(supabaseAdmin, companyId, userId)
    }

    return await handleDisconnect(supabaseAdmin, companyId, userId)
  } catch (error) {
    console.error('[manage-whatsapp] Erro ao gerenciar WhatsApp:', error)

    return jsonResponse(
      {
        success: false,
        error: (error as { message?: string })?.message ?? 'Erro interno ao gerenciar WhatsApp.',
      },
      getErrorStatus(error)
    )
  }
})
