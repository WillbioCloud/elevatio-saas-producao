import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getAsaasApiUrl } from '../_shared/billing-security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

type RequestPayload = {
  company_id?: unknown
  tenantId?: unknown
  id?: unknown
}

type SweepTarget = {
  table: string
  column: 'company_id' | 'tenant_id'
}

type DbErrorShape = {
  code?: string
  details?: string
  hint?: string
  message?: string
}

const getTargetCompanyId = (body: RequestPayload) => {
  const rawValue = body.company_id ?? body.tenantId ?? body.id
  return typeof rawValue === 'string' ? rawValue.trim() : ''
}

const formatDbError = (prefix: string, error?: DbErrorShape | null) => {
  const parts = [prefix]

  if (error?.message) parts.push(error.message)
  if (error?.details) parts.push(`details=${error.details}`)
  if (error?.hint) parts.push(`hint=${error.hint}`)
  if (error?.code) parts.push(`code=${error.code}`)

  return parts.join(' | ')
}

const isIgnorableSweepError = (error?: DbErrorShape | null) => {
  const code = error?.code ?? ''
  return code === 'PGRST204' || code === 'PGRST205' || code === '42703' || code === '42P01'
}

const deepCleanTargets: SweepTarget[] = [
  { table: 'installments', column: 'company_id' },
  { table: 'invoices', column: 'company_id' },
  { table: 'tasks', column: 'company_id' },
  { table: 'timeline_events', column: 'company_id' },
  { table: 'notifications', column: 'company_id' },
  { table: 'site_visits', column: 'company_id' },
  { table: 'saas_ticket_messages', column: 'company_id' },
  { table: 'saas_tickets', column: 'company_id' },
  { table: 'saas_payments', column: 'company_id' },
  { table: 'lead_interests', column: 'company_id' },
  { table: 'contracts', column: 'company_id' },
  { table: 'contract_templates', column: 'tenant_id' },
  { table: 'leads', column: 'company_id' },
  { table: 'properties', column: 'company_id' },
  { table: 'settings', column: 'company_id' },
  { table: 'saas_contracts', column: 'company_id' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) throw new Error("Acesso negado: Token ausente.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new Error("Acesso negado: Token ausente.")

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error("Acesso negado: Sessao invalida.")

    const { data: requesterProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (requesterProfile?.role !== 'super_admin') {
      throw new Error("Acesso negado: apenas super admins podem excluir empresas.")
    }

    const body: RequestPayload = await req.json().catch(() => ({}))
    const target_company_id = getTargetCompanyId(body)

    if (!target_company_id) throw new Error('ID da empresa nao fornecido.')

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, asaas_subscription_id')
      .eq('id', target_company_id)
      .single()

    if (companyError || !company) {
      throw new Error(formatDbError('Empresa nao encontrada no banco.', companyError))
    }

    // 1. CANCELA NO ASAAS
    if (company.asaas_subscription_id) {
      const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
      const ASAAS_URL = getAsaasApiUrl()
      try {
        const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
          method: 'DELETE',
          headers: { 'access_token': ASAAS_API_KEY!, 'Content-Type': 'application/json' }
        })

        if (!asaasRes.ok) {
          console.error('Falha ao cancelar no Asaas', await asaasRes.text())
        }
      } catch (error) {
        console.error('Falha silenciosa ao cancelar no Asaas', error)
      }
    }

    // 2. CAPTURA IDS DO AUTH ANTES DA LIMPEZA
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('company_id', target_company_id)

    if (profilesError && !isIgnorableSweepError(profilesError)) {
      throw new Error(formatDbError('Falha ao buscar usuarios da empresa.', profilesError))
    }

    // 3. VARREDURA COMPLETA (Deep Clean)
    for (const target of deepCleanTargets) {
      const { error } = await supabaseAdmin
        .from(target.table)
        .delete()
        .eq(target.column, target_company_id)

      if (!error) continue

      if (isIgnorableSweepError(error)) {
        console.warn(`Sweep ignorado: ${target.table}.${target.column}`, error.message)
        continue
      }

      throw new Error(formatDbError(`Falha ao limpar ${target.table}`, error))
    }

    // 4. DELETA USUARIOS DO AUTH (Painel Authentication)
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        await supabaseAdmin.auth.admin.deleteUser(profile.id).catch(() => {})
      }
    }

    // 5. GARANTE LIMPEZA FINAL DE PROFILES
    const { error: profilesDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('company_id', target_company_id)

    if (profilesDeleteError && !isIgnorableSweepError(profilesDeleteError)) {
      throw new Error(formatDbError('Falha ao limpar profiles.', profilesDeleteError))
    }

    // 6. O GOLPE FINAL: Deleta a Empresa
    const { error: deleteError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', target_company_id)

    if (deleteError) {
      const prefix = deleteError.code === '23503'
        ? 'Bloqueio do Banco de Dados: restricao de chave estrangeira'
        : 'Bloqueio do Banco de Dados'
      throw new Error(formatDbError(prefix, deleteError))
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Tenant destruido com sucesso.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
