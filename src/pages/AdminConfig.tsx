import React, { useEffect, useMemo, useRef, useState } from 'react';
import heic2any from 'heic2any';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { autoTagContractTemplate } from '../services/ai';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import GamificationModal from '../components/GamificationModal';
import FidelityTermsModal from '../components/FidelityTermsModal';
import { uploadCompanyAsset } from '../lib/storage';
import { SiteData } from '../types';
import { Copy, Loader2, Upload, X } from 'lucide-react';
import { useProperties } from '../hooks/useProperties';
import { generateZapXML } from '../utils/zapXmlGenerator';

interface Profile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_id?: string;
  role: 'admin' | 'corretor';
  avatar_url?: string;
  level?: number;
  xp?: number;
  active: boolean;
  distribution_rules?: { enabled: boolean; types: string[] };
  last_seen?: string;
}

interface Contract {
  id: string;
  plan_name?: string;
  plan?: string;
  plan_id?: string;
  status: string;
  start_date: string;
  end_date: string;
  billing_cycle?: string;
  has_fidelity?: boolean;
  fidelity_end_date?: string;
  companies?: { plan?: string };
}

const compressAvatar = (file: File | Blob, maxSize = 512): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Falha no contexto do Canvas'));

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao gerar Blob'));
      }, 'image/webp', 0.85);
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para compressão'));
  });
};

const getPresenceStatus = (lastSeen?: string) => {
  if (!lastSeen) return { isOnline: false, text: 'Nunca acessou' };

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));

  if (diffInMinutes < 5) {
    return { isOnline: true, text: 'Online agora' };
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = lastSeenDate.toDateString() === today.toDateString();
  const isYesterday = lastSeenDate.toDateString() === yesterday.toDateString();

  const timeString = lastSeenDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return { isOnline: false, text: `Visto hoje às ${timeString}` };
  if (isYesterday) return { isOnline: false, text: `Visto ontem às ${timeString}` };

  return {
    isOnline: false,
    text: `Visto em ${lastSeenDate.toLocaleDateString('pt-BR')} às ${timeString}`,
  };
};

interface ImageUploaderProps {
  label: string;
  currentUrl: string | null;
  onUpload: (url: string) => void;
  assetType: 'logo' | 'logo_alt' | 'hero' | 'favicon' | 'about';
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

const AdminConfig: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'team' | 'traffic' | 'subscription' | 'site' | 'contracts' | 'integrations' | 'finance'>('profile');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [distRules, setDistRules] = useState<{ enabled: boolean; types: string[] }>({ enabled: false, types: [] });
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', company_logo: '', cpf_cnpj: '', creci: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isXpModalOpen, setIsXpModalOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState({ route_to_central: true, central_whatsapp: '', central_user_id: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('trimoveis-sound') !== 'disabled');
  const [contract, setContract] = useState<Contract | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [isGeneratingCheckout, setIsGeneratingCheckout] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [acceptFidelity, setAcceptFidelity] = useState(false);
  const [acceptedFidelityTerms, setAcceptedFidelityTerms] = useState(false);
  const [showFidelityModal, setShowFidelityModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [contractTemplates, setContractTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<{id?: string, name: string, type: string, content: string} | null>(null);
  const [isAnalyzingContract, setIsAnalyzingContract] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [siteTemplate, setSiteTemplate] = useState('classic');
  const [siteDomain, setSiteDomain] = useState('');
  const [companySubdomain, setCompanySubdomain] = useState('');
  const [isSavingSite, setIsSavingSite] = useState(false);
  const { properties } = useProperties();
  const [isGeneratingXML, setIsGeneratingXML] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [paymentApiKey, setPaymentApiKey] = useState('');
  const [paymentGateway, setPaymentGateway] = useState<'asaas' | 'cora'>('cora');
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    setAcceptedFidelityTerms(false);
  }, [billingCycle]);

