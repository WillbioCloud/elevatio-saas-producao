import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { uploadCompanyAsset } from '../lib/storage';
import { SiteData } from '../types';
import { Palette, Image, Info, Mail, Loader2, Save, ExternalLink, Upload, X } from 'lucide-react';

type TabId = 'identity' | 'hero' | 'about' | 'contact';
type AssetType = 'logo' | 'hero' | 'favicon' | 'about';

interface ImageUploaderProps {
  label: string;
  currentUrl: string | null;
  onUpload: (url: string) => void;
  assetType: AssetType;
  companyId: string;
  aspectRatio?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  label, 
  currentUrl, 
  onUpload, 
  assetType, 
  companyId,
  aspectRatio = 'aspect-video'
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  useEffect(() => {
    setPreview(currentUrl);
  }, [currentUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    try {
      setUploading(true);
      const url = await uploadCompanyAsset(file, companyId, assetType);
      setPreview(url);
      onUpload(url);
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUpload('');
  };

  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
        {label}
      </label>
      
      {preview ? (
        <div className="relative group">
          <div className={`${aspectRatio} w-full rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700`}>
            <img src={preview} alt={label} className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
            <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-100 transition-colors">
              <Upload size={16} />
              Trocar
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <button
              onClick={handleRemove}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-red-600 transition-colors"
            >
              <X size={16} />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <label className={`${aspectRatio} w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all group`}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="animate-spin text-brand-500 mb-2" size={32} />
              <p className="text-sm text-slate-500">Enviando...</p>
            </>
          ) : (
            <>
              <Upload className="text-slate-400 group-hover:text-brand-500 mb-2" size={32} />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Clique para enviar</p>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG ou WEBP</p>
            </>
          )}
        </label>
      )}
    </div>
  );
};

