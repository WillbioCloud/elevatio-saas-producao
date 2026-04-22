import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
}

type Provider = 'meta' | 'google' | 'tiktok'
type JsonRecord = Record<string, any>
type SupabaseAdmin = ReturnType<typeof createClient>

type NormalizedExternalLead = {
  name: string | null
  email: string | null
  phone: string | null
  form_id: string | null
  campaign_id: string | null
  external_lead_id: string | null
  message: string | null
}

type LeadSourceMapping = {
  id?: string | null
  company_id?: string | null
  property_id?: string | null
  assigned_user_id?: string | null
  lead_mode?: string | null
  form_id?: string | null
  campaign_id?: string | null
}

type LeadSourceIntegration = {
  id: string
  company_id: string
  provider: Provider
  status?: string | null
  webhook_secret?: string | null
  verify_token?: string | null
}

type CompanySettings = {
  route_to_central?: boolean | null
  central_user_id?: string | null
  include_admins_in_roulette?: boolean | null
  kanban_config?: Record<string, string[]> | null
}

type ExternalLeadEventInput = {
  companyId?: string | null
  integrationId?: string | null
  provider?: Provider | null
  formId?: string | null
  campaignId?: string | null
  leadId?: string | null
  status: 'processed' | 'error' | 'duplicate'
  rawPayload: unknown
  normalizedPayload?: unknown
  errorMessage?: string | null
}

type ParsedRequestPayload = {
  body: JsonRecord
  rawBody: string
}

class IngestHttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'IngestHttpError'
    this.status = status
  }
}

const providerLabels: Record<Provider, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
}

const jsonResponse = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const asRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {})

const firstRecord = (...values: unknown[]): JsonRecord => {
  for (const value of values) {
    if (isRecord(value)) return value
  }

  return {}
}

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (normalized && normalized !== 'null' && normalized !== 'undefined') return normalized
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return null
}

const valueToString = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = valueToString(item)
      if (normalized) return normalized
    }

    return null
  }

  if (isRecord(value)) {
    return firstString(value.value, value.string_value, value.stringValue, value.text, value.answer)
  }

  return firstString(value)
}

const normalizePhoneForDedup = (value: string | null) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

const timingSafeEqual = (left: string, right: string) => {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false

  let diff = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index]
  }

  return diff === 0
}

const bytesToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const hmacSha256Hex = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return bytesToHex(signature)
}

const canonicalFieldName = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const pickFromRecord = (record: JsonRecord, keys: string[]) => {
  for (const key of keys) {
    const directValue = valueToString(record[key])
    if (directValue) return directValue

    const canonicalKey = canonicalFieldName(key)
    const matchedKey = Object.keys(record).find((candidate) => canonicalFieldName(candidate) === canonicalKey)
    if (matchedKey) {
      const matchedValue = valueToString(record[matchedKey])
      if (matchedValue) return matchedValue
    }
  }

  return null
}

const fieldMatches = (fieldName: unknown, aliases: string[]) => {
  const normalizedField = canonicalFieldName(fieldName)
  if (!normalizedField) return false

  return aliases.some((alias) => {
    const normalizedAlias = canonicalFieldName(alias)
    if (normalizedAlias.length <= 4) return normalizedField === normalizedAlias

    return normalizedField === normalizedAlias ||
      normalizedField.includes(normalizedAlias) ||
      normalizedAlias.includes(normalizedField)
  })
}

const pickFromFieldArray = (fields: unknown, aliases: string[]) => {
  if (!Array.isArray(fields)) return null

  for (const item of fields) {
    if (!isRecord(item)) continue

    const fieldName = item.name ??
      item.key ??
      item.field_name ??
      item.fieldName ??
      item.column_name ??
      item.columnName ??
      item.label ??
      item.question ??
      item.id

    if (!fieldMatches(fieldName, aliases)) continue

    const value = valueToString(
      item.value ??
        item.values ??
        item.string_value ??
        item.stringValue ??
        item.answer ??
        item.answers ??
        item.text
    )

    if (value) return value
  }

  return null
}

