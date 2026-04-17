import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { type ListingType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../contexts/ToastContext';
import { buildContractHtml, generateContract } from '../utils/contractGenerator';

interface IntermediationContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId: string;
  serviceType: 'intermediation' | 'administration';
  propertyData: {
    title: string;
    listing_type: ListingType;
    price: number | '';
    address: string;
    neighborhood: string;
    city: string;
    state: string;
    zip_code?: string;
    owner_name: string;
    owner_phone: string;
    owner_email: string;
    owner_document: string;
    owner_rg: string;
    owner_rg_org?: string;
    owner_rg_uf?: string;
    owner_profession: string;
    owner_marital_status: string;
    owner_address: string;
    owner_spouse_name?: string;
    owner_spouse_cpf?: string;
    owner_spouse_rg?: string;
    owner_spouse_rg_org?: string;
    owner_spouse_rg_uf?: string;
    commission_percentage?: number | '';
    has_exclusivity?: boolean;
    property_registration?: string;
    property_registry_office?: string;
    property_municipal_registration?: string;
    agent_id?: string;
  };
}

interface BrokerOption {
  id: string;
  name: string;
  cpf_cnpj?: string | null;
  creci?: string | null;
}

const formatRgWithIssuer = (rg?: string | null, org?: string | null, uf?: string | null) => {
  const baseRg = String(rg || '').trim();
  if (!baseRg) return '';

  const issuer = [org, uf].filter(Boolean).join('/');
  return issuer ? `${baseRg} ${issuer}`.trim() : baseRg;
};

const buildPropertyAddress = (propertyData: IntermediationContractModalProps['propertyData']) =>
  [
    propertyData.address,
    propertyData.neighborhood,
    `${propertyData.city} - ${propertyData.state}`.trim(),
    propertyData.zip_code ? `CEP ${propertyData.zip_code}` : '',
  ]
    .filter(Boolean)
    .join(', ');

const formatPriceInput = (value: number | '') => (value === '' ? '' : String(value));