export default function AdminSiteBuilder() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  
  const [siteData, setSiteData] = useState<SiteData>({
    logo_url: null,
    favicon_url: null,
    hero_image_url: null,
    hero_title: null,
    hero_subtitle: null,
    about_text: null,
    about_image_url: null,
    primary_color: '#0f172a',
    secondary_color: '#3b82f6',
    contact: { email: null, phone: null, address: null },
    social: { instagram: null, facebook: null, whatsapp: null, youtube: null },
    seo: { title: null, description: null },
  });

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!user?.company_id) return;

      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, subdomain, active, logo_url, site_data')
        .eq('id', user.company_id)
        .single();

      if (error) {
        console.error('Erro ao buscar dados da empresa:', error);
        setIsLoading(false);
        return;
      }

      if (data) {
        setCompanyData(data);
        
        if (data.site_data) {
          setSiteData(prev => ({
            ...prev,
            ...data.site_data,
            contact: { ...prev.contact, ...data.site_data.contact },
            social: { ...prev.social, ...data.site_data.social },
            seo: { ...prev.seo, ...data.site_data.seo },
          }));
        }
      }

      setIsLoading(false);
    };

    fetchCompanyData();
  }, [user?.company_id]);

  const handleSave = async () => {
    if (!user?.company_id) return;

    setIsSaving(true);
    
    const { error } = await supabase
      .from('companies')
      .update({ site_data: siteData })
      .eq('id', user.company_id);

    setIsSaving(false);

    if (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar as alterações. Tente novamente.');
    } else {
      alert('Site atualizado com sucesso! 🎉');
    }
  };

  const updateSiteData = (updates: Partial<SiteData>) => {
    setSiteData(prev => ({ ...prev, ...updates }));
  };

  const updateContact = (field: keyof SiteData['contact'], value: string) => {
    setSiteData(prev => ({
      ...prev,
      contact: { ...prev.contact, [field]: value }
    }));
  };

  const updateSocial = (field: keyof SiteData['social'], value: string) => {
    setSiteData(prev => ({
      ...prev,
      social: { ...prev.social, [field]: value }
    }));
  };

  const previewUrl = companyData 
    ? `http://${companyData.subdomain || companyData.slug}.localhost:5173` 
    : '#';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <Icons.AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-100 mb-2">
                Empresa não encontrada
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                Não foi possível carregar os dados da sua empresa.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'identity' as TabId, label: 'Identidade', icon: Palette },
    { id: 'hero' as TabId, label: 'Hero', icon: Image },
    { id: 'about' as TabId, label: 'Sobre', icon: Info },
    { id: 'contact' as TabId, label: 'Contato', icon: Mail },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Icons.Layout className="text-brand-500" /> Construtor de Site
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Personalize a identidade visual e conteúdo do seu site.
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <ExternalLink size={18} /> Visualizar
          </a>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-brand-500/20"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        
        {/* Identidade Visual */}
        {activeTab === 'identity' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Identidade Visual</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Defina as cores e logos da sua marca.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploader
                label="Logo Principal"
                currentUrl={siteData.logo_url}
                onUpload={(url) => updateSiteData({ logo_url: url })}
                assetType="logo"
                companyId={user?.company_id || ''}
                aspectRatio="aspect-[3/1]"
              />

              <ImageUploader
                label="Favicon (Ícone do Site)"
                currentUrl={siteData.favicon_url}
                onUpload={(url) => updateSiteData({ favicon_url: url })}
                assetType="favicon"
                companyId={user?.company_id || ''}
                aspectRatio="aspect-square"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Cor Primária
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={siteData.primary_color}
                    onChange={(e) => updateSiteData({ primary_color: e.target.value })}
                    className="w-16 h-16 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-600"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={siteData.primary_color}
                      onChange={(e) => updateSiteData({ primary_color: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                      placeholder="#0f172a"
                    />
                    <p className="text-xs text-slate-500 mt-1">Cor principal da marca</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Cor Secundária
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={siteData.secondary_color}
                    onChange={(e) => updateSiteData({ secondary_color: e.target.value })}
                    className="w-16 h-16 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-600"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={siteData.secondary_color}
                      onChange={(e) => updateSiteData({ secondary_color: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                      placeholder="#3b82f6"
                    />
                    <p className="text-xs text-slate-500 mt-1">Cor de destaque e botões</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        {activeTab === 'hero' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Seção Hero</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Banner principal que aparece no topo do site.</p>
            </div>

            <ImageUploader
              label="Imagem de Fundo do Hero"
              currentUrl={siteData.hero_image_url}
              onUpload={(url) => updateSiteData({ hero_image_url: url })}
              assetType="hero"
              companyId={user?.company_id || ''}
              aspectRatio="aspect-[21/9]"
            />

            <div className="grid grid-cols-1 gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Título Principal
                </label>
                <input
                  type="text"
                  value={siteData.hero_title || ''}
                  onChange={(e) => updateSiteData({ hero_title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Encontre o Imóvel dos Seus Sonhos"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Subtítulo
                </label>
                <input
                  type="text"
                  value={siteData.hero_subtitle || ''}
                  onChange={(e) => updateSiteData({ hero_subtitle: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="As melhores opções do mercado com atendimento exclusivo"
                />
              </div>
            </div>
          </div>
        )}

        {/* About Section */}
        {activeTab === 'about' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Sobre a Empresa</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Conte a história da sua imobiliária.</p>
            </div>

            <ImageUploader
              label="Imagem da Seção Sobre"
              currentUrl={siteData.about_image_url}
              onUpload={(url) => updateSiteData({ about_image_url: url })}
              assetType="about"
              companyId={user?.company_id || ''}
            />

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                Texto Sobre a Empresa
              </label>
              <textarea
                value={siteData.about_text || ''}
                onChange={(e) => updateSiteData({ about_text: e.target.value })}
                rows={6}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                placeholder="Somos especialistas em realizar sonhos e garantir os melhores negócios imobiliários..."
              />
              <p className="text-xs text-slate-500 mt-2">Descreva a missão, valores e diferenciais da sua empresa.</p>
            </div>
          </div>
        )}

        {/* Contact Section */}
        {activeTab === 'contact' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Informações de Contato</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Dados para seus clientes entrarem em contato.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  E-mail
                </label>
                <input
                  type="email"
                  value={siteData.contact.email || ''}
                  onChange={(e) => updateContact('email', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="contato@imobiliaria.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={siteData.contact.phone || ''}
                  onChange={(e) => updateContact('phone', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Endereço
                </label>
                <input
                  type="text"
                  value={siteData.contact.address || ''}
                  onChange={(e) => updateContact('address', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Rua Exemplo, 123 - Centro - Cidade/UF"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Redes Sociais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    Instagram
                  </label>
                  <input
                    type="text"
                    value={siteData.social.instagram || ''}
                    onChange={(e) => updateSocial('instagram', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="@suaimobiliaria"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    Facebook
                  </label>
                  <input
                    type="text"
                    value={siteData.social.facebook || ''}
                    onChange={(e) => updateSocial('facebook', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="facebook.com/suaimobiliaria"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={siteData.social.whatsapp || ''}
                    onChange={(e) => updateSocial('whatsapp', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="5511999999999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    YouTube
                  </label>
                  <input
                    type="text"
                    value={siteData.social.youtube || ''}
                    onChange={(e) => updateSocial('youtube', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="youtube.com/@suaimobiliaria"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
