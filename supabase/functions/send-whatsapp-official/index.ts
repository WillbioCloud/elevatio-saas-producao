import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  HttpError,
  createSupabaseAdmin,
  getErrorStatus,
  requireBillingCompanyAccess,
} from '../_shared/billing-security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type JsonRecord = Record<string, unknown>

type RequestPayload = {
  companyId?: unknown
  company_id?: unknown
  to?: unknown
  templateName?: unknown
  template_name?: unknown
  languageCode?: unknown
  language_code?: unknown
  components?: unknown
}

type MetaMessageResponse = {
  messages?: Array<{ id?: string }>
  error?: {
    message?: string
    error_user_msg?: string
    error_user_title?: string
    type?: string
    code?: number
    fbtrace_id?: string
    error_data?: {
      details?: string
    }
  }
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const normalizePhone = (value: unknown) => normalizeString(value).replace(/\D/g, '')

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const jsonResponse = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const requireEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) {
    throw new HttpError(`Variavel de ambiente ${name} nao configurada.`, 500)
  }

  return value
}

const parsePayload = async (req: Request) => {
  const body = await req.json().catch(() => ({})) as RequestPayload

  const companyId = normalizeString(body.companyId ?? body.company_id)
  const to = normalizePhone(body.to)
  const templateName = normalizeString(body.templateName ?? body.template_name)
  const languageCode = normalizeString(body.languageCode ?? body.language_code) || 'pt_BR'
  const components = body.components

  if (!companyId) {
    throw new HttpError('companyId e obrigatorio.', 400)
  }

  if (!to) {
    throw new HttpError('Numero de destino invalido.', 400)
  }

  if (!templateName) {
    throw new HttpError('templateName e obrigatorio.', 400)
  }

  if (components !== undefined && !Array.isArray(components)) {
    throw new HttpError('components deve ser um array quando informado.', 400)
  }

  return {
    companyId,
    to,
    templateName,
    languageCode,
    components: Array.isArray(components) ? components : [],
  }
}

const parseMetaResponse = async (response: Response): Promise<MetaMessageResponse | JsonRecord> => {
  const rawText = await response.text()

  try {
    return rawText ? JSON.parse(rawText) : {}
  } catch {
    return { raw: rawText }
  }
}

const getMetaErrorMessage = (
  payload: MetaMessageResponse | JsonRecord | null | undefined,
  fallback: string
) => {
  if (!payload || !isRecord(payload)) return fallback

  const error = isRecord(payload.error) ? payload.error : null
  const errorData = error?.error_data
  const details = isRecord(errorData) ? normalizeString(errorData.details) : ''
  const message = normalizeString(error?.error_user_msg)
    || details
    || normalizeString(error?.message)
    || normalizeString((payload as { message?: unknown }).message)
    || normalizeString((payload as { error?: unknown }).error)

  return message || fallback
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
  }

  try {
    const metaAccessToken = requireEnv('META_ACCESS_TOKEN')
    const metaPhoneNumberId = requireEnv('META_PHONE_NUMBER_ID')

    const {
      companyId,
      to,
      templateName,
      languageCode,
      components,
    } = await parsePayload(req)

    await requireBillingCompanyAccess(req, companyId)

    const supabaseAdmin = createSupabaseAdmin()

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('whatsapp_credits')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      throw new HttpError(
        `Nao foi possivel localizar o saldo de creditos da empresa: ${companyError?.message || 'registro ausente'}.`,
        404
      )
    }

    const currentCredits = Math.max(0, Number(company.whatsapp_credits ?? 0))

    if (currentCredits <= 0) {
      throw new HttpError(
        'Saldo insuficiente de cr\u00e9ditos de WhatsApp. Fa\u00e7a um upgrade ou recarregue seu pacote.',
        403
      )
    }

    const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode || 'pt_BR' },
          components: components || [],
        },
      }),
    })

    const metaPayload = await parseMetaResponse(metaResponse)
    const messages = Array.isArray((metaPayload as MetaMessageResponse).messages)
      ? (metaPayload as MetaMessageResponse).messages
      : []
    const messageId = normalizeString(messages[0]?.id)

    if (!metaResponse.ok || !messageId) {
      const friendlyMessage = getMetaErrorMessage(
        metaPayload,
        'Falha ao enviar mensagem pela Meta Cloud API.'
      )

      throw new HttpError(friendlyMessage, metaResponse.status >= 400 ? metaResponse.status : 502)
    }

    const nextCredits = currentCredits - 1

    const { error: updateError } = await supabaseAdmin
      .from('companies')
      .update({ whatsapp_credits: nextCredits })
      .eq('id', companyId)

    if (updateError) {
      throw new HttpError(`Mensagem enviada, mas falhou ao debitar o credito: ${updateError.message}`, 500)
    }

    return jsonResponse({
      success: true,
      messageId,
      credits_remaining: nextCredits,
    })
  } catch (error) {
    console.error('[send-whatsapp-official] erro:', error)

    return jsonResponse(
      {
        success: false,
        error: (error as { message?: string })?.message || 'Erro interno ao enviar mensagem oficial do WhatsApp.',
      },
      getErrorStatus(error)
    )
  }
})