const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const IntermediationContractModal: React.FC<IntermediationContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
  serviceType,
  propertyData,
}) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);
  const [brokerProfile, setBrokerProfile] = useState<{
    name: string;
    cpf_cnpj: string;
    creci: string;
    company?: {
      name?: string | null;
      logo_url?: string | null;
    } | null;
  } | null>(null);

  const resolveInitialCommissionPercentage = () => {
    const value = propertyData.commission_percentage;
    const fallback = propertyData.listing_type === 'rent' ? 100 : 6;

    if (value === '' || value == null) {
      return fallback;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  };

  const [commissionPercentage, setCommissionPercentage] = useState(resolveInitialCommissionPercentage);
  const [adminFeePercentage, setAdminFeePercentage] = useState('10');
  const [transferDay, setTransferDay] = useState('10');
  const [representationType, setRepresentationType] = useState('imobiliaria');
  const [validityDays, setValidityDays] = useState('90');

  const [formState, setFormState] = useState({
    broker_id: '',
    contract_date: new Date().toISOString().split('T')[0],
    total_value: '',
    commission_percentage: '',
    has_exclusivity: true,
    seller_name: '',
    seller_phone: '',
    seller_email: '',
    seller_document: '',
    seller_rg: '',
    seller_rg_org: '',
    seller_rg_uf: '',
    seller_profession: '',
    seller_marital_status: '',
    seller_address: '',
    seller_spouse_name: '',
    seller_spouse_document: '',
    seller_spouse_rg: '',
  });

  const isRentListing = propertyData.listing_type === 'rent';
  const valueLabel = isRentListing ? 'Valor Pretendido da Locação (R$/mês)' : 'Valor Pretendido de Venda (R$)';
  const priceValue = parseNumber(formState.total_value);
  const commissionPct = Number.isFinite(commissionPercentage) ? commissionPercentage : 0;
  const commissionValue = (priceValue * commissionPct) / 100;

  const propertyAddress = useMemo(() => buildPropertyAddress(propertyData), [propertyData]);
  const selectedBroker = brokers.find((broker) => broker.id === formState.broker_id);

  useEffect(() => {
    if (!isOpen) return;

    const initialCommissionPercentage = resolveInitialCommissionPercentage();
    setCommissionPercentage(initialCommissionPercentage);
    setAdminFeePercentage('10');
    setTransferDay('10');
    setRepresentationType('imobiliaria');
    setValidityDays('90');

    setFormState({
      broker_id: propertyData.agent_id || user?.id || '',
      contract_date: new Date().toISOString().split('T')[0],
      total_value: formatPriceInput(propertyData.price),
      commission_percentage: String(initialCommissionPercentage),
      has_exclusivity: propertyData.has_exclusivity ?? true,
      seller_name: propertyData.owner_name || '',
      seller_phone: propertyData.owner_phone || '',
      seller_email: propertyData.owner_email || '',
      seller_document: propertyData.owner_document || '',
      seller_rg: propertyData.owner_rg || '',
      seller_rg_org: propertyData.owner_rg_org || '',
      seller_rg_uf: propertyData.owner_rg_uf || '',
      seller_profession: propertyData.owner_profession || '',
      seller_marital_status: propertyData.owner_marital_status || '',
      seller_address: propertyData.owner_address || '',
      seller_spouse_name: propertyData.owner_spouse_name || '',
      seller_spouse_document: propertyData.owner_spouse_cpf || '',
      seller_spouse_rg: formatRgWithIssuer(
        propertyData.owner_spouse_rg,
        propertyData.owner_spouse_rg_org,
        propertyData.owner_spouse_rg_uf
      ),
    });
  }, [isOpen, propertyData, user?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchModalData = async () => {
      const [{ data: brokersData }, { data: authProfile }] = await Promise.all([
        supabase.from('profiles').select('id, name, cpf_cnpj, creci').eq('active', true),
        supabase
          .from('profiles')
          .select('name, cpf_cnpj, creci, company:companies(name, logo_url)')
          .eq('id', user?.id)
          .maybeSingle(),
      ]);

      if (brokersData) {
        setBrokers(brokersData as BrokerOption[]);
      }

      if (authProfile) {
        setBrokerProfile(authProfile as any);
      }
    };

    void fetchModalData();
  }, [isOpen, user?.id]);

  const handleInput =
    (field: keyof typeof formState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        event.currentTarget instanceof HTMLInputElement && event.currentTarget.type === 'checkbox'
          ? event.currentTarget.checked
          : event.currentTarget.value;
      setFormState((prev) => ({ ...prev, [field]: value }));
    };

  const formattedSellerRg = formatRgWithIssuer(formState.seller_rg, formState.seller_rg_org, formState.seller_rg_uf);
  const projectionBaseValue = formState.total_value === '' ? Number(propertyData.price) || 0 : priceValue;
  const recurringAdminFeeValue = (projectionBaseValue * Number(adminFeePercentage)) / 100;

  const contractDataObj = {
    owner_name: formState.seller_name,
    owner_document: formState.seller_document,
    owner_rg: formattedSellerRg,
    owner_rg_org: formState.seller_rg_org,
    owner_rg_uf: formState.seller_rg_uf,
    owner_profession: formState.seller_profession,
    owner_marital_status: formState.seller_marital_status,
    owner_address: formState.seller_address,
    seller_name: formState.seller_name,
    seller_phone: formState.seller_phone,
    seller_email: formState.seller_email,
    seller_document: formState.seller_document,
    seller_rg: formattedSellerRg,
    seller_rg_org: formState.seller_rg_org,
    seller_rg_uf: formState.seller_rg_uf,
    seller_profession: formState.seller_profession,
    seller_marital_status: formState.seller_marital_status,
    seller_address: formState.seller_address,
    seller_spouse_name: formState.seller_spouse_name,
    seller_spouse_document: formState.seller_spouse_document,
    seller_spouse_rg: formState.seller_spouse_rg,
    seller_spouse_profession: '',
    property_address: propertyAddress,
    property_city: propertyData.city,
    property_state: propertyData.state,
    property_description: propertyData.title,
    property_registration: propertyData.property_registration || '',
    property_registry_office: propertyData.property_registry_office || '',
    property_municipal_registration: propertyData.property_municipal_registration || '',
    price: formState.total_value,
    sale_total_value: isRentListing ? '' : formState.total_value,
    rent_value: isRentListing ? formState.total_value : '',
    total_value: formState.total_value,
    commission_percentage: commissionPercentage,
    admin_fee_percentage: serviceType === 'administration' ? adminFeePercentage : '0',
    transfer_day: transferDay,
    validity_days: validityDays,
    representation_type: representationType,
    broker_name: representationType === 'imobiliaria' ? (tenant?.corporate_name || tenant?.name) : (user?.user_metadata?.full_name || 'Corretor'),
    broker_document: representationType === 'imobiliaria' ? (tenant?.document || tenant?.cnpj || tenant?.cpf || '') : (user?.user_metadata?.document || user?.user_metadata?.cpf || ''),
    broker_creci: representationType === 'imobiliaria' ? (tenant?.creci || tenant?.creci_number || '') : (user?.user_metadata?.creci || ''),
    broker_email: representationType === 'imobiliaria' ? tenant?.email : user?.email,
    has_exclusivity: formState.has_exclusivity,
    listing_type: propertyData.listing_type,
    contract_date: formState.contract_date,
  };

  const validateBeforeSave = () => {
    if (!propertyId) {
      addToast('Salve o imóvel antes de gerar o contrato.', 'error');
      return false;
    }

    if (!formState.seller_name.trim()) {
      addToast('Informe o nome do proprietário.', 'error');
      return false;
    }

    if (!formState.seller_document.trim()) {
      addToast('Informe o CPF/CNPJ do proprietário.', 'error');
      return false;
    }

    if (!formState.broker_id) {
      addToast('Selecione o corretor responsável.', 'error');
      return false;
    }

    if (priceValue <= 0) {
      addToast('Informe um valor válido para o contrato.', 'error');
      return false;
    }

    return true;
  };

  const handlePreview = async () => {
    if (!validateBeforeSave()) return;

    setLoading(true);

    try {
      await generateContract(
        'intermediacao',
        contractDataObj,
        tenant,
        brokerProfile?.company?.logo_url ?? undefined,
        selectedBroker?.name || brokerProfile?.name,
        selectedBroker?.cpf_cnpj || brokerProfile?.cpf_cnpj,
        selectedBroker?.creci || brokerProfile?.creci,
        brokerProfile?.company?.name || undefined
      );
    } catch (error) {
      console.error('Erro ao gerar pré-visualização do contrato:', error);
      addToast('Não foi possível gerar a pré-visualização do contrato.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateBeforeSave()) return;

    setLoading(true);

    try {
      const finalHtml = await buildContractHtml(
        'intermediacao',
        contractDataObj,
        tenant,
        brokerProfile?.company?.logo_url ?? undefined,
        selectedBroker?.name || brokerProfile?.name,
        selectedBroker?.cpf_cnpj || brokerProfile?.cpf_cnpj,
        selectedBroker?.creci || brokerProfile?.creci,
        brokerProfile?.company?.name || undefined
      );

      const payload: Record<string, unknown> = {
        type: isRentListing ? 'rent' : 'sale',
        status: 'pending',
        property_id: propertyId,
        broker_id: formState.broker_id || null,
        lead_id: null,
        client_id: null,
        start_date: formState.contract_date,
        commission_percentage: commissionPct,
        commission_total: commissionValue,
        contract_data: {
          ...contractDataObj,
          document_type: 'intermediacao',
          seller_email: formState.seller_email,
          seller_phone: formState.seller_phone,
          template_content: null,
        },
        content: null,
        html_content: finalHtml,
        company_id: user?.company_id,
      };

      if (isRentListing) {
        payload.rent_value = priceValue;
      } else {
        payload.sale_total_value = priceValue;
      }

      const { error } = await supabase.from('contracts').insert([payload]);

      if (error) {
        throw error;
      }

      addToast('Contrato de intermediação criado com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar contrato de intermediação:', error);
      addToast(`Não foi possível salvar o contrato. ${error.message || ''}`.trim(), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-16 sm:pt-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Jurídico</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Icons.FileSignature size={22} className="text-emerald-500" />
              Contrato de Intermediação
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Documento fixo de autorização para {isRentListing ? 'locação' : 'venda'} do imóvel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <Icons.X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-6">
          <form id="intermediation-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 flex items-start gap-3 dark:border-brand-500/20 dark:bg-brand-500/10">
              <Icons.Info className="text-brand-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-brand-900 dark:text-brand-300">
                    Gerador Automático de {serviceType === 'administration' ? 'Administração' : 'Intermediação'}
                  </h4>
                  <p className="text-xs text-brand-700 dark:text-brand-400 mt-1">
                    Os dados abaixo foram importados da ficha do imóvel. Confirme as informações, prazos e comissões antes de gerar a minuta do contrato.
                  </p>
              </div>
            </div>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-4">Dados do Proprietário</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome completo *</label>
                    <input
                      type="text"
                      value={formState.seller_name}
                      onChange={handleInput('seller_name')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">CPF/CNPJ *</label>
                    <input
                      type="text"
                      value={formState.seller_document}
                      onChange={handleInput('seller_document')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">RG</label>
                        <input
                          type="text"
                          value={formState.seller_rg || ''}
                          onChange={handleInput('seller_rg')}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Órgão Emissor</label>
                        <select
                          value={formState.seller_rg_org || ''}
                          onChange={handleInput('seller_rg_org')}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500"
                        >
                          <option value="">Selecione</option>
                          {['SSP', 'DETRAN', 'DIC', 'PM', 'PF', 'CREA', 'OAB', 'CRM'].map(org => (
                            <option key={org} value={org}>{org}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">UF do RG</label>
                        <select
                          value={formState.seller_rg_uf || ''}
                          onChange={handleInput('seller_rg_uf')}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500"
                        >
                          <option value="">Selecione</option>
                          {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Profissão</label>
                    <input
                      type="text"
                      value={formState.seller_profession}
                      onChange={handleInput('seller_profession')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Estado civil</label>
                    <select
                      value={formState.seller_marital_status}
                      onChange={handleInput('seller_marital_status')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="União Estável">União Estável</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={formState.seller_phone}
                      onChange={handleInput('seller_phone')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formState.seller_email}
                      onChange={handleInput('seller_email')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Endereço</label>
                    <input
                      type="text"
                      value={formState.seller_address}
                      onChange={handleInput('seller_address')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {(formState.seller_marital_status === 'Casado(a)' || formState.seller_marital_status === 'União Estável') && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Cônjuge</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Nome</label>
                        <input
                          type="text"
                          value={formState.seller_spouse_name}
                          onChange={handleInput('seller_spouse_name')}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">CPF</label>
                        <input
                          type="text"
                          value={formState.seller_spouse_document}
                          onChange={handleInput('seller_spouse_document')}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">RG</label>
                        <input
                          type="text"
                          value={formState.seller_spouse_rg}
                          onChange={handleInput('seller_spouse_rg')}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Icons.Briefcase size={16} className="text-brand-500" /> Configurações do Serviço
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {propertyData.listing_type === 'sale' && (
                      <div className="flex flex-col justify-end h-full">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Comissão de Venda</label>
                        <div className="flex relative mt-auto">
                          <input type="number" value={commissionPercentage} onChange={e => setCommissionPercentage(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500" />
                          <span className="absolute right-4 top-3 text-slate-400 font-bold">%</span>
                        </div>
                      </div>
                    )}
                    
                    {propertyData.listing_type === 'rent' && (
                      <div className="flex flex-col justify-end h-full">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Honorários (Aluguel Acordado)</label>
                        <div className="flex relative mt-auto">
                          <input type="number" value={commissionPercentage} onChange={e => setCommissionPercentage(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500" />
                          <span className="absolute right-4 top-3 text-slate-400 font-bold">%</span>
                        </div>
                      </div>
                    )}

                    {serviceType === 'administration' && (
                      <>
                        <div className="flex flex-col justify-end h-full">
                          <label className="block text-xs font-bold text-emerald-600 mb-2 uppercase">Taxa de Adm. Mensal</label>
                          <div className="flex relative mt-auto">
                            <input type="number" value={adminFeePercentage} onChange={e => setAdminFeePercentage(e.target.value)} className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500" />
                            <span className="absolute right-4 top-3 text-emerald-600 font-bold">%</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-end h-full">
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Dia do Repasse</label>
                          <div className="flex relative mt-auto">
                            <span className="absolute left-4 top-3 text-slate-400 font-bold">Dia</span>
                            <input type="number" min="1" max="31" value={transferDay} onChange={e => setTransferDay(e.target.value)} className="w-full pl-12 bg-white border border-slate-200 rounded-xl py-3 text-sm outline-none focus:border-brand-500" />
                          </div>
                        </div>
                      </>
                    )}
                    
                    <div className="flex flex-col justify-end h-full">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Prazo de Validade</label>
                      <select value={validityDays} onChange={e => setValidityDays(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 mt-auto">
                        <option value="90">90 dias</option>
                        <option value="180">180 dias</option>
                        <option value="360">12 meses</option>
                        <option value="indeterminado">Prazo Indeterminado</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col justify-end h-full">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Responsabilidade</label>
                      <select value={representationType} onChange={e => setRepresentationType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 mt-auto">
                        <option value="corretor">Corretor Responsável</option>
                        <option value="imobiliaria">Imobiliária (PJ)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 overflow-hidden">
                    <h4 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2">
                      <Icons.TrendingUp size={18} /> Projeção de Receita
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-emerald-600/80 font-bold uppercase tracking-wider mb-1 truncate">
                          {propertyData.listing_type === 'sale' ? 'Comissão de Venda' : 'Honorários Iniciais'}
                        </p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight break-words">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((projectionBaseValue * commissionPercentage) / 100)}
                        </p>
                      </div>
                      
                      {serviceType === 'administration' && (
                        <>
                          <div className="hidden sm:block w-px bg-emerald-200 shrink-0"></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-emerald-600/80 font-bold uppercase tracking-wider mb-1 truncate">
                              Taxa Recorrente
                            </p>
                            <p className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight flex flex-wrap items-baseline gap-1 break-words">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(recurringAdminFeeValue)}
                              <span className="text-sm font-bold text-emerald-600/60">/mês</span>
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-4">Imóvel</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Título</label>
                      <input
                        type="text"
                        value={propertyData.title}
                        readOnly
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Endereço jurídico</label>
                      <textarea
                        value={propertyAddress}
                        readOnly
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 resize-none"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-4">Condições Comerciais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Corretor responsável *</label>
                      <select
                        value={formState.broker_id}
                        onChange={handleInput('broker_id')}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                      >
                        <option value="">Selecione...</option>
                        {brokers.map((broker) => (
                          <option key={broker.id} value={broker.id}>
                            {broker.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Data do contrato</label>
                      <input
                        type="date"
                        value={formState.contract_date}
                        onChange={handleInput('contract_date')}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{valueLabel} *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.total_value}
                        onChange={handleInput('total_value')}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="inline-flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.has_exclusivity}
                        onChange={handleInput('has_exclusivity')}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-semibold text-slate-700">Contrato com exclusividade</span>
                    </label>
                  </div>
                </section>
              </div>
            </section>
          </form>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {loading ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.FileText size={16} />}
            Gerar PDF (Pré-visualização)
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="intermediation-form"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {loading ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Save size={16} />}
              Salvar Contrato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntermediationContractModal;
