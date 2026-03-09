import { supabase } from './supabase';

type AssetType = 'logo' | 'hero' | 'favicon' | 'about';

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