const pickLeadName = (lead: JsonRecord, fields: unknown) => {
  const directName = pickFromRecord(lead, [
    'name',
    'full_name',
    'fullName',
    'nome',
    'nome_completo',
    'contact_name',
  ])

  if (directName) return directName

  const fieldName = pickFromFieldArray(fields, [
    'full_name',
    'full name',
    'nome completo',
    'nome',
    'name',
    'contact name',
  ])

  if (fieldName) return fieldName

  const firstName = pickFromRecord(lead, ['first_name', 'firstName']) ??
    pickFromFieldArray(fields, ['first_name', 'first name', 'primeiro nome'])
  const lastName = pickFromRecord(lead, ['last_name', 'lastName']) ??
    pickFromFieldArray(fields, ['last_name', 'last name', 'sobrenome'])

  return [firstName, lastName].filter(Boolean).join(' ').trim() || null
}

const pickLeadEmail = (lead: JsonRecord, fields: unknown) =>
  pickFromRecord(lead, ['email', 'e-mail', 'email_address', 'emailAddress']) ??
  pickFromFieldArray(fields, ['email', 'e-mail', 'email_address', 'user email'])

const pickLeadPhone = (lead: JsonRecord, fields: unknown) =>
  pickFromRecord(lead, ['phone', 'phone_number', 'phoneNumber', 'telefone', 'whatsapp', 'mobile']) ??
  pickFromFieldArray(fields, ['phone', 'phone_number', 'phone number', 'telefone', 'whatsapp', 'mobile', 'user phone'])

const normalizeProvider = (value: unknown): Provider | null => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['meta', 'facebook', 'fb', 'instagram'].includes(normalized)) return 'meta'
  if (['google', 'google_ads', 'googleads', 'adwords'].includes(normalized)) return 'google'
  if (['tiktok', 'tik_tok', 'tik-tok'].includes(normalized)) return 'tiktok'
  return null
}

const readRequestPayload = async (req: Request): Promise<ParsedRequestPayload> => {
  const contentType = req.headers.get('content-type')?.toLowerCase() ?? ''
  const rawBody = await req.text()

  if (contentType.includes('application/json')) {
    let parsedJson: unknown = {}
    try {
      parsedJson = JSON.parse(rawBody || '{}')
    } catch {
      parsedJson = {}
    }

    return {
      body: asRecord(parsedJson),
      rawBody,
    }
  }

  if (!rawBody.trim()) return { body: {}, rawBody }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return {
      body: Object.fromEntries(new URLSearchParams(rawBody)),
      rawBody,
    }
  }

  try {
    return {
      body: asRecord(JSON.parse(rawBody)),
      rawBody,
    }
  } catch {
    return {
      body: { raw_body: rawBody },
      rawBody,
    }
  }
}

const normalizeMetaLead = (body: JsonRecord): NormalizedExternalLead => {
  const entry = Array.isArray(body.entry) ? asRecord(body.entry[0]) : {}
  const change = Array.isArray(entry.changes) ? asRecord(entry.changes[0]) : {}
  const value = firstRecord(change.value, body.value, body.lead, body)
  const lead = firstRecord(value.lead, value.leadgen, body.lead, body)
  const fields = value.field_data ?? value.fieldData ?? lead.field_data ?? lead.fieldData ?? body.field_data ?? body.fieldData

  return {
    name: pickLeadName(lead, fields),
    email: pickLeadEmail(lead, fields),
    phone: pickLeadPhone(lead, fields),
    form_id: firstString(value.form_id, value.formId, lead.form_id, lead.formId, body.form_id, body.formId),
    campaign_id: firstString(
      value.campaign_id,
      value.campaignId,
      asRecord(value.campaign).id,
      lead.campaign_id,
      lead.campaignId,
      body.campaign_id,
      body.campaignId,
      value.ad_id,
      value.adId,
      value.adgroup_id
    ),
    external_lead_id: firstString(value.leadgen_id, value.lead_id, value.leadId, lead.leadgen_id, lead.lead_id, body.leadgen_id, body.lead_id),
    message: pickFromRecord(lead, ['message', 'mensagem', 'comments', 'observacoes']) ??
      pickFromFieldArray(fields, ['message', 'mensagem', 'comments', 'observacoes']) ??
      null,
  }
}

