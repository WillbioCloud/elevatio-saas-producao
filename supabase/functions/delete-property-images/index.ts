import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const payload = await req.json()
    // O Supabase envia os dados do item deletado dentro de "old_record"
    const property = payload.old_record; 

    if (!property || !property.company_id || !property.id) {
      return new Response(JSON.stringify({ error: "Missing company_id or property_id" }), { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // O caminho exato da pasta do imóvel
    const folderPath = `${property.company_id}/${property.id}`;

    // Lista os arquivos dentro da pasta
    const { data: files, error: listError } = await supabase.storage.from('properties').list(folderPath)

    if (listError) throw listError;

    if (files && files.length > 0) {
      // Mapeia e apaga todos os arquivos encontrados
      const filesToRemove = files.map((x) => `${folderPath}/${x.name}`)
      const { error: removeError } = await supabase.storage.from('properties').remove(filesToRemove)
      if (removeError) throw removeError;
    }

    return new Response(JSON.stringify({ success: true, deleted: files?.length || 0 }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("Erro no Webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})