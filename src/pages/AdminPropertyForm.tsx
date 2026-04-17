import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import heic2any from 'heic2any';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import PropertyPreviewModal from '../components/PropertyPreviewModal';
import IntermediationContractModal from '../components/IntermediationContractModal';
import SignatureManagerModal from '../components/SignatureManagerModal';
import { useAuth } from '../contexts/AuthContext';
import { PropertyType, type Company, type ListingType, type SiteData } from '../types';
import { useToast } from '../contexts/ToastContext';
import { addXp } from '../services/gamification';
import { generatePropertyDescription } from '../services/ai';
import { uploadCompanyAsset } from '../lib/storage';
import { appendSignatureManifest, injectSignatureStamps } from '../utils/contractGenerator';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const UFs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const ORGAOS = ['SSP', 'Detran', 'Policia Federal', 'Cartorio Civil', 'OAB', 'CREA', 'CRM'];

type PropertyPriorityLevel = 'padrao' | 'estrategico' | 'dificil' | 'premium' | 'alta_comissao';
type WizardStep = 'basic' | 'details' | 'owner' | 'strategy' | 'legal' | 'media' | 'seo';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationMarker = ({ position, setPosition }: { position: any, setPosition: any }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : <Marker position={position}></Marker>;
};

interface ImageItem {
  id: string;
  url: string;
}

interface FormState {
  title: string;
  description: string;
  type: string;
  listing_type: ListingType;
  price: number | '';
  condominium: number | '';
  iptu: number | '';
  down_payment: number | '';
  financing_available: boolean;
  has_balloon: boolean;
  balloon_value: number | '';
  balloon_frequency: string;
  bedrooms: number | '';
  suites: number | '';
  bathrooms: number | '';
  garage: number | '';
  area: number | '';
  built_area: number | '';
  features: string[];
  zip_code: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  condominium_id: string | null;
  latitude: number;
  longitude: number;
  seo_title: string;
  seo_description: string;
  agent_id: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  owner_document: string;
  owner_rg: string;
  owner_rg_org: string;
  owner_rg_uf: string;
  owner_profession: string;
  owner_marital_status: string;
  owner_address: string;
  owner_pix_key: string;
  owner_pix_type: string;
  owner_spouse_name: string;
  owner_spouse_cpf: string;
  owner_spouse_rg: string;
  owner_spouse_rg_org: string;
  owner_spouse_rg_uf: string;
  commission_percentage: number | '';
  has_exclusivity: boolean;
  strategic_weight: number;
  priority_level: PropertyPriorityLevel;
}

const DEFAULT_STEP_ORDER: WizardStep[] = ['basic', 'details', 'owner', 'media', 'seo', 'legal'];
const STRATEGY_STEP_ORDER: WizardStep[] = ['basic', 'details', 'owner', 'strategy', 'media', 'seo', 'legal'];

const STEP_META: Record<WizardStep, { label: string; icon: keyof typeof Icons }> = {
  basic: { label: 'Básico', icon: 'Home' },
  details: { label: 'Detalhes', icon: 'List' },
  owner: { label: 'Proprietário', icon: 'User' },
  strategy: { label: 'Peso Comercial', icon: 'Target' },
  media: { label: 'Multimídia', icon: 'Image' },
  legal: { label: 'Jurídico', icon: 'Scale' },
  seo: { label: 'SEO', icon: 'Globe' },
};

const defaultForm: FormState = {
  title: '',
  description: '',
  type: PropertyType.HOUSE,
  listing_type: 'sale',
  price: '',
  condominium: 0,
  iptu: 0,
  down_payment: '',
  financing_available: true,
  has_balloon: false,
  balloon_value: '',
  balloon_frequency: 'Anual',
  bedrooms: '',
  suites: '',
  bathrooms: '',
  garage: '',
  area: '',
  built_area: '',
  features: [],
  zip_code: '',
  address: '',
  neighborhood: '',
  city: 'Caldas Novas',
  state: 'GO',
  condominium_id: null,
  latitude: 0,
  longitude: 0,
  seo_title: '',
  seo_description: '',
  agent_id: '',
  owner_name: '',
  owner_phone: '',
  owner_email: '',
  owner_document: '',
  owner_rg: '',
  owner_rg_org: '',
  owner_rg_uf: '',
  owner_profession: '',
  owner_marital_status: '',
  owner_address: '',
  owner_pix_key: '',
  owner_pix_type: '',
  owner_spouse_name: '',
  owner_spouse_cpf: '',
  owner_spouse_rg: '',
  owner_spouse_rg_org: '',
  owner_spouse_rg_uf: '',
  commission_percentage: 5,
  has_exclusivity: true,
  strategic_weight: 1.0,
  priority_level: 'padrao',
};

const createSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .concat(`-${Math.floor(Math.random() * 10000)}`);

type CondominiumRecord = NonNullable<SiteData['condominiums']>[number];
type TenantRecord = Pick<Company, 'id' | 'site_data' | 'name' | 'admin_signature_url'>;

const parseSiteData = (raw: unknown): SiteData => {
  if (!raw) return {};

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as SiteData) : {};
    } catch {
      return {};
    }
  }

  return typeof raw === 'object' ? (raw as SiteData) : {};
};

const compressImageToWebP = (file: File, maxWidth = 1200, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.webp', { type: 'image/webp' }));
          } else {
            resolve(file);
          }
        }, 'image/webp', quality);
      };
    };
  });
};

