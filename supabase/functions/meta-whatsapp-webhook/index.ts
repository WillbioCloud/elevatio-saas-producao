import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expectedToken = Deno.env.get('META_VERIFY_TOKEN')?.trim()

    if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
      return new Response(challenge ?? 'ok', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    return new Response('forbidden', { status: 403, headers: corsHeaders })
  }

  if (req.method === 'POST') {
    const rawBody = await req.text()

    try {
      const payload = rawBody ? JSON.parse(rawBody) : {}
      console.log('[meta-whatsapp-webhook] payload:', JSON.stringify(payload))

      const entries = Array.isArray(payload.entry) ? payload.entry : []
      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : []
        for (const change of changes) {
          const value = change?.value ?? {}
          const statuses = Array.isArray(value?.statuses) ? value.statuses : []
          const messages = Array.isArray(value?.messages) ? value.messages : []

          for (const status of statuses) {
            console.log('[meta-whatsapp-webhook] status:', JSON.stringify({
              message_id: status?.id ?? null,
              recipient_id: status?.recipient_id ?? null,
              status: status?.status ?? null,
              timestamp: status?.timestamp ?? null,
              errors: status?.errors ?? null,
              pricing: status?.pricing ?? null,
            }))
          }

          for (const message of messages) {
            console.log('[meta-whatsapp-webhook] incoming_message:', JSON.stringify({
              from: message?.from ?? null,
              id: message?.id ?? null,
              type: message?.type ?? null,
              text: message?.text ?? null,
              timestamp: message?.timestamp ?? null,
            }))
          }
        }
      }

      return new Response('ok', { status: 200, headers: corsHeaders })
    } catch (error) {
      console.error('[meta-whatsapp-webhook] parse error:', error)
      console.log('[meta-whatsapp-webhook] raw body:', rawBody)
      return jsonResponse({ success: false, error: 'Invalid webhook payload' }, 400)
    }
  }

  return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
})