  useEffect(() => {
    if (!acceptFidelity) {
      setAcceptedFidelityTerms(false);
    }
  }, [acceptFidelity]);
  const [siteSubTab, setSiteSubTab] = useState<'templates' | 'identity' | 'hero' | 'about' | 'social'>('templates');
  const [siteData, setSiteData] = useState<SiteData>({
    logo_url: null,
    logo_alt_url: null,
    favicon_url: null,
    hero_image_url: null,
    about_image_url: null,
    primary_color: '#0ea5e9',
    secondary_color: '#1e293b',
    hero_title: '',
    hero_subtitle: '',
    about_title: '',
    about_text: '',
    show_partnerships: true,
    social_instagram: '',
    social_facebook: '',
    social_linkedin: '',
    social_youtube: '',
    contact: { email: null, phone: null, address: null },
    social: { instagram: null, facebook: null, whatsapp: null, youtube: null },
    seo: { title: null, description: null },
  });

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      setSiteSettings({
        route_to_central: data.route_to_central ?? true,
        central_whatsapp: data.central_whatsapp ?? '',
        central_user_id: data.central_user_id ?? '',
      });
    }
  };

  const fetchPlans = async () => {
    try {
      const { data } = await supabase.from('saas_plans').select('*').order('price', { ascending: true });
      setPlans(data || []);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchContract = async () => {
    if (!user?.company_id) return;
    setLoadingContract(true);
    const { data, error } = await supabase
      .from('saas_contracts')
      .select('*, companies(plan)')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Contrato não retornado, aplicando fallback de período de teste:', error.message);
    }

    if (data) {
      setContract(data as Contract);
    } else {
      // Se não há contrato oficial (usuário novo), cria um contrato "Virtual" de Teste na tela
      const { data: comp } = await supabase
        .from('companies')
        .select('created_at, plan')
        .eq('id', user.company_id)
        .single();

      if (comp) {
        const trialEnd = new Date(comp.created_at);
        trialEnd.setDate(trialEnd.getDate() + 7);
        setContract({
          id: 'trial-virtual',
          plan_name: comp.plan || 'essencial',
          status: 'pending',
          start_date: comp.created_at,
          end_date: trialEnd.toISOString(),
          billing_cycle: 'monthly'
        } as Contract);
      }
    }
    setLoadingContract(false);
  };

  const fetchCompanyData = async () => {
    if (!user?.company_id) return;
    
    const { data } = await supabase
      .from('companies')
      .select('template, domain, site_data, subdomain, payment_api_key, payment_gateway')
      .eq('id', user.company_id)
      .maybeSingle();
    
    if (data) {
      setSiteTemplate(data.template || 'classic');
      setSiteDomain(data.domain || '');
      setCompanySubdomain(data.subdomain || '');
      setPaymentApiKey(data.payment_api_key || '');
      setPaymentGateway(data.payment_gateway || 'asaas');
      
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
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
      fetchSettings();
      fetchContract();
      fetchCompanyData();
      fetchPlans();
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    const fetchCompleteProfile = async () => {
      if (!user?.id) return;
      try {
        // Vai diretamente ao banco de dados buscar a "verdade absoluta" do utilizador
        const { data } = await supabase
          .from('profiles')
          .select('name, phone, company_logo, cpf_cnpj, creci')
          .eq('id', user.id)
          .single();

        if (data) {
          setProfileForm({
            name: data.name || user.name || '',
            phone: data.phone || user.phone || '',
            email: user.email || '',
            company_logo: data.company_logo || '',
            cpf_cnpj: data.cpf_cnpj || '',
            creci: data.creci || '',
          });
        }

        const { data: templatesData } = await supabase.from('contract_templates').select('*');
        if (templatesData) setContractTemplates(templatesData);
      } catch (err) {
        console.error("Erro ao carregar dados complementares do perfil:", err);
      }
    };

    fetchCompleteProfile();
  }, [user?.id]); // Agora executa de forma limpa apenas quando o ID é carregado

  const fetchProfiles = async () => {
    if (!user?.company_id) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', user.company_id)
      .order('name');

    if (data) {
      const normalizedProfiles = (data as Partial<Profile>[]).map((profile) => ({
        ...profile,
        role: profile.role === 'admin' ? 'admin' : 'corretor',
      })) as Profile[];
      setProfiles(normalizedProfiles);
      const myProfile = normalizedProfiles.find((p) => p.id === user?.id);
      if (myProfile?.distribution_rules) setDistRules(myProfile.distribution_rules);
    }
  };

  const canManageTeamMember = (targetProfileId: string) => {
    if (!isAdmin || !user?.company_id) {
      alert('Apenas administradores podem gerenciar a equipe.');
      return false;
    }

    const targetProfile = profiles.find((profile) => profile.id === targetProfileId);

    if (!targetProfile || targetProfile.company_id !== user.company_id) {
      alert('Você só pode alterar usuários da sua própria empresa.');
      return false;
    }

    return true;
  };

  const updateDistRules = async (updates: Partial<{ enabled: boolean; types: string[] }>) => {
    if (!user?.id || !isAdmin || !user.company_id) return;

    const myProfile = profiles.find((profile) => profile.id === user.id);
    if (!myProfile || myProfile.company_id !== user.company_id) return;

    const newRules = { ...distRules, ...updates };
    setDistRules(newRules);
    await supabase.from('profiles').update({ distribution_rules: newRules }).eq('id', user.id);
  };

  const togglePropertyType = (type: string) => {
    const newTypes = distRules.types.includes(type)
      ? distRules.types.filter((t) => t !== type)
      : [...distRules.types, type];
    updateDistRules({ types: newTypes });
  };

  const updateProfileStatus = async (id: string, active: boolean) => {
    if (!canManageTeamMember(id)) return;

    const updates: Partial<Profile> = { active };

    if (active) {
      updates.role = 'corretor';
    }

    await supabase.from('profiles').update(updates).eq('id', id);
    await fetchProfiles();
  };

  const formatPhone = (value) => {
  if (!value) return ""
  
  // Remove tudo o que não for dígito
  const phoneNumber = value.replace(/\D/g, "")
  
  // Aplica a formatação progressivamente
  if (phoneNumber.length <= 2) return phoneNumber.replace(/^(\d{0,2})/, "($1")
  if (phoneNumber.length <= 7) return phoneNumber.replace(/^(\d{2})(\d{0,5})/, "($1) $2")
  
  return phoneNumber.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3")
}


  const toggleRole = async (id: string, currentRole: Profile['role']) => {
    if (!user?.id || !canManageTeamMember(id)) return;

    if (id === user.id) {
      alert('Você não pode alterar o próprio cargo.');
      return;
    }

    const newRole: Profile['role'] = currentRole === 'admin' ? 'corretor' : 'admin';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);

    if (error) {
      console.error('Erro ao atualizar cargo:', error);
      alert(`Não foi possível atualizar o cargo: ${error.message}`);
      return;
    }

    await fetchProfiles();
  };

  const deleteUser = async (id: string) => {
    if (!canManageTeamMember(id)) return;

    if (!window.confirm('Tem certeza? Isso apagará o usuário e todo o acesso dele permanentemente.')) return;

    const { error } = await supabase.rpc('delete_user_complete', { target_user_id: id });

    if (error) {
      console.error(error);
      alert(`Erro ao excluir: ${error.message}`);
    } else {
      await fetchProfiles();
      alert('Usuário excluído com sucesso.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: profileForm.name,
        phone: profileForm.phone,
        company_logo: profileForm.company_logo,
        cpf_cnpj: profileForm.cpf_cnpj,
        creci: profileForm.creci,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Erro ao salvar perfil:', error);
      addToast(`Erro ao salvar: ${error.message}`, 'error');
    } else {
      await refreshUser();
      if (isAdmin) await fetchProfiles();
      addToast('Perfil salvo com sucesso!', 'success');
    }

    setSavingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];

    setUploadingAvatar(true);

    try {
      let processedFile: File | Blob = file;
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        processedFile = Array.isArray(converted) ? converted[0] : converted;
      }

      const compressedBlob = await compressAvatar(processedFile);
      const fileName = `${user.id}-${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedBlob, {
          upsert: true,
          contentType: 'image/webp',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshUser();
      alert('Foto de perfil atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro no upload da foto:', error);
      alert('Não foi possível atualizar a foto: ' + error.message);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user?.id) return;
    const file = e.target.files[0];
    setIsUploadingLogo(true);
    try {
      const compressedBlob = await compressAvatar(file, 500);
      const fileName = `logo_${user.id}_${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedBlob, {
        upsert: true,
        contentType: 'image/webp',
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setProfileForm(prev => ({ ...prev, company_logo: data.publicUrl }));
      addToast('Logo processada! Não esqueça de clicar em "Salvar Perfil".', 'success');
    } catch (error: any) {
      console.error('Erro no upload da logo:', error);
      addToast('Erro ao carregar a logo: ' + error.message, 'error');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.password || passwordForm.password !== passwordForm.confirmPassword) return;

    setSavingPassword(true);
    await supabase.auth.updateUser({ password: passwordForm.password });
    setPasswordForm({ password: '', confirmPassword: '' });
    setSavingPassword(false);
  };

  const handleSaveTrafficSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    const cleanNumber = siteSettings.central_whatsapp.replace(/\D/g, '');

    const { error } = await supabase
      .from('settings')
      .update({
        route_to_central: siteSettings.route_to_central,
        central_whatsapp: cleanNumber,
        central_user_id: siteSettings.central_user_id || null,
      })
      .eq('id', 1);

    if (error) {
      alert('Erro ao salvar configurações de tráfego: ' + error.message);
    } else {
      alert('Configurações de tráfego salvas com sucesso!');
      setSiteSettings(prev => ({ ...prev, central_whatsapp: cleanNumber }));
    }
    setSavingSettings(false);
  };

  const handleCheckout = async () => {
    const companyId = user?.company_id;

    if (!companyId) {
      alert('Não foi possível identificar a empresa.');
      return;
    }

    setIsGeneratingCheckout(true);
    try {
      console.log("🚀 Buscando link de pagamento...");

      const { data, error } = await supabase.functions.invoke('get-asaas-payment-link', {
        body: { company_id: companyId }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.checkoutUrl) {
        throw new Error(data?.error || 'Link não retornado pelo Asaas.');
      }

      console.log("✅ Link encontrado! Redirecionando...");
      window.location.href = data.checkoutUrl;

    } catch (error: any) {
      console.error("🔥 ERRO FATAL:", error);
      alert('Erro ao buscar pagamento: ' + (error.message || error));
    } finally {
      setIsGeneratingCheckout(false);
    }
  };

  const handleOpenPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-asaas-portal-link', {
        body: { company_id: user?.company_id }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.portalUrl) {
        window.open(data.portalUrl, '_blank');
      } else {
        alert('Não foi possível gerar o link de acesso no momento.');
      }
    } catch (error: any) {
      alert('Erro ao acessar portal: ' + error.message);
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleReactivate = async (plan: any) => {
    setIsReactivating(true);
    try {
      const monthlyPrice = Number(plan.price || 0);
      const yearlyPrice = monthlyPrice * 0.85;
      const priceToPay = billingCycle === 'monthly' ? monthlyPrice : yearlyPrice;
      const planId = String(plan.id || plan.name || '').toLowerCase();

      const { data, error } = await supabase.functions.invoke('reactivate-asaas-subscription', {
        body: { 
          company_id: user?.company_id,
          plan_name: planId,
          billing_cycle: billingCycle,
          price: priceToPay
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert('Assinatura reativada, mas o link de pagamento não foi encontrado.');
      }
    } catch (error: any) {
      alert('Erro ao reativar: ' + error.message);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(planId);
    const previousContract = contract;
    try {
      if (!user?.company_id) throw new Error("ID da empresa não encontrado.");

      // Update otimista para feedback imediato na UI
      setContract((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plan_name: planId,
          billing_cycle: billingCycle,
          status: prev.status || 'pending',
        };
      });

      const { data, error } = await supabase.functions.invoke('update-asaas-subscription', {
        body: { 
          company_id: user.company_id, 
          new_plan: planId,
          billing_cycle: billingCycle,
          has_fidelity: acceptFidelity
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      alert(`Sucesso! Sua assinatura foi atualizada para o plano ${planId.toUpperCase()}.`);
      await fetchContract(); // Recarrega o contrato para atualizar o card na tela
      setAcceptedFidelityTerms(false);
    } catch (error: any) {
      setContract(previousContract);
      console.error(error);
      alert('Erro ao atualizar plano: ' + (error.message || 'Tente novamente mais tarde.'));
    } finally {
      setIsUpgrading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelReason) return alert('Por favor, selecione um motivo.');
    if (cancelReason === 'Outro' && !otherReason) return alert('Por favor, descreva o motivo.');

    setIsCanceling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-asaas-subscription', {
        body: { 
          company_id: user?.company_id, 
          reason: cancelReason, 
          other_reason: otherReason 
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      alert('Assinatura cancelada com sucesso. Você terá acesso até o final do período pago.');
      setIsCancelModalOpen(false);
      await fetchContract();
    } catch (error: any) {
      alert('Erro ao cancelar: ' + error.message);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleSaveSiteConfig = async () => {
    setIsSavingSite(true);
    try {
      if (!user?.company_id) throw new Error("ID da empresa não encontrado.");

      // Limpa o domínio caso o usuário digite com http ou www
      const cleanDomain = siteDomain.replace(/^(https?:\/\/)?(www\.)?/, '').trim();
      const finalDomain = cleanDomain === '' ? null : cleanDomain;

      const { error } = await supabase
        .from('companies')
        .update({ 
          template: siteTemplate,
          domain: finalDomain,
          site_data: siteData
        })
        .eq('id', user.company_id);

      if (error) throw error;

      setSiteDomain(cleanDomain);
      alert('Configurações do site salvas com sucesso!');
    } catch (error: any) {
      alert('Erro ao salvar configurações: ' + error.message);
    } finally {
      setIsSavingSite(false);
    }
  };

  const handleDownloadXML = () => {
    setIsGeneratingXML(true);
    try {
      const activeProperties = properties.filter(p => p.status?.toLowerCase() === 'ativo');
      const xmlString = generateZapXML(activeProperties, 'Imobiliaria');
      const blob = new Blob([xmlString], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feed_portais_${companySubdomain || 'imobiliaria'}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao gerar XML', error);
    } finally {
      setIsGeneratingXML(false);
    }
  };

  const handleOpenWebsite = () => {
    if (!companySubdomain) {
      alert('Subdomínio não configurado. Verifique as configurações da empresa.');
      return;
    }

    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const port = window.location.port ? `:${window.location.port}` : '';

    if (isLocalhost) {
      // Abre no ambiente local com a porta correta (ex: http://imob.localhost:5173)
      window.open(`http://${companySubdomain}.localhost${port}`, '_blank');
    } else {
      // Força o uso do domínio de teste base do sistema (ex: https://imob.elevatiovendas.com)
      const baseDomain = hostname.replace(/^admin\./, '');
      window.open(`https://${companySubdomain}.${baseDomain}`, '_blank');
    }
  };

  const currentLevel = Math.max(1, Number(user?.level ?? 1));
  const currentXP = Math.max(0, Number(user?.xp_points ?? 0));
  const progressMax = 100;
  const progressCurrent = currentXP % progressMax;
  const pointsToNext = progressMax - progressCurrent;

  const roleLabel = useMemo(() => {
    if (user?.role === 'admin') return 'Administrador';
    if (!user?.role) return 'Corretor';
    return `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`;
  }, [user?.role]);

  const pendingProfiles = useMemo(() => profiles.filter((profile) => !profile.active), [profiles]);
  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.active), [profiles]);

  const rawPlan = contract?.plan_name || contract?.plan || contract?.companies?.plan || '';
  const activePlanId = rawPlan.toLowerCase();
  const currentPlanIndex = plans.findIndex(
    (p) => String(p.id || '').toLowerCase() === activePlanId || String(p.name || '').toLowerCase() === activePlanId,
  );
  const currentPlanDetails = currentPlanIndex !== -1 ? plans[currentPlanIndex] : null;
  const getPlanHighlights = (plan: any) => [
    ...(billingCycle === 'yearly' && plan?.has_free_domain ? ['🎁 Domínio Grátis (1º ano)'] : []),
    ...(plan?.max_contracts > 0 ? [`Até ${plan.max_contracts} contratos ativos`] : []),
    ...(Array.isArray(plan?.features) ? plan.features : []),
  ];
  const currentPlanFeatureList = currentPlanDetails ? getPlanHighlights(currentPlanDetails) : [];
  const displayPlanName = currentPlanDetails?.name || (rawPlan ? rawPlan.toUpperCase() : 'PLANO PADRÃO');

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);

    if (newValue) {
      localStorage.removeItem('trimoveis-sound');
    } else {
      localStorage.setItem('trimoveis-sound', 'disabled');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Configurações</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Gerencie seu perfil, segurança e equipe.</p>
      </div>

      {/* Abas Principais de Configuração (Design Premium) */}
      <div className="flex overflow-x-auto ev-main-scroll gap-2 p-1.5 bg-slate-200/50 dark:bg-[#0a0f1c]/50 backdrop-blur-md rounded-2xl w-fit border border-slate-300/50 dark:border-white/5 shadow-inner">
        {[
          { id: 'profile', label: 'Perfil', icon: Icons.User },
          { id: 'security', label: 'Segurança', icon: Icons.Lock },
          { id: 'team', label: 'Equipe', icon: Icons.Users, adminOnly: true },
          { id: 'traffic', label: 'Tráfego', icon: Icons.Globe, adminOnly: true },
          { id: 'subscription', label: 'Assinatura', icon: Icons.CreditCard, adminOnly: true },
          { id: 'site', label: 'Meu Site', icon: Icons.Layout, adminOnly: true },
          { id: 'contracts', label: 'Modelos de Contrato', icon: Icons.FileSignature, adminOnly: true },
          { id: 'integrations', label: 'Integrações', icon: Icons.Share2, adminOnly: true },
          { id: 'finance', label: 'Financeiro / API', icon: Icons.DollarSign, adminOnly: true },
        ].filter(t => !t.adminOnly || isAdmin).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-brand-600 text-brand-600 dark:text-white shadow-md' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-200 dark:border-dark-border space-y-6">
            <div className="flex items-center gap-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-white overflow-hidden flex items-center justify-center"
                title="Clique para alterar avatar"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar do usuário" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-2xl">{(user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 text-[10px] py-0.5 bg-black/50 text-white">{uploadingAvatar ? 'Enviando...' : 'Alterar'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />

              <div>
                <p className="font-bold text-slate-800 dark:text-white">{user?.name || 'Usuário'}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{roleLabel}</p>
              </div>
            </div>

            {/* UPLOAD DA LOGO DA IMOBILIÁRIA (CONTRATOS) */}
            <div className="pt-6 pb-2 border-t border-b border-gray-100 dark:border-slate-800 mb-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Icons.Image size={18} className="text-brand-500" />
                Logo para Contratos e Recibos
              </h3>
              <div className="flex items-center gap-6">
                <div className="w-32 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-white/5 overflow-hidden relative group">
                  {profileForm.company_logo ? (
                    <img src={profileForm.company_logo} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Icons.Building size={24} className="text-slate-400" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <label className="cursor-pointer p-2">
                      {isUploadingLogo ? (
                        <Icons.Loader2 size={20} className="text-white animate-spin" />
                      ) : (
                        <Icons.Upload size={20} className="text-white" />
                      )}
                      <input type="file" accept="image/*" className="hidden" disabled={isUploadingLogo} onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">
                  Aparecerá no cabeçalho dos contratos PDF. Recomendado PNG com fundo transparente. Lembre-se de clicar em "Salvar Perfil".
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  value={profileForm.name}
                  onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                    value={profileForm.phone}
                    maxLength={15} // Limita o tamanho máximo: (11) 99999-9999
                    onChange={e => {
                      const formattedValue = formatPhone(e.target.value)
                      setProfileForm(prev => ({ ...prev, phone: formattedValue }))
                    }}
                    placeholder="(00) 00000-0000"
                  />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF / CNPJ da Empresa</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  value={profileForm.cpf_cnpj}
                  onChange={e => setProfileForm(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CRECI (Opcional)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  value={profileForm.creci}
                  onChange={e => setProfileForm(prev => ({ ...prev, creci: e.target.value }))}
                  placeholder="Ex: 12345-F"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 outline-none opacity-70 cursor-not-allowed"
                  value={profileForm.email}
                  disabled
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-60"
              >
                {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </form>


          <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-200 dark:border-dark-border mt-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
              <Icons.Settings size={20} className="text-brand-600" /> Preferências do Sistema
            </h2>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-100">Sons de Notificação</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Tocar um som suave quando uma notificação chegar em tempo real.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                onClick={toggleSound}
                className={`${soundEnabled ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-600'} relative inline-flex h-6 w-11 items-center flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
              >
                <span className={`${soundEnabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
              </button>
            </div>
          </div>
          </div>

          <button
            type="button"
            onClick={() => setIsXpModalOpen(true)}
            className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700 h-fit text-left cursor-pointer hover:shadow-md transition-all"
          >
            <p className="text-xs uppercase tracking-widest text-brand-300">Gamificação</p>
            <h3 className="text-xl font-bold mt-2">Seu Nível: {currentLevel}</h3>
            <p className="text-sm text-slate-300 mt-1">XP Total: {currentXP}</p>

            <div className="mt-6">
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Progresso para o próximo nível</span>
                <span>{progressCurrent}/{progressMax}</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(progressCurrent / progressMax) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-300 mt-2">Faltam {pointsToNext} pontos para o próximo nível.</p>
            </div>
          </button>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="max-w-2xl bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-200 dark:border-dark-border">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Icons.Lock size={18} /> Alterar Senha
          </h3>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nova Senha</label>
              <input
                type="password"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                required
                minLength={6}
              />
            </div>

            {passwordForm.confirmPassword && passwordForm.password !== passwordForm.confirmPassword && (
              <p className="text-xs text-red-500">As senhas não coincidem.</p>
            )}

            <button
              type="submit"
              disabled={savingPassword || passwordForm.password !== passwordForm.confirmPassword}
              className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-60"
            >
              {savingPassword ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'team' && isAdmin && (
        <div className="space-y-6">
          <div className={`p-6 rounded-2xl border shadow-sm transition-all ${distRules.enabled ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-white border-gray-200 dark:bg-dark-card dark:border-dark-border'}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Distribuição dos MEUS Imóveis</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Transfira automaticamente leads interessados nos seus imóveis para a equipe.
                </p>
              </div>
              <button
                onClick={() => updateDistRules({ enabled: !distRules.enabled })}
                className={`px-5 py-2 rounded-xl font-bold transition-colors ${distRules.enabled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
              >
                {distRules.enabled ? 'Desativar Distribuição' : 'Ativar Distribuição'}
              </button>
            </div>

            {distRules.enabled && (
              <div className="pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Quais categorias deseja distribuir?</p>
                <div className="flex flex-wrap gap-2">
                  {['Casa', 'Apartamento', 'Terreno', 'Chácara', 'Comercial', 'Aluguel'].map((type) => (
                    <label key={type} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand-400 transition-colors">
                      <input
                        type="checkbox"
                        checked={distRules.types.includes(type)}
                        onChange={() => togglePropertyType(type)}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white">Pendentes ({pendingProfiles.length})</h3>
              </div>
              {pendingProfiles.map((profile) => (
                <div key={profile.id} className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 dark:text-white">{profile.name || 'Sem nome'}</p>
                      {getPresenceStatus(profile.last_seen).isOnline && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Online
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{profile.email}</p>
                    {!getPresenceStatus(profile.last_seen).isOnline && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Icons.Clock size={10} /> {getPresenceStatus(profile.last_seen).text}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateProfileStatus(profile.id, true)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Aprovar</button>
                    <button onClick={() => deleteUser(profile.id)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                  </div>
                </div>
              ))}
              {pendingProfiles.length === 0 && <p className="p-5 text-sm text-gray-400">Sem usuários pendentes.</p>}
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white">Ativos ({activeProfiles.length})</h3>
              </div>
              {activeProfiles.map((profile) => (
                <div key={profile.id} className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 dark:text-white">{profile.name || 'Sem nome'}</p>
                      {getPresenceStatus(profile.last_seen).isOnline && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Online
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{profile.email}</p>
                    {!getPresenceStatus(profile.last_seen).isOnline && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Icons.Clock size={10} /> {getPresenceStatus(profile.last_seen).text}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {profile.role === 'admin' ? (
                      <button
                        onClick={() => toggleRole(profile.id, profile.role ?? 'user')}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200"
                      >
                        ADMIN
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleRole(profile.id, profile.role ?? 'user')}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50"
                      >
                        Tornar Admin
                      </button>
                    )}
                    <button onClick={() => updateProfileStatus(profile.id, false)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Pausar</button>
                    <button onClick={() => deleteUser(profile.id)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-100 text-red-700 hover:bg-red-200">Excluir</button>
                  </div>
                </div>
              ))}
              {activeProfiles.length === 0 && <p className="p-5 text-sm text-gray-400">Sem usuários ativos.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'traffic' && isAdmin && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Roteamento de Leads</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Defina para qual fila ou usuário os leads de cada canal de tráfego devem ser enviados.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-brand-200 dark:border-brand-900/30 overflow-hidden shadow-sm">
              <div className="bg-brand-50 dark:bg-brand-900/10 p-4 border-b border-brand-100 dark:border-brand-900/20 flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-dark-bg rounded-full flex items-center justify-center text-brand-600 shadow-sm">
                  <Icons.Globe size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white">Tráfego Orgânico (Site)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Leads gerados pela página dos imóveis.</p>
                </div>
              </div>

              <form onSubmit={handleSaveTrafficSettings} className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-slate-800 dark:text-white">Pré-atendimento Centralizado</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Se ativo, leads vão para o gestor abaixo. Se inativo, vão para o corretor dono do imóvel.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={siteSettings.route_to_central}
                      onChange={(e) => setSiteSettings(prev => ({ ...prev, route_to_central: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                  </label>
                </div>

                {siteSettings.route_to_central && (
                  <div className="space-y-4 animate-fade-in pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável pelos Leads (Admin)</label>
                      <select
                        value={siteSettings.central_user_id}
                        onChange={(e) => setSiteSettings(prev => ({ ...prev, central_user_id: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                      >
                        <option value="">Ninguém (Fica na fila geral)</option>
                        {profiles.filter(p => p.role === 'admin').map(admin => (
                          <option key={admin.id} value={admin.id}>{admin.name} (Admin)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp da Recepção/Central</label>
                      <input
                        type="text"
                        placeholder="Ex: 11999999999"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                        value={siteSettings.central_whatsapp}
                        onChange={(e) => setSiteSettings(prev => ({ ...prev, central_whatsapp: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full bg-brand-600 text-white py-2.5 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-60 transition-colors"
                >
                  {savingSettings ? 'Salvando...' : 'Salvar Regras do Site'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {[
                { title: 'Meta Ads (Facebook & Instagram)', icon: Icons.Share2, color: 'text-blue-600', bg: 'bg-blue-50' },
                { title: 'Google Ads', icon: Icons.Search, color: 'text-red-500', bg: 'bg-red-50' },
              ].map((platform, i) => (
                <div key={i} className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-4 flex items-center justify-between opacity-70 grayscale-[30%]">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${platform.bg} rounded-full flex items-center justify-center ${platform.color}`}>
                      <platform.icon size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">{platform.title}</h4>
                      <p className="text-xs text-slate-500">Integração nativa</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-md">
                    Em Breve
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subscription' && isAdmin && (
        <div className="space-y-8 animate-fade-in">
          {/* Cabeçalho da Assinatura */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h3 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Sua Assinatura</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Gerencie seu plano, faturas e métodos de pagamento.
              </p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center w-fit">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  billingCycle === 'yearly'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                Anual
                <span className="bg-brand-100 text-brand-700 text-[10px] px-1.5 py-0.5 rounded-md">-20%</span>
              </button>
            </div>

            {/* Checkbox de Fidelidade para o plano Mensal */}
            {billingCycle === 'monthly' && (
              <button
                type="button"
                onClick={() => {
                  if (acceptFidelity) {
                    setAcceptFidelity(false);
                    setAcceptedFidelityTerms(false);
                    return;
                  }
                  setShowFidelityModal(true);
                }}
                className={`mt-4 w-fit rounded-xl border p-3 transition-colors ${
                  acceptFidelity
                    ? 'bg-brand-100 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      acceptFidelity ? 'bg-brand-600' : 'bg-slate-400 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        acceptFidelity ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 text-left">
                    Ativar fidelidade de 12 meses para ganhar <strong className="text-brand-600 dark:text-brand-400">20% de desconto</strong>
                  </span>
                </div>
              </button>
            )}
          </div>

          {loadingContract ? (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-8 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : contract ? (
            <>
              {/* Card do Plano Atual */}
              <div className="bg-gradient-to-br from-brand-900 to-slate-900 rounded-3xl p-1 shadow-xl">
                <div className="bg-white/10 backdrop-blur-md rounded-[22px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="text-white w-full md:w-auto">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-brand-500/20 text-brand-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-brand-400/30">
                        Plano Atual
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-xs font-bold ${
                          contract.status === 'active'
                            ? 'text-emerald-400'
                            : contract.status === 'pending'
                              ? 'text-blue-400'
                              : contract.status === 'canceled'
                                ? 'text-amber-400'
                                : 'text-red-400'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            contract.status === 'active'
                              ? 'bg-emerald-400'
                              : contract.status === 'pending'
                                ? 'bg-blue-400'
                                : contract.status === 'canceled'
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                          }`}
                        ></span>
                        {contract.status === 'active'
                          ? 'Ativo'
                          : contract.status === 'pending'
                            ? 'Período de Teste (7 Dias)'
                            : contract.status === 'canceled'
                              ? `Cancela em ${new Date(contract.end_date).toLocaleDateString('pt-BR')}`
                              : contract ? 'Inativo' : 'Erro: Contrato não gerado'}
                      </span>
                    </div>
                    <h2 className="text-4xl font-serif font-bold uppercase tracking-tight">{displayPlanName}</h2>
                    <div className="flex items-center gap-6 mt-6 opacity-80 text-sm">
                      <div>
                        <p className="text-brand-300 text-xs uppercase mb-0.5">Renovação em</p>
                        <p className="font-medium">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="w-px h-8 bg-white/20"></div>
                      <div>
                        <p className="text-brand-300 text-xs uppercase mb-0.5">Ciclo Atual</p>
                        <p className="font-medium">{contract.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}</p>
                      </div>
                    </div>
                  </div>
                  {/* Ações da Assinatura */}
                  <div className="w-full md:w-auto flex flex-col gap-3 min-w-[240px]">
                    {(contract?.status === 'trial' || contract?.status === 'past_due' || contract?.status === 'canceled' || contract?.status === 'pending') && (
                      <button
                        onClick={() => {
                          if (contract?.status === 'canceled') {
                            const currentPlanData =
                              plans.find((p) => String(p.id || '').toLowerCase() === String(contract.plan_name || '').toLowerCase())
                              || plans[0];
                            if (currentPlanData) handleReactivate(currentPlanData);
                          } else {
                            handleCheckout();
                          }
                        }}
                        disabled={isGeneratingCheckout || isReactivating}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                          contract?.status === 'past_due'
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                            : contract?.status === 'canceled'
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                            : 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20'
                        }`}
                      >
                        {(isGeneratingCheckout || isReactivating) ? (
                          <Icons.RefreshCw size={20} className="animate-spin" />
                        ) : (
                          <Icons.CreditCard size={20} />
                        )}
                        {(isGeneratingCheckout || isReactivating)
                          ? 'Processando...'
                          : contract?.status === 'past_due'
                          ? 'Regularizar Pagamento'
                          : contract?.status === 'canceled'
                          ? 'Reativar Assinatura'
                          : 'Assinar Agora'}
                      </button>
                    )}

                    {contract?.status === 'active' && (
                      <>
                        <button
                          onClick={handleOpenPortal}
                          disabled={isOpeningPortal}
                          className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isOpeningPortal ? (
                            <Icons.RefreshCw size={20} className="animate-spin" />
                          ) : (
                            <Icons.CreditCard size={20} />
                          )}
                          {isOpeningPortal ? 'Acessando...' : 'Faturas e Cartão'}
                        </button>

                        <button
                          onClick={() => setIsCancelModalOpen(true)}
                          className="w-full bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-500 py-3 rounded-xl font-bold transition-colors"
                        >
                          Cancelar Assinatura
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grade de Upgrades */}
              <div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Opções de Upgrade</h4>
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-10">
                    <Icons.RefreshCw size={22} className="animate-spin text-brand-500" />
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.filter((plan) => {
                    const planId = String(plan.id || plan.name || '').toLowerCase();
                    const isCurrentPlan = planId === activePlanId;
                    const isCurrentCycle = contract?.billing_cycle === billingCycle;
                    // SÓ esconde se for o mesmo plano E o mesmo ciclo que ele já paga
                    return !(isCurrentPlan && isCurrentCycle);
                  }).map((plan) => {
                    const planId = String(plan.id || plan.name || '').toLowerCase();
                    const planIndex = plans.findIndex((p) => String(p.id || p.name || '').toLowerCase() === planId);
                    const isDowngrade = currentPlanIndex !== -1 && planIndex < currentPlanIndex;
                    const planFeatureList = getPlanHighlights(plan);
                    
                    // Verifica se é mudança de ciclo no mesmo plano
                    const isCycleUpgrade = planId === activePlanId && contract?.billing_cycle === 'monthly' && billingCycle === 'yearly';
                    const isCycleDowngrade = planId === activePlanId && contract?.billing_cycle === 'yearly' && billingCycle === 'monthly';
                    const isReactivationFlow = contract?.status === 'canceled' || contract?.status === 'expired';
                    const monthlyPrice = Number(plan.price || 0);
                    const yearlyPrice = monthlyPrice * 0.85;
                    
                    return (
                      <div
                        key={plan.id || plan.name}
                        className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-6 flex flex-col h-full hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                      >
                        <div className="mb-4">
                          <h5 className="text-xl font-bold text-slate-800 dark:text-white uppercase">{plan.name}</h5>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{plan.description}</p>
                        </div>
                        <div className="mb-6 flex flex-col">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">
                              R${' '}
                              {billingCycle === 'monthly'
                                ? (acceptFidelity ? monthlyPrice * 0.8 : monthlyPrice).toFixed(2).replace('.', ',')
                                : yearlyPrice.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-sm text-slate-500">/mês</span>
                          </div>
                          <div className="h-4 mt-1">
                            {billingCycle === 'yearly' && (
                              <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                                Faturado R$ {(yearlyPrice * 12).toFixed(2).replace('.', ',')} / ano
                              </span>
                            )}
                          </div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-grow">
                          {planFeatureList.slice(0, 4).map((feature: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Icons.Check size={16} className="text-brand-500 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                          {planFeatureList.length > 4 && (
                            <li className="text-xs text-brand-600 font-medium pl-6">
                              + {planFeatureList.length - 4} outras vantagens
                            </li>
                          )}
                        </ul>
                        <button
                          onClick={() => {
                            if (isReactivationFlow) {
                              handleReactivate(plan);
                            } else {
                              handleUpgrade(planId);
                            }
                          }}
                          disabled={isUpgrading === planId || isGeneratingCheckout || isReactivating}
                          className={`w-full py-2.5 rounded-xl font-bold transition-colors ${
                            isDowngrade || isCycleDowngrade
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400'
                              : 'bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 dark:text-brand-400'
                          }`}
                        >
                          {(isUpgrading === planId || isReactivating)
                            ? 'Processando...' 
                            : isReactivationFlow
                              ? 'Reativar Assinatura'
                              : isCycleUpgrade 
                                ? 'Migrar para Anual' 
                                : isCycleDowngrade 
                                  ? 'Migrar para Mensal' 
                                  : isDowngrade 
                                    ? 'Fazer Downgrade' 
                                    : 'Fazer Upgrade'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum plano ativo encontrado. Entre em contato com o suporte.
              </p>
            </div>
          )}
        </div>
      )}

      <GamificationModal
        isOpen={isXpModalOpen}
        onClose={() => setIsXpModalOpen(false)}
        xpPoints={Number(user?.xp_points || 0)}
      />

      <FidelityTermsModal
        isOpen={showFidelityModal}
        onClose={() => setShowFidelityModal(false)}
        onAccept={() => {
          setShowFidelityModal(false);
          setAcceptFidelity(true);
          setAcceptedFidelityTerms(true);
        }}
        companyName={user?.user_metadata?.company_name || profileForm.name || 'Empresa não informada'}
        ownerName={user?.user_metadata?.full_name || user?.name || 'Responsável não informado'}
        document={profileForm.cpf_cnpj || 'Documento não informado'}
      />

      {/* Modal de Cancelamento */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Cancelar Assinatura</h3>
            
            {contract?.has_fidelity && contract?.fidelity_end_date && new Date() < new Date(contract.fidelity_end_date) && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl mb-6">
                <h4 className="text-red-800 dark:text-red-400 font-bold text-sm flex items-center gap-2 mb-1">
                  <Icons.AlertTriangle size={16} />
                  Aviso de Quebra de Contrato
                </h4>
                <p className="text-xs text-red-600 dark:text-red-300">
                  Sua assinatura possui um contrato de fidelidade válido até <strong>{new Date(contract.fidelity_end_date).toLocaleDateString('pt-BR')}</strong>. Ao cancelar agora, será gerada uma fatura de multa rescisória (30% sobre o valor dos meses restantes) conforme os Termos de Uso.
                </p>
              </div>
            )}

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Sentimos muito em ver você partir. Seu acesso continuará liberado até{' '}
              <strong className="text-brand-500">
                {new Date(contract?.end_date || '').toLocaleDateString('pt-BR')}
              </strong>
              . Conta pra gente, por que está cancelando?
            </p>

            <div className="space-y-3 mb-6">
              {['Muito caro', 'Faltam recursos', 'Difícil de usar', 'Mudei de software', 'Outro'].map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <input
                    type="radio"
                    name="cancel_reason"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-4 h-4 text-brand-500 bg-transparent border-slate-300 focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{reason}</span>
                </label>
              ))}
            </div>

            {cancelReason === 'Outro' && (
              <textarea
                placeholder="Por favor, conte-nos mais (opcional)..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500 mb-6 min-h-[80px] resize-none"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isCanceling || !cancelReason || (cancelReason === 'Outro' && !otherReason)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isCanceling ? (
                  <>
                    <Icons.RefreshCw size={18} className="animate-spin" /> Cancelando...
                  </>
                ) : (
                  'Confirmar Cancelamento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'site' && (
        <div className="space-y-6 animate-fade-in">
          {/* Cabeçalho do Construtor */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Construtor do Site</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Personalize a identidade e os textos da sua página pública.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={handleOpenWebsite} 
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm text-sm"
              >
                <Icons.Globe size={18} /> Visitar Site
              </button>
              <button 
                onClick={handleSaveSiteConfig} 
                disabled={isSavingSite} 
                className="flex-1 md:flex-none bg-gradient-to-r from-brand-600 to-sky-500 text-white px-6 py-2.5 rounded-xl font-bold hover:scale-105 transition-all shadow-[0_4px_14px_rgba(14,165,233,0.35)] flex items-center justify-center gap-2 text-sm"
              >
                {isSavingSite ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Save size={18} />}
                {isSavingSite ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>

          {/* Sub-Abas do Construtor */}
          <div className="flex overflow-x-auto ev-main-scroll gap-2 p-1.5 bg-slate-100 dark:bg-white/5 backdrop-blur-md rounded-2xl w-fit border border-slate-200 dark:border-white/10 shadow-inner mb-6">
            {[
              { id: 'templates', label: 'Templates & Domínio', icon: Icons.Layout },
              { id: 'identity', label: 'Identidade Visual', icon: Icons.Palette },
              { id: 'hero', label: 'Página Inicial', icon: Icons.Home },
              { id: 'about', label: 'Quem Somos', icon: Icons.Users },
              { id: 'social', label: 'Redes Sociais', icon: Icons.Share2 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSiteSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 ${
                  siteSubTab === tab.id 
                    ? 'bg-white dark:bg-brand-600 text-brand-600 dark:text-white shadow-md' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {siteSubTab === 'templates' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
          {/* SEÇÃO 1: Escolha do Template */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Icons.Layout size={24} className="text-brand-500" />
                Aparência do Site
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Escolha o design que melhor representa a sua imobiliária.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {/* Opção Minimalist (O antigo Classic limpo) */}
              <div
                onClick={() => setSiteTemplate('minimalist')}
                className={`cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                  siteTemplate === 'minimalist'
                    ? 'border-brand-500 ring-4 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="h-40 bg-slate-100 dark:bg-slate-800 p-4 flex flex-col items-center justify-center border-b border-slate-200 dark:border-slate-700">
                  <div className="w-full h-4 bg-white dark:bg-slate-700 rounded mb-2 shadow-sm"></div>
                  <div className="w-full flex gap-2">
                    <div className="w-1/3 h-16 bg-white dark:bg-slate-700 rounded shadow-sm"></div>
                    <div className="w-1/3 h-16 bg-white dark:bg-slate-700 rounded shadow-sm"></div>
                    <div className="w-1/3 h-16 bg-white dark:bg-slate-700 rounded shadow-sm"></div>
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-dark-card h-full">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-white">Minimalist</h4>
                    {siteTemplate === 'minimalist' && <Icons.CheckCircle className="text-brand-500" size={20} />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Design limpo e direto, focado em alta conversão, leveza e simplicidade. Fundo claro.
                  </p>
                </div>
              </div>

              {/* Opção Classic (O novo formato tradicional) */}
              <div
                onClick={() => setSiteTemplate('classic')}
                className={`cursor-pointer rounded-xl border-2 transition-all overflow-hidden flex flex-col ${
                  siteTemplate === 'classic'
                    ? 'border-brand-500 ring-4 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="h-40 bg-white dark:bg-slate-900 p-4 flex flex-col items-center justify-center border-b border-slate-200 dark:border-slate-800">
                  <div className="w-full h-6 bg-slate-200 dark:bg-slate-800 rounded mb-3"></div>
                  <div className="w-full h-20 bg-slate-100 dark:bg-slate-800/50 rounded shadow-inner"></div>
                </div>
                <div className="p-4 bg-white dark:bg-dark-card flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-white">Classic</h4>
                    {siteTemplate === 'classic' && <Icons.CheckCircle className="text-brand-500" size={20} />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Design tradicional e confiável. Estrutura padrão com barra de navegação sólida e destaque central.
                  </p>
                </div>
              </div>

              {/* Opção Luxury */}
              <div
                onClick={() => setSiteTemplate('luxury')}
                className={`cursor-pointer rounded-xl border-2 transition-all overflow-hidden flex flex-col ${
                  siteTemplate === 'luxury'
                    ? 'border-brand-500 ring-4 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="h-40 bg-slate-900 p-4 flex flex-col items-center justify-center border-b border-slate-800">
                  <div className="w-3/4 h-8 bg-slate-800 rounded mb-4"></div>
                  <div className="w-1/2 h-10 bg-brand-600 rounded"></div>
                </div>
                <div className="p-4 bg-white dark:bg-dark-card flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-white">Luxury</h4>
                    {siteTemplate === 'luxury' && <Icons.CheckCircle className="text-brand-500" size={20} />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Design premium em tons escuros. Ideal para imóveis de alto padrão e máxima exclusividade.
                  </p>
                </div>
              </div>

              {/* Opção Modern */}
              <div
                onClick={() => setSiteTemplate('modern')}
                className={`cursor-pointer rounded-xl border-2 transition-all overflow-hidden flex flex-col ${
                  siteTemplate === 'modern'
                    ? 'border-brand-500 ring-4 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="h-40 bg-slate-50 dark:bg-slate-800 p-4 flex flex-col items-center border-b border-slate-200 dark:border-slate-700 relative overflow-hidden">
                  <div className="absolute top-3 left-3 right-3 h-6 bg-white dark:bg-slate-700 rounded-full shadow-sm"></div>
                  <div className="mt-12 w-[90%] h-24 bg-brand-100 dark:bg-brand-900/30 rounded-2xl"></div>
                </div>
                <div className="p-4 bg-white dark:bg-dark-card flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-white">Modern</h4>
                    {siteTemplate === 'modern' && <Icons.CheckCircle className="text-brand-500" size={20} />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Visual de vanguarda. Elementos flutuantes, cantos arredondados e foco total na imersão visual.
                  </p>
                </div>
              </div>

              {/* Opção Básico */}
              <div
                onClick={() => setSiteTemplate('basico')}
                className={`cursor-pointer rounded-xl border-2 transition-all overflow-hidden flex flex-col ${
                  siteTemplate === 'basico'
                    ? 'border-brand-500 ring-4 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="h-40 bg-[#0e0e0e] p-4 flex flex-col items-center justify-center border-b border-slate-800 relative overflow-hidden">
                  <div className="w-full h-5 bg-white/5 rounded mb-3 flex items-center px-2 gap-1">
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full"></div>
                    <div className="w-12 h-3 bg-amber-700/60 rounded"></div>
                  </div>
                  <div className="w-full h-20 bg-white/5 rounded flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-3 bg-amber-700/40 rounded mx-auto mb-2"></div>
                      <div className="w-16 h-2 bg-white/10 rounded mx-auto"></div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-dark-card flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-white">Básico</h4>
                    {siteTemplate === 'basico' && <Icons.CheckCircle className="text-brand-500" size={20} />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Layout One-Page rápido, focado em alta conversão e direto ao ponto. Fundo escuro elegante.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: Domínio Customizado */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Icons.Globe size={24} className="text-brand-500" />
                Domínio Próprio
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Conecte o seu domínio (ex: sua-imobiliaria.com.br) para remover a marca da Elevatio Vendas.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Seu Domínio
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Link size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={siteDomain}
                    onChange={(e) => setSiteDomain(e.target.value)}
                    placeholder="minhaimobiliaria.com.br"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:border-brand-500 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 border border-brand-100 dark:border-brand-900/50">
                <h4 className="text-sm font-bold text-brand-800 dark:text-brand-400 mb-2 flex items-center gap-2">
                  <Icons.Info size={16} />
                  Como configurar seu domínio:
                </h4>
                <ol className="list-decimal list-inside text-xs text-brand-700 dark:text-brand-300 space-y-1">
                  <li>Acesse o painel onde comprou seu domínio (Registro.br, GoDaddy, etc).</li>
                  <li>Vá na zona de DNS e crie um apontamento do tipo <strong>CNAME</strong>.</li>
                  <li>No campo Nome, digite <strong>www</strong>.</li>
                  <li>No campo Destino/Valor, digite <strong>cname.vercel-dns.com</strong>.</li>
                  <li>Aguarde a propagação (pode levar até 24 horas).</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Botão de Salvar - REMOVIDO (agora está no topo) */}
          </div>
          )} {/* Fim do siteSubTab === 'templates' */}

          {siteSubTab === 'identity' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Identidade Visual</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Defina as cores e logos da sua marca.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ImageUploader
                  label="Logo Principal"
                  currentUrl={siteData.logo_url}
                  onUpload={(url) => setSiteData({...siteData, logo_url: url})}
                  assetType="logo"
                  companyId={user?.company_id || ''}
                  aspectRatio="aspect-[3/1]"
                />

                <ImageUploader
                  label="Logo Símbolo (Rolagem)"
                  currentUrl={siteData.logo_alt_url || null}
                  onUpload={(url) => setSiteData({...siteData, logo_alt_url: url})}
                  assetType="logo_alt"
                  companyId={user?.company_id || ''}
                  aspectRatio="aspect-square"
                />

                <ImageUploader
                  label="Favicon (Ícone do Site)"
                  currentUrl={siteData.favicon_url}
                  onUpload={(url) => setSiteData({...siteData, favicon_url: url})}
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
                      onChange={(e) => setSiteData({...siteData, primary_color: e.target.value})}
                      className="w-16 h-16 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-600"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={siteData.primary_color}
                        onChange={(e) => setSiteData({...siteData, primary_color: e.target.value})}
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
                      onChange={(e) => setSiteData({...siteData, secondary_color: e.target.value})}
                      className="w-16 h-16 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-600"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={siteData.secondary_color}
                        onChange={(e) => setSiteData({...siteData, secondary_color: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                        placeholder="#3b82f6"
                      />
                      <p className="text-xs text-slate-500 mt-1">Cor de destaque e botões</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Seções do Site</h3>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">Exibir Seção de Parcerias</p>
                    <p className="text-sm text-slate-500">Mostra o carrossel contínuo de logomarcas na página inicial.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer hover:scale-105 transition-transform">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={siteData.show_partnerships !== false}
                      onChange={(e) => setSiteData({...siteData, show_partnerships: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {siteSubTab === 'hero' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-xl font-serif font-bold text-slate-800 dark:text-white mb-4">
                Destaque da Página Inicial
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Título Principal (Headline)
                    </label>
                    <input
                      type="text"
                      value={siteData.hero_title || ''}
                      onChange={e => setSiteData({...siteData, hero_title: e.target.value})}
                      placeholder="Ex: Encontre o imóvel dos seus sonhos"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Subtítulo Descritivo
                    </label>
                    <textarea
                      value={siteData.hero_subtitle || ''}
                      onChange={e => setSiteData({...siteData, hero_subtitle: e.target.value})}
                      placeholder="Ex: As melhores opções de casas e apartamentos na região..."
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-slate-800 dark:text-white resize-none"
                    />
                  </div>
                </div>

                <div>
                  <ImageUploader
                    label="Imagem de Fundo (Capa da Home)"
                    currentUrl={siteData.hero_image_url}
                    onUpload={(url) => setSiteData({ ...siteData, hero_image_url: url })}
                    assetType="hero"
                    companyId={user?.company_id || ''}
                    aspectRatio="aspect-video"
                  />
                </div>
              </div>
            </div>
          )}

          {siteSubTab === 'about' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-xl font-serif font-bold text-slate-800 dark:text-white mb-4">
                Página "Quem Somos"
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Título da Seção
                    </label>
                    <input
                      type="text"
                      value={siteData.about_title || ''}
                      onChange={e => setSiteData({...siteData, about_title: e.target.value})}
                      placeholder="Ex: Conheça a Nossa História"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Texto Descritivo
                    </label>
                    <textarea
                      value={siteData.about_text || ''}
                      onChange={e => setSiteData({...siteData, about_text: e.target.value})}
                      placeholder="Conte um pouco dos valores e da missão da sua imobiliária..."
                      rows={6}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-slate-800 dark:text-white resize-none"
                    />
                  </div>
                </div>

                <div>
                  <ImageUploader
                    label="Foto da Equipe ou Fachada"
                    currentUrl={siteData.about_image_url}
                    onUpload={(url) => setSiteData({ ...siteData, about_image_url: url })}
                    assetType="about"
                    companyId={user?.company_id || ''}
                    aspectRatio="aspect-square"
                  />
                </div>
              </div>
            </div>
          )}

          {siteSubTab === 'social' && (
            <div className="bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-dark-border p-6 md:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-xl font-serif font-bold text-slate-800 dark:text-white mb-2">Redes Sociais</h3>
              <p className="text-sm text-slate-500 mb-6">Cole os links completos para exibir os ícones no rodapé do site.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['instagram', 'facebook', 'linkedin', 'youtube'].map(social => (
                  <div key={social} className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 capitalize">{social}</span>
                    <input 
                      type="url" 
                      value={siteData[`social_${social}`] || ''} 
                      onChange={e => setSiteData({...siteData, [`social_${social}`]: e.target.value})} 
                      placeholder={`https://${social}.com/sua-pagina`} 
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-brand-500 text-sm" 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONSTRUTOR DE CONTRATOS */}
      {activeTab === 'contracts' && isAdmin && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">Meus Modelos de Contrato</h2>
              <p className="text-slate-500 dark:text-slate-400">Crie contratos personalizados e deixe o sistema preencher os dados do cliente automaticamente.</p>
            </div>
            <button onClick={() => setEditingTemplate({ name: '', type: 'sale', content: '' })} className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors">
              <Icons.Plus size={18} /> Novo Modelo
            </button>
          </div>

          {editingTemplate ? (
            <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-slate-200 dark:border-dark-border">
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Modelo</label>
                  <input type="text" value={editingTemplate.name} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border outline-none focus:border-brand-500" placeholder="Nome interno..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                  <select value={editingTemplate.type} onChange={e => setEditingTemplate({...editingTemplate, type: e.target.value})} className="px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border outline-none">
                    <option value="sale">Venda</option>
                    <option value="rent">Aluguel</option>
                  </select>
                </div>
              </div>
              <div className="mb-4 bg-brand-50 dark:bg-brand-500/10 p-4 rounded-xl border border-brand-100 dark:border-brand-500/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                  <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider">Variáveis Disponíveis</p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingTemplate.content || editingTemplate.content.length < 50) {
                        addToast('Cole o texto do contrato primeiro!', 'error');
                        return;
                      }
                      setIsAnalyzingContract(true);
                      addToast('A IA está a analisar o seu contrato...', 'info');
                      try {
                        const newContent = await autoTagContractTemplate(editingTemplate.content);
                        setEditingTemplate({ ...editingTemplate, content: newContent });
                        addToast('Contrato mapeado com sucesso! Revise os campos.', 'success');
                      } catch (error: any) {
                        // Agora a interface vai mostrar exatamente o motivo da falha!
                        addToast(error.message || 'Erro ao usar IA no contrato.', 'error');
                      } finally {
                        setIsAnalyzingContract(false);
                      }
                    }}
                    disabled={isAnalyzingContract}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-brand-500 hover:from-purple-600 hover:to-brand-600 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
                  >
                    {isAnalyzingContract ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Sparkles size={16} />}
                    {isAnalyzingContract ? 'Mapeando...' : 'Mapear com IA'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">Pode clicar nos botões abaixo para inserir manualmente, ou usar a IA acima para substituir nomes reais do seu documento pelas tags automaticamente.</p>
                <div className="flex flex-wrap gap-2">
                  {['{{IMOBILIARIA_NOME}}', '{{CORRETOR_NOME}}', '{{CORRETOR_CPF}}', '{{CORRETOR_CRECI}}',
                    '{{IMOVEL_TITULO}}', '{{IMOVEL_ENDERECO}}', '{{IMOVEL_MATRICULA}}',
                    '{{VALOR_NEGOCIADO}}', '{{VALOR_SINAL}}', '{{VALOR_FINANCIAMENTO}}', '{{VALOR_FGTS}}', '{{VALOR_PERMUTA}}', '{{QTD_PARCELAS}}',
                    '{{LOCATARIO_NOME}}', '{{LOCATARIO_CPF}}', '{{LOCATARIO_RG}}', '{{LOCATARIO_PROFISSAO}}', '{{LOCATARIO_ESTADO_CIVIL}}', '{{LOCATARIO_ENDERECO}}',
                    '{{LOCADOR_NOME}}', '{{LOCADOR_CPF}}', '{{LOCADOR_RG}}', '{{LOCADOR_PROFISSAO}}', '{{LOCADOR_ESTADO_CIVIL}}', '{{LOCADOR_ENDERECO}}',
                    '{{FIADOR_NOME}}', '{{FIADOR_CPF}}', '{{FIADOR_RG}}', '{{FIADOR_PROFISSAO}}', '{{FIADOR_ESTADO_CIVIL}}', '{{FIADOR_ENDERECO}}',
                    '{{DATA_ATUAL}}'].map(tag => (
                    <button key={tag} type="button" onClick={() => { navigator.clipboard.writeText(tag); addToast(`${tag} copiado!`, 'success'); }} className="px-2 py-1 bg-white dark:bg-slate-800 text-[10px] font-mono font-bold text-brand-600 rounded-lg shadow-sm border border-brand-100 hover:scale-105 transition-transform">{tag}</button>
                  ))}
                </div>
              </div>
              <div className="relative">
                {isAnalyzingContract && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10 border border-brand-200">
                    <Icons.Sparkles size={40} className="text-purple-500 animate-pulse mb-4" />
                    <p className="font-bold text-brand-800 dark:text-brand-200 text-lg animate-pulse">A IA está a ler e a etiquetar o seu contrato...</p>
                    <p className="text-sm text-slate-500">Isto pode demorar alguns segundos.</p>
                  </div>
                )}
                <textarea
                  value={editingTemplate.content}
                  onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                  className="w-full h-[500px] p-4 rounded-xl border border-slate-200 dark:border-dark-border outline-none focus:border-brand-500 font-mono text-sm leading-relaxed whitespace-pre-wrap resize-y"
                  placeholder="Cole o texto do seu contrato aqui..."
                  disabled={isAnalyzingContract}
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setEditingTemplate(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                <button onClick={async () => {
                  if (!editingTemplate.name || !editingTemplate.content) return addToast('Preencha nome e conteúdo', 'error');
                  const tenantId = (await supabase.from('profiles').select('company_id').eq('id', user?.id).single()).data?.company_id;
                  const { error } = editingTemplate.id
                    ? await supabase.from('contract_templates').update(editingTemplate).eq('id', editingTemplate.id)
                    : await supabase.from('contract_templates').insert({ ...editingTemplate, tenant_id: tenantId });
                  if (error) addToast('Erro ao salvar', 'error');
                  else {
                    addToast('Modelo salvo com sucesso!', 'success');
                    setEditingTemplate(null);
                    const { data } = await supabase.from('contract_templates').select('*');
                    if (data) setContractTemplates(data);
                  }
                }} className="px-6 py-2 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600">Salvar Modelo</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contractTemplates.map(template => (
                <div key={template.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between hover:border-brand-300 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${template.type === 'sale' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Icons.FileText size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">{template.name}</p>
                      <p className="text-xs text-slate-500 uppercase">{template.type === 'sale' ? 'Venda' : 'Aluguel'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingTemplate(template)} className="p-2 text-slate-400 hover:text-brand-500 bg-slate-50 rounded-lg"><Icons.Edit2 size={16} /></button>
                    <button onClick={async () => {
                      if (!confirm('Apagar modelo?')) return;
                      await supabase.from('contract_templates').delete().eq('id', template.id);
                      setContractTemplates(prev => prev.filter(t => t.id !== template.id));
                      addToast('Apagado!', 'success');
                    }} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg"><Icons.Trash size={16} /></button>
                  </div>
                </div>
              ))}
              {contractTemplates.length === 0 && (
                <div className="col-span-2 text-center py-12 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Icons.FileSignature size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">Nenhum modelo personalizado ainda.</p>
                  <p className="text-sm text-slate-400">Clique em "Novo Modelo" para criar o seu primeiro contrato customizado.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ABA DE INTEGRAÇÕES */}
      {activeTab === 'integrations' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Integração com Portais</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sincronize seus imóveis com o Zap Imóveis, Viva Real, OLX e outros.</p>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-dark-border p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <Icons.Code size={32} className="text-brand-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Carga XML (Padrão Zap / Viva Real)</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 max-w-2xl leading-relaxed">
                  Gere o arquivo XML contendo todos os seus imóveis ativos. O formato utilizado é o padrão universal aceito por 99% dos portais brasileiros. Você pode enviar este arquivo diretamente para o portal ou utilizar a URL de integração nativa.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleDownloadXML}
                    disabled={isGeneratingXML || properties.length === 0}
                    className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50"
                  >
                    {isGeneratingXML ? <Icons.Loader2 size={20} className="animate-spin" /> : <Icons.Download size={20} />}
                    {properties.length === 0 ? 'Nenhum imóvel ativo' : 'Baixar Arquivo XML'}
                  </button>
                  <div className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-mono text-slate-500 truncate mr-4">
                      {companySubdomain ? `https://udqychpxnbdaxlorbhyw.supabase.co/functions/v1/zap-feed?subdomain=${companySubdomain}` : 'Configure seu subdomínio primeiro'}
                    </span>
                    <button
                      onClick={() => {
                        if (companySubdomain) {
                          navigator.clipboard.writeText(`https://udqychpxnbdaxlorbhyw.supabase.co/functions/v1/zap-feed?subdomain=${companySubdomain}`);
                        }
                      }}
                      className="text-brand-600 hover:text-brand-700 font-bold text-sm shrink-0 flex items-center gap-1"
                    >
                      <Copy size={16} /> Copiar URL
                    </button>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA FINANCEIRO */}
      {activeTab === 'finance' && isAdmin && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Gateway de Pagamentos</h2>
              <p className="text-sm text-slate-500 mt-1">Configure o seu próprio banco para cobrar inquilinos sem taxas da nossa plataforma.</p>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-card rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-dark-border">
            <div className="max-w-xl space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Provedor de Pagamento</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setPaymentGateway('cora')}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                      paymentGateway === 'cora'
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 shadow-sm'
                        : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icons.CreditCard size={20} /> Banco Cora (Taxa Zero)
                  </button>
                  <button
                    onClick={() => setPaymentGateway('asaas')}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                      paymentGateway === 'asaas'
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 shadow-sm'
                        : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icons.Wallet size={20} /> Asaas
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Credencial de Produção (Client ID / API Key)</label>
                <input
                  type="password"
                  value={paymentApiKey}
                  onChange={(e) => setPaymentApiKey(e.target.value)}
                  placeholder="Cole sua credencial gerada no painel do banco..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none transition-shadow text-slate-800 dark:text-white"
                />
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Icons.Info size={12} className="shrink-0" /> O dinheiro das locações cairá diretamente na sua conta Cora. Zero taxas de intermediação do nosso sistema.
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!user?.company_id) return;
                  const { error } = await supabase
                    .from('companies')
                    .update({ payment_api_key: paymentApiKey, payment_gateway: paymentGateway })
                    .eq('id', user.company_id);
                  if (error) alert('Erro ao salvar: ' + error.message);
                  else alert('Configuração financeira salva com sucesso!');
                }}
                className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center gap-2"
              >
                <Icons.Save size={20} /> Salvar Configuração Financeira
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Plano Atual */}
      {isDetailsModalOpen && currentPlanDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="bg-brand-900 p-6 text-white relative">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                <Icons.X size={24} />
              </button>
              <span className="bg-brand-500/30 text-brand-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-brand-400/30 mb-3 inline-block">
                Seu Plano Atual
              </span>
              <h3 className="text-3xl font-serif font-bold uppercase">{currentPlanDetails.name}</h3>
              <p className="text-brand-200 text-sm mt-2">{currentPlanDetails.description}</p>
            </div>

            <div className="p-6">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">
                O que está incluído:
              </h4>
              <ul className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {currentPlanFeatureList.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <div className="bg-brand-100 dark:bg-brand-900/30 p-1 rounded-full shrink-0 mt-0.5">
                      <Icons.Check size={14} className="text-brand-600 dark:text-brand-400" />
                    </div>
                    <span className="leading-tight">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConfig;
