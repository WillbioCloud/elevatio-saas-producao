import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import SignaturePad from 'react-signature-canvas';
import heic2any from 'heic2any';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { autoTagContractTemplate } from '../services/ai';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import GamificationModal from '../components/GamificationModal';
import FidelityTermsModal from '../components/FidelityTermsModal';
import BillingPortalModal from '../components/BillingPortalModal';
import { uploadCompanyAsset } from '../lib/storage';
import {
  DEFAULT_COMPANY_PERMISSIONS,
  type AppUserRole,
  type Company as BaseCompany,
  type CompanyPermissions,
  type CompanySettings,
  type FinanceConfig,
  type SiteData,
} from '../types';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Copy, Headphones, ImageOff, Loader2, Upload, X, XCircle } from 'lucide-react';
import { useProperties } from '../hooks/useProperties';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { generateZapXML } from '../utils/zapXmlGenerator';
import { useSearchParams } from 'react-router-dom';
import { getLevelInfo } from '../services/gamification';

interface Profile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_id?: string;
  role: AppUserRole;
  avatar_url?: string;
  level?: number;
  xp?: number;
  xp_points?: number;
  active: boolean;
  distribution_rules?: { enabled: boolean; types: string[] };
  last_seen?: string;
}

interface Contract {
  id: string;
  company_id?: string;
  plan_name?: string;
  plan?: string;
  plan_id?: string;
  price?: number | string;
  status: string;
  start_date: string;
  end_date: string;
  billing_cycle?: string;
  has_fidelity?: boolean;
  fidelity_end_date?: string;
  domain_status?: 'pending' | 'active' | 'expired' | null;
  domain_renewal_date?: string | null;
  companies?: { plan?: string };
}

type CheckoutCoupon = {
  code: string;
  type: 'percentage' | 'fixed' | 'free_month';
  value: number;
};

type SaasTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'construction' | 'exclusive';
  exclusive_company_id: string | null;
};

type CompanyDomainStatus = 'pending' | 'active' | 'error' | 'idle' | 'expired' | null;

interface Company extends Omit<BaseCompany, 'subdomain' | 'domain' | 'domain_secondary' | 'domain_status'> {
  subdomain: string | null;
  domain: string | null;
  domain_secondary: string | null;
  domain_status: CompanyDomainStatus;
  domain_secondary_status: CompanyDomainStatus;
}

type SitePartner = NonNullable<SiteData['partners']>[number];
type OfficialSignatureTab = 'draw' | 'type' | 'upload';
type ConfigTab = 'profile' | 'company' | 'team' | 'traffic' | 'subscription' | 'site' | 'contracts' | 'integrations' | 'finance' | 'permissions';
type SiteSubTab = 'templates' | 'identity' | 'hero' | 'about' | 'social';
type PermissionKey = keyof CompanyPermissions;
type TenantFinanceRecord = Pick<
  Company,
  'id' | 'name' | 'document' | 'subdomain' | 'site_data' | 'finance_config' | 'use_asaas' | 'default_commission' | 'broker_commission' | 'payment_api_key' | 'domain' | 'domain_secondary' | 'domain_type' | 'domain_status' | 'domain_secondary_status' | 'manual_discount_value' | 'manual_discount_type' | 'template' | 'logo_url' | 'admin_signature_url'
> & {
  finance_config?: FinanceConfig | null;
  subscription_status?: string | null;
  plan_status?: string | null;
  trial_ends_at?: string | null;
};

const CONFIG_TABS: ConfigTab[] = ['profile', 'company', 'team', 'traffic', 'subscription', 'site', 'contracts', 'integrations', 'finance', 'permissions'];
const OWNER_ONLY_CONFIG_TABS: ConfigTab[] = ['company', 'subscription', 'finance', 'permissions'];
const SITE_SUBTABS: SiteSubTab[] = ['templates', 'identity', 'hero', 'about', 'social'];
const LEGACY_CONFIG_TAB_ALIASES: Partial<Record<string, ConfigTab>> = {
  assinatura: 'subscription',
  empresa: 'company',
};

const normalizeProfileRole = (role: unknown): AppUserRole => {
  switch (role) {
    case 'owner':
    case 'manager':
    case 'admin':
    case 'atendente':
    case 'corretor':
    case 'super_admin':
      return role;
    default:
      return 'corretor';
  }
};

const getRoleLabel = (role?: AppUserRole | null) => {
  switch (role) {
    case 'owner':
      return 'Dono da Imobiliária';
    case 'manager':
      return 'Gerente de Vendas';
    case 'admin':
      return 'Administrador';
    case 'atendente':
      return 'Atendente (SDR)';
    case 'super_admin':
      return 'Super Admin';
    case 'corretor':
    default:
      return 'Corretor';
  }
};

const getRoleBadgeClassName = (role?: AppUserRole | null) => {
  switch (role) {
    case 'owner':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'manager':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'admin':
      return 'border-purple-200 bg-purple-100 text-purple-700';
    case 'atendente':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'super_admin':
      return 'border-slate-300 bg-slate-100 text-slate-700';
    case 'corretor':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
};

const PERMISSION_SECTIONS: Array<{
  title: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  items: Array<{
    key: PermissionKey;
    title: string;
    description: string;
  }>;
}> = [
  {
    title: 'Permissões de Corretores',
    icon: Icons.Users,
    items: [
      {
        key: 'brokers_can_create_properties',
        title: 'Criar Novos Imóveis',
        description: 'Permite que o corretor cadastre imóveis diretamente no sistema.',
      },
      {
        key: 'brokers_can_edit_properties',
        title: 'Editar Próprios Imóveis',
        description: 'Permite que o corretor edite fotos e dados dos imóveis que ele mesmo cadastrou.',
      },
    ],
  },
  {
    title: 'Permissões de Atendentes (SDR)',
    icon: Headphones,
    items: [
      {
        key: 'atendentes_can_assign_leads',
        title: 'Distribuir Leads',
        description: 'Permite que atendentes atribuam leads recebidos para outros corretores.',
      },
    ],
  },
];

const TYPED_CANVAS_WIDTH = 1200;
const TYPED_CANVAS_HEIGHT = 360;

const OFFICIAL_SIGNATURE_FONT_OPTIONS = [
  {
    id: 'font-dancing',
    label: 'Dancing',
    className: 'font-dancing',
    canvasFamily: '"Dancing Script", cursive',
  },
  {
    id: 'font-chilanka',
    label: 'Chilanka',
    className: 'font-chilanka',
    canvasFamily: '"Chilanka", cursive',
  },
  {
    id: 'font-grand',
    label: 'Grand',
    className: 'font-grand',
    canvasFamily: '"Grand Hotel", cursive',
  },
  {
    id: 'font-inter',
    label: 'Inter',
    className: 'font-inter',
    canvasFamily: '"Inter", sans-serif',
  },
  {
    id: 'font-satisfy',
    label: 'Satisfy',
    className: 'font-satisfy',
    canvasFamily: '"Satisfy", cursive',
  },
] as const;

const OFFICIAL_SIGNATURE_TABS: Array<{
  id: OfficialSignatureTab;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}> = [
  { id: 'draw', label: 'Desenhar', icon: Icons.PenTool },
  { id: 'type', label: 'Digitar', icon: Icons.Edit2 },
  { id: 'upload', label: 'Upload / Câmera', icon: Icons.Upload },
];

const normalizePartners = (partners: unknown): SitePartner[] => {
  if (!Array.isArray(partners)) return [];

  return partners.reduce<SitePartner[]>((acc, partner, index) => {
    if (!partner) return acc;

    if (typeof partner === 'string') {
      acc.push({
        id: `legacy-partner-${index}`,
        name: '',
        logo_url: partner,
      });
      return acc;
    }

    if (typeof partner === 'object') {
      const candidate = partner as Partial<SitePartner>;
      acc.push({
        id: candidate.id || `partner-${index}`,
        name: candidate.name || '',
        logo_url: candidate.logo_url || '',
      });
    }

    return acc;
  }, []);
};

const sanitizeNewDomainLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const sanitizeExistingDomain = (value: string) =>
  value
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/+$/, '')
    .trim();


const getDomainAnnualPrice = (domain: string) => (domain.endsWith('.com') ? 73.0 : 53.0);

const getDomainStatusMeta = (status: CompanyDomainStatus) => {
  if (status === 'active') {
    return {
      badgeLabel: 'Funcional',
      badgeClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      helperText: null,
      helperClassName: '',
      helperIcon: 'clock' as const,
    };
  }

  if (status === 'error' || status === 'expired') {
    return {
      badgeLabel: 'Atenção',
      badgeClassName: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      helperText: 'Verifique a configuração DNS',
      helperClassName: 'mt-2 flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400',
      helperIcon: 'alert' as const,
    };
  }

  if (status === 'idle' || status === null) {
    return {
      badgeLabel: 'Aguardando',
      badgeClassName: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      helperText: 'Aguardando configuração do domínio',
      helperClassName: 'mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400',
      helperIcon: 'clock' as const,
    };
  }

  return {
    badgeLabel: 'Configurando',
    badgeClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse',
    helperText: 'Aguardando propagação DNS',
    helperClassName: 'mt-2 flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400',
    helperIcon: 'clock' as const,
  };
};

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

const cropAvatarToWebp = (image: HTMLImageElement, crop: PixelCrop, outputSize = 400): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Falha no contexto do Canvas'));
      return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = outputSize;
    canvas.height = outputSize;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      outputSize,
      outputSize
    );

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Falha ao gerar WebP do avatar'));
    }, 'image/webp', 0.85);
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

const clampChannel = (value: number) => Math.max(0, Math.min(255, value));

const readFileAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Não foi possível ler a imagem selecionada.'));
    };

    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível processar a imagem enviada.'));
    image.src = src;
  });

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
  const { user, refreshUser, isOwner } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = user?.role === 'admin' || isOwner;
  const canManageOfficialSignature = user?.role === 'owner';
  const canManagePermissions = isAdmin;
  const adminCompanyId = user?.company_id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const normalizedTabParam = tabParam ? LEGACY_CONFIG_TAB_ALIASES[tabParam] ?? tabParam : null;
  const activeTab: ConfigTab =
    normalizedTabParam && CONFIG_TABS.includes(normalizedTabParam as ConfigTab)
      ? (normalizedTabParam as ConfigTab)
      : 'profile';

  const setActiveTab = (newTab: ConfigTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (OWNER_ONLY_CONFIG_TABS.includes(activeTab) && user?.role !== 'owner') {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'profile');
        return next;
      }, { replace: true });
    }
  }, [activeTab, user?.role, setSearchParams]);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<Profile | null>(null);
  const [updatingMemberRole, setUpdatingMemberRole] = useState(false);
  const { hasReachedLimit: teamLimitReached, limit: teamLimit, isUnlimited: teamUnlimited } = usePlanLimits(profiles.length, 'users');
  const [distRules, setDistRules] = useState<{ enabled: boolean; types: string[] }>({ enabled: false, types: [] });
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', creci: '' });
  const [companyForm, setCompanyForm] = useState({
    name: user?.company?.name || '',
    cnpj: '',
    contract_logo: '',
    signature_image: '',
  });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [adminSignatureUrl, setAdminSignatureUrl] = useState<string | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signTab, setSignTab] = useState<OfficialSignatureTab>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState<(typeof OFFICIAL_SIGNATURE_FONT_OPTIONS)[number]['id']>('font-dancing');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarImageToCrop, setAvatarImageToCrop] = useState<string | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<Crop>();
  const [completedAvatarCrop, setCompletedAvatarCrop] = useState<PixelCrop | null>(null);
  const [avatarCropError, setAvatarCropError] = useState('');
  const [showSignatureQrCode, setShowSignatureQrCode] = useState(false);
  const [isSignatureCameraOpen, setIsSignatureCameraOpen] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [signatureModalError, setSignatureModalError] = useState('');
  const [isXpModalOpen, setIsXpModalOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState({ route_to_central: true, central_whatsapp: '', central_user_id: '' });
  const [companyPermissions, setCompanyPermissions] = useState<CompanyPermissions>({
    ...DEFAULT_COMPANY_PERMISSIONS,
  });
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissionKey, setSavingPermissionKey] = useState<PermissionKey | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('trimoveis-sound') !== 'disabled');
  const [contract, setContract] = useState<Contract | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [isGeneratingCheckout, setIsGeneratingCheckout] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'upgrade' | 'pay'>('pay');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const isYearly = billingCycle === 'yearly';
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
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<any>(null);
  const [checkoutAddons, setCheckoutAddons] = useState({
    buyDomainBr: false,
    buyDomainCom: false
  });
  const [siteTemplate, setSiteTemplate] = useState('classic');
  const [dbTemplates, setDbTemplates] = useState<SaasTemplate[]>([]);
  const [siteDomain, setSiteDomain] = useState('');
  const [savedSiteDomain, setSavedSiteDomain] = useState('');
  const [companySubdomain, setCompanySubdomain] = useState('');
  const [companyDomainType, setCompanyDomainType] = useState<'new' | 'existing' | null>(null);
  const [companyDomainStatus, setCompanyDomainStatus] = useState<CompanyDomainStatus>(null);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [isBillingPortalOpen, setIsBillingPortalOpen] = useState(false);
  const { properties } = useProperties();
  const [isGeneratingXML, setIsGeneratingXML] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [tenant, setTenant] = useState<TenantFinanceRecord | null>(null);
  const [savingFinance, setSavingFinance] = useState(false);
  const [showAsaasModal, setShowAsaasModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [isUsageExpanded, setIsUsageExpanded] = useState(false);
  const [usageStats, setUsageStats] = useState({ users: 1, properties: 0, activeContracts: 0 });
  // Estados do Cupom no Checkout
  const [checkoutCoupon, setCheckoutCoupon] = useState('');
  const [validatedCoupon, setValidatedCoupon] = useState<CheckoutCoupon | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  // --- ESTADOS DO DOMÍNIO SECUNDÁRIO INTELIGENTE ---
  const [autoSecondaryDomain, setAutoSecondaryDomain] = useState('');
  const [isCheckingSecondary, setIsCheckingSecondary] = useState(false);
  const [isSecondaryAvailable, setIsSecondaryAvailable] = useState<boolean | null>(null);
  const [isSecondaryConfirmed, setIsSecondaryConfirmed] = useState(false);
  const isLoading = isGeneratingCheckout || isReactivating || isUpgrading !== null;
  const setIsLoading = setIsGeneratingCheckout;
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const avatarCropImageRef = useRef<HTMLImageElement | null>(null);
  const signatureUploadInputRef = useRef<HTMLInputElement | null>(null);
  const signatureVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeSignatureFont = useMemo(
    () => OFFICIAL_SIGNATURE_FONT_OPTIONS.find((option) => option.id === selectedFont) ?? OFFICIAL_SIGNATURE_FONT_OPTIONS[0],
    [selectedFont]
  );

  const signatureQrCodeUrl = useMemo(
    () =>
      typeof window !== 'undefined'
        ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(window.location.href)}`
        : '',
    []
  );

  useEffect(() => {
    setProfileAvatarUrl(user?.avatar_url || '');
  }, [user?.avatar_url]);

  const checkoutDomainInfo = useMemo(() => {
    const companyDomain = siteDomain || (companySubdomain ? `${companySubdomain}.elevatio.app` : '');
    const hasCustomDomain = companyDomain && !companyDomain.includes('elevatio');
    const normalizedPrimaryDomain = hasCustomDomain ? sanitizeExistingDomain(companyDomain) : 'seudominio.com.br';
    const primaryBaseName = sanitizeNewDomainLabel(
      normalizedPrimaryDomain.replace(/\.com\.br$|\.com$/i, '')
    ) || 'seudominio';
    const suggestedSecondaryDomain = normalizedPrimaryDomain.endsWith('.com.br')
      ? `${primaryBaseName}.com`
      : `${primaryBaseName}.com.br`;

    return {
      companyDomain,
      hasCustomDomain,
      primaryDomain: normalizedPrimaryDomain,
      suggestedSecondaryDomain,
    };
  }, [siteDomain, companySubdomain]);

  const company = useMemo(
    () => ({
      id: tenant?.id || user?.company_id || null,
      subdomain: companySubdomain || tenant?.subdomain || null,
      domain: savedSiteDomain || tenant?.domain || null,
      domain_secondary: tenant?.domain_secondary || null,
      domain_status: companyDomainStatus ?? tenant?.domain_status ?? null,
      domain_secondary_status: tenant?.domain_secondary_status ?? null,
      template: tenant?.template || null,
      admin_signature_url: tenant?.admin_signature_url || null,
    }),
    [
      tenant?.id,
      user?.company_id,
      companySubdomain,
      savedSiteDomain,
      companyDomainStatus,
      tenant?.subdomain,
      tenant?.domain,
      tenant?.domain_secondary,
      tenant?.domain_status,
      tenant?.domain_secondary_status,
      tenant?.template,
      tenant?.admin_signature_url,
    ]
  );

  useEffect(() => {
    if (!company?.id) return;

    const fetchCrmTemplates = async () => {
      const { data } = await supabase
        .from('saas_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (data) {
        const allowed = (data as SaasTemplate[]).filter((t) =>
          t.status === 'active' ||
          t.slug === company.template ||
          (t.status === 'exclusive' && t.exclusive_company_id === company.id)
        );
        setDbTemplates(allowed);
      }
    };

    fetchCrmTemplates();
  }, [company?.id, company?.template]);

  const getTemplateStyle = (slug: string) => {
    switch (slug) {
      case 'basico':
        return {
          icon: Icons.LayoutTemplate,
          color: 'text-slate-600',
          bg: 'bg-slate-100',
          bgDark: 'dark:bg-slate-900',
          colorDark: 'dark:text-slate-400',
        };
      case 'modern':
        return {
          icon: Icons.Sparkles,
          color: 'text-brand-600',
          bg: 'bg-brand-100',
          bgDark: 'dark:bg-brand-900/30',
          colorDark: 'dark:text-brand-400',
        };
      case 'luxury':
        return {
          icon: Icons.Gem,
          color: 'text-purple-600',
          bg: 'bg-purple-100',
          bgDark: 'dark:bg-purple-900/30',
          colorDark: 'dark:text-purple-400',
        };
      default:
        return {
          icon: Icons.LayoutTemplate,
          color: 'text-blue-600',
          bg: 'bg-blue-100',
          bgDark: 'dark:bg-blue-900/30',
          colorDark: 'dark:text-blue-400',
        };
    }
  };

  const primaryDomainStatusMeta = getDomainStatusMeta(company.domain_status);
  const secondaryDomainStatusMeta = getDomainStatusMeta(company.domain_secondary_status);

  useEffect(() => {
    setAcceptedFidelityTerms(false);
  }, [billingCycle]);

  useEffect(() => {
    if (!acceptFidelity) {
      setAcceptedFidelityTerms(false);
    }
  }, [acceptFidelity]);

  useEffect(() => {
    if (isCheckoutModalOpen) return;

    setCheckoutCoupon('');
    setValidatedCoupon(null);
    setValidatingCoupon(false);
    setAutoSecondaryDomain('');
    setIsCheckingSecondary(false);
    setIsSecondaryAvailable(null);
    setIsSecondaryConfirmed(false);
    setCheckoutAddons((prev) => (prev.buyDomainCom ? { ...prev, buyDomainCom: false } : prev));
  }, [isCheckoutModalOpen]);

  useEffect(() => {
    if (!isCheckoutModalOpen) return;

    const primary = sanitizeExistingDomain(tenant?.domain || siteDomain || '');

    if (!primary) {
      setAutoSecondaryDomain('');
      setIsCheckingSecondary(false);
      setIsSecondaryAvailable(null);
      setIsSecondaryConfirmed(false);
      setCheckoutAddons((prev) => (prev.buyDomainCom ? { ...prev, buyDomainCom: false } : prev));
      return;
    }

    let suggested = '';

    if (primary.endsWith('.com.br')) {
      suggested = primary.replace('.com.br', '.com');
    } else if (primary.endsWith('.com')) {
      suggested = primary.replace(/\.com$/i, '.com.br');
    } else {
      suggested = `${primary.split('.')[0]}.com.br`;
    }

    const normalizedSuggested = sanitizeExistingDomain(suggested);
    let isMounted = true;

    setAutoSecondaryDomain(normalizedSuggested);
    setIsSecondaryAvailable(null);
    setIsSecondaryConfirmed(false);
    setCheckoutAddons((prev) => (prev.buyDomainCom ? { ...prev, buyDomainCom: false } : prev));

    const checkDomain = async () => {
      setIsCheckingSecondary(true);

      try {
        const { data, error } = await supabase.functions.invoke('check-domain', {
          body: { domain: suggested }
        });

        if (error) throw error;
        if (!isMounted) return;
        setIsSecondaryAvailable(data.available);
      } catch (error) {
        console.error('Erro ao verificar domínio secundário:', error);
        if (!isMounted) return;
        setIsSecondaryAvailable(false);
      } finally {
        if (isMounted) {
          setIsCheckingSecondary(false);
        }
      }
    };

    if (normalizedSuggested) {
      checkDomain();
    }

    return () => {
      isMounted = false;
    };
  }, [isCheckoutModalOpen, tenant?.domain, siteDomain]);

  const subTabParam = searchParams.get('sub');
  const siteSubTab: SiteSubTab =
    subTabParam && SITE_SUBTABS.includes(subTabParam as SiteSubTab)
      ? (subTabParam as SiteSubTab)
      : 'templates';

  const setSiteSubTab = (newSubTab: SiteSubTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sub', newSubTab);
      return next;
    }, { replace: true });
  };
  const [siteData, setSiteData] = useState<SiteData & { hero_video_url?: string | null }>({
    logo_url: null,
    logo_alt_url: null,
    favicon_url: null,
    hero_image_url: null,
    hero_video_url: null,
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

  useEffect(() => {
    setTenant(prev => (prev ? { ...prev, site_data: siteData } : prev));
  }, [siteData]);

  const formatPlanPrice = (value: number) => value.toFixed(2).replace('.', ',');

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

  const fetchCompanyPermissions = async () => {
    if (!user?.company_id) {
      setCompanyPermissions({ ...DEFAULT_COMPANY_PERMISSIONS });
      return;
    }

    setLoadingPermissions(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('permissions')
        .eq('company_id', user.company_id)
        .maybeSingle();

      if (error) throw error;

      const settingsData = data as Pick<CompanySettings, 'permissions'> | null;
      setCompanyPermissions({
        ...DEFAULT_COMPANY_PERMISSIONS,
        ...(settingsData?.permissions ?? {}),
      });
    } catch (error) {
      console.error('Erro ao carregar permissões da empresa:', error);
      setCompanyPermissions({ ...DEFAULT_COMPANY_PERMISSIONS });
    } finally {
      setLoadingPermissions(false);
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
          company_id: user.company_id,
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
      .select(`
        id,
        name,
        document,
        logo_url,
        admin_signature_url,
        subdomain,
        domain,
        domain_secondary,
        domain_type,
        domain_status,
        domain_secondary_status,
        template,
        site_data,
        payment_api_key,
        finance_config,
        use_asaas,
        default_commission,
        broker_commission,
        manual_discount_value,
        manual_discount_type,
        plan_status,
        trial_ends_at
      `)
      .eq('id', user.company_id)
      .maybeSingle();
    
    if (data) {
      const parsedFinanceConfig =
        typeof data.finance_config === 'string'
          ? (() => {
              try {
                return JSON.parse(data.finance_config) as FinanceConfig;
              } catch {
                return null;
              }
            })()
          : ((data.finance_config as FinanceConfig | null) ?? null);

      setSiteTemplate(data.template || 'classic');
      setSiteDomain(data.domain || '');
      setSavedSiteDomain(data.domain || '');
      setCompanySubdomain(data.subdomain || '');
      setCompanyDomainType((data.domain_type as 'new' | 'existing' | null | undefined) ?? null);
      setCompanyDomainStatus((data.domain_status as CompanyDomainStatus | undefined) ?? null);
      setTenant({
        id: data.id,
        name: data.name || '',
        document: data.document || null,
        logo_url: data.logo_url || null,
        admin_signature_url: data.admin_signature_url ?? null,
        subdomain: data.subdomain || null,
        domain: data.domain || null,
        domain_secondary: data.domain_secondary || null,
        domain_type: (data.domain_type as 'new' | 'existing' | null | undefined) ?? null,
        domain_status: (data.domain_status as CompanyDomainStatus | undefined) ?? null,
        domain_secondary_status: (data.domain_secondary_status as CompanyDomainStatus | undefined) ?? null,
        template: data.template || null,
        site_data: data.site_data || undefined,
        payment_api_key: data.payment_api_key || '',
        finance_config: parsedFinanceConfig || undefined,
        use_asaas: data.use_asaas ?? parsedFinanceConfig?.use_asaas ?? false,
        default_commission: data.default_commission ?? parsedFinanceConfig?.default_commission ?? undefined,
        broker_commission: data.broker_commission ?? parsedFinanceConfig?.broker_commission ?? undefined,
        manual_discount_value: data.manual_discount_value ?? null,
        manual_discount_type: data.manual_discount_type ?? null,
        plan_status: data.plan_status ?? null,
        subscription_status: data.plan_status === 'trial' ? 'trialing' : (data.plan_status ?? null),
        trial_ends_at: data.trial_ends_at ?? null,
      });
      setCompanyForm({
        name: data.name || '',
        cnpj: data.document || '',
        contract_logo: data.logo_url || '',
        signature_image: data.admin_signature_url || '',
      });
      
      if (data.site_data) {
        setSiteData(prev => ({
          ...prev,
          ...data.site_data,
          partners: Array.isArray(data.site_data.partners)
            ? normalizePartners(data.site_data.partners)
            : prev.partners,
          contact: { ...prev.contact, ...data.site_data.contact },
          social: { ...prev.social, ...data.site_data.social },
          seo: { ...prev.seo, ...data.site_data.seo },
        }));
      }
    }
  };

  const handleSave = async () => {
    if (!user?.company_id || !tenant) return;

    setSavingFinance(true);
    try {
      const normalizedDefaultCommission =
        tenant.default_commission === undefined ||
        tenant.default_commission === null ||
        Number.isNaN(Number(tenant.default_commission))
          ? null
          : Number(tenant.default_commission);

      const normalizedBrokerCommission =
        tenant.broker_commission === undefined ||
        tenant.broker_commission === null ||
        Number.isNaN(Number(tenant.broker_commission))
          ? null
          : Number(tenant.broker_commission);

      const normalizedFinanceConfig = {
        ...(tenant.finance_config || {}),
        use_asaas: tenant.use_asaas ?? false,
        default_commission: normalizedDefaultCommission ?? undefined,
        broker_commission: normalizedBrokerCommission ?? undefined,
      };

      const { error: companyError } = await supabase
        .from('companies')
        .update({
          name: tenant.name,
          site_data: tenant.site_data,
          finance_config: normalizedFinanceConfig,
          use_asaas: tenant.use_asaas,
          default_commission: normalizedDefaultCommission,
          broker_commission: normalizedBrokerCommission,
          payment_api_key: tenant.payment_api_key?.trim() || null
        })
        .eq('id', tenant.id);

      if (companyError) throw companyError;

      setTenant((prev) =>
        prev
          ? {
              ...prev,
              site_data: siteData,
              payment_api_key: tenant.payment_api_key?.trim() || '',
              finance_config: normalizedFinanceConfig || undefined,
              use_asaas: tenant.use_asaas ?? false,
              default_commission: normalizedDefaultCommission ?? undefined,
              broker_commission: normalizedBrokerCommission ?? undefined,
            }
          : prev
      );
      addToast('Configurações financeiras salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar configurações financeiras:', error);
      addToast('Erro ao salvar configurações financeiras.', 'error');
    } finally {
      setSavingFinance(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
      fetchSettings();
      fetchCompanyPermissions();
      fetchContract();
      fetchCompanyData();
      fetchPlans();
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    setAdminSignatureUrl(tenant?.admin_signature_url ?? null);
  }, [tenant?.admin_signature_url]);

  const fetchAdminSignature = async () => {
    if (!adminCompanyId) {
      setAdminSignatureUrl(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('admin_signature_url')
        .eq('id', adminCompanyId)
        .maybeSingle();

      if (error) throw error;

      const nextSignatureUrl = data?.admin_signature_url || null;
      setAdminSignatureUrl(nextSignatureUrl);
      setCompanyForm((prev) => ({ ...prev, signature_image: nextSignatureUrl || '' }));
      setTenant((prev) => (prev ? { ...prev, admin_signature_url: nextSignatureUrl } : prev));
    } catch (error) {
      console.error('Erro ao buscar assinatura admin:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'company' && canManageOfficialSignature && adminCompanyId) {
      void fetchAdminSignature();
    }
  }, [activeTab, canManageOfficialSignature, adminCompanyId]);

  useEffect(() => {
    if (activeTab === 'company') return;

    setIsSignModalOpen(false);
    setShowSignatureQrCode(false);
    setIsSignatureCameraOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (isSignatureCameraOpen) {
      if (!navigator.mediaDevices?.getUserMedia) {
        addToast('Câmera indisponível neste navegador.', 'error');
        setIsSignatureCameraOpen(false);
        return;
      }

      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (signatureVideoRef.current) {
            signatureVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          addToast('Câmera indisponível. Use HTTPS ou faça upload de um arquivo.', 'error');
          setIsSignatureCameraOpen(false);
        });
    } else {
      const stream = signatureVideoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      if (signatureVideoRef.current) {
        signatureVideoRef.current.srcObject = null;
      }
    }
  }, [addToast, isSignatureCameraOpen]);

  useEffect(() => {
    if (activeTab !== 'subscription' || !user?.company_id) return;

    let ignore = false;

    const fetchUsageStats = async () => {
      try {
        const [profilesResult, propertiesResult, contractsResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id', { count: 'exact' })
            .eq('company_id', user.company_id),
          supabase
            .from('properties')
            .select('id', { count: 'exact' })
            .eq('company_id', user.company_id)
            .in('status', ['Disponível', 'ativo', 'active']),
          supabase
            .from('contracts')
            .select('id', { count: 'exact' })
            .eq('company_id', user.company_id)
            .eq('status', 'active'),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (propertiesResult.error) throw propertiesResult.error;
        if (contractsResult.error) throw contractsResult.error;

        if (ignore) return;

        setUsageStats({
          users: profilesResult.count ?? 1,
          properties: propertiesResult.count ?? 0,
          activeContracts: contractsResult.count ?? 0,
        });
      } catch (error) {
        console.error('Erro ao buscar uso da assinatura:', error);
      }
    };

    fetchUsageStats();

    return () => {
      ignore = true;
    };
  }, [activeTab, user?.company_id]);

  useEffect(() => {
    const fetchCompleteProfile = async () => {
      if (!user?.id) return;
      try {
        // Vai diretamente ao banco de dados buscar a "verdade absoluta" do utilizador
        const { data } = await supabase
          .from('profiles')
          .select('name, phone, creci')
          .eq('id', user.id)
          .single();

        if (data) {
          setProfileForm({
            name: data.name || user.name || '',
            phone: data.phone || user.phone || '',
            email: user.email || '',
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
        role: normalizeProfileRole(profile.role),
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

    if (targetProfile.role === 'super_admin') {
      alert('Este usuário é protegido pelo sistema.');
      return false;
    }

    if (targetProfile.role === 'owner' && user.role !== 'owner' && user.role !== 'super_admin') {
      alert('Apenas o dono da imobiliária pode gerenciar esse perfil.');
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

  const copyInviteLink = async (role: 'admin' | 'corretor') => {
    if (!user?.company_id) {
      addToast('Empresa não encontrada para gerar o convite.', 'error');
      return;
    }

    const token = btoa(JSON.stringify({ c: user.company_id, r: role }));
    const link = `${window.location.origin}/convite?token=${token}`;

    try {
      await navigator.clipboard.writeText(link);
      addToast(`Link de convite para ${role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Corretor'} copiado!`, 'success');
    } catch (clipboardError) {
      console.error('Erro ao copiar link de convite:', clipboardError);
      addToast('Não foi possível copiar o link de convite.', 'error');
    }
  };

  const updateProfileStatus = async (id: string, active: boolean) => {
    if (!canManageTeamMember(id)) return;

    const updates: Partial<Profile> = { active };

    await supabase.from('profiles').update(updates).eq('id', id);
    await fetchProfiles();
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: Profile['role']) => {
    if (!user?.id || !canManageTeamMember(memberId)) return;

    const currentMember = profiles.find((member) => member.id === memberId);
    if (!currentMember) return;

    if (memberId === user.id) {
      addToast('Você não pode alterar seu próprio cargo por aqui.', 'error');
      return;
    }

    if (currentMember.role === newRole) {
      setSelectedTeamMember(null);
      return;
    }

    if (newRole === 'owner' && user.role !== 'owner' && user.role !== 'super_admin') {
      addToast('Apenas o dono da imobiliária pode promover alguém para owner.', 'error');
      return;
    }

    setUpdatingMemberRole(true);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId);
      if (error) throw error;

      setProfiles((prev) => prev.map((member) => (member.id === memberId ? { ...member, role: newRole } : member)));
      addToast('Cargo atualizado com sucesso!', 'success');
      setSelectedTeamMember(null);
    } catch (err) {
      console.error('Erro ao atualizar o cargo do membro:', err);
      addToast('Erro ao atualizar o cargo.', 'error');
    } finally {
      setUpdatingMemberRole(false);
    }
  };

  const formatPhone = (value: string) => {
    if (!value) return '';

    const phoneNumber = value.replace(/\D/g, '');

    if (phoneNumber.length <= 2) return phoneNumber.replace(/^(\d{0,2})/, '($1');
    if (phoneNumber.length <= 7) return phoneNumber.replace(/^(\d{2})(\d{0,5})/, '($1) $2');

    return phoneNumber.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
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
        creci: profileForm.creci,
        avatar_url: profileAvatarUrl || null,
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
    const isHeic = file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic');

    if (!file.type.startsWith('image/') && !isHeic) {
      addToast('Selecione um arquivo de imagem para usar como foto de perfil.', 'error');
      e.target.value = '';
      return;
    }

    try {
      let processedFile: File | Blob = file;
      if (isHeic) {
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        processedFile = Array.isArray(converted) ? converted[0] : converted;
      }

      setAvatarCropError('');
      setAvatarCrop(undefined);
      setCompletedAvatarCrop(null);
      setAvatarImageToCrop(await readFileAsDataUrl(processedFile));
    } catch (error: any) {
      console.error('Erro ao preparar foto para recorte:', error);
      addToast(error.message || 'Nao foi possivel carregar a imagem selecionada.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const resetAvatarCropModal = () => {
    setAvatarImageToCrop(null);
    setAvatarCrop(undefined);
    setCompletedAvatarCrop(null);
    setAvatarCropError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const confirmAvatarCrop = async () => {
    if (!user?.id || !avatarCropImageRef.current || !completedAvatarCrop?.width || !completedAvatarCrop?.height) {
      setAvatarCropError('Selecione uma area da foto antes de continuar.');
      return;
    }

    setUploadingAvatar(true);
    setAvatarCropError('');

    try {
      const croppedBlob = await cropAvatarToWebp(avatarCropImageRef.current, completedAvatarCrop, 400);
      const fileName = `${user.id}-${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, {
          upsert: true,
          contentType: 'image/webp',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfileAvatarUrl(data.publicUrl);
      await refreshUser();
      if (isAdmin) await fetchProfiles();
      addToast('Foto de perfil atualizada com sucesso!', 'success');
      resetAvatarCropModal();
    } catch (error: any) {
      console.error('Erro no upload da foto:', error);
      setAvatarCropError(error.message || 'Nao foi possivel atualizar a foto.');
      addToast(error.message || 'Nao foi possivel atualizar a foto.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!user?.company_id) {
      addToast('Empresa não encontrada para salvar os dados.', 'error');
      return;
    }

    if (!companyForm.name.trim()) {
      addToast('Informe o nome da imobiliária antes de salvar.', 'error');
      return;
    }

    setSavingCompany(true);

    try {
      const payload = {
        name: companyForm.name.trim(),
        document: companyForm.cnpj.trim() || null,
        logo_url: companyForm.contract_logo || null,
        admin_signature_url: companyForm.signature_image || null,
      };

      const { error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', user.company_id);

      if (error) throw error;

      setCompanyForm((prev) => ({
        ...prev,
        name: payload.name,
        cnpj: payload.document || '',
        contract_logo: payload.logo_url || '',
        signature_image: payload.admin_signature_url || '',
      }));
      setTenant((prev) => (prev ? { ...prev, ...payload } : prev));
      await refreshUser();
      addToast('Dados da empresa atualizados com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao salvar empresa:', error);
      addToast(error.message || 'Erro ao atualizar dados da empresa.', 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleCompanyLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user?.company_id) return;
    const file = e.target.files[0];
    setIsUploadingLogo(true);
    try {
      let processedFile: File | Blob = file;
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        processedFile = Array.isArray(converted) ? converted[0] : converted;
      }

      const compressedBlob = await compressAvatar(processedFile, 700);
      const uploadFile = new File([compressedBlob], `company-logo-${Date.now()}.webp`, {
        type: 'image/webp',
      });

      const publicUrl = await uploadCompanyAsset(uploadFile, user.company_id, 'logo');
      const { error } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', user.company_id);

      if (error) throw error;

      setCompanyForm((prev) => ({ ...prev, contract_logo: publicUrl }));
      setTenant((prev) => (prev ? { ...prev, logo_url: publicUrl } : prev));
      addToast('Logo da empresa atualizada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro no upload da logo da empresa:', error);
      addToast('Erro ao carregar a logo: ' + error.message, 'error');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const resetSignatureModalState = () => {
    setSignTab('draw');
    setTypedName('');
    setSelectedFont('font-dancing');
    setUploadPreview(null);
    setCrop(undefined);
    setImageToCrop(null);
    setShowSignatureQrCode(false);
    setIsSignatureCameraOpen(false);
    setHasDrawnSignature(false);
    setSignatureModalError('');
    signaturePadRef.current?.clear();

    if (signatureUploadInputRef.current) {
      signatureUploadInputRef.current.value = '';
    }
  };

  const openSignatureModal = () => {
    resetSignatureModalState();
    setIsSignModalOpen(true);
  };

  const closeSignatureModal = () => {
    setIsSignModalOpen(false);
    resetSignatureModalState();
  };

  const clearDrawSignature = () => {
    signaturePadRef.current?.clear();
    setHasDrawnSignature(false);
  };

  const clearUploadPreview = () => {
    setUploadPreview(null);
    setCrop(undefined);
    setImageToCrop(null);

    if (signatureUploadInputRef.current) {
      signatureUploadInputRef.current.value = '';
    }
  };

  const handleUploadSelection = async (file?: File) => {
    if (!file) return;
    setSignatureModalError('');
    setSignTab('upload');
    setUploadPreview(null);
    setCrop(undefined);
    setImageToCrop(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const getCroppedImage = () => {
    if (!cropImageRef.current || !crop?.width || !crop?.height) return;
    const canvas = document.createElement('canvas');
    const scaleX = cropImageRef.current.naturalWidth / cropImageRef.current.width;
    const scaleY = cropImageRef.current.naturalHeight / cropImageRef.current.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      cropImageRef.current,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );
    setUploadPreview(canvas.toDataURL('image/png'));
    setImageToCrop(null);
    setCrop(undefined);
    setSignatureModalError('');
  };

  const captureSignaturePhoto = () => {
    if (!signatureVideoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = signatureVideoRef.current.videoWidth;
    canvas.height = signatureVideoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(signatureVideoRef.current, 0, 0);
    setUploadPreview(null);
    setCrop(undefined);
    setImageToCrop(canvas.toDataURL('image/png'));
    setSignatureModalError('');
    setSignTab('upload');
    setIsSignatureCameraOpen(false);
  };

  const generateTypedSignatureImage = async () => {
    const value = typedName.trim();

    if (!value) {
      return '';
    }

    if (document.fonts?.load) {
      try {
        await document.fonts.load(`700 72px ${activeSignatureFont.canvasFamily}`);
      } catch {
        // Segue com a fonte fallback caso a webfont ainda não tenha carregado.
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = TYPED_CANVAS_WIDTH;
    canvas.height = TYPED_CANVAS_HEIGHT;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Não foi possível renderizar a assinatura digitada.');
    }

    let fontSize = 142;
    const maxWidth = canvas.width - 140;

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#0f172a';

    while (fontSize > 72) {
      context.font = `700 ${fontSize}px ${activeSignatureFont.canvasFamily}`;

      if (context.measureText(value).width <= maxWidth) {
        break;
      }

      fontSize -= 6;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `700 ${fontSize}px ${activeSignatureFont.canvasFamily}`;
    context.fillText(value, canvas.width / 2, canvas.height / 2 + fontSize * 0.06);

    return canvas.toDataURL('image/png');
  };

  const getAdminSignatureDataUrl = async () => {
    if (signTab === 'draw') {
      if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
        return '';
      }

      return signaturePadRef.current.getCanvas().toDataURL('image/png');
    }

    if (signTab === 'type') {
      return generateTypedSignatureImage();
    }

    return uploadPreview ?? '';
  };

  const handleSaveAdminSignature = async () => {
    if (!adminCompanyId || !user?.id) {
      setSignatureModalError('Não foi possível identificar a empresa para salvar a assinatura.');
      return;
    }

    setSignatureModalError('');

    const signatureDataUrl = await getAdminSignatureDataUrl();

    if (!signatureDataUrl) {
      setSignatureModalError('Escolha ou gere uma assinatura antes de salvar.');
      return;
    }

    setIsUploadingSignature(true);

    try {
      const blob = await (await fetch(signatureDataUrl)).blob();
      const fileName = `admin_sig_${user.id}_${Date.now()}.png`;
      const filePath = `companies/${adminCompanyId}/signatures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('company-assets').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('companies')
        .update({ admin_signature_url: publicUrl })
        .eq('id', adminCompanyId);

      if (updateError) throw updateError;

      setAdminSignatureUrl(publicUrl);
      setCompanyForm((prev) => ({ ...prev, signature_image: publicUrl }));
      setTenant((prev) => (prev ? { ...prev, admin_signature_url: publicUrl } : prev));
      addToast('Assinatura oficial salva com sucesso!', 'success');
      closeSignatureModal();
    } catch (error) {
      console.error('Erro ao salvar assinatura admin:', error);
      setSignatureModalError('Ocorreu um erro ao salvar a assinatura oficial.');
      addToast('Ocorreu um erro ao salvar a assinatura oficial.', 'error');
    } finally {
      setIsUploadingSignature(false);
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

  const saveCompanyPermissions = async (
    nextPermissions: CompanyPermissions,
    permissionKey: PermissionKey
  ) => {
    if (!user?.company_id) {
      addToast('Empresa não encontrada para salvar as permissões.', 'error');
      return;
    }

    const previousPermissions = companyPermissions;
    setCompanyPermissions(nextPermissions);
    setSavingPermissionKey(permissionKey);

    try {
      const { data: currentSettings, error: fetchError } = await supabase
        .from('settings')
        .select('id')
        .eq('company_id', user.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (currentSettings?.id) {
        const { error: updateError } = await supabase
          .from('settings')
          .update({ permissions: nextPermissions })
          .eq('id', currentSettings.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('settings')
          .insert({
            company_id: user.company_id,
            permissions: nextPermissions,
          });

        if (insertError) throw insertError;
      }

      window.dispatchEvent(
        new CustomEvent('company-permissions-updated', {
          detail: {
            companyId: user.company_id,
            permissions: nextPermissions,
          },
        })
      );

      addToast('Permissão atualizada com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao salvar permissões da empresa:', error);
      setCompanyPermissions(previousPermissions);
      addToast('Não foi possível salvar essa permissão.', 'error');
    } finally {
      setSavingPermissionKey(null);
    }
  };

  const handleTogglePermission = async (permissionKey: PermissionKey) => {
    const nextPermissions: CompanyPermissions = {
      ...companyPermissions,
      [permissionKey]: !companyPermissions[permissionKey],
    };

    await saveCompanyPermissions(nextPermissions, permissionKey);
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
      console.log('Buscando link de pagamento...');

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-asaas-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ company_id: companyId })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Link não retornado pelo Asaas.');
      }

      if (!data?.checkoutUrl) {
        throw new Error(data?.error || 'Link não retornado pelo Asaas.');
      }

      console.log('Link encontrado! Redirecionando...');
      window.location.href = data.checkoutUrl;

    } catch (error: any) {
      console.error('Erro fatal ao buscar link de pagamento:', error);
      alert('Erro ao buscar pagamento: ' + (error.message || error));
    } finally {
      setIsGeneratingCheckout(false);
    }
  };

  const handleValidateCheckoutCoupon = async () => {
    if (!checkoutCoupon.trim()) return;

    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from('saas_coupons')
        .select('*')
        .eq('code', checkoutCoupon.toUpperCase())
        .eq('active', true)
        .single();

      if (error || !data) throw new Error('Cupom inválido');

      const maxUses = data.max_uses ?? data.usage_limit;
      if (typeof maxUses === 'number' && maxUses > 0 && Number(data.used_count ?? 0) >= maxUses) {
        throw new Error('Cupom esgotado');
      }

      setValidatedCoupon({
        code: data.code,
        type: (data.discount_type ?? data.type) as CheckoutCoupon['type'],
        value: Number(data.discount_value ?? data.value ?? 0),
      });
      addToast('Cupom aplicado com sucesso!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Cupom inválido ou expirado', 'error');
      setValidatedCoupon(null);
    } finally {
      setValidatingCoupon(false);
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

  const handleUpgrade = async (planParam: any) => {
    const upgradeKey = typeof planParam === 'string'
      ? planParam
      : String(planParam?.id || planParam?.name || '');
    setIsUpgrading(String(upgradeKey).toLowerCase());
    const previousContract = contract;
    try {
      if (!user?.company_id) throw new Error("ID da empresa não encontrado.");

      const plan = typeof planParam === 'string'
        ? plans.find((p) => p.id === planParam || p.name.toLowerCase() === planParam.toLowerCase())
        : planParam;
      const planId = String(plan?.id || plan?.name || upgradeKey).toLowerCase();
      const isYearly = billingCycle === 'yearly';

      if (!plan || !plan.name) throw new Error('Plano não encontrado.');

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

      // Pega a sessão atual para o Token JWT
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-asaas-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          company_id: contract?.company_id, // Certifique-se de que contract.company_id existe no escopo
          new_plan: plan.name,
          billing_cycle: isYearly ? 'yearly' : 'monthly',
          has_fidelity: isYearly ? false : acceptFidelity,
          addons: planParam.addons || { buyDomainBr: false, buyDomainCom: false },
          coupon_code: planParam.coupon_code || null,
          domain_secondary: planParam.domain_secondary || null,
          total_price: typeof planParam.total_price === 'number' ? planParam.total_price : null,
          domain_count: planParam.domain_count || 0
        })
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Erro desconhecido ao comunicar com o servidor de pagamentos.');
      }

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

  const handleTemplateChange = async (nextTemplate: string) => {
    if (!company?.id || nextTemplate === company.template) return;

    setIsUpdatingTemplate(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ template: nextTemplate })
        .eq('id', company.id);

      if (error) throw error;

      setSiteTemplate(nextTemplate);
      setTenant((prev) => (prev ? { ...prev, template: nextTemplate } : prev));
      addToast('Template atualizado com sucesso!', 'success');
    } catch (error: any) {
      addToast(`Erro ao atualizar template: ${error.message}`, 'error');
    } finally {
      setIsUpdatingTemplate(false);
    }
  };

  const handleSaveSiteConfig = async () => {
    setIsSavingSite(true);
    try {
      if (!user?.company_id) throw new Error("ID da empresa não encontrado.");

      // Limpa o domínio caso o usuário digite com http ou www
      const cleanDomain = siteDomain.replace(/^(https?:\/\/)?(www\.)?/, '').trim();
      const finalDomain = cleanDomain === '' ? null : cleanDomain;
      const previousDomain = savedSiteDomain || null;
      const domainChanged = previousDomain !== finalDomain;

      const companyUpdate: Record<string, unknown> = {
        template: siteTemplate,
        domain: finalDomain,
        site_data: siteData,
      };

      if (domainChanged) {
        companyUpdate.domain_status = finalDomain ? 'pending' : null;
        companyUpdate.domain_type = finalDomain ? (companyDomainType ?? 'existing') : null;
      }

      const { error } = await supabase
        .from('companies')
        .update(companyUpdate)
        .eq('id', user.company_id);

      if (error) throw error;

      setSiteDomain(cleanDomain);
      setSavedSiteDomain(cleanDomain);
      if (domainChanged) {
        setCompanyDomainStatus(finalDomain ? 'pending' : null);
        setCompanyDomainType(finalDomain ? (companyDomainType ?? 'existing') : null);
        setTenant((prev) =>
          prev
            ? {
                ...prev,
                domain: finalDomain,
                domain_status: finalDomain ? 'pending' : null,
                domain_type: finalDomain ? (companyDomainType ?? 'existing') : null,
              }
            : prev
        );
      }
      alert('Configurações do site salvas com sucesso!');
    } catch (error: any) {
      alert('Erro ao salvar configurações: ' + error.message);
    } finally {
      setIsSavingSite(false);
    }
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      addToast('Buscando endere\u00e7o...', 'info');
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        addToast('CEP n\u00e3o encontrado.', 'error');
        return;
      }

      setSiteData(prev => ({
        ...prev,
        address: {
          ...(prev.address || {}),
          zip: data.cep,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
        } as any
      }));
      addToast('Endere\u00e7o preenchido automaticamente!', 'success');
    } catch (error) {
      addToast('Erro ao buscar o CEP.', 'error');
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

  const currentXP = Math.max(0, Number(user?.xp_points ?? 0));
  const { currentLevel: currentLeague, nextLevel: nextLeague, progress: currentLeagueProgress } = getLevelInfo(currentXP);

  const roleLabel = useMemo(() => getRoleLabel(user?.role), [user?.role]);

  const pendingProfiles = useMemo(() => profiles.filter((profile) => !profile.active), [profiles]);
  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.active), [profiles]);
  const pointsToNextLeague = nextLeague ? Math.max(nextLeague.minXp - currentXP, 0) : 0;
  const canAssignOwnerRole = user?.role === 'owner' || user?.role === 'super_admin';
  const isSelectedTeamMemberProtected =
    selectedTeamMember?.role === 'super_admin' ||
    (selectedTeamMember?.role === 'owner' && !canAssignOwnerRole);
  const isMemberOnline = selectedTeamMember?.last_seen
    ? new Date().getTime() - new Date(selectedTeamMember.last_seen).getTime() < 5 * 60000
    : false;
  const memberLevelInfo = selectedTeamMember
    ? getLevelInfo(Number(selectedTeamMember.xp_points || 0))
    : null;

  const rawPlan = contract?.plan_name || contract?.plan || contract?.companies?.plan || '';
  const activePlanId = rawPlan.toLowerCase();
  const currentPlanIndex = plans.findIndex(
    (p) => String(p.id || '').toLowerCase() === activePlanId || String(p.name || '').toLowerCase() === activePlanId,
  );
  const currentPlanDetails = currentPlanIndex !== -1 ? plans[currentPlanIndex] : null;
  const getPlanHighlights = (plan: any) => [
    ...(billingCycle === 'yearly' && plan?.has_free_domain ? ['Domínio Grátis (1º ano)'] : []),
    ...(plan?.max_contracts > 0 ? [`Até ${plan.max_contracts} contratos ativos`] : []),
    ...(Array.isArray(plan?.features) ? plan.features : []),
  ];
  const currentPlanFeatureList = currentPlanDetails ? getPlanHighlights(currentPlanDetails) : [];
  const displayPlanName = currentPlanDetails?.name || (rawPlan ? rawPlan.toUpperCase() : 'PLANO PADRÃO');

  const getUsagePercentage = (used: number, max: number) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  };
  const usageItems = currentPlanDetails
    ? [
        { label: 'Usuários', used: usageStats.users, max: Number(currentPlanDetails.max_users ?? 0) },
        { label: 'Imóveis', used: usageStats.properties, max: Number(currentPlanDetails.max_properties ?? 0) },
        { label: 'Contratos', used: usageStats.activeContracts, max: Number(currentPlanDetails.max_contracts ?? 0) },
      ]
    : [];
  const crmModules = currentPlanDetails
    ? [
        { key: 'has_funnel', label: 'Funil de Vendas', enabled: Boolean(currentPlanDetails.has_funnel) },
        { key: 'has_pipeline', label: 'Pipeline', enabled: Boolean(currentPlanDetails.has_pipeline) },
        { key: 'has_gamification', label: 'Gamificacao', enabled: Boolean(currentPlanDetails.has_gamification) },
        { key: 'has_erp', label: 'ERP', enabled: Boolean(currentPlanDetails.has_erp) },
        { key: 'has_site', label: 'Site', enabled: Boolean(currentPlanDetails.has_site) },
        { key: 'has_portals', label: 'Portais', enabled: Boolean(currentPlanDetails.has_portals) },
        { key: 'has_api', label: 'API', enabled: Boolean(currentPlanDetails.has_api) },
      ]
    : [];

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);

    if (newValue) {
      localStorage.removeItem('trimoveis-sound');
    } else {
      localStorage.setItem('trimoveis-sound', 'disabled');
    }
  };

  const canConfirmOfficialSignature =
    !isUploadingSignature &&
    ((signTab === 'draw' && hasDrawnSignature) ||
      (signTab === 'type' && typedName.trim().length >= 3) ||
      (signTab === 'upload' && Boolean(uploadPreview)));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Configurações</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Gerencie seu perfil, empresa, segurança e equipe.</p>
      </div>

      {/* Abas Principais de Configuração (Design Premium) */}
      <div className="flex overflow-x-auto ev-main-scroll gap-2 p-1.5 bg-slate-200/50 dark:bg-[#0a0f1c]/50 backdrop-blur-md rounded-2xl w-fit border border-slate-300/50 dark:border-white/5 shadow-inner">
        {[
          { id: 'profile', label: 'Perfil', icon: Icons.User },
          { id: 'company', label: 'Minha Empresa', icon: Icons.Building2, ownerOnly: true },
          { id: 'team', label: 'Equipe', icon: Icons.Users, adminOnly: true },
          { id: 'traffic', label: 'Tráfego', icon: Icons.Globe, adminOnly: true },
          { id: 'subscription', label: 'Assinatura', icon: Icons.CreditCard, ownerOnly: true },
          { id: 'site', label: 'Meu Site', icon: Icons.Layout, adminOnly: true },
          { id: 'contracts', label: 'Modelos de Contrato', icon: Icons.FileSignature, adminOnly: true },
          { id: 'integrations', label: 'Integrações', icon: Icons.Share2, adminOnly: true },
          { id: 'finance', label: 'Financeiro / API', icon: Icons.DollarSign, ownerOnly: true },
          { id: 'permissions', label: 'Permissões', icon: Icons.Shield, ownerOnly: true },
        ].filter(tab => {
          if (tab.ownerOnly) return user?.role === 'owner';
          if (tab.id === 'permissions') return canManagePermissions;
          return !tab.adminOnly || isAdmin;
        }).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ConfigTab)}
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

      {activeTab === 'company' && user?.role === 'owner' && (
        <div className="space-y-6 animate-fade-in">
          <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-800 dark:text-white">
              <Icons.Building2 className="text-brand-600" />
              Dados da Empresa
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gerencie a identidade jurídica e a assinatura oficial usadas em contratos e faturamento.
            </p>
          </div>

          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-dark-card">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Nome da Imobiliária
                </label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Sua Imobiliária"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Este nome será usado como identificação oficial da empresa.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={companyForm.cnpj}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Logomarca para Contratos
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Recomendado PNG com fundo transparente para cabeçalhos de contratos e recibos.
                  </p>
                </div>

                <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900/60">
                  {companyForm.contract_logo ? (
                    <img
                      src={companyForm.contract_logo}
                      alt="Logo da empresa"
                      className="mb-4 max-h-20 w-auto object-contain"
                    />
                  ) : (
                    <Icons.Building2 className="mb-4 text-slate-300 dark:text-slate-600" size={36} />
                  )}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-950 dark:text-brand-300 dark:hover:bg-slate-900">
                    {isUploadingLogo ? (
                      <Icons.Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Icons.Upload size={16} />
                    )}
                    {companyForm.contract_logo ? 'Trocar Imagem' : 'Enviar Imagem'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingLogo}
                      onChange={handleCompanyLogoUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Assinatura Oficial
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    A rubrica do responsável legal será aplicada automaticamente nos contratos gerados.
                  </p>
                </div>

                <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900/60">
                  {companyForm.signature_image ? (
                    <img
                      src={companyForm.signature_image}
                      alt="Assinatura oficial"
                      className="mb-4 max-h-20 w-auto object-contain mix-blend-multiply dark:mix-blend-normal"
                    />
                  ) : (
                    <Icons.PenTool className="mb-4 text-slate-300 dark:text-slate-600" size={36} />
                  )}

                  <button
                    type="button"
                    onClick={openSignatureModal}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-950 dark:text-brand-300 dark:hover:bg-slate-900"
                  >
                    <Icons.PenTool size={16} />
                    {companyForm.signature_image ? 'Alterar Assinatura' : 'Cadastrar Assinatura'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleSaveCompany}
                disabled={savingCompany}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {savingCompany ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Save size={18} />}
                Salvar Dados da Empresa
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-200 dark:border-dark-border space-y-6">
            <div className="flex items-center gap-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-white overflow-hidden flex items-center justify-center"
                title="Clique para alterar avatar"
              >
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt="Avatar do usuário" className="w-full h-full object-cover" />
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
                {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>

            <div className="my-10 border-t border-slate-200 dark:border-slate-700/50"></div>

            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Icons.Lock size={18} className="text-brand-600" /> Segurança da Conta
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Atualize a sua senha para manter o acesso ao CRM protegido.
                </p>
              </div>

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

          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                <Icons.Award size={120} />
              </div>
              <div className="relative z-10">
                <div className="mb-2 flex items-center gap-3">
                  <Icons.Trophy className="text-yellow-400" size={24} />
                  <h3 className="text-xl font-black">Minhas Conquistas</h3>
                </div>
                <p className="mb-6 text-sm text-slate-400">Acompanhe sua evolução e suba de liga fechando negócios.</p>

                <div className="mb-4 rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-300">Liga Atual</p>
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-black shadow-sm ${currentLeague.bg} ${currentLeague.color}`}>
                        <Icons.Award size={14} />
                        {currentLeague.title}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-300">XP Acumulado</p>
                      <p className="text-2xl font-black text-white">
                        {currentXP} <span className="text-sm font-medium text-slate-400">XP</span>
                      </p>
                    </div>
                  </div>

                  {nextLeague ? (
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
                        <span>Próxima liga</span>
                        <span>{nextLeague.title}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-brand-400 transition-all duration-700" style={{ width: `${currentLeagueProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">Faltam {pointsToNextLeague} XP para chegar em {nextLeague.title}.</p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-brand-400/20 bg-brand-500/10 p-3 text-sm font-bold text-brand-100">
                      Liga máxima alcançada.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsXpModalOpen(true)}
                  className="rounded-lg bg-brand-500 px-5 py-2 font-bold text-white shadow-md transition-colors hover:bg-brand-400"
                >
                  Ver Detalhes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && isAdmin && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Equipe da Imobiliária</h2>
              {!teamUnlimited && user?.role !== 'super_admin' && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
                  <Icons.Users size={14} className={teamLimitReached ? 'text-red-500' : 'text-brand-500'} />
                  <span>Usuários: {profiles.length} / {teamLimit}</span>
                  {teamLimitReached && <span className="text-red-500 ml-1">(Limite atingido)</span>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void copyInviteLink('corretor')}
                disabled={teamLimitReached}
                className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 font-bold text-sm rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icons.Link size={16} /> Convite Corretor
              </button>
            </div>
          </div>

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
                <div key={profile.id} className="border-b border-gray-100 p-4 last:border-0 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTeamMember(profile)}
                      className="-m-2 flex flex-1 cursor-pointer rounded-2xl p-2 text-left ring-brand-500 transition-all hover:ring-2 focus:outline-none focus-visible:ring-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 dark:text-white">{profile.name || 'Sem nome'}</p>
                          {getPresenceStatus(profile.last_seen).isOnline && (
                            <span className="flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Online
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{profile.email}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRoleBadgeClassName(profile.role)}`}>
                          {getRoleLabel(profile.role)}
                        </span>
                        {!getPresenceStatus(profile.last_seen).isOnline && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                            <Icons.Clock size={10} /> {getPresenceStatus(profile.last_seen).text}
                          </p>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => updateProfileStatus(profile.id, true)} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200">Aprovar</button>
                      <button onClick={() => deleteUser(profile.id)} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200">Rejeitar</button>
                    </div>
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
                <div key={profile.id} className="border-b border-gray-100 p-4 last:border-0 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTeamMember(profile)}
                      className="-m-2 flex flex-1 cursor-pointer rounded-2xl p-2 text-left ring-brand-500 transition-all hover:ring-2 focus:outline-none focus-visible:ring-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 dark:text-white">{profile.name || 'Sem nome'}</p>
                          {getPresenceStatus(profile.last_seen).isOnline && (
                            <span className="flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Online
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{profile.email}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRoleBadgeClassName(profile.role)}`}>
                          {getRoleLabel(profile.role)}
                        </span>
                        {!getPresenceStatus(profile.last_seen).isOnline && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                            <Icons.Clock size={10} /> {getPresenceStatus(profile.last_seen).text}
                          </p>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <button onClick={() => updateProfileStatus(profile.id, false)} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-200">Pausar</button>
                      <button onClick={() => deleteUser(profile.id)} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200">Excluir</button>
                    </div>
                  </div>
                </div>
              ))}
              {activeProfiles.length === 0 && <p className="p-5 text-sm text-gray-400">Sem usuários ativos.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && user?.role === 'owner' && (
        <div className="space-y-6 animate-fade-in">
          <div className="border-b border-slate-200 pb-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-800 dark:text-white">
              <Icons.ShieldCheck className="text-brand-600" /> Controle de Permissões
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Defina o que cada cargo pode fazer dentro do sistema.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-dark-card">
            <div className="mb-6 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 dark:border-brand-900/40 dark:bg-brand-900/10">
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                Donos, gerentes e administradores operacionais sempre mantêm acesso total.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Os toggles abaixo controlam apenas as permissões dinâmicas de corretores e atendentes.
              </p>
            </div>

            {loadingPermissions ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <Loader2 size={18} className="animate-spin text-brand-600" />
                Carregando permissões da empresa...
              </div>
            ) : (
              <div className="space-y-8">
                {PERMISSION_SECTIONS.map((section) => {
                  const SectionIcon = section.icon;

                  return (
                    <div key={section.title}>
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                        <SectionIcon size={16} /> {section.title}
                      </h3>

                      <div className="space-y-4">
                        {section.items.map((permission) => {
                          const isEnabled = companyPermissions[permission.key];
                          const isSaving = savingPermissionKey === permission.key;

                          return (
                            <div
                              key={permission.key}
                              className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                            >
                              <div>
                                <p className="font-bold text-slate-800 dark:text-white">
                                  {permission.title}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                  {permission.description}
                                </p>
                              </div>

                              <div className="flex items-center gap-3">
                                {isSaving ? (
                                  <Loader2 size={16} className="animate-spin text-brand-600" />
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void handleTogglePermission(permission.key)}
                                  disabled={Boolean(savingPermissionKey)}
                                  aria-pressed={isEnabled}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${
                                    isEnabled ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'
                                  } ${savingPermissionKey ? 'cursor-not-allowed opacity-70' : ''}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                        {profiles
                          .filter((profile) =>
                            ['owner', 'manager', 'admin'].includes(profile.role)
                          )
                          .map(admin => (
                          <option key={admin.id} value={admin.id}>{admin.name} ({getRoleLabel(admin.role)})</option>
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

      {activeTab === 'subscription' && user?.role === 'owner' && (
        <div className="space-y-8 animate-fade-in">
          {tenant?.subscription_status === 'trialing' && tenant?.trial_ends_at && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-6 text-white shadow-xl shadow-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-6 border border-orange-400/50 mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                  <Icons.Timer size={28} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">
                    Seu período de teste acaba em {Math.ceil((new Date(tenant.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dias!
                  </h3>
                  <p className="text-orange-50 font-medium mt-1">
                    Assine um plano abaixo para evitar a suspensão da sua imobiliária.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                Anual (15% OFF)
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
                    Desconto Fidelidade (10% OFF)
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
              <div className="bg-gradient-to-r from-brand-600 to-brand-800 rounded-3xl p-[1px] shadow-xl shadow-brand-900/10">
                <div className="bg-white/10 backdrop-blur-md rounded-[22px] p-6 md:p-8">
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="w-full text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/15">
                        Plano Atual
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-xs font-bold ${
                          contract.status === 'active'
                            ? 'text-emerald-200'
                            : contract.status === 'pending'
                              ? 'text-blue-100'
                              : contract.status === 'canceled'
                                ? 'text-amber-200'
                                : 'text-red-200'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            contract.status === 'active'
                              ? 'bg-emerald-300'
                              : contract.status === 'pending'
                                ? 'bg-blue-200'
                                : contract.status === 'canceled'
                                  ? 'bg-amber-300'
                                  : 'bg-red-300'
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
                    <div>
                      <h2 className="text-4xl font-serif font-bold uppercase tracking-tight">Plano {displayPlanName}</h2>
                      {Number(user?.company?.manual_discount_value ?? 0) > 0 && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 w-fit">
                          <Icons.BadgeCheck size={14} className="text-emerald-400" />
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                            Desconto de {user?.company?.manual_discount_type === 'percentage'
                              ? `${Number(user.company.manual_discount_value)}%`
                              : `R$ ${Number(user.company.manual_discount_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} Ativo
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-3xl font-bold text-white">
                      {contract?.price
                        ? Number(contract.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : 'R$ 0,00'}
                      <span className="text-sm font-normal text-brand-200 ml-1">{contract?.billing_cycle === 'yearly' ? '/ano' : '/mês'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 mt-6 text-sm text-white/85">
                      <div>
                        <p className="text-brand-300 text-xs uppercase mb-0.5">Renovação em</p>
                        <p className="font-medium text-white">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="hidden h-8 w-px bg-white/20 sm:block"></div>
                      <div>
                        <p className="text-brand-300 text-xs uppercase mb-0.5">Ciclo Atual</p>
                        <p className="font-medium text-white">
                          {contract?.billing_cycle === 'yearly'
                            ? 'Anual'
                            : (contract?.has_fidelity ? 'Mensal (Com Fidelidade)' : 'Mensal')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsUsageExpanded(!isUsageExpanded)}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                    >
                      {isUsageExpanded ? 'Ocultar detalhes' : 'Ver detalhes de uso'}
                      {isUsageExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {/* Ações da Assinatura */}
                  <div className="w-full lg:w-auto flex flex-col gap-3 min-w-[240px]">
                    {(contract?.status === 'trial' || contract?.status === 'past_due' || contract?.status === 'canceled' || contract?.status === 'pending') && (
                      <button
                        onClick={() => {
                          const currentPlanObj = plans.find(p => p.name.toLowerCase() === contract?.plan_name?.toLowerCase());
                          if (currentPlanObj) {
                            setSelectedPlanForCheckout(currentPlanObj);
                            // Se o domínio está pendente, já deixa a caixinha marcada para incentivar o pagamento junto
                            setCheckoutAddons({
                              buyDomainBr: contract?.domain_status === 'pending' || contract?.domain_status == null,
                              buyDomainCom: false
                            });
                            setCheckoutCoupon('');
                            setValidatedCoupon(null);
                            setCheckoutMode('pay');
                            setIsCheckoutModalOpen(true);
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
                            : 'bg-white text-brand-700 hover:bg-brand-50 shadow-lg shadow-black/10'
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
                          onClick={() => setIsBillingPortalOpen(true)}
                          className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-white/10"
                        >
                          <Icons.CreditCard size={20} />
                          {isOpeningPortal ? 'Acessando...' : 'Faturas e Cartão'}
                        </button>

                        <button
                          onClick={() => setIsCancelModalOpen(true)}
                          className="w-full bg-transparent hover:bg-red-500/10 text-white/80 hover:text-white py-3 rounded-xl font-bold transition-colors border border-white/10"
                        >
                          Cancelar Assinatura
                        </button>
                      </>
                    )}
                  </div>
                  </div>
                  {isUsageExpanded && (
                    <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Uso atual</p>
                        <div className="mt-4 space-y-4">
                          {usageItems.map((item) => {
                            const percentage = getUsagePercentage(item.used, item.max);
                            const isBlocked = item.max === 0;
                            const isOverLimit = item.max > 0 && item.used > item.max;

                            return (
                              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-white">{item.label}</p>
                                  <span className={`text-xs font-semibold ${isBlocked ? 'text-red-200' : isOverLimit ? 'text-amber-200' : 'text-white/70'}`}>
                                    {isBlocked ? 'Bloqueado' : `${item.used} / ${item.max}`}
                                  </span>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isBlocked
                                        ? 'bg-transparent'
                                        : isOverLimit
                                          ? 'bg-amber-300'
                                          : 'bg-emerald-300'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <p className="mt-2 text-xs text-white/60">
                                  {isBlocked
                                    ? 'Recurso indisponivel no plano atual.'
                                    : isOverLimit
                                      ? 'Uso acima do limite contratado.'
                                      : `${percentage}% da capacidade em uso.`}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Ferramentas do CRM</p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {crmModules.map((module) => (
                            <div
                              key={module.key}
                              className={`rounded-2xl border p-3 ${
                                module.enabled
                                  ? 'border-emerald-300/20 bg-emerald-400/10'
                                  : 'border-white/10 bg-white/5'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {module.enabled ? (
                                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                                ) : (
                                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-200/80" />
                                )}
                                <span className={`text-xs font-medium leading-relaxed ${module.enabled ? 'text-emerald-50' : 'text-white/70'}`}>
                                  {module.label}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
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
                  {plans.map((plan) => {
                    // Só esconde se for o mesmo plano e o mesmo ciclo que ele já paga
                    const planId = String(plan.id || plan.name || '').toLowerCase();
                    const isYearly = billingCycle === 'yearly';
                    const isCurrentPlan =
                      contract?.plan_name?.toLowerCase() === plan.name.toLowerCase() &&
                      contract?.billing_cycle === (isYearly ? 'yearly' : 'monthly') &&
                      (isYearly ? true : !!contract?.has_fidelity === acceptFidelity);
                    const planIndex = plans.findIndex((p) => String(p.id || p.name || '').toLowerCase() === planId);
                    const isDowngrade = currentPlanIndex !== -1 && planIndex < currentPlanIndex;
                    const planFeatureList = getPlanHighlights(plan);
                    
                    // Verifica se é mudança de ciclo no mesmo plano
                    const isCycleUpgrade = planId === activePlanId && contract?.billing_cycle === 'monthly' && billingCycle === 'yearly';
                    const isCycleDowngrade = planId === activePlanId && contract?.billing_cycle === 'yearly' && billingCycle === 'monthly';
                    const isReactivationFlow = contract?.status === 'canceled' || contract?.status === 'expired';
                    const monthlyPrice = Number(plan.price || 0);
                    const yearlyPrice = monthlyPrice * 0.85;
                    const fidelityPrice = monthlyPrice * 0.90;
                    const displayPrice = isYearly ? yearlyPrice : (acceptFidelity ? fidelityPrice : monthlyPrice);
                    const yearlyTotalPrice = monthlyPrice * 12 * 0.85;
                    const hasDiscount = displayPrice < monthlyPrice;
                    const isPopularPlan = planId.includes('premium') || String(plan.name || '').toLowerCase().includes('premium');
                    
                    return (
                      <div
                        key={plan.id || plan.name}
                        className={`relative flex flex-col h-full bg-white/60 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${
                          isPopularPlan
                            ? 'md:scale-105 border-brand-400/80 dark:border-brand-400/50 ring-2 ring-brand-500/20 shadow-brand-500/20'
                            : ''
                        } ${
                          isCurrentPlan
                            ? 'border-brand-300 dark:border-brand-500 ring-2 ring-brand-500 bg-brand-50/40 dark:bg-brand-900/20'
                            : 'hover:border-brand-300 dark:hover:border-brand-700'
                        }`}
                      >
                        {isPopularPlan && (
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-brand-500/30">
                            Mais escolhido
                          </div>
                        )}
                        {isCurrentPlan && (
                          <div className="mb-4">
                            <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-700 dark:border-brand-500/20 dark:text-brand-300">
                              ⭐ Seu Plano
                            </span>
                          </div>
                        )}
                        <div className="mb-4">
                          <h5 className="text-xl font-bold text-slate-800 dark:text-white uppercase">{plan.name}</h5>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{plan.description}</p>
                        </div>
                        <div className="mb-6 flex flex-col">
                          <div className="h-5">
                            {hasDiscount && (
                              <span className="text-sm text-slate-500">
                                De <span className="line-through">R$ {formatPlanPrice(monthlyPrice)}</span> por
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">
                              R$ {formatPlanPrice(displayPrice)}
                            </span>
                            <span className="text-sm text-slate-500">/mês</span>
                          </div>
                          <div className="h-4 mt-1">
                            {billingCycle === 'yearly' && (
                              <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                                Faturado R$ {formatPlanPrice(yearlyTotalPrice)} / ano
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
                        {isCurrentPlan ? (
                          <button
                            disabled
                            className="w-full py-3 rounded-xl font-bold border-2 border-brand-500 text-brand-600 dark:text-brand-400 opacity-70 flex items-center justify-center gap-2"
                          >
                            <Icons.Check size={20} /> Plano Atual
                          </button>
                        ) : (acceptFidelity && contract?.plan_name?.toLowerCase() === plan.name.toLowerCase() && !contract?.has_fidelity) ? (
                          <button
                            onClick={() => handleUpgrade(plan)}
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                             Ativar Fidelidade
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpgrade(plan)}
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            {isLoading ? <Icons.Loader2 className="animate-spin" /> : null}
                            Atualizar Plano
                          </button>
                        )}
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

      {avatarImageToCrop && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Recortar foto de perfil</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">A imagem final será salva em WebP com 400x400 pixels.</p>
              </div>
              <button
                type="button"
                onClick={resetAvatarCropModal}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Fechar recorte de avatar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <ReactCrop
                  crop={avatarCrop}
                  onChange={(nextCrop) => setAvatarCrop(nextCrop)}
                  onComplete={(nextCrop) => setCompletedAvatarCrop(nextCrop)}
                  aspect={1}
                  circularCrop
                  keepSelection
                  className="max-h-[420px]"
                >
                  <img
                    ref={avatarCropImageRef}
                    src={avatarImageToCrop}
                    alt="Recortar avatar"
                    className="max-h-[420px] w-auto object-contain"
                    onLoad={(event) => {
                      const { width, height } = event.currentTarget;
                      const size = Math.min(width, height) * 0.85;
                      const nextCrop: PixelCrop = {
                        unit: 'px',
                        x: (width - size) / 2,
                        y: (height - size) / 2,
                        width: size,
                        height: size,
                      };
                      setAvatarCrop(nextCrop);
                      setCompletedAvatarCrop(nextCrop);
                    }}
                  />
                </ReactCrop>
              </div>

              {avatarCropError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
                  {avatarCropError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={resetAvatarCropModal}
                disabled={uploadingAvatar}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAvatarCrop}
                disabled={uploadingAvatar}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-black text-white shadow-md transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {uploadingAvatar ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Upload size={16} />}
                {uploadingAvatar ? 'Enviando...' : 'Salvar Foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VERTICAL DE EDIÇÃO DE MEMBRO DA EQUIPE (Figma Inspired) */}
      {selectedTeamMember && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto">

          {/* Main Wrapper (Gradient Background) */}
          <div className="w-full max-w-[409px] bg-gradient-to-b from-[#DFE3FF] to-[#E7EEF9] dark:from-slate-800 dark:to-slate-900 rounded-[40px] shadow-2xl relative p-4 flex flex-col gap-4 my-8">

            <button
              onClick={() => setSelectedTeamMember(null)}
              className="absolute top-6 right-6 z-20 bg-white/50 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-700 p-2 rounded-full transition-colors text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <Icons.X size={20} />
            </button>

            {/* BLOCK 1: Perfil e Cargo (F5F5F5) */}
            <div className="bg-[#F5F5F5] dark:bg-slate-800 rounded-[30px] p-6 pt-10 flex flex-col items-center text-center shadow-sm relative mt-2">
              <div className="relative">
                <img
                  src={selectedTeamMember.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTeamMember.name)}&background=C89B9B&color=fff&size=240`}
                  alt="Avatar"
                  className="w-[120px] h-[120px] rounded-full object-cover shadow-md border-4 border-white dark:border-slate-700"
                />
                <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-[#F5F5F5] dark:border-slate-800 ${isMemberOnline ? 'bg-[#84E078]' : 'bg-slate-400'}`}></div>
              </div>

              <h3 className="text-[18px] font-bold text-slate-900 dark:text-white mt-4 tracking-tight">{selectedTeamMember.name}</h3>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">{selectedTeamMember.email}</p>

              <div className="flex items-center gap-2 bg-[#CFD9F3] dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-300 px-3 py-1.5 rounded-lg mt-3">
                <div className={`w-2 h-2 rounded-full ${isMemberOnline ? 'bg-[#84E078] animate-pulse' : 'bg-slate-400'}`}></div>
                <span className="text-[13px] font-semibold">{isMemberOnline ? 'Online agora' : 'Offline'}</span>
              </div>

              {!isMemberOnline && selectedTeamMember.last_seen && (
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  Visto: {new Date(selectedTeamMember.last_seen).toLocaleString('pt-BR')}
                </p>
              )}

              <div className="w-full mt-6 text-left border-t border-slate-200 dark:border-slate-700 pt-5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Nível de Acesso (Cargo)</label>
                <select
                  value={selectedTeamMember.role || 'corretor'}
                  onChange={(e) => handleUpdateMemberRole(selectedTeamMember.id, e.target.value as Profile['role'])}
                  disabled={updatingMemberRole || selectedTeamMember.id === user?.id || isSelectedTeamMemberProtected}
                  className="w-full rounded-2xl border-0 bg-[#D9D9D9]/40 dark:bg-slate-900 px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#4759CD] transition-all disabled:opacity-50 appearance-none cursor-pointer"
                >
                  {selectedTeamMember.role === 'super_admin' && (
                    <option value="super_admin">Super Admin (protegido)</option>
                  )}
                  <option value="corretor">Corretor de Imóveis</option>
                  <option value="atendente">Atendente / SDR</option>
                  <option value="manager">Gerente de Vendas</option>
                  <option value="admin">Administrador Operacional</option>
                  <option value="owner" disabled={!canAssignOwnerRole}>Dono (Acesso Total)</option>
                </select>
              </div>
            </div>

            {/* BLOCK 2: Gamificação (Gradient Dark Blue) */}
            <div className="bg-gradient-to-r from-[#4759CD] to-[#A9B2E8] rounded-[30px] p-6 text-white shadow-md flex items-center justify-between relative overflow-hidden">
              <div className="absolute right-[-20px] top-[-20px] opacity-20">
                <Icons.Trophy size={140} />
              </div>
              <div className="relative z-10">
                <p className="text-[11px] uppercase tracking-widest font-bold text-indigo-100 opacity-90 mb-1">Status de Gamificação</p>
                <h4 className="text-2xl font-black">{memberLevelInfo?.currentLevel.title || 'Iniciante'}</h4>
                <p className="text-sm text-indigo-50 font-medium mt-1">
                  Nível {memberLevelInfo?.currentLevel.level || 1} • {selectedTeamMember.xp_points || 0} XP
                </p>
              </div>
              <div className="relative z-10 w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                <Icons.Award size={24} className="text-white" />
              </div>
            </div>

            {/* BLOCK 3: CRM Stats (White) */}
            <div className="bg-white dark:bg-slate-800 rounded-[30px] p-6 shadow-sm">
              <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-4">Métricas de CRM (Este Mês)</p>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3 text-center border border-blue-100 dark:border-blue-800/50">
                  <div className="flex justify-center mb-1"><Icons.MessageCircle size={16} className="text-blue-500" /></div>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-400">12</p>
                  <p className="text-[10px] font-bold text-blue-500 uppercase mt-1">Em Fila</p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 text-center border border-emerald-100 dark:border-emerald-800/50">
                  <div className="flex justify-center mb-1"><Icons.Trophy size={16} className="text-emerald-500" /></div>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">4</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1">Ganhos</p>
                </div>

                <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 text-center border border-rose-100 dark:border-rose-800/50">
                  <div className="flex justify-center mb-1"><Icons.XCircle size={16} className="text-rose-400" /></div>
                  <p className="text-xl font-black text-rose-700 dark:text-rose-400">2</p>
                  <p className="text-[10px] font-bold text-rose-400 uppercase mt-1">Perdidos</p>
                </div>
              </div>
            </div>

          </div>
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
        companyName={companyForm.name || user?.company?.name || user?.user_metadata?.company_name || 'Empresa não informada'}
        ownerName={user?.user_metadata?.full_name || user?.name || 'Responsável não informado'}
        document={companyForm.cnpj || user?.company?.document || 'Documento não informado'}
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
                onClick={() => setSiteSubTab(tab.id as SiteSubTab)}
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {dbTemplates.map((t) => {
                const style = getTemplateStyle(t.slug);
                const Icon = style.icon;
                const isActive = company?.template === t.slug;
                const isExclusive = t.status === 'exclusive';

                return (
                  <div
                    key={t.slug}
                    className={`relative rounded-2xl border-2 p-5 transition-all ${
                      isActive
                        ? 'border-brand-600 bg-brand-50/50 dark:border-brand-500 dark:bg-brand-900/10'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-brand-200 dark:hover:border-brand-800'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-4 right-4 text-brand-600 dark:text-brand-400">
                        <CheckCircle2 size={24} className="fill-brand-100 dark:fill-brand-900/50" />
                      </div>
                    )}

                    {isExclusive && (
                      <div className={`absolute top-4 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-600 ${isActive ? 'left-4' : 'right-4'} flex items-center gap-1`}>
                        <Icons.Lock size={10} /> VIP
                      </div>
                    )}

                    <div className={`mb-4 w-fit rounded-xl ${style.bg} ${style.bgDark} p-3 ${style.color} ${style.colorDark}`}>
                      <Icon size={24} />
                    </div>

                    <h4 className="mb-1 text-lg font-bold text-slate-800 dark:text-white">{t.name}</h4>
                    <p className="mb-6 min-h-[40px] text-sm text-slate-500 dark:text-slate-400">
                      {t.description}
                    </p>

                    <button
                      onClick={() => handleTemplateChange(t.slug)}
                      disabled={isActive || isUpdatingTemplate}
                      className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all ${
                        isActive
                          ? 'cursor-default bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                          : 'bg-slate-100 text-slate-700 hover:bg-brand-600 hover:text-white dark:bg-white/5 dark:text-slate-300 dark:hover:bg-brand-600 dark:hover:text-white'
                      }`}
                    >
                      {isActive ? 'Template Atual' : 'Usar este Template'}
                    </button>
                  </div>
                );
              })}
            </div>
            {false && (
              <>
                <div>
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
              </>
            )}
          </div>

          {/* SEÇÃO 2: Domínio Customizado */}
          <div className="mt-10 border-t border-slate-200 dark:border-white/10 pt-10">
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-800 dark:text-white">
                <Icons.Globe size={20} className="text-brand-600" />
                Domínios & Endereços Web
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Gerencie os endereços oficiais onde seus clientes acessam seu site.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Subdomínio Grátis</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Ativo
                  </span>
                </div>
                <p className="break-all text-sm font-bold text-slate-700 dark:text-slate-200">
                  {(company.subdomain || 'seu-subdominio')}.elevatiovendas.com.br
                </p>
              </div>

              {company.domain && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Domínio Principal</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${primaryDomainStatusMeta.badgeClassName}`}>
                      {primaryDomainStatusMeta.badgeLabel}
                    </span>
                  </div>
                  <p className="break-all text-sm font-black text-brand-600 dark:text-brand-400">
                    {company.domain}
                  </p>
                  {primaryDomainStatusMeta.helperText && (
                    <p className={primaryDomainStatusMeta.helperClassName}>
                      {primaryDomainStatusMeta.helperIcon === 'alert' ? <Icons.AlertTriangle size={10} /> : <Icons.Clock size={10} />}
                      {primaryDomainStatusMeta.helperText}
                    </p>
                  )}
                </div>
              )}

              {company.domain_secondary && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Domínio Secundário</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${secondaryDomainStatusMeta.badgeClassName}`}>
                      {secondaryDomainStatusMeta.badgeLabel}
                    </span>
                  </div>
                  <p className="break-all text-sm font-black text-brand-600 dark:text-brand-400">
                    {company.domain_secondary}
                  </p>
                  {secondaryDomainStatusMeta.helperText && (
                    <p className={secondaryDomainStatusMeta.helperClassName}>
                      {secondaryDomainStatusMeta.helperIcon === 'alert' ? <Icons.AlertTriangle size={10} /> : <Icons.Clock size={10} />}
                      {secondaryDomainStatusMeta.helperText}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!company.domain && (
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-900/20 dark:bg-brand-900/10">
                <p className="text-xs font-medium text-brand-700 dark:text-brand-400">
                  Você ainda não utiliza um domínio próprio (ex: www.suaimobiliaria.com.br).
                </p>
                <button className="text-xs font-bold text-brand-600 underline">
                  Contratar agora
                </button>
              </div>
            )}
          </div>
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Icons.PenTool size={16} className="text-brand-600" /> Assinatura do Responsável
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Esta assinatura será anexada automaticamente ao final dos contratos gerados em PDF.
                  </p>
                </div>

                <div className="mt-5 flex items-start gap-6">
                  <div className="flex h-24 w-48 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
                    {company?.admin_signature_url ? (
                      <img
                        src={company.admin_signature_url}
                        alt="Assinatura"
                        className="max-h-full max-w-full object-contain p-2"
                      />
                    ) : (
                      <div className="p-4 text-center">
                        <ImageOff size={24} className="mx-auto mb-2 text-slate-300" />
                        <span className="text-xs font-medium text-slate-400">Fundo Transparente (PNG)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      A assinatura oficial agora é centralizada na aba <span className="font-bold text-slate-700 dark:text-slate-200">Minha Empresa</span>, com fluxo completo para desenhar, digitar ou enviar a rubrica.
                    </p>
                    {user?.role === 'owner' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('company');
                          openSignatureModal();
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        <Icons.PenTool size={16} />
                        Gerenciar em Minha Empresa
                      </button>
                    ) : (
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Apenas o dono da imobiliária pode alterar essa assinatura.
                      </p>
                    )}
                  </div>
                </div>
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
                <div className="flex flex-col gap-6">
                  {/* Toggle Parcerias */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Exibir Seção de Parcerias</p>
                      <p className="text-sm text-slate-500">Mostra o carrossel contínuo de logomarcas (Construtoras, Bancos, etc) no final da página inicial.</p>
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

                  {/* Gerenciador de Parceiros */}
                  {siteData.show_partnerships !== false && (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-white dark:bg-dark-card">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white">Gerenciar Parceiros</h4>
                          <p className="text-xs text-slate-500">Adicione as empresas parceiras da sua imobiliária.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newPartner = { id: Date.now().toString(), name: '', logo_url: '' };
                            setSiteData(prev => ({ ...prev, partners: [...(prev.partners || []), newPartner] }));
                          }}
                          className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2"
                        >
                          <Icons.Plus size={16} /> Adicionar
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(!siteData.partners || siteData.partners.length === 0) ? (
                          <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                            <p className="text-sm text-slate-500">Nenhum parceiro cadastrado ainda.</p>
                          </div>
                        ) : (
                          siteData.partners.map((partner) => (
                            <div key={partner.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                              {/* Preview da Logo */}
                              <div className="w-16 h-16 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative group shrink-0">
                                {partner.logo_url ? (
                                  <img src={partner.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                                ) : (
                                  <Icons.Image size={20} className="text-slate-400" />
                                )}
                                <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                  <Icons.Upload size={16} className="text-white" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file || !user?.company_id) return;
                                      try {
                                        addToast('Enviando logo...', 'info');
                                        const url = await uploadCompanyAsset(file, user.company_id, 'logo_alt');
                                        setSiteData(prev => ({
                                          ...prev,
                                          partners: (prev.partners || []).map(p => p.id === partner.id ? { ...p, logo_url: url } : p)
                                        }));
                                        addToast('Logo carregada com sucesso!', 'success');
                                      } catch (err) {
                                        addToast('Erro ao carregar logo.', 'error');
                                      }
                                    }}
                                  />
                                </label>
                              </div>

                              {/* Nome do Parceiro */}
                              <div className="flex-1">
                                <input
                                  type="text"
                                  placeholder="Nome da Empresa (ex: Caixa, Cyrela...)"
                                  value={partner.name}
                                  onChange={(e) => {
                                    setSiteData(prev => ({
                                      ...prev,
                                      partners: (prev.partners || []).map(p => p.id === partner.id ? { ...p, name: e.target.value } : p)
                                    }));
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                                />
                              </div>

                              {/* Remover */}
                              <button
                                onClick={() => {
                                  setSiteData(prev => ({
                                    ...prev,
                                    partners: (prev.partners || []).filter(p => p.id !== partner.id)
                                  }));
                                }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                                title="Remover parceiro"
                              >
                                <Icons.Trash size={18} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
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

                <div className="space-y-6">
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

                  <div className="pt-6 border-t border-slate-200 dark:border-white/10">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center justify-between">
                      <span>Vídeo de Fundo <span className="text-[10px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full ml-2 font-bold uppercase tracking-wider">Modern / Luxury</span></span>
                    </label>
                    <p className="text-xs text-slate-500 mb-4">
                      Selecione um vídeo cinematográfico para o topo do site. Ao selecionar, o vídeo sobrepõe a imagem estática. Passe o mouse para pré-visualizar.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: '', label: 'Sem Vídeo (Usar Imagem)' },
                        { id: 'https://res.cloudinary.com/dxplpg36m/video/upload/v1774895674/V%C3%ADdeo_Imobili%C3%A1rio_Cinematogr%C3%A1fico_de_Im%C3%B3vel_Planejado_xjaxsv.mp4', label: 'Imóvel Planejado' },
                        { id: 'https://res.cloudinary.com/dxplpg36m/video/upload/v1770259664/Cria%C3%A7%C3%A3o_de_V%C3%ADdeo_Imobili%C3%A1rio_de_Luxo_cfgwew.mp4', label: 'Casa de Luxo' },
                        { id: 'https://res.cloudinary.com/dxplpg36m/video/upload/v1774913646/Novo_V%C3%ADdeo_Gerado_m3dn31.mp4', label: 'Fachada Moderna' },
                        { id: 'https://res.cloudinary.com/dxplpg36m/video/upload/v1774913646/V%C3%ADdeo_em_Apartamento_Gerado_pxwkhl.mp4', label: 'Apartamento' }
                      ].map((video) => {
                        const isSelected = siteData.hero_video_url === video.id || (!video.id && !siteData.hero_video_url);
                        return (
                          <div
                            key={video.label}
                            onClick={() => setSiteData({ ...siteData, hero_video_url: video.id })}
                            className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all relative group ${
                              isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                            }`}
                          >
                            {video.id ? (
                              <div className="aspect-video bg-black relative">
                                <video
                                  src={video.id}
                                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                  muted
                                  loop
                                  playsInline
                                  onMouseEnter={(e) => e.currentTarget.play()}
                                  onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                />
                                {isSelected && (
                                  <div className="absolute top-2 right-2 bg-brand-500 text-white rounded-full p-1 shadow-md">
                                    <Check size={12} />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                                <ImageOff size={24} className="text-slate-400" />
                                {isSelected && (
                                  <div className="absolute top-2 right-2 bg-brand-500 text-white rounded-full p-1 shadow-md">
                                    <Check size={12} />
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="p-2 bg-white dark:bg-dark-card text-center border-t border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{video.label}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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

                  {/* Dados Jurídicos e Qualificação */}
                  <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Dados Jurídicos e Contato</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Razão Social */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Razão Social</label>
                        <input
                          type="text"
                          value={siteData.corporate_name || ''}
                          onChange={(e) => setSiteData({ ...siteData, corporate_name: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                          placeholder="Ex: TR Imóveis Ltda"
                        />
                      </div>
                      {/* CNPJ */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNPJ</label>
                        <input
                          type="text"
                          value={siteData.cnpj || ''}
                          onChange={(e) => setSiteData({ ...siteData, cnpj: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                          placeholder="00.000.000/0001-00"
                        />
                      </div>
                      {/* CRECI */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CRECI</label>
                        <input
                          type="text"
                          value={siteData.creci || ''}
                          onChange={(e) => setSiteData({ ...siteData, creci: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                          placeholder="Ex: 12345-J"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* E-mail Principal */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail Principal</label>
                        <input
                          type="email"
                          value={siteData.contact_email || ''}
                          onChange={(e) => setSiteData({ ...siteData, contact_email: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                          placeholder="contato@suaimobiliaria.com.br"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone/WhatsApp Central</label>
                        <input
                          type="text"
                          value={siteData.contact_phone || ''}
                          onChange={(e) => setSiteData({ ...siteData, contact_phone: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-6 mb-3">Endereço da Sede</h4>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* CEP */}
                      <div className="col-span-1 md:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CEP</label>
                        <input
                          type="text"
                          value={siteData.address?.zip || ''}
                          onChange={(e) => setSiteData({ ...siteData, address: { ...siteData.address, zip: e.target.value } as any })}
                          onBlur={handleCepBlur}
                          maxLength={9}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none transition-colors"
                          placeholder="00000-000"
                        />
                      </div>

                      {/* Logradouro */}
                      <div className="col-span-1 md:col-span-7">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logradouro (Rua, Av)</label>
                        <input
                          type="text"
                          value={siteData.address?.street || ''}
                          onChange={(e) => setSiteData({ ...siteData, address: { ...siteData.address, street: e.target.value } as any })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                        />
                      </div>
                      {/* Número */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número</label>
                        <input
                          type="text"
                          value={siteData.address?.number || ''}
                          onChange={(e) => setSiteData({ ...siteData, address: { ...siteData.address, number: e.target.value } as any })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                        />
                      </div>
                      {/* Bairro */}
                      <div className="col-span-1 md:col-span-5">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bairro</label>
                        <input
                          type="text"
                          value={siteData.address?.neighborhood || ''}
                          onChange={(e) => setSiteData({ ...siteData, address: { ...siteData.address, neighborhood: e.target.value } as any })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                        />
                      </div>
                      {/* Cidade */}
                      <div className="col-span-1 md:col-span-5">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
                        <input
                          type="text"
                          value={siteData.address?.city || ''}
                          onChange={(e) => setSiteData({ ...siteData, address: { ...siteData.address, city: e.target.value } as any })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
                        />
                      </div>
                      {/* Estado */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UF</label>
                        <input
                          type="text"
                          value={siteData.address?.state || ''}
                          onChange={(e) => setSiteData({ ...siteData, address: { ...siteData.address, state: e.target.value } as any })}
                          maxLength={2}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm uppercase"
                        />
                      </div>
                    </div>
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
                  {['{{IMOBILIARIA_NOME}}', '{{IMOBILIARIA_CNPJ}}', '{{IMOBILIARIA_ENDERECO}}', '{{CORRETOR_NOME}}', '{{CORRETOR_CRECI}}', '{{IMOBILIARIA_ASSINATURA}}',
                    '{{CLIENTE_NOME}}', '{{CLIENTE_CPF}}', '{{CLIENTE_RG}}', '{{CLIENTE_NACIONALIDADE}}', '{{CLIENTE_PROFISSAO}}', '{{CLIENTE_ESTADO_CIVIL}}', '{{CLIENTE_ENDERECO}}',
                    '{{PROPRIETARIO_NOME}}', '{{PROPRIETARIO_CPF}}', '{{PROPRIETARIO_RG}}', '{{PROPRIETARIO_ESTADO_CIVIL}}', '{{PROPRIETARIO_ENDERECO}}',
                    '{{IMOVEL_ENDERECO}}', '{{IMOVEL_MATRICULA}}', '{{VALOR_TOTAL}}', '{{VALOR_TOTAL_EXTENSO}}', '{{DATA_VENCIMENTO}}', '{{PRAZO_MESES}}', '{{DATA_ATUAL}}'].map(tag => (
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
      {activeTab === 'finance' && user?.role === 'owner' && (
        <div className="space-y-6">
          
          {/* Chave Mestra: Pix Nativo vs Asaas */}
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">Modo de Recebimento</h3>
              <p className="text-sm text-slate-500">Escolha entre receber via Pix sem taxas ou usar o gateway avançado Asaas.</p>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setTenant(prev => prev ? { ...prev, use_asaas: false, finance_config: { ...prev.finance_config, use_asaas: false } } : prev)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  !tenant?.use_asaas 
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Pix Nativo
              </button>
              <button
                onClick={() => {
                  if (!tenant?.use_asaas) {
                    setTempApiKey(tenant?.payment_api_key || '');
                    setShowAsaasModal(true);
                  }
                }}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  tenant?.use_asaas 
                    ? 'bg-brand-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Gateway Asaas
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            
            {/* Coluna Esquerda: Exibe as opções baseadas na escolha acima */}
            <div className="flex-1 space-y-6">
              
              {/* 1. MODO PIX NATIVO */}
              {!tenant?.use_asaas ? (
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                      <Icons.Wallet className="text-brand-600 dark:text-brand-400" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white">Conta Digital (Pix Nativo)</h3>
                      <p className="text-sm text-slate-500">Receba aluguéis e sinais diretamente na sua conta, sem taxas.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Chave PIX *</label>
                        <select
                          value={tenant?.finance_config?.pix_type || ''}
                          onChange={(e) => setTenant(prev => prev ? { ...prev, finance_config: { ...prev.finance_config, pix_type: e.target.value as any } } : prev)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none"
                        >
                          <option value="">Selecione...</option>
                          <option value="cnpj">CNPJ</option>
                          <option value="cpf">CPF</option>
                          <option value="email">E-mail</option>
                          <option value="phone">Telefone / Celular</option>
                          <option value="random">Chave Aleatória</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chave PIX *</label>
                        <input
                          type="text"
                          placeholder="Ex: 00.000.000/0001-00"
                          value={tenant?.finance_config?.pix_key || ''}
                          onChange={(e) => setTenant(prev => prev ? { ...prev, finance_config: { ...prev.finance_config, pix_key: e.target.value } } : prev)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Titular / Razão Social *</label>
                        <input
                          type="text"
                          placeholder="Ex: Elevatio Vendas LTDA"
                          value={tenant?.finance_config?.pix_name || ''}
                          onChange={(e) => setTenant(prev => prev ? { ...prev, finance_config: { ...prev.finance_config, pix_name: e.target.value } } : prev)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cidade da Conta *</label>
                        <input
                          type="text"
                          placeholder="Ex: São Paulo"
                          value={tenant?.finance_config?.pix_city || ''}
                          onChange={(e) => setTenant(prev => prev ? { ...prev, finance_config: { ...prev.finance_config, pix_city: e.target.value } } : prev)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                
                /* 2. MODO ASAAS ATIVO */
                <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center">
                      <Icons.CheckCircle className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-brand-800 dark:text-brand-300">Integração Asaas Ativa</h3>
                      <p className="text-sm text-brand-600 dark:text-brand-500/80">O sistema emitirá faturas e boletos registrados automaticamente.</p>
                    </div>
                  </div>
                  <div className="mt-4 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">API Key Configurada</p>
                      <p className="text-sm text-slate-800 dark:text-slate-300 font-mono">
                        {tenant?.payment_api_key ? '****************' + tenant.payment_api_key.slice(-4) : 'Nenhuma chave configurada'}
                      </p>
                    </div>
                    <button 
                      onClick={() => { setTempApiKey(tenant?.payment_api_key || ''); setShowAsaasModal(true); }}
                      className="text-brand-600 hover:text-brand-700 text-sm font-bold underline"
                    >
                      Alterar Chave
                    </button>
                  </div>
                </div>
              )}

              {/* Regras de Comissionamento Inteligente */}
              <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Icons.Percent size={20} className="text-brand-600" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Regras de Comissionamento</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Comissão da Imobiliária (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 10"
                        value={tenant?.default_commission ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : Number(e.target.value);
                          setTenant(prev => prev ? { ...prev, default_commission: value, finance_config: { ...prev.finance_config, default_commission: value } } : prev);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-4 pr-10 py-2 text-sm focus:border-brand-500 outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 italic">Percentual total cobrado sobre o valor do aluguel/venda.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Repasse ao Corretor (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 30"
                        value={tenant?.broker_commission ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : Number(e.target.value);
                          setTenant(prev => prev ? { ...prev, broker_commission: value, finance_config: { ...prev.finance_config, broker_commission: value } } : prev);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-4 pr-10 py-2 text-sm focus:border-brand-500 outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 italic">Quanto da parte da imobiliária vai para o corretor que fechou o negócio.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
            <button 
              onClick={handleSave} 
              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-colors"
            >
              <Icons.Save size={18} /> Salvar Financeiro
            </button>
          </div>
        </div>
      )}

      {isSignModalOpen && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_40px_120px_-44px_rgba(15,23,42,0.42)] backdrop-blur">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-5 sm:px-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.26em] text-emerald-500">Assinatura Oficial</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Configure a rubrica da imobiliária</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">
                    Escolha como deseja criar a assinatura oficial do responsável legal. O resultado será anexado automaticamente aos contratos gerados pelo sistema.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeSignatureModal}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <Icons.X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5 sm:px-8 sm:py-8">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_340px]">
                  <section className="rounded-[30px] border border-slate-200 bg-slate-50 p-4 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.38)] backdrop-blur sm:p-6">
                    <div className="grid gap-3 sm:grid-cols-3 mb-6">
                      {OFFICIAL_SIGNATURE_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = signTab === tab.id;

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSignTab(tab.id as OfficialSignatureTab)}
                            className={`rounded-[20px] border py-3 px-4 transition-all flex items-center justify-center gap-3 ${
                              active
                                ? 'border-slate-950 bg-slate-950 text-white shadow-lg'
                                : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <Icon size={18} />
                            <span className="text-sm font-bold">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {signTab === 'draw' && (
                      <div className="mt-6 space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-slate-900">Desenhe a assinatura oficial abaixo</p>
                          <button
                            type="button"
                            onClick={clearDrawSignature}
                            className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                          >
                            Limpar quadro
                          </button>
                        </div>

                        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 p-1 shadow-inner sm:p-3">
                          <div className="overflow-hidden rounded-[24px] border border-dashed border-slate-300 bg-slate-50">
                            <SignaturePad
                              ref={signaturePadRef}
                              penColor="#0f172a"
                              onEnd={() => setHasDrawnSignature(!(signaturePadRef.current?.isEmpty() ?? true))}
                              canvasProps={{
                                className: 'w-full h-[260px] bg-slate-50 rounded-[24px] touch-none cursor-crosshair sm:h-[340px] lg:h-[400px]',
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setShowSignatureQrCode(true)}
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                          >
                            <Icons.QrCode size={16} />
                            Assinar pelo Celular (QR Code)
                          </button>
                        </div>
                      </div>
                    )}

                    {signTab === 'type' && (
                      <div className="mt-6 space-y-5">
                        <input
                          type="text"
                          value={typedName}
                          onChange={(event) => {
                            setTypedName(event.target.value);
                            setSignatureModalError('');
                          }}
                          placeholder="Digite o nome do responsável..."
                          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        />

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {OFFICIAL_SIGNATURE_FONT_OPTIONS.map((option) => {
                            const active = selectedFont === option.id;

                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setSelectedFont(option.id)}
                                className={`rounded-[20px] border p-2 transition-all ${
                                  active
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                }`}
                              >
                                <div className={`flex min-h-[72px] items-center justify-center rounded-[14px] px-2 text-center text-3xl text-slate-900 ${option.className}`}>
                                  {typedName.trim() || 'Seu nome'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {signTab === 'upload' ? (
                      <div className="mt-6 space-y-5">
                        {!imageToCrop && !uploadPreview && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button type="button" onClick={() => signatureUploadInputRef.current?.click()} className="flex h-14 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-slate-100 text-sm font-bold text-slate-900 transition hover:bg-slate-200"><Icons.Image size={18} /> Buscar Arquivo</button>
                            <button type="button" onClick={() => setIsSignatureCameraOpen(true)} className="flex h-14 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-slate-100 text-sm font-bold text-slate-900 transition hover:bg-slate-200"><Icons.Camera size={18} /> Tirar Foto</button>
                          </div>
                        )}
                        <input
                          ref={signatureUploadInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleUploadSelection(event.target.files?.[0])}
                        />
                        
                        {imageToCrop && (
                          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                            <p className="text-sm font-semibold text-slate-900 mb-4 text-center">Recorte a sua assinatura</p>
                            <div className="flex justify-center bg-slate-100 border border-dashed border-slate-300 p-2 rounded-xl overflow-hidden">
                              <ReactCrop crop={crop} onChange={(nextCrop) => setCrop(nextCrop)} className="max-h-[300px]">
                                <img ref={cropImageRef} src={imageToCrop} alt="Recortar" className="max-h-[300px] w-auto object-contain" onLoad={(event) => {
                                  const { width, height } = event.currentTarget;
                                  setCrop({ unit: 'px', x: width * 0.1, y: height * 0.1, width: width * 0.8, height: height * 0.8 });
                                }} />
                              </ReactCrop>
                            </div>
                            <div className="mt-4 flex gap-3">
                              <button type="button" onClick={clearUploadPreview} className="flex-1 py-3 bg-slate-200 text-slate-900 font-bold rounded-xl text-sm">Cancelar</button>
                              <button type="button" onClick={getCroppedImage} className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-md">Confirmar Recorte</button>
                            </div>
                          </div>
                        )}

                        {uploadPreview && !imageToCrop && (
                          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                            <div className="flex items-center justify-between gap-3 mb-4">
                              <p className="text-sm font-semibold text-slate-900">Prévia da imagem</p>
                              <button type="button" onClick={clearUploadPreview} className="text-sm font-semibold text-rose-500 hover:text-rose-700">Remover</button>
                            </div>
                            <div className="flex h-[180px] items-center justify-center rounded-[20px] border border-slate-200 bg-slate-100 p-4 shadow-sm">
                              <img src={uploadPreview} alt="Enviada" className="max-h-full w-auto object-contain mix-blend-multiply" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </section>

                  <aside className="flex flex-col justify-between rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] backdrop-blur">
                    <div className="space-y-5">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Assinatura atual
                        </p>
                        <div className="mt-4 flex min-h-[140px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-100 p-4">
                          {adminSignatureUrl ? (
                            <img
                              src={adminSignatureUrl}
                              alt="Assinatura oficial atual"
                              className="max-h-[96px] w-auto object-contain mix-blend-multiply"
                            />
                          ) : (
                            <div className="text-center">
                              <Icons.PenTool size={22} className="mx-auto mb-2 text-slate-500" />
                              <p className="text-sm text-slate-500">Nenhuma assinatura salva</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Método selecionado
                        </p>
                        <p className="mt-3 text-lg font-semibold text-slate-900">
                          {signTab === 'draw' ? 'Desenho livre' : signTab === 'type' ? 'Assinatura digitada' : 'Imagem enviada'}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          Revise a assinatura antes de confirmar. O arquivo salvo será usado como rubrica oficial da imobiliária.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      {signatureModalError ? (
                        <div className="mb-4 rounded-[20px] bg-rose-50 p-4 text-sm font-semibold text-rose-600">
                          {signatureModalError}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={handleSaveAdminSignature}
                        disabled={!canConfirmOfficialSignature}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-base font-bold text-white shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-600 disabled:opacity-50 disabled:shadow-none"
                      >
                        {isUploadingSignature ? <Icons.Loader2 className="animate-spin" size={18} /> : 'Confirmar e Salvar Assinatura'}
                      </button>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </div>

          {showSignatureQrCode ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-sm">
              <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl animate-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => setShowSignatureQrCode(false)}
                  className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-900"
                >
                  <Icons.X size={24} />
                </button>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-emerald-600">
                  <Icons.Smartphone size={24} />
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-900">Continue no celular</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Abra esta tela no seu celular para desenhar ou enviar a assinatura oficial com mais conforto.
                </p>
                <img
                  src={signatureQrCodeUrl}
                  alt="QR Code para abrir no celular"
                  className="mx-auto mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm"
                />
              </div>
            </div>
          ) : null}

          {isSignatureCameraOpen ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm">
              <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-black shadow-2xl animate-in zoom-in-95">
                <div className="relative aspect-[3/4] bg-slate-800 sm:aspect-video">
                  <video ref={signatureVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setIsSignatureCameraOpen(false)}
                    className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition hover:bg-black"
                  >
                    <Icons.X size={20} />
                  </button>
                </div>
                <div className="flex flex-col gap-3 bg-white p-6">
                  <button
                    type="button"
                    onClick={captureSignaturePhoto}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-lg font-bold text-white transition hover:bg-emerald-600"
                  >
                    <Icons.Camera size={20} />
                    Tirar Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignatureCameraOpen(false);
                      setShowSignatureQrCode(true);
                    }}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 font-bold text-slate-900 transition hover:bg-slate-200"
                  >
                    <Icons.QrCode size={20} />
                    Continuar no Celular
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Modal de Detalhes do Plano Atual */}
      {/* MODAL DE CHECKOUT COM ORDER BUMP (INTELIGENTE) */}
      {isCheckoutModalOpen && selectedPlanForCheckout && (
        (() => {
          // Lê os dados REAIS do banco (contract) e não o estado visual da tela
          const isModalYearly = contract?.billing_cycle === 'yearly';
          const isModalFidelity = contract?.has_fidelity;
          const isDomainActive = contract?.domain_status === 'active';
          
          // Inteligência de extração do domínio
          const billingLabel = isModalYearly ? 'Anual' : (isModalFidelity ? 'Mensal (Fidelidade 12m)' : 'Mensal');
          const primaryDomainStr = checkoutDomainInfo.primaryDomain;
          const secondaryDomainStr = autoSecondaryDomain || checkoutDomainInfo.suggestedSecondaryDomain;
          const primaryPrice = getDomainAnnualPrice(primaryDomainStr);
          const secondaryPrice = getDomainAnnualPrice(secondaryDomainStr);
          const isPrimaryFree = isModalYearly && selectedPlanForCheckout.has_free_domain;
          const shouldIncludePrimaryDomain = isDomainActive || isPrimaryFree || checkoutAddons.buyDomainBr;
          const basePlanPrice = Number(selectedPlanForCheckout.price * (isModalYearly ? 12 * 0.85 : (isModalFidelity ? 0.9 : 1)));
          const manualDiscountValue = Number(tenant?.manual_discount_value ?? user?.company?.manual_discount_value ?? 0);
          const manualDiscountType = tenant?.manual_discount_type ?? user?.company?.manual_discount_type ?? null;
          const courtesyAmount = manualDiscountValue > 0
            ? Math.min(
                basePlanPrice,
                manualDiscountType === 'percentage'
                  ? basePlanPrice * (manualDiscountValue / 100)
                  : manualDiscountValue
              )
            : 0;
          const subtotalAfterCourtesy = Math.max(0, basePlanPrice - courtesyAmount);
          const discountAmount = validatedCoupon
            ? Math.min(
                subtotalAfterCourtesy,
                validatedCoupon.type === 'percentage'
                  ? subtotalAfterCourtesy * (validatedCoupon.value / 100)
                  : validatedCoupon.type === 'free_month'
                    ? subtotalAfterCourtesy
                    : validatedCoupon.value
              )
            : 0;
          const primaryCharge = shouldIncludePrimaryDomain && !isPrimaryFree && !isDomainActive ? primaryPrice : 0;
          const secondaryCharge = checkoutAddons.buyDomainCom ? secondaryPrice : 0;
          const finalTotal = subtotalAfterCourtesy - discountAmount + primaryCharge + secondaryCharge;
          const formatCurrency = (value: number) =>
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const primaryPriceLabel = isDomainActive
            ? 'R$ 0,00 (Já Ativo)'
            : isPrimaryFree
              ? 'R$ 0,00'
              : `+ ${formatCurrency(primaryPrice)} /ano`;
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 backdrop-blur-xl p-4">
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
                <div className="p-6 border-b border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Icons.ShoppingCart className="text-brand-500" /> Resumo do Pedido
                  </h3>
                  <button onClick={() => setIsCheckoutModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <Icons.X size={24} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  {/* Item 1: O Plano */}
                  <div className="border border-brand-200/70 dark:border-brand-500/20 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-lg">
                          Plano {selectedPlanForCheckout.name}
                        </h4>
                        <p className="text-sm text-slate-500">
                          Ciclo: {billingLabel}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg text-brand-600 dark:text-brand-400">
                          {formatCurrency(basePlanPrice)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-brand-200/50 dark:border-brand-800/50 text-sm text-slate-600 dark:text-slate-400 flex flex-wrap gap-2">
                      <span className="bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded-md shadow-sm">Até {selectedPlanForCheckout.max_users} usuários</span>
                      <span className="bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded-md shadow-sm">{selectedPlanForCheckout.max_properties} imóveis</span>
                      {isPrimaryFree && (
                        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-md shadow-sm font-medium">
                          Domínio Grátis (1º ano)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item 2: Upsell de Domínio (O seu código inteligente original!) */}
                  <div className="border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                      <Icons.Globe size={18} className="text-slate-400" /> Seu Domínio Profissional
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Domínio Principal */}
                      <label className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isPrimaryFree || isDomainActive ? 'border-green-500 bg-green-50/90 dark:bg-green-900/20' : (checkoutAddons.buyDomainBr ? 'border-brand-500 bg-brand-50/90 dark:bg-brand-900/20' : 'border-slate-200/70 dark:border-white/10 cursor-pointer bg-white/70 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-800')}`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isPrimaryFree || isDomainActive ? true : checkoutAddons.buyDomainBr}
                            onChange={(e) => !isPrimaryFree && !isDomainActive && setCheckoutAddons((p) => ({ ...p, buyDomainBr: e.target.checked }))}
                            disabled={isPrimaryFree || isDomainActive}
                            className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-600 disabled:opacity-50"
                          />
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-200 block">
                              {primaryDomainStr}
                            </span>
                            {isDomainActive ? (
                              <span className="text-xs text-green-600 dark:text-green-400 font-bold">Domínio Ativo</span>
                            ) : isPrimaryFree ? (
                              <span className="text-xs text-green-600 dark:text-green-400 font-bold">Incluso no plano Anual</span>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                          {primaryPriceLabel}
                        </span>
                      </label>

                      {/* Domínio Adicional (Proteção de marca) */}
                      {autoSecondaryDomain && (
                        <div className="mt-6 rounded-2xl border border-brand-200/70 bg-brand-50/70 p-5 backdrop-blur-xl dark:border-brand-500/20 dark:bg-brand-900/10">
                          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                            <Icons.Globe size={16} className="text-brand-600" />
                            Proteja sua marca (Domínio Secundário)
                          </h4>
                          <p className="mb-4 text-xs text-slate-500">
                            Seu domínio principal é <strong>{tenant?.domain || siteDomain}</strong>. Verificamos automaticamente a disponibilidade da extensão alternativa para proteger sua marca.
                          </p>

                          <div className="flex flex-col gap-3">
                            <div className="relative">
                              <input
                                type="text"
                                readOnly
                                value={autoSecondaryDomain}
                                className="w-full rounded-xl border border-slate-200/60 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300"
                              />
                              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
                                {isCheckingSecondary && <Icons.Loader2 size={18} className="animate-spin text-brand-500" />}
                                {!isCheckingSecondary && isSecondaryAvailable === true && <Icons.CheckCircle2 size={18} className="text-green-500" />}
                                {!isCheckingSecondary && isSecondaryAvailable === false && <Icons.XCircle size={18} className="text-red-500" />}
                              </div>
                            </div>

                            {!isCheckingSecondary && isSecondaryAvailable === true && !isSecondaryConfirmed && (
                              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800/30 dark:bg-green-900/20">
                                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                  Domínio disponível! (+{formatCurrency(secondaryPrice)} /ano)
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAutoSecondaryDomain('');
                                      setIsSecondaryAvailable(null);
                                      setIsSecondaryConfirmed(false);
                                      setCheckoutAddons((prev) => ({ ...prev, buyDomainCom: false }));
                                    }}
                                    className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsSecondaryConfirmed(true);
                                      setCheckoutAddons((prev) => ({ ...prev, buyDomainCom: true }));
                                    }}
                                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-green-700"
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              </div>
                            )}

                            {isSecondaryConfirmed && (
                              <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-100 p-3 dark:border-brand-800/50 dark:bg-brand-900/40">
                                <span className="flex items-center gap-2 text-xs font-medium text-brand-700 dark:text-brand-300">
                                  <Icons.Check size={14} /> Adicionado ao valor da assinatura
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSecondaryConfirmed(false);
                                    setCheckoutAddons((prev) => ({ ...prev, buyDomainCom: false }));
                                  }}
                                  className="text-xs font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                                >
                                  Remover
                                </button>
                              </div>
                            )}

                            {!isCheckingSecondary && isSecondaryAvailable === false && (
                              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/30 dark:bg-red-900/20">
                                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                  Este domínio já está registrado por outra pessoa.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item 3: Cupom de Desconto (Adicionado) */}
                  <div className="border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Possui Cupom de Desconto?</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={checkoutCoupon} 
                        onChange={(e) => {
                          setCheckoutCoupon(e.target.value);
                          if (validatedCoupon?.code !== e.target.value.toUpperCase()) {
                            setValidatedCoupon(null);
                          }
                        }} 
                        placeholder="INSERIR CÓDIGO" 
                        className="flex-1 border border-slate-300/80 dark:border-white/10 rounded-xl px-4 py-2 text-sm uppercase outline-none focus:border-brand-500 bg-white/90 dark:bg-slate-950/50 text-slate-900 dark:text-white font-bold" 
                      />
                      <button 
                        onClick={handleValidateCheckoutCoupon} 
                        disabled={validatingCoupon || !checkoutCoupon} 
                        className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {validatingCoupon ? <Icons.Loader2 size={16} className="animate-spin" /> : 'Aplicar'}
                      </button>
                    </div>
                    {validatedCoupon && (
                      <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Icons.CheckCircle2 size={14} /> Cupom {validatedCoupon.code} validado!
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-950/90 dark:bg-black/70 backdrop-blur-xl p-5 rounded-2xl space-y-3 shadow-inner border border-white/10">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Resumo do Pagamento</h5>
                    
                    <div className="flex justify-between gap-4 text-slate-300 text-sm">
                      <span>Plano {selectedPlanForCheckout.name} ({billingLabel})</span>
                      <span>{formatCurrency(basePlanPrice)}</span>
                    </div>

                    {courtesyAmount > 0 && (
                      <div className="flex justify-between gap-4 text-blue-400 text-sm font-medium italic">
                        <span className="flex items-center gap-1"><Icons.BadgeCheck size={14} /> Cortesia</span>
                        <span>
                          -{manualDiscountType === 'percentage'
                            ? `${manualDiscountValue}%`
                            : formatCurrency(courtesyAmount)}
                        </span>
                      </div>
                    )}

                    {validatedCoupon && (
                      <div className="flex justify-between gap-4 text-emerald-400 text-sm font-bold">
                        <span className="flex items-center gap-1"><Icons.Ticket size={14} /> Cupom: {validatedCoupon.code}</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}

                    {shouldIncludePrimaryDomain && (
                      <div className="flex justify-between gap-4 text-slate-400 text-sm">
                        <span>Registro: {primaryDomainStr}</span>
                        <span>{isDomainActive ? 'R$ 0,00 (Já Ativo)' : isPrimaryFree ? 'Grátis' : formatCurrency(primaryCharge)}</span>
                      </div>
                    )}

                    {checkoutAddons.buyDomainCom && (
                      <div className="flex justify-between gap-4 text-slate-400 text-sm">
                        <span>Proteção: {secondaryDomainStr}</span>
                        <span>{formatCurrency(secondaryCharge)}</span>
                      </div>
                    )}

                    <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-end">
                      <span className="text-slate-400 font-bold">Total Final</span>
                      <span className="text-2xl font-black text-white">{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer do Checkout com a Matemática Precisa */}
                <div className="p-6 border-t border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-end items-center">
                  <button 
                    onClick={async () => {
                      setIsCheckoutModalOpen(false);
                      if (checkoutMode === 'upgrade') {
                        handleUpgrade({
                          ...selectedPlanForCheckout,
                          addons: checkoutAddons,
                          domain_secondary: isSecondaryConfirmed ? autoSecondaryDomain : null,
                        });
                      } else {
                        try {
                          setIsLoading(true);
                          const { data: { session } } = await supabase.auth.getSession();
                          
                          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                          if (!supabaseUrl || !supabaseAnonKey) {
                            throw new Error("Chaves de ambiente não configuradas.");
                          }

                          // Usamos o fetch nativo: Ele garante o envio dos headers sem a interferência do SDK
                          const response = await fetch(`${supabaseUrl}/functions/v1/update-asaas-subscription`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session?.access_token}`,
                              'apikey': supabaseAnonKey
                            },
                            body: JSON.stringify({
                              company_id: contract?.company_id,
                              new_plan: selectedPlanForCheckout.name,
                              billing_cycle: isModalYearly ? 'yearly' : 'monthly',
                              has_fidelity: contract?.has_fidelity || false,
                              addons: checkoutAddons,
                              coupon_code: validatedCoupon?.code,
                              domain_secondary: isSecondaryConfirmed ? autoSecondaryDomain : null
                            })
                          });

                          const responseData = await response.json();

                          if (!response.ok) {
                            throw new Error(responseData.error || 'Falha ao processar assinatura no Asaas.');
                          }

                          handleCheckout(); 
                        } catch (e: any) {
                          console.error('Erro no Checkout:', e);
                          addToast(e.message || 'Erro ao processar pagamento.', 'error');
                        } finally {
                          setIsLoading(false);
                        }
                      }
                    }}
                    disabled={isLoading}
                    className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white text-lg font-black rounded-xl transition-all shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Icons.Loader2 className="animate-spin" /> : <Icons.CreditCard size={20} />}
                    Pagar com Asaas
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Modal Instrucional de Ativação do Asaas */}
      {showAsaasModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Ativar Gateway Avançado (Asaas)</h3>
              <button onClick={() => setShowAsaasModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* O Vídeo do Cadastro */}
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">1. Como criar a conta</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Assista ao vídeo rápido abaixo para entender como criar sua conta gratuita no Asaas.</p>
                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/zw0R_sgBDnA"
                    title="Tutorial Asaas" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen>
                  </iframe>
                </div>
              </div>

              {/* O Vídeo da API */}
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">2. Como gerar a API</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Assista ao vídeo rápido abaixo para entender como criar e copiar sua chave de integração (API Key).</p>
                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/XeX7FQ29PXk" 
                    title="Tutorial Asaas" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen>
                  </iframe>
                </div>
              </div>

              {/* O Alerta de KYC */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex gap-4">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={24} />
                <div>
                  <h5 className="font-bold text-amber-800 dark:text-amber-400 mb-1">Aviso Importante: Compliance de Segurança</h5>
                  <p className="text-sm text-amber-700 dark:text-amber-300/80 leading-relaxed">
                    Por determinação do Banco Central, para evitar fraudes, o Asaas exige <strong>reconhecimento facial e envio de documento oficial (RG ou CNH)</strong> para aprovar sua conta. Esse processo é feito diretamente no app deles e pode demorar algumas horas para liberação.
                  </p>
                </div>
              </div>

              {/* O Input da Chave */}
              <div className="pt-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">3. Cole sua API Key no campo abaixo.</h4>
                <input
                  type="password"
                  placeholder="Ex: $aact_YTU5YTE0M2M..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-sm focus:border-brand-500 outline-none font-mono"
                />
              </div>

            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowAsaasModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (!tempApiKey.trim()) {
                    alert("Por favor, insira a API Key para continuar.");
                    return;
                  }
                  setTenant(prev => prev ? { 
                    ...prev, 
                    payment_api_key: tempApiKey.trim(),
                    use_asaas: true,
                    finance_config: { ...prev.finance_config, use_asaas: true } 
                  } : prev);
                  setShowAsaasModal(false);
                }}
                className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shadow-md transition-colors"
              >
                Confirmar e Ativar Asaas
              </button>
            </div>

          </div>
        </div>
      )}

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

      <BillingPortalModal
        isOpen={isBillingPortalOpen}
        onClose={() => setIsBillingPortalOpen(false)}
        company={tenant}
        contract={contract}
      />
    </div>
  );
};

export default AdminConfig;