const normalizeGoogleLead = (body: JsonRecord): NormalizedExternalLead => {
  const lead = firstRecord(
    body.googleAdsLeadFormSubmissionData,
    body.leadFormSubmissionData,
    body.lead_form_submission_data,
    body.lead,
    body
  )
  const fields = lead.user_column_data ??
    lead.userColumnData ??
    lead.customLeadFormFields ??
    lead.field_data ??
    lead.fieldData ??
    lead.fields ??
    body.user_column_data ??
    body.userColumnData

  return {
    name: pickLeadName(lead, fields),
    email: pickLeadEmail(lead, fields),
    phone: pickLeadPhone(lead, fields),
    form_id: firstString(lead.form_id, lead.formId, lead.lead_form_id, lead.leadFormId, body.form_id, body.formId),
    campaign_id: firstString(lead.campaign_id, lead.campaignId, asRecord(lead.campaign).id, body.campaign_id, body.campaignId),
    external_lead_id: firstString(lead.lead_id, lead.leadId, lead.gcl_id, lead.gclId, body.lead_id, body.leadId),
    message: pickFromRecord(lead, ['message', 'mensagem', 'comments', 'observacoes']) ??
      pickFromFieldArray(fields, ['message', 'mensagem', 'comments', 'observacoes']) ??
      null,
  }
}

const normalizeTikTokLead = (body: JsonRecord): NormalizedExternalLead => {
  const data = firstRecord(body.data, body.object, body.lead, asRecord(body.event).data, body)
  const fields = data.field_data ??
    data.fieldData ??
    data.fields ??
    data.answers ??
    data.questions ??
    body.field_data ??
    body.fieldData

  return {
    name: pickLeadName(data, fields),
    email: pickLeadEmail(data, fields),
    phone: pickLeadPhone(data, fields),
    form_id: firstString(data.form_id, data.formId, asRecord(data.form).id, body.form_id, body.formId),
    campaign_id: firstString(data.campaign_id, data.campaignId, asRecord(data.campaign).id, body.campaign_id, body.campaignId),
    external_lead_id: firstString(data.lead_id, data.leadId, data.id, body.lead_id, body.leadId),
    message: pickFromRecord(data, ['message', 'mensagem', 'comments', 'observacoes']) ??
      pickFromFieldArray(fields, ['message', 'mensagem', 'comments', 'observacoes']) ??
      null,
  }
}

const normalizeExternalLead = (provider: Provider, body: JsonRecord) => {
  switch (provider) {
    case 'meta':
      return normalizeMetaLead(body)
    case 'google':
      return normalizeGoogleLead(body)
    case 'tiktok':
      return normalizeTikTokLead(body)
  }
}

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

const getRequestCredential = (url: URL, body: JsonRecord, keys: string[]) => {
  for (const key of keys) {
    const valueFromQuery = firstString(url.searchParams.get(key))
    if (valueFromQuery) return valueFromQuery
  }

  for (const key of keys) {
    const valueFromBody = firstString(body[key])
    if (valueFromBody) return valueFromBody
  }

  return null
}

const fetchLeadSourceIntegration = async (
  supabaseAdmin: SupabaseAdmin,
  provider: Provider,
  integrationId: string
) => {
  const { data, error } = await supabaseAdmin
    .from('lead_source_integrations')
    .select('id, company_id, provider, status, webhook_secret, verify_token')
    .eq('id', integrationId)
    .eq('provider', provider)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new IngestHttpError('Integracao nao encontrada.', 404)

  const integration = data as LeadSourceIntegration
  if (!integration.company_id) {
    throw new IngestHttpError('Integracao sem company_id configurado.', 400)
  }

  return integration
}

