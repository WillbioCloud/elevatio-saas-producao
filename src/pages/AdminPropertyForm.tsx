import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import heic2any from 'heic2any';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import PropertyPreviewModal from '../components/PropertyPreviewModal';
import { useAuth } from '../contexts/AuthContext';
import { PropertyType, type ListingType } from '../types';
import { useToast } from '../contexts/ToastContext';
import { addXp } from '../services/gamification';
import { generatePropertyDescription } from '../services/ai';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

type WizardStep = 'basic' | 'details' | 'media' | 'seo';

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
  rent_package_price: number | '';
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
  latitude: number;
  longitude: number;
  seo_title: string;
  seo_description: string;
  agent_id: string;
}

const STEP_ORDER: WizardStep[] = ['basic', 'details', 'media', 'seo'];

const STEP_META: Record<WizardStep, { label: string; icon: keyof typeof Icons }> = {
  basic: { label: 'Básico', icon: 'Home' },
  details: { label: 'Detalhes', icon: 'List' },
  media: { label: 'Multimídia', icon: 'Image' },
  seo: { label: 'SEO', icon: 'Globe' },
};

const defaultForm: FormState = {
  title: '',
  description: '',
  type: PropertyType.HOUSE,
  listing_type: 'sale',
  price: '',
  rent_package_price: '',
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
  latitude: 0,
  longitude: 0,
  seo_title: '',
  seo_description: '',
  agent_id: '',
};

const createSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .concat(`-${Math.floor(Math.random() * 10000)}`);

const SortableImageCard: React.FC<{
  image: ImageItem;
  index: number;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropOn: (id: string) => void;
}> = ({ image, index, onRemove, onDragStart, onDropOn }) => {
  return (
    <div
      className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square"
      draggable
      onDragStart={() => onDragStart(image.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropOn(image.id)}
    >
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
  const { user } = useAuth();
  const { addToast } = useToast();
  const isEditing = Boolean(id);

  const [step, setStep] = useState<WizardStep>('basic');
  const [formData, setFormData] = useState<FormState>(defaultForm);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [originalAgentId, setOriginalAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');


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

      if (user && user.role !== 'admin' && data.agent_id !== user.id) {
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
        rent_package_price: data.rent_package_price || '',
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
        latitude: Number(data.latitude || 0),
        longitude: Number(data.longitude || 0),
        seo_title: data.seo_title || '',
        seo_description: data.seo_description || '',
        agent_id: data.agent_id || user?.id || '',
      });

      setOriginalAgentId(data.agent_id);

      const existingImages: ImageItem[] = (data.images || []).map((url: string, idx: number) => ({
        id: `${idx}-${url}`,
        url,
      }));
      setImages(existingImages);
    };

    loadProperty();
  }, [id, isEditing, user?.id, user?.role, addToast, navigate]);

  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('active', true);
      if (data) setAgents(data);
    };

    if (user?.role === 'admin') {
      fetchAgents();
    }
  }, [user?.role]);

  const handleInput = (name: keyof FormState, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      const generatedText = await generatePropertyDescription(propertyFeatures);

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
    const fileName = `${user?.id || 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

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

  const goNext = () => {
    const index = STEP_ORDER.indexOf(step);
    if (index < STEP_ORDER.length - 1) setStep(STEP_ORDER[index + 1]);
  };

  const goBack = () => {
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) setStep(STEP_ORDER[index - 1]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

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
        rent_package_price: formData.listing_type === 'rent' ? Number(formData.rent_package_price) : null,
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
        latitude: Number(formData.latitude) || null,
        longitude: Number(formData.longitude) || null,
        seo_title: formData.seo_title || formData.title,
        seo_description: formData.seo_description || formData.description.slice(0, 155),
        images: images.map((item) => item.url),
        slug: isEditing ? undefined : createSlug(formData.title),
        agent_id: formData.agent_id || user?.id,
      };

      if (isEditing && id) {
        const { error } = await supabase.from('properties').update(basePayload).eq('id', id);
        if (error) throw error;

        if (user?.role === 'admin' && originalAgentId && originalAgentId !== user.id) {
          await supabase.from('notifications').insert([
            {
              user_id: originalAgentId,
              title: 'Imóvel Editado',
              message: `Seu imóvel "${formData.title}" foi editado pela administração.`,
              type: 'system',
              read: false,
            },
          ]);
        }
      } else {
        const { error } = await supabase.from('properties').insert([{ 
          ...basePayload, 
          status: 'Disponível' 
        }]);
        if (error) throw error;

        if (user?.id) {
          await addXp(user.id, 50);
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

  const StepIcon = STEP_META[step].icon;
  const CurrentStepIcon = Icons[StepIcon];

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

        <div className="hidden md:block px-4 py-2 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold">
          {STEP_META[step].label}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3 md:p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STEP_ORDER.map((item, index) => {
            const ActiveIcon = Icons[STEP_META[item].icon];
            const isActive = item === step;
            const isDone = STEP_ORDER.indexOf(step) > index;

            return (
              <button
                key={item}
                type="button"
                onClick={() => setStep(item)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-lg'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <ActiveIcon size={16} />
                {STEP_META[item].label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <CurrentStepIcon size={20} className="text-brand-600" />
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

                <div>
                  <label htmlFor="price" className="block text-sm font-bold text-slate-600 mb-2">
                    {formData.listing_type === 'sale' ? 'Preço de venda (R$)' : 'Aluguel mensal (R$)'}
                  </label>
                  <input
                    id="price"
                    name="price"
                    required
                    type="number"
                    min={0}
                    value={formData.price}
                    onChange={(e) => handleInput('price', e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                    placeholder="Ex: 0"
                  />
                </div>

                {formData.listing_type === 'rent' ? (
                  <div className="md:col-span-2">
                    <label htmlFor="rent_package_price" className="block text-sm font-bold text-slate-600 mb-2">Pacote (condomínio + taxas) (R$)</label>
                    <input
                      id="rent_package_price"
                      name="rent_package_price"
                      type="number"
                      min={0}
                      value={formData.rent_package_price}
                      onChange={(e) => handleInput('rent_package_price', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                      placeholder="Ex: 0"
                    />
                  </div>
                ) : (
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

              {user?.role === 'admin' && (
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

          {step === 'media' && (
            <div className="space-y-6">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((image, idx) => (
                    <SortableImageCard
                      key={image.id}
                      image={image}
                      index={idx}
                      onRemove={removeImage}
                      onDragStart={setDraggingImageId}
                      onDropOn={handleDropOnImage}
                    />
                  ))}
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
            {step !== 'seo' && (
              <button
                 type="submit"
                 disabled={loading}
                 className="px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
               >
                 {loading ? <Icons.Loader2 className="animate-spin" size={16} /> : <Icons.Save size={16} />}
                 Salvar e Sair
               </button>
            )}

            {step !== 'seo' ? (
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
    </div>
  );
};

export default AdminPropertyForm;