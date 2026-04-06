import { supabase } from './supabase';

type AssetType = 'logo' | 'logo_alt' | 'hero' | 'favicon' | 'about' | 'signature' | `region_${string}`;

export async function uploadCompanyAsset(
  file: File,
  companyId: string,
  type: AssetType
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${companyId}/${type}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('company-assets')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('company-assets')
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function deleteCompanyAsset(url: string): Promise<void> {
  if (!url) return;
  try {
    // A URL pública do Supabase termina com /company-assets/caminho-do-arquivo
    const urlParts = url.split('/company-assets/');
    if (urlParts.length !== 2) return;

    const path = urlParts[1]; // Pegamos apenas a rota interna do bucket

    const { error } = await supabase.storage.from('company-assets').remove([path]);
    if (error) throw error;
  } catch (err) {
    console.error('Erro ao deletar asset do storage:', err);
  }
}