const logSecurityError = async (
  supabaseAdmin: SupabaseAdmin,
  input: {
    integration: LeadSourceIntegration | null
    provider: Provider | null
    rawPayload: unknown
    message: string
  }
) => {
  await insertExternalLeadEvent(supabaseAdmin, {
    companyId: input.integration?.company_id ?? null,
    integrationId: input.integration?.id ?? null,
    provider: input.provider,
    status: 'error',
    rawPayload: input.rawPayload,
    errorMessage: input.message,
  })
}

const validateIntegrationSecurity = async (
  supabaseAdmin: SupabaseAdmin,
  req: Request,
  url: URL,
  rawPayload: JsonRecord,
  rawBody: string,
  provider: Provider,
  integration: LeadSourceIntegration,
  enforceWebhookSecret = true
) => {
  const verifyToken = firstString(integration.verify_token)
  if (verifyToken) {
    const providedVerifyToken = getRequestCredential(url, rawPayload, [
      'verify_token',
      'verifyToken',
      'token',
      'hub.verify_token',
      'hub_verify_token',
    ])

    if (!providedVerifyToken || !timingSafeEqual(providedVerifyToken, verifyToken)) {
      const message = 'Unauthorized: verify_token invalido ou ausente.'
      await logSecurityError(supabaseAdmin, { integration, provider, rawPayload, message })
      throw new IngestHttpError(message, 401)
    }
  }

  const webhookSecret = firstString(integration.webhook_secret)
  if (!enforceWebhookSecret) return
  if (!webhookSecret) return

  const signatureHeader = firstString(
    req.headers.get('x-hub-signature-256'),
    req.headers.get('x-meta-signature-256')
  )

  if (signatureHeader) {
    const providedSignature = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase()
    const expectedSignature = (await hmacSha256Hex(webhookSecret, rawBody)).toLowerCase()

    if (providedSignature && timingSafeEqual(providedSignature, expectedSignature)) {
      return
    }

    const message = 'Unauthorized: assinatura do webhook invalida.'
    await logSecurityError(supabaseAdmin, { integration, provider, rawPayload, message })
    throw new IngestHttpError(message, 401)
  }

  const providedSecret = getRequestCredential(url, rawPayload, [
    'webhook_secret',
    'webhookSecret',
    'secret',
    'signature_secret',
  ])

  if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
    const message = 'Unauthorized: webhook_secret ausente ou invalido.'
    await logSecurityError(supabaseAdmin, { integration, provider, rawPayload, message })
    throw new IngestHttpError(message, 401)
  }
}

const fetchMappingByColumn = async (
  supabaseAdmin: SupabaseAdmin,
  provider: Provider,
  integrationId: string,
  companyId: string,
  column: 'form_id' | 'campaign_id',
  value: string | null
) => {
  if (!value) return null

  const { data, error } = await supabaseAdmin
    .from('lead_source_mappings')
    .select('id, company_id, property_id, assigned_user_id, lead_mode, form_id, campaign_id')
    .eq('provider', provider)
    .eq('integration_id', integrationId)
    .eq('company_id', companyId)
    .eq(column, value)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as LeadSourceMapping | null) ?? null
}

const fetchLeadSourceMapping = async (
  supabaseAdmin: SupabaseAdmin,
  provider: Provider,
  integrationId: string,
  companyId: string,
  formId: string | null,
  campaignId: string | null
) => {
  const formMapping = await fetchMappingByColumn(supabaseAdmin, provider, integrationId, companyId, 'form_id', formId)
  if (formMapping) return formMapping

  const campaignMapping = await fetchMappingByColumn(supabaseAdmin, provider, integrationId, companyId, 'campaign_id', campaignId)
  if (campaignMapping) return campaignMapping

  return null
}

