import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id } = await req.json()
    if (!company_id) throw new Error("ID da empresa não informado.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Busca todos os usuários (profiles) dessa empresa
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('company_id', company_id)

    // 2. Deleta os usuários do sistema de Auth (Isso impede que eles façam login novamente)
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        await supabaseAdmin.auth.admin.deleteUser(profile.id)
      }
    }

    // 3. Limpeza Manual em Cascata (Caso o banco não tenha ON DELETE CASCADE)
    await supabaseAdmin.from('properties').delete().eq('company_id', company_id)
    await supabaseAdmin.from('leads').delete().eq('company_id', company_id)
    await supabaseAdmin.from('saas_contracts').delete().eq('company_id', company_id)
    await supabaseAdmin.from('profiles').delete().eq('company_id', company_id)

    // 4. Finalmente, deleta a empresa
    const { error: deleteError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', company_id)

    if (deleteError) throw deleteError

    return new Response(
      JSON.stringify({ success: true, message: 'Tenant excluído com sucesso.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
