import React, { useEffect, useMemo, useRef, useState } from 'react';
import heic2any from 'heic2any';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import GamificationModal from '../components/GamificationModal';
import { PLANS } from '../config/plans';

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

const AdminConfig: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'team' | 'traffic' | 'subscription' | 'site'>('profile');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [distRules, setDistRules] = useState<{ enabled: boolean; types: string[] }>({ enabled: false, types: [] });
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [siteTemplate, setSiteTemplate] = useState('classic');
  const [siteDomain, setSiteDomain] = useState('');
  const [isSavingSite, setIsSavingSite] = useState(false);

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

  const fetchContract = async () => {
    setLoadingContract(true);
    const { data } = await supabase
      .from('saas_contracts')
      .select('*, companies(plan)')
      .eq('company_id', user?.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setContract(data as Contract | null);
    setLoadingContract(false);
  };

  const fetchCompanyData = async () => {
    if (!user?.company_id) return;
    
    const { data } = await supabase
      .from('companies')
      .select('template, domain')
      .eq('id', user.company_id)
      .maybeSingle();
    
    if (data) {
      setSiteTemplate(data.template || 'classic');
      setSiteDomain(data.domain || '');
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
      fetchSettings();
      fetchContract();
      fetchCompanyData();
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    setProfileForm({
      name: user?.name ?? '',
      phone: user?.phone ?? '',
      email: user?.email ?? '',
    });
  }, [user?.name, user?.phone, user?.email]);

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
      .update({ name: profileForm.name, phone: profileForm.phone })
      .eq('id', user.id);

    if (!error) {
      await refreshUser();
      if (isAdmin) await fetchProfiles();
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

  const handleReactivate = async (plan: any) => {
    setIsReactivating(true);
    try {
      const priceToPay = billingCycle === 'monthly' ? plan.priceMensal : plan.priceAnual;

      const { data, error } = await supabase.functions.invoke('reactivate-asaas-subscription', {
        body: { 
          company_id: user?.company_id,
          plan_name: plan.id,
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
    try {
      if (!user?.company_id) throw new Error("ID da empresa não encontrado.");

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
    } catch (error: any) {
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
          domain: finalDomain
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
  const currentPlanIndex = PLANS.findIndex(p => p.id === activePlanId);
  const currentPlanDetails = currentPlanIndex !== -1 ? PLANS[currentPlanIndex] : null;
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

      <div className="flex gap-6 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'profile' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
        >
          <Icons.User size={18} /> Perfil
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'security' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
        >
          <Icons.Lock size={18} /> Segurança
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('team')}
            className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'team' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            <Icons.Users size={18} /> Equipe
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('traffic')}
            className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'traffic' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            <Icons.Globe size={18} /> Tráfego
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('subscription')}
            className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'subscription' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            <Icons.CreditCard size={18} /> Assinatura
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('site')}
            className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'site' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            <Icons.Globe size={18} /> Meu Site
          </button>
        )}
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

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
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
                  onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
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
              <label className="flex items-center gap-2 mt-4 cursor-pointer bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-3 rounded-xl w-fit transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/40">
                <input
                  type="checkbox"
                  checked={acceptFidelity}
                  onChange={(e) => setAcceptFidelity(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-brand-900 dark:text-brand-100">
                  Aceito o contrato de fidelidade (12 meses) para ganhar <strong className="text-brand-600 dark:text-brand-400">20% de desconto</strong>
                </span>
              </label>
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
                            : contract.status === 'canceled'
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            contract.status === 'active'
                              ? 'bg-emerald-400'
                              : contract.status === 'canceled'
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                          }`}
                        ></span>
                        {contract.status === 'active'
                          ? 'Ativo'
                          : contract.status === 'canceled'
                            ? `Cancela em ${new Date(contract.end_date).toLocaleDateString('pt-BR')}`
                            : 'Inativo'}
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
                    {(contract?.status === 'trial' || contract?.status === 'past_due' || contract?.status === 'canceled') && (
                      <button
                        onClick={() => {
                          if (contract?.status === 'canceled') {
                            const currentPlanData = PLANS.find(p => p.id === contract.plan_name) || PLANS[0];
                            handleReactivate(currentPlanData);
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
                          onClick={() => alert('Para alterar o cartão, acesse o link enviado no seu e-mail pelo Asaas (Em breve painel integrado).')}
                          className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <Icons.CreditCard size={20} />
                          Faturas e Cartão
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {PLANS.filter((plan) => {
                    const isCurrentPlan = plan.id === activePlanId;
                    const isCurrentCycle = contract?.billing_cycle === billingCycle;
                    // SÓ esconde se for o mesmo plano E o mesmo ciclo que ele já paga
                    return !(isCurrentPlan && isCurrentCycle);
                  }).map((plan) => {
                    const planIndex = PLANS.findIndex(p => p.id === plan.id);
                    const isDowngrade = currentPlanIndex !== -1 && planIndex < currentPlanIndex;
                    
                    // Verifica se é mudança de ciclo no mesmo plano
                    const isCycleUpgrade = plan.id === activePlanId && contract?.billing_cycle === 'monthly' && billingCycle === 'yearly';
                    const isCycleDowngrade = plan.id === activePlanId && contract?.billing_cycle === 'yearly' && billingCycle === 'monthly';
                    
                    return (
                      <div
                        key={plan.id}
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
                                ? (acceptFidelity ? plan.priceMensal * 0.8 : plan.priceMensal).toFixed(2).replace('.', ',')
                                : plan.priceAnual.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-sm text-slate-500">/mês</span>
                          </div>
                          <div className="h-4 mt-1">
                            {billingCycle === 'yearly' && (
                              <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                                Faturado R$ {(plan.priceAnual * 12).toFixed(2).replace('.', ',')} / ano
                              </span>
                            )}
                          </div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-grow">
                          {plan.features.slice(0, 4).map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Icons.Check size={16} className="text-brand-500 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                          {plan.features.length > 4 && (
                            <li className="text-xs text-brand-600 font-medium pl-6">
                              + {plan.features.length - 4} outras vantagens
                            </li>
                          )}
                        </ul>
                        <button
                          onClick={() => {
                            if (contract?.status === 'canceled' || contract?.status === 'expired') {
                              handleReactivate(plan);
                            } else {
                              handleUpgrade(plan.id);
                            }
                          }}
                          disabled={isUpgrading === plan.id || isGeneratingCheckout || isReactivating}
                          className={`w-full py-2.5 rounded-xl font-bold transition-colors ${
                            isDowngrade || isCycleDowngrade
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400'
                              : 'bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 dark:text-brand-400'
                          }`}
                        >
                          {(isUpgrading === plan.id || isReactivating)
                            ? 'Processando...' 
                            : (contract?.status === 'canceled' || contract?.status === 'expired')
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
        <div className="space-y-8 animate-fade-in">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Opção Clássica */}
              <div
                onClick={() => setSiteTemplate('classic')}
                className={`cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                  siteTemplate === 'classic'
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
                <div className="p-4 bg-white dark:bg-dark-card">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-white">Classic</h4>
                    {siteTemplate === 'classic' && <Icons.CheckCircle className="text-brand-500" size={20} />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Design original, focado em alta conversão e simplicidade. Fundo claro.
                  </p>
                </div>
              </div>

              {/* Opção Luxo */}
              <div
                onClick={() => setSiteTemplate('luxury')}
                className={`cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                  siteTemplate === 'luxury'
                    ? 'border-brand-500 ring-4 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="h-40 bg-slate-900 p-4 flex flex-col items-center justify-center border-b border-slate-800">
                  <div className="w-3/4 h-8 bg-slate-800 rounded mb-4"></div>
                  <div className="w-1/2 h-10 bg-brand-600 rounded"></div>
                </div>
                <div className="p-4 bg-white dark:bg-dark-card">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-white">Luxury</h4>
                    {siteTemplate === 'luxury' && <Icons.CheckCircle className="text-brand-500" size={20} />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Design premium em tons escuros. Ideal para imóveis de alto padrão e exclusividade.
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

          {/* Botão de Salvar */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveSiteConfig}
              disabled={isSavingSite}
              className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {isSavingSite ? (
                <Icons.RefreshCw size={20} className="animate-spin" />
              ) : (
                <Icons.Save size={20} />
              )}
              {isSavingSite ? 'Salvando...' : 'Salvar Configurações do Site'}
            </button>
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
                {currentPlanDetails.features.map((feature, i) => (
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