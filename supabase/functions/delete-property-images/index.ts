import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
serve(async (req) => {
  const { record } = await req.json()
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const folderPath = String(record.id); // Ajuste se a pasta tiver prefixo, ex: `properties/${record.id}`
  const { data: files } = await supabase.storage.from('properties').list(folderPath)
  if (files && files.length > 0) {
    const filesToRemove = files.map((x) => `${folderPath}/${x.name}`)
    await supabase.storage.from('properties').remove(filesToRemove)
  }
  return new Response(JSON.stringify({ done: true }), { headers: { "Content-Type": "application/json" } })
})