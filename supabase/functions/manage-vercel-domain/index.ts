import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

type DomainAction = 'add' | 'remove'

const buildCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    req.headers.get('Access-Control-Request-Headers') ||
    'authorization, x-client-info, apikey, content-type, accept, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
})

const normalizeDomain = (value: unknown) => {
  if (typeof value !== 'string') return ''

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
}

const isValidDomain = (domain: string) =>
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)

const readVercelPayload = async (response: Response) => {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }

  const text = await response.text().catch(() => '')
  return text ? { message: text } : null
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Metodo nao permitido. Use POST.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  }

  try {
    const vercelToken = Deno.env.get('VERCEL_API_TOKEN')
    const projectId = Deno.env.get('VERCEL_PROJECT_ID')

    if (!vercelToken || !projectId) {
      throw new Error('Variaveis VERCEL_API_TOKEN e VERCEL_PROJECT_ID precisam estar configuradas.')
    }

    const body = await req.json().catch(() => ({}))
    const domain = normalizeDomain(body.domain)
    const action = (body.action as DomainAction | undefined) ?? 'add'

    if (!domain || !isValidDomain(domain)) {
      return new Response(
        JSON.stringify({ error: 'Dominio invalido.', domain }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (action !== 'add' && action !== 'remove') {
      return new Response(
        JSON.stringify({ error: 'Acao invalida. Use add ou remove.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const endpoint =
      action === 'add'
        ? `https://api.vercel.com/v10/projects/${projectId}/domains`
        : `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`

    const vercelResponse = await fetch(endpoint, {
      method: action === 'add' ? 'POST' : 'DELETE',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: action === 'add' ? JSON.stringify({ name: domain }) : undefined,
    })

    const vercelPayload = await readVercelPayload(vercelResponse)
    const fallbackMessage = action === 'add'
      ? 'A Vercel nao conseguiu adicionar o dominio.'
      : 'A Vercel nao conseguiu remover o dominio.'
    const vercelError =
      (vercelPayload as any)?.error?.message ||
      (vercelPayload as any)?.message ||
      fallbackMessage

    return new Response(
      JSON.stringify({
        success: vercelResponse.ok,
        action,
        domain,
        vercelStatus: vercelResponse.status,
        vercel: vercelPayload,
        ...(vercelResponse.ok ? {} : { error: vercelError }),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Erro ao gerenciar dominio na Vercel:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno ao gerenciar dominio.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