const fetchCompanySettings = async (
  supabaseAdmin: SupabaseAdmin,
  companyId: string
): Promise<CompanySettings> => {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (data) return data as CompanySettings

  return {
    route_to_central: false,
    central_user_id: null,
    include_admins_in_roulette: false,
    kanban_config: null,
  }
}

const getFirstStatusForFunnel = (settings: CompanySettings, funnel: 'pre_atendimento' | 'atendimento') => {
  const configured = settings.kanban_config?.[funnel]?.[0]
  if (configured) return configured

  return funnel === 'pre_atendimento' ? 'Aguardando Atendimento' : 'Aguardando atendimento'
}

const pickRoundRobinUser = async (
  supabaseAdmin: SupabaseAdmin,
  companyId: string,
  includeAdmins: boolean
) => {
  const roles = includeAdmins ? ['corretor', 'admin', 'owner', 'manager'] : ['corretor']

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('active', true)
    .in('role', roles)

  if (profilesError) throw profilesError
  if (!profiles?.length) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: leadsToday, error: leadsError } = await supabaseAdmin
    .from('leads')
    .select('assigned_to, stage_updated_at, created_at')
    .eq('company_id', companyId)
    .gte('stage_updated_at', today.toISOString())
    .not('assigned_to', 'is', null)

  if (leadsError) throw leadsError

  const stats = profiles.map((profile: JsonRecord) => {
    const assignedLeads = (leadsToday ?? []).filter((lead: JsonRecord) => lead.assigned_to === profile.id)
    const lastLead = assignedLeads
      .slice()
      .sort((a: JsonRecord, b: JsonRecord) => {
        const dateA = new Date(a.stage_updated_at ?? a.created_at ?? 0).getTime()
        const dateB = new Date(b.stage_updated_at ?? b.created_at ?? 0).getTime()
        return dateB - dateA
      })[0]

    return {
      id: profile.id as string,
      count: assignedLeads.length,
      lastTime: lastLead ? new Date(lastLead.stage_updated_at ?? lastLead.created_at).getTime() : 0,
    }
  })

  stats.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count
    return a.lastTime - b.lastTime
  })

  return stats[0]?.id ?? null
}