const SortableImageCard: React.FC<{
  image: ImageItem;
  index: number;
  isExceeded: boolean;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropOn: (id: string) => void;
}> = ({ image, index, isExceeded, onRemove, onDragStart, onDropOn }) => {
  return (
    <div
      className={`relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square ${
        isExceeded ? 'ring-4 ring-red-500 opacity-80' : ''
      }`}
      draggable
      onDragStart={() => onDragStart(image.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropOn(image.id)}
    >
      {isExceeded && (
        <div className="absolute inset-0 bg-red-900/40 z-10 flex flex-col items-center justify-center pointer-events-none">
          <span className="bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full shadow-lg">
            Excedente (Apagar)
          </span>
        </div>
      )}

      <img src={image.url} alt={`Imagem ${index + 1}`} className="w-full h-full object-cover" />

      <div className="absolute inset-x-0 top-0 p-2 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-xs font-bold text-white rounded-full bg-black/40 px-2 py-1">#{index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(image.id)}
          className="p-1.5 rounded-full bg-red-500 text-white opacity-90 hover:opacity-100"
        >
          <Icons.X size={14} />
        </button>
      </div>

      <div className="absolute bottom-2 right-2 p-2 rounded-xl bg-white/90 text-slate-700 shadow-md">
        <Icons.MoreVertical size={16} />
      </div>
    </div>
  );
};

const AdminPropertyForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const isEditing = Boolean(id);
  const [draftId] = useState(() => crypto.randomUUID());
  const activePropertyId = isEditing && id ? id : draftId;
  const canAccessStrategy = ['owner', 'manager', 'admin', 'super_admin'].includes(user?.role ?? '');
  const visibleSteps = useMemo<WizardStep[]>(
    () => (canAccessStrategy ? STRATEGY_STEP_ORDER : DEFAULT_STEP_ORDER),
    [canAccessStrategy]
  );

  const stepParam = searchParams.get('step');
  const step =
    stepParam && visibleSteps.includes(stepParam as WizardStep)
      ? (stepParam as WizardStep)
      : 'basic';

  const setStep = (newStep: WizardStep) => {
    if (!visibleSteps.includes(newStep)) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('step', newStep);
      return next;
    }, { replace: true });
  };
  const [formData, setFormData] = useState<FormState>(defaultForm);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const MAX_IMAGES = 30;
  const exceededImagesCount = images.length - MAX_IMAGES;
  const isOverImageLimit = exceededImagesCount > 0;
  const [newFeature, setNewFeature] = useState('');
  const [newCondoFeature, setNewCondoFeature] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [legalServiceType, setLegalServiceType] = useState<'intermediation' | 'administration'>('intermediation');
  const [showSignatureManager, setShowSignatureManager] = useState(false);
  const [existingContract, setExistingContract] = useState<{ id: string; status: string } | null>(null);
  const [originalAgentId, setOriginalAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [isCondominium, setIsCondominium] = useState(false);
  const [isEditingCondo, setIsEditingCondo] = useState(false);
  const [showNewCondoForm, setShowNewCondoForm] = useState(false);
  const [newCondo, setNewCondo] = useState<Partial<CondominiumRecord>>({});
  const [uploadingCondoImage, setUploadingCondoImage] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const siteData = useMemo(() => parseSiteData(tenant?.site_data), [tenant?.site_data]);
  const condominiumsList = siteData.condominiums || [];
  const selectedCondominium = useMemo(
    () => condominiumsList.find((condo) => condo.id === formData.condominium_id) || null,
    [condominiumsList, formData.condominium_id]
  );


  const canGoNext = useMemo(() => {
    if (step === 'basic') {
      return formData.title.trim().length > 3 && formData.price > 0;
    }
    if (step === 'details') {
      return formData.city.trim().length > 1 && formData.neighborhood.trim().length > 1;
    }
    if (step === 'media') {
      return images.length > 0;
    }
    return true;
  }, [formData, images.length, step]);

  useEffect(() => {
    if (formData.listing_type !== 'rent' && legalServiceType === 'administration') {
      setLegalServiceType('intermediation');
    }
  }, [formData.listing_type, legalServiceType]);

  useEffect(() => {
    if (!user?.company_id) return;

    let isMounted = true;

    const fetchTenant = async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, site_data, name, admin_signature_url')
        .eq('id', user.company_id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar registro de condomínios:', error);
        return;
      }

      if (isMounted && data) {
        setTenant(data as TenantRecord);
      }
    };

    fetchTenant();

    return () => {
      isMounted = false;
    };
  }, [user?.company_id]);

  useEffect(() => {
    if (formData.condominium_id) {
      setIsCondominium(true);
    }
  }, [formData.condominium_id]);

  useEffect(() => {
    if (isEditing) return;

    setFormData((prev) => ({
      ...prev,
      agent_id: prev.agent_id || user?.id || '',
    }));
  }, [isEditing, user?.id]);

  useEffect(() => {
    if (!isEditing || !id) return;

    const loadProperty = async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
      if (error || !data) {
        console.error('Erro ao carregar imóvel:', error);
        return;
      }

      if (user && !isAdmin && data.agent_id !== user.id) {
        addToast('Sem permissão para editar este imóvel.', 'error');
        navigate('/admin/imoveis', { replace: true });
        return;
      }

      setFormData({
        title: data.title || '',
        description: data.description || '',
        type: data.type || PropertyType.HOUSE,
        listing_type: data.listing_type || 'sale',
        price: data.price || '',
        condominium: data.condominium ?? 0,
        iptu: data.iptu ?? 0,
        down_payment: data.down_payment || '',
        financing_available: data.financing_available ?? true,
        has_balloon: data.has_balloon ?? false,
        balloon_value: data.balloon_value || '',
        balloon_frequency: data.balloon_frequency || 'Anual',
        bedrooms: data.bedrooms || '',
        suites: data.suites || '',
        bathrooms: data.bathrooms || '',
        garage: data.garage || '',
        area: data.area || '',
        built_area: data.built_area || '',
        features: data.features || [],
        zip_code: data.zip_code || '',
        address: data.address || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || 'GO',
        condominium_id: data.condominium_id ?? null,
        latitude: Number(data.latitude || 0),
        longitude: Number(data.longitude || 0),
        seo_title: data.seo_title || '',
        seo_description: data.seo_description || '',
        agent_id: data.agent_id || user?.id || '',
        owner_name: data.owner_name || '',
        owner_phone: data.owner_phone || '',
        owner_email: data.owner_email || '',
        owner_document: data.owner_document || '',
        owner_rg: data.owner_rg || '',
        owner_rg_org: data.owner_rg_org || '',
        owner_rg_uf: data.owner_rg_uf || '',
        owner_profession: data.owner_profession || '',
        owner_marital_status: data.owner_marital_status || '',
        owner_address: data.owner_address || '',
        owner_pix_key: data.owner_pix_key || '',
        owner_pix_type: data.owner_pix_type || '',
        owner_spouse_name: data.owner_spouse_name || '',
        owner_spouse_cpf: data.owner_spouse_cpf || '',
        owner_spouse_rg: data.owner_spouse_rg || '',
        owner_spouse_rg_org: data.owner_spouse_rg_org || '',
        owner_spouse_rg_uf: data.owner_spouse_rg_uf || '',
        commission_percentage: data.commission_percentage ?? 5,
        has_exclusivity: data.has_exclusivity ?? true,
        strategic_weight: Number(data.strategic_weight ?? 1.0) || 1.0,
        priority_level: data.priority_level ?? 'padrao',
      });

      setOriginalAgentId(data.agent_id);

      const existingImages: ImageItem[] = (data.images || []).map((url: string, idx: number) => ({
        id: `${idx}-${url}`,
        url,
      }));
      setImages(existingImages);

      const { data: contractData } = await supabase
        .from('contracts')
        .select('id, status')
        .eq('property_id', id)
        .eq('contract_data->>document_type', 'intermediacao')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractData) {
        const { data: signatures } = await supabase
          .from('contract_signatures')
          .select('status')
          .eq('contract_id', contractData.id);

        const isSigned = signatures?.some((sig: any) => sig.status === 'signed');
        setExistingContract({ id: contractData.id, status: isSigned ? 'signed' : contractData.status });
      } else {
        setExistingContract(null);
      }
    };

    loadProperty();
  }, [id, isEditing, user?.id, isAdmin, addToast, navigate]);

  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('active', true);
      if (data) setAgents(data);
    };

    if (isAdmin) {
      fetchAgents();
    }
  }, [isAdmin]);

  const handleInput = (name: keyof FormState, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCondoImageUpload = async (file: File) => {
    if (!user?.company_id) {
      addToast('Empresa não encontrada para enviar a foto do condomínio.', 'error');
      return;
    }

    try {
      setUploadingCondoImage(true);
      addToast('Processando foto do condomínio...', 'info');
      const compressedFile = await compressImageToWebP(file);
      const url = await uploadCompanyAsset(compressedFile, user.company_id, `region_${Date.now()}`);
      setNewCondo((prev) => ({ ...prev, image_url: url }));
      addToast('Foto do condomínio enviada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao enviar foto do condomínio:', error);
      addToast('Erro ao enviar foto do condomínio.', 'error');
    } finally {
      setUploadingCondoImage(false);
    }
  };

  const handleCreateCondominium = async () => {
    if (!newCondo.name?.trim() || !tenant?.id) {
      addToast('Preencha pelo menos o nome do condomínio.', 'error');
      return;
    }

    const condo: CondominiumRecord = {
      id: newCondo.id || Date.now().toString(),
      name: newCondo.name.trim(),
      image_url: newCondo.image_url || '',
      zip: newCondo.zip?.trim() || '',
      street: newCondo.street?.trim() || '',
      neighborhood: newCondo.neighborhood?.trim() || '',
      city: newCondo.city?.trim() || '',
      state: newCondo.state?.trim() || '',
      features: newCondo.features || [],
    };

    const isUpdating = !!newCondo.id;
    const updatedCondos = isUpdating
      ? condominiumsList.map((c) => (c.id === condo.id ? condo : c))
      : [...condominiumsList, condo];
    const updatedSiteData: SiteData = { ...siteData, condominiums: updatedCondos };

    try {
      addToast(isUpdating ? 'Atualizando condomínio...' : 'Salvando condomínio...', 'info');

      const { error } = await supabase
        .from('companies')
        .update({ site_data: updatedSiteData })
        .eq('id', tenant.id);

      if (error) throw error;

      setTenant((prev) => (prev ? { ...prev, site_data: updatedSiteData } : { id: tenant.id, site_data: updatedSiteData }));

      setFormData((prev) => ({
        ...prev,
        condominium_id: condo.id,
        zip_code: condo.zip || prev.zip_code,
        address: condo.street || prev.address,
        neighborhood: condo.name,
        city: condo.city || prev.city,
        state: condo.state || prev.state,
      }));

      setNewCondo({});
      setNewCondoFeature('');
      setShowNewCondoForm(false);
      setIsEditingCondo(false);
      addToast(isUpdating ? 'Condomínio atualizado!' : 'Condomínio registrado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao criar condomínio:', err);
      addToast('Erro ao salvar condomínio.', 'error');
    }
  };

  const handleDeleteCondominium = async (idToDelete: string) => {
    if (!confirm('Deseja excluir este condomínio do banco geral?')) return;

    const updatedCondos = condominiumsList.filter((c) => c.id !== idToDelete);
    const updatedSiteData: SiteData = { ...siteData, condominiums: updatedCondos };

    try {
      const { error } = await supabase.from('companies').update({ site_data: updatedSiteData }).eq('id', tenant?.id);
      if (error) throw error;
      setTenant((prev) => (prev ? { ...prev, site_data: updatedSiteData } : null));
      if (formData.condominium_id === idToDelete) {
        setFormData((prev) => ({ ...prev, condominium_id: null }));
      }
      addToast('Condomínio excluído.', 'success');
    } catch (err) {
      addToast('Erro ao excluir.', 'error');
    }
  };

  const fetchAddressByCep = async () => {
    const cep = formData.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      setFetchingCep(true);
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) return;

      setFormData((prev) => ({
        ...prev,
        address: data.logradouro || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
    } finally {
      setFetchingCep(false);
    }
  };

  const generateDescriptionWithAI = async () => {
    try {
      setGeneratingDescription(true);

      const isSale = formData.listing_type === 'sale';
      const condoName = selectedCondominium?.name || '';
      const formattedPrice = Number(formData.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const featuresList = formData.features.length > 0 ? formData.features.join(', ') : 'Nenhuma comodidade específica listada';

      // Monta as características para enviar ao motor central de IA
      const propertyFeatures = `
        - Tipo: ${formData.type}
        - Negócio: ${isSale ? 'Venda' : 'Locação'}
        - Localização: ${formData.neighborhood}, ${formData.city} - ${formData.state}
        - Preço: ${formattedPrice}
        - Área Total: ${formData.area}m²
        - Área Construída: ${formData.built_area ? formData.built_area + 'm²' : 'Não informada'}
        - Quartos: ${formData.bedrooms}
        - Suítes: ${formData.suites ? formData.suites : '0'}
        - Banheiros: ${formData.bathrooms}
        - Vagas: ${formData.garage}
        - Diferenciais: ${featuresList}
      `;

      // Chama a nossa função centralizada do ai.ts
      const generatedText = await generatePropertyDescription(
        `${propertyFeatures}
        - Nome do Condominio: ${condoName || 'Nao informado'}`,
        condoName,
        selectedCondominium?.features || []
      );

      if (!generatedText) {
        throw new Error('A IA não conseguiu gerar a descrição no momento.');
      }

      setFormData((prev) => ({
        ...prev,
        description: generatedText,
        seo_description: prev.seo_description || generatedText.slice(0, 150).replace(/\n/g, ' ') + '...'
      }));

    } catch (error: any) {
      console.error('Erro ao gerar com IA:', error);
      alert('Erro ao gerar descrição: ' + error.message);
    } finally {
      setGeneratingDescription(false);
    }
  };

  const compressImage = async (file: File): Promise<File> => {
    const isHeic = file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic');

    let sourceBlob: Blob = file;
    if (isHeic) {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
      sourceBlob = Array.isArray(converted) ? converted[0] : converted;
    }

    const imageBitmap = await createImageBitmap(sourceBlob);

    // 1. COMPRESSÃO FÍSICA (Resolução Máxima 1280px)
    const maxWidth = 1280;
    const maxHeight = 960;
    const widthRatio = maxWidth / imageBitmap.width;
    const heightRatio = maxHeight / imageBitmap.height;
    const ratio = Math.min(widthRatio, heightRatio, 1);
    const targetWidth = Math.round(imageBitmap.width * ratio);
    const targetHeight = Math.round(imageBitmap.height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha no canvas.');

    context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

    // 2. COMPRESSÃO DE MEMÓRIA (Algoritmo de laço para garantir < 300KB)
    let quality = 0.85; // Começa com qualidade alta
    let webpBlob: Blob | null = null;
    let attempt = 0;
    const MAX_SIZE_BYTES = 300 * 1024; // Alvo: Máximo de 300 KB

    while (attempt < 5) {
      webpBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
      });

      // Se a imagem ficou com menos de 300KB ou já tentamos 5 vezes, paramos de espremer
      if (webpBlob && webpBlob.size <= MAX_SIZE_BYTES) {
        break;
      }

      // Se ainda está pesada, reduzimos a qualidade e tentamos de novo
      quality -= 0.15;
      attempt++;
    }

    if (!webpBlob) throw new Error('Falha ao gerar imagem otimizada.');

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    return new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' });
  };

  const uploadFileToStorage = async (file: File) => {
    const extension = file.type === 'image/webp' ? 'webp' : file.name.split('.').pop();
    // Salva na estrutura: company_id / property_id / arquivo
    const fileName = `${user?.company_id}/${activePropertyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage.from('properties').upload(fileName, file, {
      upsert: false,
      cacheControl: '3600',
    });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('properties').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const addFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.heic'),
    );
    if (!incoming.length) return;

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadStatus('Iniciando processamento das imagens...');

      const uploadedUrls: string[] = [];
      for (let index = 0; index < incoming.length; index += 1) {
        const file = incoming[index];
        const isHeic = file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic');

        if (isHeic) {
          setUploadStatus('Convertendo formato HEIC do iPhone...');
        } else {
          setUploadStatus(`Comprimindo imagem ${index + 1} de ${incoming.length}...`);
        }

        const compressedFile = await compressImage(file);
        setUploadStatus(`Enviando imagem ${index + 1} de ${incoming.length}...`);
        const uploadedUrl = await uploadFileToStorage(compressedFile);
        uploadedUrls.push(uploadedUrl);
        setUploadProgress(Math.round(((index + 1) / incoming.length) * 100));
      }

      setUploadStatus('Upload concluído com sucesso!');
      const mapped = uploadedUrls.map((url) => ({ id: crypto.randomUUID(), url }));
      setImages((prev) => [...prev, ...mapped]);
    } catch (error) {
      console.error('Erro no upload das imagens:', error);
      alert('Falha ao enviar uma ou mais imagens para o storage.');
      setUploadStatus('Falha ao processar imagens. Tente novamente.');
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
      }, 2000);
    }
  };

  const handleDropArea = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files?.length) {
      await addFiles(event.dataTransfer.files);
    }
  };


  const addImageByUrl = () => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [...prev, { id: crypto.randomUUID(), url: newImageUrl.trim() }]);
    setNewImageUrl('');
  };

  const removeImage = (idToRemove: string) => {
    const image = images.find(img => img.id === idToRemove);

    // Se a imagem estiver hospedada no nosso bucket, marca para exclusão física
    if (image && image.url.includes('supabase.co') && image.url.includes('/properties/')) {
      setImagesToDelete(prev => [...prev, image.url]);
    }

    // Remove da interface imediatamente
    setImages((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setFormData((prev) => ({ ...prev, features: [...prev.features, newFeature.trim()] }));
    setNewFeature('');
  };

  const removeFeature = (feature: string) => {
    setFormData((prev) => ({ ...prev, features: prev.features.filter((item) => item !== feature) }));
  };

  const handleDropOnImage = (targetId: string) => {
    if (!draggingImageId || draggingImageId === targetId) return;

    setImages((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === draggingImageId);
      const newIndex = prev.findIndex((item) => item.id === targetId);
      if (oldIndex < 0 || newIndex < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });

    setDraggingImageId(null);
  };

  const handleDragOverContainer = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = e.currentTarget;
    const speed = 15;
    const threshold = 60;

    const rect = container.getBoundingClientRect();
    if (e.clientY - rect.top < threshold) {
      container.scrollTop -= speed;
    } else if (rect.bottom - e.clientY < threshold) {
      container.scrollTop += speed;
    }
  };

  const reverseImages = () => {
    setImages(prev => [...prev].reverse());
  };

  const sortImagesByName = () => {
    setImages(prev => [...prev].sort((a, b) => {
      const nameA = (a as any).file?.name || (a as any).url || '';
      const nameB = (b as any).file?.name || (b as any).url || '';
      return nameA.localeCompare(nameB);
    }));
  };

  const goNext = () => {
    const index = visibleSteps.indexOf(step);
    if (index < visibleSteps.length - 1) setStep(visibleSteps[index + 1]);
  };

  const goBack = () => {
    const index = visibleSteps.indexOf(step);
    if (index > 0) setStep(visibleSteps[index - 1]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isOverImageLimit) {
      addToast(`Remova ${exceededImagesCount} imagem(ns) excedente(s) antes de salvar.`, 'error');
      return;
    }

    try {
      setLoading(true);

      // 1. Esvazia a lixeira do Storage antes de salvar as alterações no banco
      if (imagesToDelete.length > 0) {
        const pathsToRemove = imagesToDelete.map(url => {
          try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/properties/');
            return pathParts.length > 1 ? pathParts[1] : null;
          } catch {
            return null;
          }
        }).filter(Boolean) as string[];

        if (pathsToRemove.length > 0) {
          const { error: storageError } = await supabase.storage.from('properties').remove(pathsToRemove);
          if (storageError) {
            console.error('Aviso: Falha ao limpar lixeira do Storage:', storageError);
          }
        }
      }

      const basePayload = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        listing_type: formData.listing_type,
        price: Number(formData.price),
        condominium: Number(formData.condominium) || 0,
        iptu: Number(formData.iptu) || 0,
        down_payment: formData.listing_type === 'sale' ? Number(formData.down_payment) : null,
        financing_available: formData.listing_type === 'sale' ? formData.financing_available : null,
        has_balloon: formData.has_balloon,
        balloon_value: formData.has_balloon ? Number(formData.balloon_value) : null,
        balloon_frequency: formData.has_balloon ? formData.balloon_frequency : null,
        bedrooms: Number(formData.bedrooms),
        suites: Number(formData.suites) || null,
        bathrooms: Number(formData.bathrooms),
        garage: Number(formData.garage),
        area: Number(formData.area),
        built_area: Number(formData.built_area) || null,
        features: formData.features,
        zip_code: formData.zip_code,
        address: formData.address,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        condominium_id: isCondominium ? formData.condominium_id || null : null,
        latitude: Number(formData.latitude) || null,
        longitude: Number(formData.longitude) || null,
        seo_title: formData.seo_title || formData.title,
        seo_description: formData.seo_description || formData.description.slice(0, 155),
        owner_name: formData.owner_name,
        owner_phone: formData.owner_phone,
        owner_email: formData.owner_email,
        owner_document: formData.owner_document,
        owner_rg: formData.owner_rg,
        owner_rg_org: formData.owner_rg_org || null,
        owner_rg_uf: formData.owner_rg_uf || null,
        owner_profession: formData.owner_profession,
        owner_marital_status: formData.owner_marital_status,
        owner_address: formData.owner_address,
        owner_pix_key: formData.owner_pix_key || null,
        owner_pix_type: formData.owner_pix_type || null,
        owner_spouse_name: formData.owner_spouse_name,
        owner_spouse_cpf: formData.owner_spouse_cpf || null,
        owner_spouse_rg: formData.owner_spouse_rg || null,
        owner_spouse_rg_org: formData.owner_spouse_rg_org || null,
        owner_spouse_rg_uf: formData.owner_spouse_rg_uf || null,
        commission_percentage: Number(formData.commission_percentage) || 0,
        has_exclusivity: formData.has_exclusivity,
        strategic_weight: formData.strategic_weight,
        priority_level: formData.priority_level,
        images: images.map((item) => item.url),
        slug: isEditing ? undefined : createSlug(formData.title),
        agent_id: formData.agent_id || user?.id,
      };

      if (isEditing && id) {
        const { error } = await supabase.from('properties').update(basePayload).eq('id', id);
        if (error) throw error;

        if (isAdmin && originalAgentId && originalAgentId !== user.id) {
          await supabase.from('notifications').insert([
            {
              user_id: originalAgentId,
              title: 'Imóvel Editado',
              message: `Seu imóvel "${formData.title}" foi editado pela administração.`,
              type: 'system',
              read: false,
              company_id: user.company_id,
            },
          ]);
        }
      } else {
        const { error } = await supabase.from('properties').insert([{ 
          id: activePropertyId, // CRÍTICO: Usa o mesmo ID da pasta de imagens
          ...basePayload, 
          status: 'Disponível',
          company_id: user.company_id,
        }]);
        if (error) throw error;

        if (user?.id) {
          await addXp(user.id, 50, 'new_property');
        }
      }

      navigate('/admin/imoveis');
    } catch (error) {
      console.error('Erro ao salvar imóvel:', error);
      alert('Não foi possível salvar o imóvel.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSave = async () => {
    if (!id) {
      addToast('Salve o imóvel pela primeira vez antes de gerar contratos.', 'info');
      return false;
    }
    try {
      // Sanitiza campos numericos transformando string vazia em null para nao quebrar o PostgreSQL.
      const payloadToSave: Record<string, unknown> = { ...formData };
      const numericFields = [
        'commission_percentage',
        'price',
        'condo_fee',
        'condominium',
        'iptu',
        'area',
        'built_area',
        'bedrooms',
        'suites',
        'bathrooms',
        'parking_spaces',
        'garage',
        'down_payment',
        'balloon_value',
        'latitude',
        'longitude',
        'strategic_weight',
      ];

      numericFields.forEach((field) => {
        if (payloadToSave[field] === '') {
          payloadToSave[field] = null;
        }
      });

      const { error } = await supabase.from('properties').update(payloadToSave).eq('id', id);
      if (error) throw error;

      addToast('Dados do imóvel salvos com sucesso!', 'success');
      return true;
    } catch (error) {
      console.error('Erro ao salvar:', error);
      addToast('Erro ao salvar os dados. Verifique os campos preenchidos.', 'error');
      return false;
    }
  };

  const handleViewSignedPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!existingContract?.id) return;

    try {
      addToast('Gerando documento...', 'info');

      const { data: contractData, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', existingContract.id)
        .single();

      if (error) throw error;
      if (!contractData) throw new Error('Contrato não encontrado');

      // Busca a imagem estática direto do banco com certeza absoluta
      let adminUrl = '';
      if (user?.company_id) {
        const { data: companyInfo } = await supabase
          .from('companies')
          .select('admin_signature_url')
          .eq('id', user.company_id)
          .single();
        if (companyInfo?.admin_signature_url) {
          adminUrl = companyInfo.admin_signature_url;
        }
      }

      // Busca as assinaturas separadamente
      const { data: signatures } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('contract_id', contractData.id);

      let finalHtml = contractData.html_content || contractData.content || '';
      const safeSignatures = signatures || [];

      // SEMPRE roda o injetor para limpar as tags ou injetar a imagem estática
      finalHtml = await injectSignatureStamps(
        finalHtml,
        safeSignatures,
        adminUrl || tenant?.admin_signature_url || undefined
      );

      // O manifesto só roda se houver assinaturas digitais
      if (safeSignatures.length > 0) {
        finalHtml = appendSignatureManifest(
          finalHtml,
          {
            name: tenant?.name || null,
            admin_signature_url: adminUrl || tenant?.admin_signature_url || null,
          },
          safeSignatures
        );
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Contrato - ${contractData.id}</title>
              <style>
                @page { margin: 20mm; }
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f1f5f9; }
                .contract-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .signatures { display: flex; justify-content: space-around; flex-wrap: wrap; margin-top: 40px; }
                .signature-line { text-align: center; margin-top: 20px; }
                .no-print { text-align: center; margin-bottom: 20px; padding: 15px; background: #e2e8f0; border-radius: 8px; }
                .print-btn { background: #0f172a; color: white; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; }
                .print-btn:hover { background: #1e293b; }
                @media print {
                  body { padding: 0; background: white; }
                  .contract-container { box-shadow: none; padding: 0; max-width: 100%; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body>
              <div class="no-print">
                <button class="print-btn" onclick="window.print()">Imprimir / Salvar como PDF</button>
                <p style="margin-top: 10px; font-size: 14px; color: #64748b;">Dica: Na janela de impressão, escolha "Salvar como PDF" como destino.</p>
              </div>
              <div class="contract-container">
                ${finalHtml}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      addToast('Erro ao abrir o PDF do contrato.', 'error');
    }
  };

  const StepIcon = STEP_META[step].icon;
  const CurrentStepIcon = Icons[StepIcon];
  const isStrategyStep = step === 'strategy';

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/imoveis')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Icons.ArrowRight className="rotate-180 text-slate-500" />
          </button>
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-800">
              {isEditing ? 'Editar Imóvel (Wizard)' : 'Novo Imóvel (Wizard)'}
            </h1>
            <p className="text-slate-500 text-sm">Fluxo inteligente para cadastro rápido e completo.</p>
          </div>
        </div>

        <div className={`hidden md:block px-4 py-2 rounded-2xl border text-xs font-semibold ${
          isStrategyStep
            ? 'bg-amber-50 border-amber-100 text-amber-700'
            : 'bg-brand-50 border-brand-100 text-brand-700'
        }`}>
          {STEP_META[step].label}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/50 px-2 sm:px-6">
          {visibleSteps.map((item) => {
            const ActiveIcon = Icons[STEP_META[item].icon];
            const isActive = item === step;
            const isStrategyTab = item === 'strategy';

            return (
              <button
                key={item}
                type="button"
                onClick={async () => {
                  if (item === 'legal' && step !== 'legal') {
                    const saved = await handleQuickSave();
                    if (saved || !id) setStep('legal');
                    return;
                  }

                  setStep(item);
                }}
                className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold transition-all whitespace-nowrap ${
                  isStrategyTab
                    ? isActive
                      ? 'border-amber-500 text-amber-600 bg-amber-50'
                      : 'border-transparent text-slate-500 hover:text-amber-600 hover:bg-amber-50/50'
                    : isActive
                    ? 'border-brand-600 text-brand-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                }`}
              >
                <ActiveIcon size={16} className={isStrategyTab && isActive ? 'text-amber-500' : ''} />
                {STEP_META[item].label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <CurrentStepIcon size={20} className={isStrategyStep ? 'text-amber-600' : 'text-brand-600'} />
            <h2 className="font-bold text-xl">{STEP_META[step].label}</h2>
          </div>

          {step === 'basic' && (
            <div className="space-y-6">
              <fieldset className="inline-flex bg-slate-100 rounded-full p-1">
                <legend className="sr-only">Tipo de anúncio</legend>
                <input
                  id="listing-sale"
                  name="listing_type"
                  type="radio"
                  value="sale"
                  checked={formData.listing_type === 'sale'}
                  onChange={() => handleInput('listing_type', 'sale')}
                  className="sr-only"
                />
                <label
                  htmlFor="listing-sale"
                  className={`px-5 py-2 rounded-full font-semibold text-sm transition-all cursor-pointer ${
                    formData.listing_type === 'sale' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Venda
                </label>

                <input
                  id="listing-rent"
                  name="listing_type"
                  type="radio"
                  value="rent"
                  checked={formData.listing_type === 'rent'}
                  onChange={() => handleInput('listing_type', 'rent')}
                  className="sr-only"
                />
                <label
                  htmlFor="listing-rent"
                  className={`px-5 py-2 rounded-full font-semibold text-sm transition-all cursor-pointer ${
                    formData.listing_type === 'rent' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Aluguel
                </label>
              </fieldset>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="title" className="block text-sm font-bold text-slate-600 mb-2">Título do anúncio</label>
                  <input
                    id="title"
                    name="title"
                    required
                    value={formData.title}
                    onChange={(e) => handleInput('title', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                    placeholder="Ex: Casa alto padrão no Centro"
                  />
                </div>

                <div>
                  <label htmlFor="type" className="block text-sm font-bold text-slate-600 mb-2">Tipo de imóvel</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={(e) => handleInput('type', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                  >
                    {Object.values(PropertyType).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="col-span-1 md:col-span-3">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Icons.DollarSign size={18} className="text-brand-500" /> Valores do Imóvel
                      </h3>
                    </div>

                    <div>
                      <label htmlFor="price" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Valor ({formData.listing_type === 'sale' ? 'Venda' : 'Aluguel Base'}) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                        <input
                          id="price"
                          name="price"
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => handleInput('price', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="condominium" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Condomínio Mensal
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                        <input
                          id="condominium"
                          name="condominium"
                          type="number"
                          min={0}
                          step="0.01"
                          value={formData.condominium || ''}
                          onChange={(e) => handleInput('condominium', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="iptu" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        IPTU Mensal
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                        <input
                          id="iptu"
                          name="iptu"
                          type="number"
                          min={0}
                          step="0.01"
                          value={formData.iptu || ''}
                          onChange={(e) => handleInput('iptu', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    {formData.listing_type === 'rent' && (
                      <div className="col-span-1 md:col-span-3 bg-brand-50 dark:bg-brand-900/20 p-4 rounded-xl flex items-center justify-between border border-brand-100 dark:border-brand-800/30">
                        <span className="text-sm font-bold text-brand-700 dark:text-brand-400">Total Mensal (Pacote Completo):</span>
                        <span className="text-xl font-black text-brand-700 dark:text-brand-400">
                          R$ {(
                            (Number(formData.price) || 0) +
                            (Number(formData.condominium) || 0) +
                            (Number(formData.iptu) || 0)
                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {formData.listing_type === 'sale' && (
                  <>
                    <div>
                      <label htmlFor="down_payment" className="block text-sm font-bold text-slate-600 mb-2">Valor de entrada (R$)</label>
                      <input
                        id="down_payment"
                        name="down_payment"
                        type="number"
                        min={0}
                        value={formData.down_payment}
                        onChange={(e) => handleInput('down_payment', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                        placeholder="Ex: 0"
                      />
                    </div>
                    <div className="flex items-end">
                      <label htmlFor="financing_available" className="w-full inline-flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <input
                          id="financing_available"
                          name="financing_available"
                          type="checkbox"
                          checked={formData.financing_available}
                          onChange={(e) => handleInput('financing_available', e.target.checked)}
                        />
                        <span className="text-sm font-semibold text-slate-700">Aceita financiamento</span>
                      </label>
                    </div>

                    {/* SEÇÃO DE BALÃO */}
                    <div className="md:col-span-2 p-5 bg-amber-50 rounded-2xl border border-amber-200 mt-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.has_balloon}
                          onChange={(e) => handleInput('has_balloon', e.target.checked)}
                          className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                        />
                        <span className="font-bold text-amber-800">Haverá parcelas de Balão / Intermediárias?</span>
                      </label>

                      {formData.has_balloon && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fade-in pt-4 border-t border-amber-200/50">
                          <div>
                            <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Valor do Balão (R$)</label>
                            <input
                              type="number"
                              min={0}
                              value={formData.balloon_value}
                              onChange={(e) => handleInput('balloon_value', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full p-3 bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-500"
                              placeholder="Ex: 0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Periodicidade</label>
                            <select
                              value={formData.balloon_frequency}
                              onChange={(e) => handleInput('balloon_frequency', e.target.value)}
                              className="w-full p-3 bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-500"
                            >
                              <option value="Anual">Anual</option>
                              <option value="Semestral">Semestral</option>
                              <option value="Trimestral">Trimestral</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label htmlFor="bedrooms" className="block text-sm font-bold text-slate-600 mb-2">Quartos</label>
                  <input id="bedrooms" name="bedrooms" type="number" min={0} value={formData.bedrooms} onChange={(e) => handleInput('bedrooms', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label htmlFor="suites" className="block text-sm font-bold text-slate-600 mb-2">Suítes</label>
                  <input id="suites" name="suites" type="number" min={0} value={formData.suites} onChange={(e) => handleInput('suites', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 1" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label htmlFor="bathrooms" className="block text-sm font-bold text-slate-600 mb-2">Banheiros</label>
                  <input id="bathrooms" name="bathrooms" type="number" min={0} value={formData.bathrooms} onChange={(e) => handleInput('bathrooms', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label htmlFor="garage" className="block text-sm font-bold text-slate-600 mb-2">Vagas</label>
                  <input id="garage" name="garage" type="number" min={0} value={formData.garage} onChange={(e) => handleInput('garage', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label htmlFor="area" className="block text-sm font-bold text-slate-600 mb-2">Área (m²)</label>
                  <input id="area" name="area" type="number" min={0} value={formData.area} onChange={(e) => handleInput('area', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label htmlFor="built_area" className="block text-sm font-bold text-slate-600 mb-2">Área Const. (m²)</label>
                  <input id="built_area" name="built_area" type="number" min={0} value={formData.built_area} onChange={(e) => handleInput('built_area', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 100" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Endereço</h3>

                {/* --- MOTOR DE CONDOMÍNIOS --- */}
                <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={isCondominium}
                      onChange={(e) => {
                        setIsCondominium(e.target.checked);
                        if (!e.target.checked) {
                          setShowNewCondoForm(false);
                          setFormData((prev) => ({ ...prev, condominium_id: null }));
                        }
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <label
                      className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                      onClick={() => {
                        const nextValue = !isCondominium;
                        setIsCondominium(nextValue);

                        if (!nextValue) {
                          setShowNewCondoForm(false);
                          setFormData((prev) => ({ ...prev, condominium_id: null }));
                        }
                      }}
                    >
                      Este imóvel fica em um Condomínio?
                    </label>
                  </div>

                  {isCondominium && !showNewCondoForm && (
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Selecione o Condomínio</label>
                        <select
                          value={formData.condominium_id || ''}
                          onChange={(e) => {
                            const condoId = e.target.value;
                            const condo = condominiumsList.find((c) => c.id === condoId);

                            if (condo) {
                              setFormData((prev) => ({
                                ...prev,
                                condominium_id: condo.id,
                                zip_code: condo.zip || prev.zip_code,
                                address: condo.street || prev.address,
                                neighborhood: condo.name,
                                city: condo.city || prev.city,
                                state: condo.state || prev.state,
                              }));
                              addToast('Endereço preenchido via Condomínio!', 'info');
                            } else {
                              setFormData((prev) => ({ ...prev, condominium_id: null }));
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none"
                        >
                          <option value="">Selecione na lista...</option>
                          {condominiumsList.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => {
                            setNewCondo({});
                            setNewCondoFeature('');
                            setIsEditingCondo(false);
                            setShowNewCondoForm(true);
                          }}
                          className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 dark:bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2"
                        >
                          <Icons.Plus size={16} /> Novo
                        </button>

                        {formData.condominium_id && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setNewCondo(selectedCondominium || {});
                                setNewCondoFeature('');
                                setIsEditingCondo(true);
                                setShowNewCondoForm(true);
                              }}
                              className="px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-brand-600 rounded-lg flex items-center justify-center transition-colors"
                            >
                              <Icons.Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCondominium(formData.condominium_id!)}
                              className="px-3 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg flex items-center justify-center transition-colors"
                            >
                              <Icons.Trash size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {isCondominium && showNewCondoForm && (
                    <div className="mt-4 p-5 border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10 rounded-xl">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-brand-200/50 dark:border-brand-800/50">
                        <h4 className="font-bold text-brand-700 dark:text-brand-400">{isEditingCondo ? 'Editar Condomínio' : 'Registrar Novo Condomínio'}</h4>
                        <button
                          type="button"
                          onClick={() => setShowNewCondoForm(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        >
                          <Icons.X size={20} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-2 dark:text-slate-300">Foto do Condomínio</label>
                          <label className="flex flex-col items-center justify-center w-full min-h-[180px] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 cursor-pointer overflow-hidden hover:border-brand-500 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                await handleCondoImageUpload(file);
                              }}
                            />
                            {newCondo.image_url ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={newCondo.image_url}
                                  alt="Preview do condomínio"
                                  className="w-full h-48 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-white text-sm font-semibold">
                                  {uploadingCondoImage ? 'Atualizando foto...' : 'Clique para trocar a foto'}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-slate-500">
                                <Icons.Upload size={26} className="mb-2" />
                                <span className="font-medium">{uploadingCondoImage ? 'Enviando foto...' : 'Clique para enviar a foto do condomínio'}</span>
                                <span className="text-xs mt-1">A imagem será comprimida em WEBP antes do upload.</span>
                              </div>
                            )}
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">Nome Oficial do Condomínio *</label>
                          <input
                            type="text"
                            value={newCondo.name || ''}
                            onChange={(e) => setNewCondo((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                            placeholder="Ex: Residencial Aldeia do Vale"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">CEP Geral</label>
                          <input
                            type="text"
                            value={newCondo.zip || ''}
                            onChange={(e) => setNewCondo((prev) => ({ ...prev, zip: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                            placeholder="00000-000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">Logradouro (Acesso Principal)</label>
                          <input
                            type="text"
                            value={newCondo.street || ''}
                            onChange={(e) => setNewCondo((prev) => ({ ...prev, street: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">Cidade</label>
                          <input
                            type="text"
                            value={newCondo.city || ''}
                            onChange={(e) => setNewCondo((prev) => ({ ...prev, city: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">UF</label>
                          <input
                            type="text"
                            maxLength={2}
                            value={newCondo.state || ''}
                            onChange={(e) => setNewCondo((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 uppercase"
                          />
                        </div>
                      </div>
                      <div className="mb-5 border-t border-brand-200/50 dark:border-brand-800/50 pt-4">
                        <label className="block text-sm font-medium mb-2 dark:text-slate-300">Comodidades do Condomínio</label>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={newCondoFeature}
                            onChange={(e) => setNewCondoFeature(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!newCondoFeature.trim()) return;
                                setNewCondo((prev) => ({ ...prev, features: [...(prev.features || []), newCondoFeature.trim()] }));
                                setNewCondoFeature('');
                              }
                            }}
                            placeholder="Ex: Piscina, Quadra, Segurança 24h..."
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newCondoFeature.trim()) return;
                              setNewCondo((prev) => ({ ...prev, features: [...(prev.features || []), newCondoFeature.trim()] }));
                              setNewCondoFeature('');
                            }}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-bold hover:bg-slate-300"
                          >
                            Adicionar
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(newCondo.features || []).map((feature, idx) => (
                            <span key={idx} className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full text-xs font-medium">
                              {feature}
                              <button
                                type="button"
                                onClick={() => setNewCondo((prev) => ({ ...prev, features: prev.features?.filter((f) => f !== feature) }))}
                                className="text-slate-400 hover:text-red-500 ml-1"
                              >
                                <Icons.X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateCondominium}
                        disabled={uploadingCondoImage}
                        className="w-full py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {uploadingCondoImage ? 'Aguarde o upload da foto...' : isEditingCondo ? 'Salvar Alterações' : 'Salvar no Banco Geral'}
                      </button>
                    </div>
                  )}
                </div>
                {/* --- FIM DO MOTOR --- */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="zip_code" className="block text-sm font-bold text-slate-600 mb-2">CEP</label>
                  <div className="flex gap-2">
                    <input
                      id="zip_code"
                      name="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => handleInput('zip_code', e.target.value)}
                      onBlur={fetchAddressByCep}
                      placeholder="00000-000"
                      className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    />
                    <button
                      type="button"
                      onClick={fetchAddressByCep}
                      className="px-4 rounded-xl bg-slate-900 text-white font-semibold"
                    >
                      {fetchingCep ? '...' : 'Buscar'}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="address" className="block text-sm font-bold text-slate-600 mb-2">Rua / Endereço</label>
                  <input id="address" name="address" value={formData.address} onChange={(e) => handleInput('address', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label htmlFor="neighborhood" className="block text-sm font-bold text-slate-600 mb-2">Bairro</label>
                  <input id="neighborhood" name="neighborhood" value={formData.neighborhood} onChange={(e) => handleInput('neighborhood', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="city" className="block text-sm font-bold text-slate-600 mb-2">Cidade</label>
                    <input id="city" name="city" value={formData.city} onChange={(e) => handleInput('city', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-bold text-slate-600 mb-2">UF</label>
                    <input id="state" name="state" value={formData.state} onChange={(e) => handleInput('state', e.target.value.toUpperCase())} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" maxLength={2} />
                  </div>
                </div>

                <div className="md:col-span-2 mt-4">
                  <label className="block text-sm font-bold text-slate-600 mb-2">Localização Exata no Mapa (Opcional)</label>
                  <p className="text-xs text-slate-400 mb-2">Clique no mapa para marcar o ponto exato do imóvel.</p>
                  <div className="h-[300px] w-full rounded-xl overflow-hidden border border-slate-200 z-0 relative">
                    <MapContainer center={formData.latitude ? [formData.latitude, formData.longitude] : [-17.7441, -48.6256]} zoom={14} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <LocationMarker
                        position={formData.latitude ? { lat: formData.latitude, lng: formData.longitude } : null}
                        setPosition={(latlng: any) => { handleInput('latitude', latlng.lat); handleInput('longitude', latlng.lng); }}
                      />
                    </MapContainer>
                  </div>
                </div>
                </div>
              </div>

              <div>
                  <label htmlFor="new-feature" className="block text-sm font-bold text-slate-600 mb-2">Comodidades</label>
                  <div className="flex flex-col md:flex-row gap-2 mb-3">
                    <input 
                      id="new-feature" 
                      name="new_feature" 
                      value={newFeature} 
                      onChange={(e) => setNewFeature(e.target.value)}
                      // ADICIONE ESTA LINHA ABAIXO:
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                      placeholder="Ex: Piscina aquecida" 
                      className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900" 
                    />
                    <button 
                      type="button" 
                      onClick={addFeature} 
                      className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
  
  <div className="flex flex-wrap gap-2">
    {formData.features.map((feature) => (
      <span key={feature} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 border border-slate-200 text-sm text-slate-700">
        {feature}
        <button type="button" onClick={() => removeFeature(feature)}>
          <Icons.X size={14} />
        </button>
      </span>
    ))}
  </div>
</div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="description" className="block text-sm font-bold text-slate-600">Descrição</label>
                  <button
                    type="button"
                    onClick={generateDescriptionWithAI}
                    className="text-sm font-bold text-brand-700 hover:underline"
                  >
                    {generatingDescription ? 'Gerando...' : 'Gerar descrição com IA'}
                  </button>
                </div>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  value={formData.description}
                  onChange={(e) => handleInput('description', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  placeholder="Descreva o imóvel com foco em diferenciais..."
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Corretor Responsável (Captador)</label>
                  <select
                    value={formData.agent_id || user.id}
                    onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
                    required
                  >
                    <option value={user.id}>Eu mesmo ({user.name})</option>
                    {agents.filter((a) => a.id !== user.id).map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {step === 'owner' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-6">
                <p className="text-sm text-indigo-800 font-medium flex items-center gap-2">
                  <Icons.Info size={16} className="text-indigo-500" />
                  Os dados do proprietário são mantidos em sigilo e servem para <b>pré-preenchimento automático</b> na hora de gerar contratos de venda ou aluguel.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="owner_name" className="block text-sm font-bold text-slate-600 mb-2">Nome do Proprietário *</label>
                  <input id="owner_name" value={formData.owner_name} onChange={(e) => handleInput('owner_name', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Ex: João da Silva" />
                </div>
                <div>
                  <label htmlFor="owner_document" className="block text-sm font-bold text-slate-600 mb-2">CPF / CNPJ *</label>
                  <input id="owner_document" value={formData.owner_document} onChange={(e) => handleInput('owner_document', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="000.000.000-00" />
                </div>
                <div>
                  <label htmlFor="owner_marital_status" className="block text-sm font-bold text-slate-600 mb-2">Estado Civil</label>
                  <select id="owner_marital_status" value={formData.owner_marital_status} onChange={(e) => handleInput('owner_marital_status', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500">
                    <option value="">Selecione...</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                    <option value="União Estável">União Estável</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="owner_rg" className="block text-sm font-bold text-slate-600 mb-2">RG do Proprietário</label>
                  <input id="owner_rg" value={formData.owner_rg} onChange={(e) => handleInput('owner_rg', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Apenas números" />
                </div>
                <div>
                  <label htmlFor="owner_rg_org" className="block text-sm font-bold text-slate-600 mb-2">Órgão Emissor</label>
                  <select id="owner_rg_org" value={formData.owner_rg_org} onChange={(e) => handleInput('owner_rg_org', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500">
                    <option value="">Selecione...</option>
                    {ORGAOS.map((org) => (
                      <option key={org} value={org}>
                        {org}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="owner_rg_uf" className="block text-sm font-bold text-slate-600 mb-2">UF do RG</label>
                  <select id="owner_rg_uf" value={formData.owner_rg_uf} onChange={(e) => handleInput('owner_rg_uf', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500">
                    <option value="">UF...</option>
                    {UFs.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="owner_profession" className="block text-sm font-bold text-slate-600 mb-2">Profissão</label>
                  <input id="owner_profession" value={formData.owner_profession} onChange={(e) => handleInput('owner_profession', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Ex: Engenheiro" />
                </div>
                <div>
                  <label htmlFor="owner_email" className="block text-sm font-bold text-slate-600 mb-2">E-mail</label>
                  <input id="owner_email" type="email" value={formData.owner_email} onChange={(e) => handleInput('owner_email', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="joao@email.com" />
                </div>
                <div>
                  <label htmlFor="owner_phone" className="block text-sm font-bold text-slate-600 mb-2">Telefone / WhatsApp</label>
                  <input id="owner_phone" value={formData.owner_phone} onChange={(e) => handleInput('owner_phone', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="(00) 00000-0000" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="owner_address" className="block text-sm font-bold text-slate-600 mb-2">Endereço Residencial Atual</label>
                  <input id="owner_address" value={formData.owner_address} onChange={(e) => handleInput('owner_address', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Rua, número, bairro, cidade - UF" />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <Icons.Wallet size={18} className="text-brand-500" /> Dados para Repasse (Opcional)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Chave PIX</label>
                    <select
                      value={formData.owner_pix_type || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, owner_pix_type: e.target.value }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none"
                    >
                      <option value="">Selecione...</option>
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Celular</option>
                      <option value="random">Chave Aleatória</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chave PIX do Proprietário</label>
                    <input
                      type="text"
                      placeholder="Ex: 000.000.000-00"
                      value={formData.owner_pix_key || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, owner_pix_key: e.target.value }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Ao preencher esta chave, o sistema facilitará o cálculo de repasse automático no módulo financeiro quando um aluguel for recebido.
                </p>
              </div>

              {(formData.owner_marital_status === 'Casado(a)' || formData.owner_marital_status === 'União Estável') && (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 mt-4 animate-fade-in space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Dados do Cônjuge</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label htmlFor="owner_spouse_name" className="block text-xs font-bold text-slate-500 mb-1">Nome do Cônjuge</label>
                      <input id="owner_spouse_name" value={formData.owner_spouse_name} onChange={(e) => handleInput('owner_spouse_name', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="owner_spouse_cpf" className="block text-xs font-bold text-slate-500 mb-1">CPF do Cônjuge</label>
                      <input id="owner_spouse_cpf" value={formData.owner_spouse_cpf} onChange={(e) => handleInput('owner_spouse_cpf', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="owner_spouse_rg" className="block text-xs font-bold text-slate-500 mb-1">RG do Cônjuge</label>
                      <input id="owner_spouse_rg" value={formData.owner_spouse_rg} onChange={(e) => handleInput('owner_spouse_rg', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="owner_spouse_rg_org" className="block text-xs font-bold text-slate-500 mb-1">Órgão Emissor</label>
                      <select id="owner_spouse_rg_org" value={formData.owner_spouse_rg_org} onChange={(e) => handleInput('owner_spouse_rg_org', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm">
                        <option value="">Selecione...</option>
                        {ORGAOS.map((org) => (
                          <option key={org} value={org}>
                            {org}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="owner_spouse_rg_uf" className="block text-xs font-bold text-slate-500 mb-1">UF do RG</label>
                      <select id="owner_spouse_rg_uf" value={formData.owner_spouse_rg_uf} onChange={(e) => handleInput('owner_spouse_rg_uf', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm">
                        <option value="">UF...</option>
                        {UFs.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {canAccessStrategy && step === 'strategy' && (
            <div className="space-y-6 animate-fade-in p-2">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-6">
                <h3 className="text-lg font-black text-amber-800 flex items-center gap-2 mb-2">
                  <Icons.Trophy size={20} className="text-amber-600" /> Importância na Liga dos Corretores
                </h3>
                <p className="text-sm text-amber-700/80 mb-6 leading-relaxed">
                  Configure o peso deste imóvel na gamificação. Imóveis mais difíceis, exclusivos ou com maior margem de comissão devem gerar mais pontos quando o corretor realizar o fechamento.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-amber-200/50 shadow-sm">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Classificação Comercial</label>
                    <select
                      value={formData.priority_level}
                      onChange={(e) => {
                        const val = e.target.value as PropertyPriorityLevel;
                        let weight = 1.0;
                        if (val === 'estrategico') weight = 1.2;
                        if (val === 'dificil') weight = 1.35;
                        if (val === 'premium') weight = 1.5;
                        if (val === 'alta_comissao') weight = 1.6;
                        setFormData((prev) => ({ ...prev, priority_level: val, strategic_weight: weight }));
                      }}
                      className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-amber-500 focus:ring-amber-500 bg-slate-50"
                    >
                      <option value="padrao">Imóvel Padrão (Multiplicador x1.0)</option>
                      <option value="estrategico">Estratégico / Boa Liquidez (x1.2)</option>
                      <option value="dificil">Imóvel Âncora / Venda Difícil (x1.35)</option>
                      <option value="premium">Premium / Exclusividade Absoluta (x1.5)</option>
                      <option value="alta_comissao">Alta Comissão / Parceria Estratégica (x1.6)</option>
                    </select>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-amber-200/50 shadow-sm flex flex-col justify-center items-center text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Multiplicador Atual</p>
                    <div className="text-4xl font-black text-amber-500 flex items-baseline gap-1">
                      x{formData.strategic_weight.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Na venda deste imóvel, a pontuação base (300) valerá <strong>{Math.round(300 * formData.strategic_weight)} pontos</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'legal' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Comissão Acordada (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.commission_percentage || ''}
                      onChange={e => setFormData({ ...formData, commission_percentage: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-brand-500 outline-none"
                    />
                    <span className="absolute right-4 top-3 text-slate-400 font-bold">%</span>
                  </div>
                </div>
                <div className="flex items-center mt-8">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.has_exclusivity || false}
                      onChange={e => setFormData({ ...formData, has_exclusivity: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contrato com Exclusividade</span>
                  </label>
                </div>
              </div>

              <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Gerador de Contratos</h3>
                  {existingContract && (
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${existingContract.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {existingContract.status === 'signed' ? 'Assinado' : 'Pendente de Assinatura'}
                    </span>
                  )}
                </div>

                {!existingContract ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Tipo de Serviço</label>
                      <select
                        value={legalServiceType}
                        onChange={e => setLegalServiceType(e.target.value as 'intermediation' | 'administration')}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500"
                      >
                        <option value="intermediation">Apenas Intermediação (Angariação)</option>
                        {formData.listing_type === 'rent' && <option value="administration">Intermediação + Administração Mensal</option>}
                      </select>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!id) {
                            addToast('Salve o imóvel antes de gerar o contrato.', 'info');
                            return;
                          }
                          setShowContractModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-brand-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-sm"
                      >
                        <Icons.FileText size={18} />
                        Gerar Contrato de {legalServiceType === 'administration' ? 'Administração' : 'Intermediação'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/contratos/${existingContract.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                    >
                      <Icons.Eye size={18} /> Ver Documento
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSignatureManager(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-brand-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm shadow-brand-500/20"
                    >
                      <Icons.PenTool size={18} /> Gerir Assinaturas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Deseja alterar o tipo de serviço e gerar um novo contrato? (O atual será substituído).')) {
                          setExistingContract(null);
                        }
                      }}
                      className="sm:w-auto w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-3 rounded-xl font-bold transition-colors"
                      title="Configurar Novo Contrato"
                    >
                      <Icons.RefreshCw size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'media' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-xl gap-4">
                <div>
                  <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Icons.Image size={18} className="text-brand-500" /> Galeria do Imóvel
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Arraste para reordenar. A primeira é a capa.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    isOverImageLimit
                      ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800/50'
                      : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                  }`}>
                    {images.length} / {MAX_IMAGES} fotos
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                    <button type="button" onClick={sortImagesByName} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors" title="Ordenar por Nome">
                      <Icons.SortAsc size={12} /> A-Z
                    </button>
                    <button type="button" onClick={reverseImages} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors" title="Inverter Ordem Atual">
                      <Icons.RefreshCw size={12} /> Inverter
                    </button>
                  </div>
                </div>
              </div>

              {isOverImageLimit && (
                <div className="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3">
                  <Icons.AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Limite de Imagens Excedido!</h3>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Seu plano permite até {MAX_IMAGES} imagens por imóvel. Você enviou {images.length}.
                      <strong> Apague {exceededImagesCount} foto(s) marcadas em vermelho</strong> para conseguir salvar este imóvel.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-image-url" className="block text-xs font-bold text-slate-400 mb-2 uppercase">Adicionar por URL</label>
                  <div className="flex gap-2">
                    <input
                      id="new-image-url"
                      name="new_image_url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                    <button type="button" onClick={addImageByUrl} className="px-4 rounded-xl bg-slate-900 text-white font-semibold">Add</button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Upload do dispositivo</label>
                  <label className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center gap-2 cursor-pointer hover:border-brand-400 transition-colors">
                    <input
                      id="media_upload"
                      name="media_upload"
                      type="file"
                      accept="image/*,.heic"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && addFiles(e.target.files)}
                    />
                    <Icons.Upload size={16} />
                    <span className="font-semibold text-sm">{uploading ? 'Enviando...' : 'Selecionar imagens'}</span>
                  </label>
                  {(uploading || uploadStatus) && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-500">{uploadStatus || 'Processando imagens...'}</p>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropArea}
              >
                <p className="text-slate-600 font-medium">Arraste e solte imagens aqui para upload</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP • reordene depois arrastando no grid</p>
              </div>

              {images.length === 0 ? (
                <p className="text-center text-slate-400 py-10 bg-slate-50 rounded-xl border border-slate-100">
                  Nenhuma imagem adicionada.
                </p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto" onDragOver={handleDragOverContainer}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((image, idx) => (
                      <SortableImageCard
                        key={image.id}
                        image={image}
                        index={idx}
                        isExceeded={idx >= MAX_IMAGES}
                        onRemove={removeImage}
                        onDragStart={setDraggingImageId}
                        onDropOn={handleDropOnImage}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'seo' && (
            <div className="space-y-6">
              <div>
                  <label htmlFor="seo_title" className="block text-sm font-bold text-slate-600 mb-2">SEO Title</label>
                <input
                  id="seo_title"
                  name="seo_title"
                  value={formData.seo_title || formData.title}
                  onChange={(e) => handleInput('seo_title', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="Título para Google (até 60 caracteres)"
                />
              </div>
              <div>
                <label htmlFor="seo_description" className="block text-sm font-bold text-slate-600 mb-2">SEO Description</label>
                <textarea
                  id="seo_description"
                  name="seo_description"
                  rows={4}
                  value={formData.seo_description || formData.description.slice(0, 155)}
                  onChange={(e) => handleInput('seo_description', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="Descrição curta para resultados de busca"
                />
              </div>

            </div>
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 sticky bottom-0 z-10">
          
          <button
            type="button"
            onClick={goBack}
            disabled={step === 'basic'}
            className={`px-5 py-3 rounded-xl font-bold transition-colors w-full sm:w-auto text-center ${
              step === 'basic'
                ? 'text-slate-300 cursor-not-allowed hidden sm:block'
                : 'text-slate-600 hover:bg-slate-200 bg-slate-200/50 sm:bg-transparent'
            }`}
          >
            Voltar
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Botão de Salvar Rápido (Oculto na última etapa) */}
            {step !== 'legal' && (
              <button
                 type="submit"
                 disabled={loading}
                 className="px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
               >
                 {loading ? <Icons.Loader2 className="animate-spin" size={16} /> : <Icons.Save size={16} />}
                 Salvar e Sair
               </button>
            )}

            {step !== 'legal' ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-40 w-full sm:w-auto text-center"
              >
                Próximo passo
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="px-6 py-3 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Icons.Eye size={16} />
                  Visualizar no Site
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
                >
                  {loading ? <Icons.Loader2 className="animate-spin" size={16} /> : <Icons.CheckCircle size={16} />}
                  {isEditing ? 'Atualizar imóvel' : 'Cadastrar imóvel'}
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      <PropertyPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        data={{
          ...formData,
          images: images.map((item) => item.url),
        }}
      />

      <IntermediationContractModal
        isOpen={showContractModal}
        onClose={() => setShowContractModal(false)}
        onSuccess={() => {
          setShowContractModal(false);
          if (id) {
            supabase
              .from('contracts')
              .select('id, status')
              .eq('property_id', id)
              .eq('contract_data->>document_type', 'intermediacao')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
              .then(async ({ data }) => {
                if (data) {
                  const { data: signatures } = await supabase.from('contract_signatures').select('status').eq('contract_id', data.id);
                  const isSigned = signatures?.some((sig: any) => sig.status === 'signed');
                  setExistingContract({ id: data.id, status: isSigned ? 'signed' : data.status });
                }
              });
          }
        }}
        propertyId={id || ''}
        serviceType={legalServiceType}
        propertyData={{
          title: formData.title,
          listing_type: formData.listing_type,
          price: formData.price,
          address: formData.address,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          owner_name: formData.owner_name,
          owner_phone: formData.owner_phone,
          owner_email: formData.owner_email,
          owner_document: formData.owner_document,
          owner_rg: formData.owner_rg,
          owner_rg_org: formData.owner_rg_org,
          owner_rg_uf: formData.owner_rg_uf,
          owner_profession: formData.owner_profession,
          owner_marital_status: formData.owner_marital_status,
          owner_address: formData.owner_address,
          owner_spouse_name: formData.owner_spouse_name,
          owner_spouse_cpf: formData.owner_spouse_cpf,
          owner_spouse_rg: formData.owner_spouse_rg,
          owner_spouse_rg_org: formData.owner_spouse_rg_org,
          owner_spouse_rg_uf: formData.owner_spouse_rg_uf,
          commission_percentage: formData.commission_percentage,
          has_exclusivity: formData.has_exclusivity,
          agent_id: formData.agent_id,
        }}
      />

      {showSignatureManager && existingContract && (
        <SignatureManagerModal
          contractId={existingContract.id}
          companyId={user?.company_id || ''}
          onClose={() => {
            setShowSignatureManager(false);
            if (id) {
              supabase
                .from('contracts')
                .select('id, status')
                .eq('property_id', id)
                .eq('contract_data->>document_type', 'intermediacao')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(async ({ data }) => {
                  if (data) {
                    const { data: signatures } = await supabase.from('contract_signatures').select('status').eq('contract_id', data.id);
                    const isSigned = signatures?.some((sig: any) => sig.status === 'signed');
                    setExistingContract({ id: data.id, status: isSigned ? 'signed' : data.status });
                  }
                });
            }
          }}
          initialSigner={{
            name: formData.owner_name,
            email: formData.owner_email,
            role: 'Proprietário'
          }}
        />
      )}
    </div>
  );
};

export default AdminPropertyForm;