const fetchPropertyOwnerUserId = async (
  supabaseAdmin: SupabaseAdmin,
  companyId: string,
  propertyId: string
) => {
  const firstAttempt = await supabaseAdmin
    .from('properties')
    .select('created_by, assigned_to')
    .eq('id', propertyId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (!firstAttempt.error) {
    const property = firstAttempt.data as JsonRecord | null
    return firstString(property?.assigned_to, property?.created_by)
  }

  if (!isMissingColumnError(firstAttempt.error)) {
    throw firstAttempt.error
  }

  const fallbackSelect = String(firstAttempt.error?.message ?? '').includes('assigned_to')
    ? 'created_by'
    : 'created_by, assigned_to'

  const fallback = await supabaseAdmin
    .from('properties')
    .select(fallbackSelect)
    .eq('id', propertyId)
    .limit(1)
    .maybeSingle()

  if (fallback.error) {
    if (!isMissingColumnError(fallback.error)) throw fallback.error

    const minimalFallback = await supabaseAdmin
      .from('properties')
      .select('created_by')
      .eq('id', propertyId)
      .limit(1)
      .maybeSingle()

    if (minimalFallback.error) throw minimalFallback.error

    const property = minimalFallback.data as JsonRecord | null
    return firstString(property?.created_by)
  }

  const property = fallback.data as JsonRecord | null
  return firstString(property?.assigned_to, property?.created_by)
}

const resolveLeadRouting = async (
  supabaseAdmin: SupabaseAdmin,
  companyId: string,
  mapping: LeadSourceMapping | null,
  settings: CompanySettings
) => {
  if (mapping?.assigned_user_id) {
    return {
      assignedTo: mapping.assigned_user_id,
      funnelStep: 'atendimento',
      status: getFirstStatusForFunnel(settings, 'atendimento'),
    }
  }

  if (mapping?.property_id) {
    const propertyOwnerId = await fetchPropertyOwnerUserId(supabaseAdmin, companyId, mapping.property_id)
    if (propertyOwnerId) {
      return {
        assignedTo: propertyOwnerId,
        funnelStep: 'atendimento',
        status: getFirstStatusForFunnel(settings, 'atendimento'),
      }
    }
  }

  const routeToCentral = settings.route_to_central === true
  if (routeToCentral) {
    return {
      assignedTo: settings.central_user_id ?? null,
      funnelStep: 'pre_atendimento',
      status: getFirstStatusForFunnel(settings, 'pre_atendimento'),
    }
  }

  const rouletteUserId = await pickRoundRobinUser(
    supabaseAdmin,
    companyId,
    settings.include_admins_in_roulette === true
  )

  return {
    assignedTo: rouletteUserId,
    funnelStep: 'atendimento',
    status: getFirstStatusForFunnel(settings, 'atendimento'),
  }
}

const isMissingColumnError = (error: any) => {
  const message = String(error?.message ?? '')
  const code = String(error?.code ?? '')
  return code === 'PGRST204' || code === '42703' || /column/i.test(message)
}

const insertLead = async (
  supabaseAdmin: SupabaseAdmin,
  payload: JsonRecord
) => {
  const firstAttempt = await supabaseAdmin
    .from('leads')
    .insert(payload)
    .select('id')
    .single()

  if (!firstAttempt.error) return firstAttempt

  if (!isMissingColumnError(firstAttempt.error)) return firstAttempt

  const fallbackPayload = { ...payload }
  const externalColumns = {
    external_source: fallbackPayload.external_source,
    form_id: fallbackPayload.form_id,
    campaign_id: fallbackPayload.campaign_id,
  }

  delete fallbackPayload.external_source
  delete fallbackPayload.form_id
  delete fallbackPayload.campaign_id

  fallbackPayload.metadata = {
    ...(asRecord(payload.metadata)),
    ...externalColumns,
  }

  return await supabaseAdmin
    .from('leads')
    .insert(fallbackPayload)
    .select('id')
    .single()
}

const maybeSingleDuplicate = async (query: any) => {
  const { data, error } = await query
  if (!error) return (data as JsonRecord | null) ?? null
  if (isMissingColumnError(error)) return null
  throw error
}

const findDuplicateLead = async (
  supabaseAdmin: SupabaseAdmin,
  companyId: string,
  externalLeadId: string | null,
  phone: string | null
) => {
  if (externalLeadId) {
    const byExternalColumn = await maybeSingleDuplicate(
      supabaseAdmin
        .from('leads')
        .select('id')
        .eq('company_id', companyId)
        .eq('external_lead_id', externalLeadId)
        .limit(1)
        .maybeSingle()
    )

    if (byExternalColumn?.id) return byExternalColumn

    const byMetadata = await maybeSingleDuplicate(
      supabaseAdmin
        .from('leads')
        .select('id')
        .eq('company_id', companyId)
        .filter('metadata->>external_lead_id', 'eq', externalLeadId)
        .limit(1)
        .maybeSingle()
    )

    if (byMetadata?.id) return byMetadata
  }

  const normalizedPhone = normalizePhoneForDedup(phone)
  if (!normalizedPhone) return null

  const byExactPhone = await maybeSingleDuplicate(
    supabaseAdmin
      .from('leads')
      .select('id, phone')
      .eq('company_id', companyId)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle()
  )

  if (byExactPhone?.id) return byExactPhone

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('id, phone')
    .eq('company_id', companyId)
    .not('phone', 'is', null)
    .limit(500)

  if (error) {
    if (isMissingColumnError(error)) return null
    throw error
  }

  return ((data ?? []) as JsonRecord[]).find((lead) =>
    normalizePhoneForDedup(firstString(lead.phone)) === normalizedPhone
  ) ?? null
}

const updateIntegrationLastLeadReceivedAt = async (
  supabaseAdmin: SupabaseAdmin,
  integrationId: string,
  companyId: string
) => {
  const { error } = await supabaseAdmin
    .from('lead_source_integrations')
    .update({ last_lead_received_at: new Date().toISOString() })
    .eq('id', integrationId)
    .eq('company_id', companyId)

  if (error) {
    console.error('[ingest-external-lead] Falha ao atualizar last_lead_received_at:', error)
  }
}

const insertExternalLeadEvent = async (
  supabaseAdmin: SupabaseAdmin,
  input: ExternalLeadEventInput
) => {
  const fullPayload = {
    company_id: input.companyId ?? null,
    integration_id: input.integrationId ?? null,
    provider: input.provider ?? null,
    form_id: input.formId ?? null,
    campaign_id: input.campaignId ?? null,
    lead_id: input.leadId ?? null,
    status: input.status,
    raw_payload: input.rawPayload ?? {},
    normalized_payload: input.normalizedPayload ?? null,
    error_message: input.errorMessage ?? null,
    processed_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin.from('external_lead_events').insert(fullPayload)

  if (!error) return

  if (!isMissingColumnError(error)) {
    console.error('[ingest-external-lead] Falha ao registrar external_lead_events:', error)
    return
  }

  const minimalPayload = {
    company_id: input.companyId ?? null,
    status: input.status,
    raw_payload: input.rawPayload ?? {},
    error_message: input.errorMessage ?? null,
  }

  const fallback = await supabaseAdmin.from('external_lead_events').insert(minimalPayload)
  if (fallback.error) {
    console.error('[ingest-external-lead] Falha ao registrar external_lead_events fallback:', fallback.error)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  if (req.method !== 'POST') {
    if (req.method === 'GET' && url.searchParams.get('hub.challenge')) {
      const supabaseAdmin = getSupabaseAdmin()
      const provider = normalizeProvider(url.searchParams.get('provider'))
      const integrationId = firstString(url.searchParams.get('integration_id'), url.searchParams.get('integrationId'))

      if (!provider || !integrationId) {
        return jsonResponse({ success: false, error: 'Provider ou integration_id ausente.' }, 400)
      }

      try {
        const integration = await fetchLeadSourceIntegration(supabaseAdmin, provider, integrationId)
        await validateIntegrationSecurity(supabaseAdmin, req, url, {}, '', provider, integration, false)

        return new Response(url.searchParams.get('hub.challenge') ?? '', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          status: 200,
        })
      } catch (error: any) {
        const message = error?.message || 'Falha na verificacao do webhook.'
        const status = error instanceof IngestHttpError ? error.status : 400
        console.error('[ingest-external-lead] erro GET:', message, error)
        return jsonResponse({ success: false, error: message }, status)
      }
    }

    return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
  }

  let supabaseAdmin: SupabaseAdmin | null = null
  let rawPayload: JsonRecord = {}
  let rawBody = ''
  let provider: Provider | null = null
  let integrationId: string | null = null
  let integration: LeadSourceIntegration | null = null
  let companyId: string | null = null
  let normalizedLead: NormalizedExternalLead | null = null

  try {
    supabaseAdmin = getSupabaseAdmin()
    const parsedPayload = await readRequestPayload(req)
    rawPayload = parsedPayload.body
    rawBody = parsedPayload.rawBody

    provider = normalizeProvider(
      url.searchParams.get('provider') ??
        rawPayload.provider ??
        rawPayload.source_provider ??
        rawPayload.platform
    )
    integrationId = firstString(
      url.searchParams.get('integration_id'),
      url.searchParams.get('integrationId'),
      rawPayload.integration_id,
      rawPayload.integrationId,
      asRecord(rawPayload.integration).id
    )

    if (!provider) throw new Error('Provider invalido ou ausente. Use meta, google ou tiktok.')
    if (!integrationId) throw new Error('integration_id ausente na URL ou no body.')

    integration = await fetchLeadSourceIntegration(supabaseAdmin, provider, integrationId)
    companyId = integration.company_id

    await validateIntegrationSecurity(supabaseAdmin, req, url, rawPayload, rawBody, provider, integration)

    normalizedLead = normalizeExternalLead(provider, rawPayload)

    const mapping = await fetchLeadSourceMapping(
      supabaseAdmin,
      provider,
      integrationId,
      companyId,
      normalizedLead.form_id,
      normalizedLead.campaign_id
    )

    const settings = await fetchCompanySettings(supabaseAdmin, companyId)
    const routing = await resolveLeadRouting(supabaseAdmin, companyId, mapping, settings)
    const now = new Date().toISOString()
    const leadMode = mapping?.lead_mode ?? 'generic'

    const duplicateLead = await findDuplicateLead(
      supabaseAdmin,
      companyId,
      normalizedLead.external_lead_id,
      normalizedLead.phone
    )

    if (duplicateLead?.id) {
      await insertExternalLeadEvent(supabaseAdmin, {
        companyId,
        integrationId,
        provider,
        formId: normalizedLead.form_id,
        campaignId: normalizedLead.campaign_id,
        leadId: firstString(duplicateLead.id),
        status: 'duplicate',
        rawPayload,
        normalizedPayload: normalizedLead,
        errorMessage: 'Lead duplicado detectado por external_lead_id ou telefone.',
      })

      return jsonResponse({
        success: true,
        duplicate: true,
        lead_id: duplicateLead.id,
        company_id: companyId,
      })
    }

    const leadPayload = {
      company_id: companyId,
      property_id: mapping?.property_id ?? null,
      assigned_to: routing.assignedTo,
      name: normalizedLead.name || `${providerLabels[provider]} - Lead sem nome`,
      email: normalizedLead.email,
      phone: normalizedLead.phone || '',
      message: normalizedLead.message || `Lead recebido via ${providerLabels[provider]}.`,
      source: providerLabels[provider],
      external_source: provider,
      form_id: normalizedLead.form_id,
      campaign_id: normalizedLead.campaign_id,
      funnel_step: routing.funnelStep,
      status: routing.status,
      stage_updated_at: now,
      last_interaction: now,
      metadata: {
        provider,
        integration_id: integrationId,
        external_lead_id: normalizedLead.external_lead_id,
        form_id: normalizedLead.form_id,
        campaign_id: normalizedLead.campaign_id,
        lead_mode: leadMode,
        mapping_id: mapping?.id ?? null,
        raw_payload: rawPayload,
      },
    }

    const { data: createdLead, error: leadError } = await insertLead(supabaseAdmin, leadPayload)
    if (leadError || !createdLead?.id) throw leadError ?? new Error('Lead nao foi criado.')

    await updateIntegrationLastLeadReceivedAt(supabaseAdmin, integrationId, companyId)

    await insertExternalLeadEvent(supabaseAdmin, {
      companyId,
      integrationId,
      provider,
      formId: normalizedLead.form_id,
      campaignId: normalizedLead.campaign_id,
      leadId: createdLead.id,
      status: 'processed',
      rawPayload,
      normalizedPayload: normalizedLead,
    })

    return jsonResponse({
      success: true,
      lead_id: createdLead.id,
      company_id: companyId,
      property_id: mapping?.property_id ?? null,
      assigned_to: routing.assignedTo,
      lead_mode: leadMode,
    })
  } catch (error: any) {
    const message = error?.message || 'Erro desconhecido ao ingerir lead externo.'
    const status = error instanceof IngestHttpError ? error.status : 400
    console.error('[ingest-external-lead] erro:', message, error)

    if (supabaseAdmin && status !== 401) {
      await insertExternalLeadEvent(supabaseAdmin, {
        companyId,
        integrationId,
        provider,
        formId: normalizedLead?.form_id ?? null,
        campaignId: normalizedLead?.campaign_id ?? null,
        status: 'error',
        rawPayload,
        normalizedPayload: normalizedLead,
        errorMessage: message,
      })
    }

    return jsonResponse({ success: false, error: message }, status)
  }
})
