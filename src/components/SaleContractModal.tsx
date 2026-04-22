import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { Lead, Property } from '../types';
import { useToast } from '../contexts/ToastContext';
import { buildContractHtml, generateContract } from '../utils/contractGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { SALE_DOCUMENTS } from '../constants/contractTypes';

interface SaleContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractData?: any;
}

const formatRgWithIssuer = (rg?: string | null, org?: string | null, uf?: string | null) => {
  const baseRg = String(rg || '').trim();
  if (!baseRg) return '';

  const issuer = [org, uf].filter(Boolean).join('/');
  return issuer ? `${baseRg} ${issuer}`.trim() : baseRg;
};

const SaleContractModal: React.FC<SaleContractModalProps> = ({ isOpen, onClose, onSuccess, contractData }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const userAvatar = user?.user_metadata?.avatar_url || user?.avatar_url || null;
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState('sale_standard');
  const [brokerProfile, setBrokerProfile] = useState<{
    name: string;
    cpf_cnpj: string;
    creci: string;
    company?: {
      name?: string | null;
      logo_url?: string | null;
    } | null;
  } | null>(null);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  // Variáveis Mágicas: O formulário adapta-se com base no tipo de contrato!
  const isCashContract = documentType === 'sale_cash';
  const isPermutaContract = documentType === 'permuta';
  const isStandardContract = documentType === 'sale_standard';

  const [contractDetails, setContractDetails] = useState({
    buyer_document: '',
    buyer_rg: '',
    buyer_profession: '',
    buyer_marital_status: '',
    buyer_address: '',
    buyer_spouse_name: '',
    buyer_spouse_document: '',
    buyer_spouse_profession: '',
    seller_document: '',
    seller_rg: '',
    seller_profession: '',
    seller_marital_status: '',
    seller_address: '',
    seller_spouse_name: '',
    seller_spouse_document: '',
    seller_spouse_rg: '',
    seller_spouse_profession: '',
    permuta_address: '',
    permuta_description: '',
    permuta_value: ''
  });

  const [formData, setFormData] = useState({
    lead_id: '',
    client_id: null as string | null,
    property_id: '',
    broker_id: '',
    representation_type: 'corretor',
    sale_date: new Date().toISOString().split('T')[0],
    sale_total_value: '',
    sale_down_payment: '',
    sale_financing_value: '',
    sale_financing_bank: '',
    has_permutation: false,
    permutation_details: '',
    permutation_value: '',
    commission_percentage: '',
    commission_value: '',
    sale_is_cash: false,
    sale_payment_method: 'Pix',
    sale_consortium_value: '',
    installments_count: '12',
    due_day: '10',
    readjustment_index: 'IPCA',
    interest_rate: '1.0',
    spouse_details: '',
  });

  // Busca a comissão do contrato de intermediação quando um imóvel é selecionado
  useEffect(() => {
    async function fetchCommission() {
      if (!formData.property_id || !user?.company_id || contractData) return;
      try {
        // Busca contratos anteriores deste imóvel
        const { data, error } = await supabase
          .from('contracts')
          .select('metadata, commission_percentage, contract_data')
          .eq('company_id', user.company_id)
          .eq('property_id', formData.property_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const hasCommission = (contract: any) => {
            const metadata = contract.metadata || {};
            const contractDataObj = contract.contract_data || {};
            return (
              metadata.commission_percent !== undefined ||
              metadata.commission !== undefined ||
              metadata.comissao !== undefined ||
              contract.commission_percentage !== undefined ||
              contractDataObj.commission_percentage !== undefined
            );
          };

          // Procura nas metadatas algum valor de comissão salvo anteriormente
          const interContract =
            data.find((contract: any) => contract.contract_data?.document_type === 'intermediacao' && hasCommission(contract)) ||
            data.find(hasCommission);
          const metadata = interContract?.metadata || {};
          const contractDataObj = interContract?.contract_data || {};
          const commissionVal =
            metadata.commission_percent ??
            metadata.commission ??
            metadata.comissao ??
            interContract?.commission_percentage ??
            contractDataObj.commission_percentage;

          if (commissionVal !== undefined && commissionVal !== null && commissionVal !== '') {
            setFormData(prev => {
              const commissionPercentage = String(commissionVal);
              const total = Number(prev.sale_total_value) || 0;
              const pct = Number(commissionPercentage) || 0;
              const calcVal = (total * pct) / 100;

              return {
                ...prev,
                commission_percentage: commissionPercentage,
                commission_value: calcVal ? String(calcVal) : prev.commission_value,
              };
            });
          }
        }
      } catch (err) {
        console.error('Erro ao buscar comissão prévia:', err);
      }
    }
    fetchCommission();
  }, [formData.property_id, user?.company_id, contractData]);

  const selectedLeadRecord = leads.find((lead) => lead.id === formData.lead_id);
  const contractClientRecord = selectedLeadRecord;

  // Autofill dos dados do Proprietário quando um imóvel é selecionado
  useEffect(() => {
    if (formData.lead_id && !contractData) {
      const selectedLead = leads.find((lead) => lead.id === formData.lead_id);
      if (selectedLead) {
        setFormData((prev) => ({
          ...prev,
          client_id: selectedLead.id,
        }));
        setContractDetails((prev) => ({
          ...prev,
          buyer_document: selectedLead.cpf || '',
          buyer_rg: selectedLead.rg || '',
          buyer_profession: selectedLead.profissao || '',
          buyer_marital_status: selectedLead.estado_civil || '',
          buyer_address: selectedLead.endereco || '',
        }));
      }
    }
  }, [formData.lead_id, leads, contractData]);

  useEffect(() => {
    if (formData.property_id && !contractData && properties.length > 0) {
      const selectedProp = properties.find((property) => property.id === formData.property_id);
      if (selectedProp) {
        const sellerRg = formatRgWithIssuer(
          selectedProp.owner_rg,
          selectedProp.owner_rg_org,
          selectedProp.owner_rg_uf
        );
        const sellerSpouseRg = formatRgWithIssuer(
          selectedProp.owner_spouse_rg,
          selectedProp.owner_spouse_rg_org,
          selectedProp.owner_spouse_rg_uf
        );

        setContractDetails(prev => ({
          ...prev,
          seller_document: selectedProp.owner_cpf || selectedProp.owner_document || '',
          seller_rg: sellerRg,
          seller_profession: selectedProp.owner_profession || '',
          seller_marital_status: selectedProp.owner_marital_status || '',
          seller_address: selectedProp.owner_address || '',
          seller_spouse_name: selectedProp.owner_spouse_name || '',
          seller_spouse_document: selectedProp.owner_spouse_cpf || selectedProp.owner_spouse_document || '',
          seller_spouse_rg: sellerSpouseRg,
        }));
      }
    }
  }, [formData.property_id, properties, contractData]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  // Busca o perfil completo do corretor ao abrir o modal
  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data } = await supabase
          .from('profiles')
          .select('name, cpf_cnpj, creci, company:companies(name, logo_url)')
          .eq('id', authUser.id)
          .single();
        if (data) setBrokerProfile(data as any);
      }
    };
    if (isOpen) {
      fetchProfileData();
      const fetchTemplates = async () => {
        const { data } = await supabase.from('contract_templates').select('id, name, content').eq('type', 'sale');
        if (data) setCustomTemplates(data);
      };
      fetchTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchLeadProperties = async () => {
      if (!formData.lead_id) { setProperties([]); return; }
      const selectedLead = leads.find(l => l.id === formData.lead_id);
      if (!selectedLead) return;
      const leadBroker = (selectedLead as any).assigned_to;
      if (leadBroker) setFormData(prev => ({ ...prev, broker_id: leadBroker }));
      const propIds = new Set<string>();
      if ((selectedLead as any).property_id) propIds.add((selectedLead as any).property_id);
      if ((selectedLead as any).sold_property_id) propIds.add((selectedLead as any).sold_property_id);
      const interests = (selectedLead as any).interested_properties || [];
      interests.forEach((p: any) => { if (p.id) propIds.add(p.id); });
      if (propIds.size > 0) {
        const { data } = await supabase.from('properties').select('*').in('id', Array.from(propIds)).eq('listing_type', 'sale');
        if (data && data.length > 0) {
          setProperties(data as any);
          const firstProp = data[0];
          setFormData(prev => {
            const val = String(firstProp.price || '');
            const total = Number(val) || 0;
            const pct = Number(prev.commission_percentage) || 0;
            const calcVal = (total * pct) / 100;
            return { ...prev, property_id: firstProp.id, sale_total_value: val, commission_value: calcVal ? String(calcVal) : prev.commission_value };
          });
        } else { setProperties([]); }
      } else { setProperties([]); }
    };
    fetchLeadProperties();
  }, [formData.lead_id, leads]);

  // MODO DE VISUALIZAÇÃO
  useEffect(() => {
    if (isOpen && contractData) {
      const storedDocumentType =
        typeof contractData?.contract_data?.document_type === 'string' && contractData.contract_data.document_type
          ? contractData.contract_data.document_type
          : contractData?.has_permutation
            ? 'permuta'
            : contractData?.sale_is_cash
              ? 'sale_cash'
              : 'sale_standard';

      setDocumentType(storedDocumentType);
      setFormData(prev => ({
        ...prev,
        lead_id: contractData.lead_id || '',
        client_id: contractData.client_id || contractData.lead_id || null,
        property_id: contractData.property_id || '',
        broker_id: contractData.broker_id || '',
        representation_type: contractData.representation_type || contractData.contract_data?.representation_type || 'corretor',
        sale_date: contractData.start_date || '',
        sale_total_value: String(contractData.sale_total_value || ''),
        sale_down_payment: String(contractData.sale_down_payment || ''),
        sale_financing_value: String(contractData.sale_financing_value || ''),
        sale_financing_bank: contractData.sale_financing_bank || '',
        has_permutation: contractData.has_permutation || false,
        permutation_details: contractData.permutation_details || '',
        permutation_value: String(contractData.permutation_value || ''),
        commission_percentage: String(contractData.commission_percentage || ''),
        commission_value: String(contractData.commission_total || ''),
        sale_is_cash: contractData.sale_is_cash || false,
        sale_payment_method: contractData.sale_payment_method || 'Pix',
        sale_consortium_value: String(contractData.sale_consortium_value || ''),
      }));

      if (contractData.contract_data) {
        setContractDetails(prev => ({
          ...prev,
          ...contractData.contract_data
        }));
      }
    }
  }, [isOpen, contractData]);

  // Auto-preenche a comissão da imobiliária se for um novo contrato
  useEffect(() => {
    if (isOpen && !contractData) {
      setFormData(prev => ({
        ...prev,
        commission_percentage: String(user?.company?.default_commission ?? 6)
      }));
    }
  }, [isOpen, contractData, user?.company?.default_commission]);

  const fetchData = async () => {
    const { data: leadsData } = await supabase.from('leads').select('*').or('funnel_step.eq.venda_ganha,status.in.(Fechado,Venda Fechada,Venda Ganha)');
    if (leadsData) setLeads(leadsData as any);
    const { data: brokersData } = await supabase.from('profiles').select('id, name').eq('active', true);
    if (brokersData) setBrokers(brokersData);
  };

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propId = e.target.value;
    const selectedProp = properties.find(p => p.id === propId);
    if (selectedProp?.price) {
      const val = String(selectedProp.price);
      const total = Number(val) || 0;
      const pct = Number(formData.commission_percentage) || 0;
      const calcVal = (total * pct) / 100;
      setFormData(prev => ({ ...prev, property_id: propId, sale_total_value: val, commission_value: calcVal ? String(calcVal) : '' }));
    } else {
      setFormData(prev => ({ ...prev, property_id: propId }));
    }
  };

  const handleTotalValueChange = (val: string) => {
    const total = Number(val) || 0;
    const pct = Number(formData.commission_percentage) || 0;
    const calcVal = (total * pct) / 100;
    setFormData(prev => ({ ...prev, sale_total_value: val, commission_value: calcVal ? String(calcVal) : '' }));
  };

  const handleCommissionPctChange = (val: string) => {
    const pct = Number(val) || 0;
    const total = Number(formData.sale_total_value) || 0;
    const calcVal = (total * pct) / 100;
    setFormData(prev => ({ ...prev, commission_percentage: val, commission_value: calcVal ? String(calcVal) : '' }));
  };

  const handleCommissionValChange = (val: string) => {
    const cVal = Number(val) || 0;
    const total = Number(formData.sale_total_value) || 0;
    const calcPct = total > 0 ? (cVal / total) * 100 : 0;
    setFormData(prev => ({ ...prev, commission_value: val, commission_percentage: calcPct ? String(calcPct) : '' }));
  };

  const totalValue = Number(formData.sale_total_value) || 0;
  const downPayment = Number(formData.sale_down_payment) || 0;
  const financing = Number(formData.sale_financing_value) || 0;
  const permutation = formData.has_permutation ? (Number(formData.permutation_value) || 0) : 0;
  const consortium = Number(formData.sale_consortium_value) || 0;
  const totalCovered = downPayment + financing + consortium;

  // Se for contrato À Vista, assume automaticamente entrada = 100% e saldo = 0
  useEffect(() => {
    if (isCashContract) {
      setFormData(prev => ({ ...prev, sale_is_cash: true, sale_down_payment: prev.sale_total_value, sale_payment_method: 'Pix' }));
    } else {
      setFormData(prev => ({ ...prev, sale_is_cash: false }));
    }
  }, [isCashContract, formData.sale_total_value]);

  // Se for Permuta, garante que a flag está ativada
  useEffect(() => {
    if (isPermutaContract) {
      setFormData(prev => ({ ...prev, has_permutation: true }));
    }
  }, [isPermutaContract]);

  const saldoDevedor = isCashContract ? 0 : Math.max(0, totalValue - downPayment - financing - permutation - consortium);
  const parcelasCount = Number(formData.installments_count) || 1;
  const valorParcela = parcelasCount > 0 ? saldoDevedor / parcelasCount : 0;

  const INDICES_ANUAIS: Record<string, number> = { 'IPCA': 4.50, 'IGPM': 3.70, 'INCC': 5.10, 'FIXO': 0 };

  const handleGeneratePDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedPropertyData = properties.find(p => p.id === formData.property_id);
      const contractDataObj = {
        representation_type: formData.representation_type,

        // DADOS DO COMPRADOR
        buyer_name: contractClientRecord?.name || '',
        buyer_phone: contractClientRecord?.phone || '',
        buyer_email: contractClientRecord?.email || '',
        buyer_document: contractDetails.buyer_document,
        buyer_rg: contractDetails.buyer_rg,
        buyer_profession: contractDetails.buyer_profession,
        buyer_marital_status: contractDetails.buyer_marital_status,
        buyer_address: contractDetails.buyer_address || selectedLeadRecord?.address,
        buyer_nationality: contractDetails.buyer_nationality,
        buyer_spouse_name: contractDetails.buyer_spouse_name,
        buyer_spouse_document: contractDetails.buyer_spouse_document,
        buyer_spouse_profession: contractDetails.buyer_spouse_profession,
        buyer_spouse_rg: contractDetails.buyer_spouse_rg,
        
        // DADOS DO VENDEDOR
        seller_name: selectedPropertyData?.owner_name || 'Proprietário Atual',
        seller_phone: selectedPropertyData?.owner_phone || '',
        seller_email: selectedPropertyData?.owner_email || '',
        seller_document: contractDetails.seller_document,
        seller_rg: contractDetails.seller_rg,
        seller_profession: contractDetails.seller_profession,
        seller_marital_status: contractDetails.seller_marital_status,
        seller_address: contractDetails.seller_address || selectedPropertyData?.owner_address || properties.find(p => p.id === formData.property_id)?.owner_address,
        seller_nationality: contractDetails.seller_nationality,
        seller_spouse_name: contractDetails.seller_spouse_name,
        seller_spouse_document: contractDetails.seller_spouse_document,
        seller_spouse_rg: contractDetails.seller_spouse_rg,
        seller_spouse_profession: contractDetails.seller_spouse_profession,
        
        // DADOS DO IMÓVEL
        property_address: selectedPropertyData ? `${selectedPropertyData.address}, ${selectedPropertyData.city}` : '',
        property_city: selectedPropertyData?.city || '',
        property_state: selectedPropertyData?.state || '',
        property_description: selectedPropertyData?.title || '',
        property_registration: selectedPropertyData?.property_registration || '',
        property_registry_office: selectedPropertyData?.property_registry_office || '',
        property_municipal_registration: selectedPropertyData?.property_municipal_registration || '',
        
        // DADOS FINANCEIROS DA VENDA
        sale_total_value: formData.sale_total_value || selectedPropertyData?.price,
        total_value: formData.sale_total_value || selectedPropertyData?.price,
        sale_down_payment: formData.sale_down_payment || '0',
        down_payment: formData.sale_down_payment || '0',
        sale_financing_value: (Number(formData.sale_total_value || selectedPropertyData?.price || 0) - Number(formData.sale_down_payment || 0)),
        permutation_value: contractDetails.permuta_value || formData.permutation_value || '0',
        
        // DADOS DE PERMUTA (SE HOUVER)
        permuta_address: contractDetails.permuta_address,
        permuta_description: contractDetails.permuta_description,
        permuta_value: contractDetails.permuta_value,
        
        // DADOS BANCÁRIOS
        bank_name: formData.sale_financing_bank || '',
        bank_agency: '',
        bank_account: '',
      };
      const selectedTemplate = customTemplates.find(t => `custom_${t.id}` === documentType);
      await generateContract(
        documentType,
        contractDataObj,
        tenant,
        brokerProfile?.company?.logo_url ?? undefined,
        brokerProfile?.name,
        brokerProfile?.cpf_cnpj,
        brokerProfile?.creci,
        brokerProfile?.company?.name ?? undefined,
        selectedTemplate?.content
      );
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      addToast('Erro ao gerar documento PDF', 'error', { avatar: userAvatar });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalValue <= 0) return alert('O valor total da venda deve ser maior que zero.');
    setLoading(true);
    try {
      const selectedLeadForSave = leads.find((lead) => lead.id === formData.lead_id);
      const selectedPropForSave = properties.find((property) => property.id === formData.property_id);
      const selectedTemplate = customTemplates.find(t => `custom_${t.id}` === documentType);
      const resolvedClientId = formData.client_id || formData.lead_id || null;
      const contractDataObj = {
        representation_type: formData.representation_type,

        // DADOS DO COMPRADOR
        buyer_name: selectedLeadForSave?.name || '',
        buyer_phone: selectedLeadForSave?.phone || '',
        buyer_email: selectedLeadForSave?.email || '',
        buyer_document: contractDetails.buyer_document,
        buyer_rg: contractDetails.buyer_rg,
        buyer_profession: contractDetails.buyer_profession,
        buyer_marital_status: contractDetails.buyer_marital_status,
        buyer_address: contractDetails.buyer_address || selectedLeadForSave?.address,
        buyer_nationality: contractDetails.buyer_nationality,
        buyer_spouse_name: contractDetails.buyer_spouse_name,
        buyer_spouse_document: contractDetails.buyer_spouse_document,
        buyer_spouse_profession: contractDetails.buyer_spouse_profession,
        buyer_spouse_rg: contractDetails.buyer_spouse_rg,
        
        // DADOS DO VENDEDOR
        seller_name: selectedPropForSave?.owner_name || 'Proprietário Atual',
        seller_phone: selectedPropForSave?.owner_phone || '',
        seller_email: selectedPropForSave?.owner_email || '',
        seller_document: contractDetails.seller_document,
        seller_rg: contractDetails.seller_rg,
        seller_profession: contractDetails.seller_profession,
        seller_marital_status: contractDetails.seller_marital_status,
        seller_address: contractDetails.seller_address || selectedPropForSave?.owner_address || properties.find(p => p.id === formData.property_id)?.owner_address,
        seller_nationality: contractDetails.seller_nationality,
        seller_spouse_name: contractDetails.seller_spouse_name,
        seller_spouse_document: contractDetails.seller_spouse_document,
        seller_spouse_rg: contractDetails.seller_spouse_rg,
        seller_spouse_profession: contractDetails.seller_spouse_profession,
        
        // DADOS DO IMÓVEL
        property_address: selectedPropForSave ? `${selectedPropForSave.address}, ${selectedPropForSave.city}` : '',
        property_description: selectedPropForSave?.title || '',
        property_registration: selectedPropForSave?.property_registration || '',
        property_registry_office: selectedPropForSave?.property_registry_office || '',
        property_municipal_registration: selectedPropForSave?.property_municipal_registration || '',
        
        // DADOS FINANCEIROS DA VENDA
        sale_total_value: formData.sale_total_value || selectedPropForSave?.price,
        total_value: formData.sale_total_value || selectedPropForSave?.price,
        sale_down_payment: formData.sale_down_payment || '0',
        down_payment: formData.sale_down_payment || '0',
        sale_financing_value: (Number(formData.sale_total_value || selectedPropForSave?.price || 0) - Number(formData.sale_down_payment || 0)),
        permutation_value: contractDetails.permuta_value || formData.permutation_value || '0',
        
        // DADOS DE PERMUTA (SE HOUVER)
        permuta_address: contractDetails.permuta_address,
        permuta_description: contractDetails.permuta_description,
        permuta_value: contractDetails.permuta_value,
        
        // DADOS BANCÁRIOS
        bank_name: formData.sale_financing_bank || '',
        bank_agency: '',
        bank_account: '',
      };
      const rawTemplate =
        selectedTemplate?.content ||
        (SALE_DOCUMENTS.find((document) => document.id === documentType) as { content?: string } | undefined)?.content ||
        '';
      const contractHtmlData = {
        ...contractDataObj,
        lead: selectedLeadForSave,
        property: selectedPropForSave,
        sale_total_value: formData.sale_total_value,
        sale_down_payment: formData.sale_down_payment || '0',
        sale_financing_value: formData.sale_financing_value || '0',
        sale_consortium_value: formData.sale_consortium_value || '0',
        permutation_value: formData.permutation_value || '0',
        installments_count: formData.installments_count,
        due_day: formData.due_day,
        readjustment_index: formData.readjustment_index,
        interest_rate: formData.interest_rate,
      };
      const finalHtml = await buildContractHtml(
        rawTemplate.trim().length > 0 && !documentType.startsWith('custom_') ? 'custom_runtime' : documentType,
        contractHtmlData,
        tenant,
        brokerProfile?.company?.logo_url ?? undefined,
        brokerProfile?.name,
        brokerProfile?.cpf_cnpj,
        brokerProfile?.creci,
        brokerProfile?.company?.name ?? undefined,
        rawTemplate || undefined
      );
      const payload = {
        type: 'sale', status: 'pending',
        lead_id: formData.lead_id || null,
        client_id: resolvedClientId,
        property_id: formData.property_id || null,
        broker_id: formData.broker_id || null,
        created_by: user?.id, // ADICIONADO: Garante a autoria
        start_date: formData.sale_date,
        sale_total_value: totalValue,
        sale_down_payment: downPayment,
        sale_financing_value: financing,
        sale_financing_bank: formData.sale_financing_bank,
        has_permutation: formData.has_permutation,
        permutation_details: formData.permutation_details,
        permutation_value: permutation,
        sale_consortium_value: consortium,
        sale_is_cash: formData.sale_is_cash,
        sale_payment_method: formData.sale_is_cash ? formData.sale_payment_method : null,
        commission_percentage: Number(formData.commission_percentage) || 0,
        commission_total: Number(formData.commission_value) || 0,
        representation_type: formData.representation_type,
        contract_data: {
          ...contractDetails,
          ...contractDataObj,
          representation_type: formData.representation_type,
          buyer_name: selectedLeadForSave?.name || '',
          seller_name: selectedPropForSave?.owner_name || 'Proprietário',
          document_type: documentType,
          template_content: rawTemplate || null,
        },
        content: rawTemplate,
        html_content: finalHtml,
        company_id: user?.company_id,
      };
      const { data: contract, error } = await supabase.from('contracts').insert([payload]).select().single();
      if (error) throw error;

      if (resolvedClientId) {
        const { error: clientEnrichmentError } = await supabase
          .from('leads')
          .update({
            cpf: contractDetails.buyer_document,
            rg: contractDetails.buyer_rg,
            profissao: contractDetails.buyer_profession,
            estado_civil: contractDetails.buyer_marital_status,
            endereco: contractDetails.buyer_address
          })
          .eq('id', resolvedClientId);

        if (clientEnrichmentError) {
          console.error('Erro ao enriquecer o cadastro do cliente:', clientEnrichmentError);
        }
      }

      if (!formData.sale_is_cash && contract && saldoDevedor > 0) {
        const installments = [];
        let valorAtualParcela = valorParcela;
        const taxaAnualIndice = INDICES_ANUAIS[formData.readjustment_index] || 0;
        const jurosMensal = Number(formData.interest_rate) || 0;
        const taxaJurosAnualizada = jurosMensal * 12;
        for (let i = 1; i <= parcelasCount; i++) {
          if (i > 1 && (i - 1) % 12 === 0) {
            valorAtualParcela = valorAtualParcela * (1 + (taxaAnualIndice + taxaJurosAnualizada) / 100);
          }
          const dueDate = new Date(formData.sale_date);
          dueDate.setMonth(dueDate.getMonth() + i);
          const targetDay = Number(formData.due_day);
          dueDate.setDate(targetDay);
          if (dueDate.getDate() !== targetDay) dueDate.setDate(0);
          installments.push({
            contract_id: contract.id, type: 'monthly', installment_number: i,
            amount: valorAtualParcela, due_date: dueDate.toISOString().split('T')[0],
            status: 'pending', notes: `Ano ${Math.ceil(i/12)} - Correção: ${formData.readjustment_index} + ${formData.interest_rate}% a.m.`
          });
        }
        await supabase.from('installments').insert(installments);
      }

      if (formData.sale_is_cash && formData.broker_id) {
        const { data: brokerData } = await supabase.from('profiles').select('xp').eq('id', formData.broker_id).single();
        await supabase.from('profiles').update({ xp: (brokerData?.xp || 0) + 1000 }).eq('id', formData.broker_id);
      }
      if (formData.property_id) {
        await supabase.from('properties').update({ status: 'Vendido' }).eq('id', formData.property_id);
      }
      addToast('Novo contrato de venda gerado com sucesso.', 'success', { avatar: userAvatar });
      onSuccess();
      onClose();
    } catch (error: any) {
      addToast('Erro ao salvar contrato: ' + error.message, 'error', { avatar: userAvatar });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col animate-in zoom-in-95 overflow-hidden rounded-3xl bg-white shadow-2xl duration-200 dark:bg-slate-900 border border-white/10">

        {/* Header Elegante */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-brand-500 p-2.5 text-white shadow-lg shadow-brand-500/20">
              <Icons.FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">Contrato de Compra e Venda</h2>
              <p className="text-sm font-medium text-slate-500 italic">Geração de documento jurídico para comercialização.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700">
            <Icons.X size={24} />
          </button>
        </div>

        {/* Body com Scroll e Seções */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 bg-white dark:bg-slate-900">
          <form id="sale-form" onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-5xl mx-auto">
            <fieldset disabled={!!contractData} className="contents">

              {/* SECTION 1: TIPO DE CONTRATO */}
              <section className="order-3 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden border border-slate-700">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <Icons.FileText size={140} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <Icons.FileText size={24} className="text-brand-400" />
                      Qual o tipo de contrato?
                    </h3>
                    <p className="text-slate-300 text-sm">O modelo selecionado define os campos que serão preenchidos abaixo.</p>
                  </div>
                  <div className="w-full md:w-1/2">
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {SALE_DOCUMENTS.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
                  </div>
                </div>
              </section>

              <section className="order-4 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2 dark:text-white dark:border-slate-800">
                  <Icons.FileText size={16} className="text-brand-500" /> Dados do Comprador e do Vendedor
                </h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-500 mb-4 uppercase flex items-center justify-between dark:text-slate-400">
                      Dados do Comprador
                      <span className="text-[10px] text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md font-semibold dark:bg-brand-500/10 dark:text-brand-400">Auto do Lead</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">CPF/CNPJ</label>
                        <input type="text" value={contractDetails.buyer_document} onChange={e => setContractDetails({ ...contractDetails, buyer_document: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">RG</label>
                        <input type="text" value={contractDetails.buyer_rg} onChange={e => setContractDetails({ ...contractDetails, buyer_rg: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">Estado Civil</label>
                        <select value={contractDetails.buyer_marital_status} onChange={e => setContractDetails({ ...contractDetails, buyer_marital_status: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          <option value="">Selecione...</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viúvo(a)">Viúvo(a)</option>
                          <option value="União Estável">União Estável</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">Profissão</label>
                        <input type="text" value={contractDetails.buyer_profession} onChange={e => setContractDetails({ ...contractDetails, buyer_profession: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">Endereço</label>
                        <input type="text" value={contractDetails.buyer_address} onChange={e => setContractDetails({ ...contractDetails, buyer_address: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                    </div>
                    {(contractDetails.buyer_marital_status === 'Casado(a)' || contractDetails.buyer_marital_status === 'União Estável') && (
                      <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-3 animate-fade-in">
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 mb-1">Nome do Cônjuge</label>
                          <input type="text" value={contractDetails.buyer_spouse_name} onChange={e => setContractDetails({ ...contractDetails, buyer_spouse_name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF do Cônjuge</label>
                          <input type="text" value={contractDetails.buyer_spouse_document} onChange={e => setContractDetails({ ...contractDetails, buyer_spouse_document: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão do Cônjuge</label>
                          <input type="text" value={contractDetails.buyer_spouse_profession} onChange={e => setContractDetails({ ...contractDetails, buyer_spouse_profession: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-500 mb-4 uppercase flex items-center justify-between dark:text-slate-400">
                      Dados do Vendedor
                      <span className="text-[10px] text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md font-semibold dark:bg-brand-500/10 dark:text-brand-400">Auto do Imóvel</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">CPF/CNPJ</label>
                        <input type="text" value={contractDetails.seller_document} onChange={e => setContractDetails({ ...contractDetails, seller_document: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">RG</label>
                        <input type="text" value={contractDetails.seller_rg} onChange={e => setContractDetails({ ...contractDetails, seller_rg: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">Estado Civil</label>
                        <select value={contractDetails.seller_marital_status} onChange={e => setContractDetails({ ...contractDetails, seller_marital_status: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          <option value="">Selecione...</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viúvo(a)">Viúvo(a)</option>
                          <option value="União Estável">União Estável</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">Profissão</label>
                        <input type="text" value={contractDetails.seller_profession} onChange={e => setContractDetails({ ...contractDetails, seller_profession: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wide dark:text-slate-400">Endereço</label>
                        <input type="text" value={contractDetails.seller_address} onChange={e => setContractDetails({ ...contractDetails, seller_address: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                      </div>
                    </div>
                    {(contractDetails.seller_marital_status === 'Casado(a)' || contractDetails.seller_marital_status === 'União Estável') && (
                      <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-4 gap-3 animate-fade-in">
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 mb-1">Nome do Cônjuge</label>
                          <input type="text" value={contractDetails.seller_spouse_name} onChange={e => setContractDetails({ ...contractDetails, seller_spouse_name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF do Cônjuge</label>
                          <input type="text" value={contractDetails.seller_spouse_document} onChange={e => setContractDetails({ ...contractDetails, seller_spouse_document: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 mb-1">RG do Cônjuge</label>
                          <input type="text" value={contractDetails.seller_spouse_rg} onChange={e => setContractDetails({ ...contractDetails, seller_spouse_rg: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão do Cônjuge</label>
                          <input type="text" value={contractDetails.seller_spouse_profession} onChange={e => setContractDetails({ ...contractDetails, seller_spouse_profession: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {isCashContract ? (
                <section className="order-5 bg-emerald-500 text-white p-6 rounded-2xl shadow-lg border border-emerald-400 relative overflow-hidden animate-in fade-in slide-in-from-right-4">
                  <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none"><Icons.DollarSign size={100} /></div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                      <Icons.CheckCircle2 size={24} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Pagamento à Vista</h3>
                    <p className="text-emerald-100 text-sm mb-6">O contrato será gerado com cláusula de quitação no ato da assinatura. Não há saldo devedor.</p>
                    <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                      <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-1">Valor a ser Transferido (Pix/TED)</p>
                      <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="order-5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm animate-in fade-in slide-in-from-right-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2 dark:text-white dark:border-slate-800">
                    <Icons.CreditCard size={16} className="text-brand-500" /> Formas de Pagamento
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Sinal / Entrada (R$)</label>
                      <input type="number" value={formData.sale_down_payment} onChange={e => setFormData({ ...formData, sale_down_payment: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm font-bold text-slate-800 bg-white transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="0.00" />
                    </div>
                    {(isStandardContract || !isPermutaContract) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Financiamento Bancário (R$)</label>
                          <input type="number" value={formData.sale_financing_value} onChange={e => setFormData({ ...formData, sale_financing_value: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Banco Financiador</label>
                          <input type="text" value={formData.sale_financing_bank} onChange={e => setFormData({ ...formData, sale_financing_bank: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="Ex: Caixa" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">FGTS / Consórcio (R$)</label>
                          <input type="number" value={formData.sale_consortium_value} onChange={e => setFormData({ ...formData, sale_consortium_value: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="0.00" />
                        </div>
                      </div>
                    )}

                    {(isPermutaContract || formData.has_permutation) && (
                      <div className="bg-brand-50 border border-brand-200 p-5 rounded-xl animate-in fade-in dark:bg-brand-900/10 dark:border-brand-800/30">
                        <div className="flex justify-between items-center mb-4">
                          <p className="text-xs font-bold text-brand-700 uppercase tracking-wide dark:text-brand-400">Imóvel como Parte de Pagamento</p>
                          {!isPermutaContract && (
                            <button type="button" onClick={() => setFormData({ ...formData, has_permutation: false })} className="text-xs text-red-500 hover:text-red-700 hover:underline font-semibold transition-colors">Remover</button>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide dark:text-slate-400">Endereço / Descrição</label>
                            <input type="text" value={contractDetails.permuta_address} onChange={e => setContractDetails({ ...contractDetails, permuta_address: e.target.value })} className="w-full bg-white border border-brand-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-brand-700 dark:text-slate-100" placeholder="Ex: Lote 12, Quadra B..." />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide dark:text-slate-400">Valor Atribuído (R$)</label>
                            <input type="number" value={formData.permutation_value} onChange={e => setFormData({ ...formData, permutation_value: e.target.value })} className="w-full bg-white border border-brand-200 rounded-lg px-3 py-2.5 text-sm outline-none font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-slate-900 dark:border-brand-700 dark:text-slate-100" placeholder="0.00" />
                          </div>
                        </div>
                      </div>
                    )}

                    {!isPermutaContract && !formData.has_permutation && (
                      <button type="button" onClick={() => setFormData({ ...formData, has_permutation: true })} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50 hover:border-brand-500 hover:text-brand-600 transition-all dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:border-brand-500 dark:hover:text-brand-400">
                        + Adicionar Imóvel/Veículo como Permuta
                      </button>
                    )}

                    <div className={`mt-2 p-5 rounded-xl border-2 transition-all ${saldoDevedor > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/30'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${saldoDevedor > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>Saldo Restante</p>
                      <p className={`text-3xl font-black ${saldoDevedor > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoDevedor)}
                      </p>
                      {saldoDevedor > 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-200/50 grid grid-cols-2 gap-3 dark:border-amber-800/30">
                          <div>
                            <label className="block text-[10px] font-bold text-amber-700 mb-1.5 uppercase tracking-wide dark:text-amber-400">Nº de Parcelas Diretas</label>
                            <input type="number" min="1" value={formData.installments_count} onChange={e => setFormData({ ...formData, installments_count: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-amber-200 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm bg-white transition-all dark:bg-slate-900 dark:border-amber-700 dark:text-slate-100" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-amber-700 mb-1.5 uppercase tracking-wide dark:text-amber-400">Índice Correção</label>
                            <select value={formData.readjustment_index} onChange={e => setFormData({ ...formData, readjustment_index: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-amber-200 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm bg-white text-slate-900 transition-all dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100">
                              <option value="FIXO">Fixo (Sem Juros)</option>
                              <option value="IPCA">IPCA</option>
                              <option value="INCC">INCC</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <div className="order-1 grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* COLUNA ESQUERDA: DADOS BASE */}
                <div className="lg:col-span-12 flex flex-col gap-6">

                  {/* IMÓVEL E VALORES */}
                  <section className="order-2 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2 dark:text-white dark:border-slate-800">
                      <Icons.Home size={16} className="text-brand-500" /> Imóvel e Valor
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Imóvel Negociado *</label>
                        <select required value={formData.property_id} onChange={handlePropertyChange} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          <option value="">Selecione o imóvel...</option>
                          {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Valor Total Fechado (R$) *</label>
                        <input type="number" required value={formData.sale_total_value} onChange={e => handleTotalValueChange(e.target.value)} className="w-full px-4 py-4 rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-900 font-black text-2xl outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-400" placeholder="0.00" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Comissão (%)</label>
                          <input type="number" step="0.1" value={formData.commission_percentage} onChange={e => handleCommissionPctChange(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm bg-white transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Comissão (R$)</label>
                          <input type="number" value={formData.commission_value} onChange={e => handleCommissionValChange(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm font-bold text-brand-700 bg-white transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-brand-400" placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* PARTES ENVOLVIDAS */}
                  <section className="order-1 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2 dark:text-white dark:border-slate-800">
                      <Icons.Users size={16} className="text-brand-500" /> Envolvidos
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Comprador (Lead) *</label>
                        <select required value={formData.lead_id} onChange={e => setFormData({ ...formData, lead_id: e.target.value, client_id: e.target.value || null })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          <option value="">Selecione o cliente...</option>
                          {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Corretor Responsável *</label>
                          <select required value={formData.broker_id} onChange={e => setFormData({ ...formData, broker_id: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            <option value="">Selecione...</option>
                            {brokers.map(b => <option key={b.id} value={b.id}>{b.name.split(' ')[0]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2 dark:text-slate-300">Data da Venda *</label>
                          <input type="date" required value={formData.sale_date} onChange={e => setFormData({ ...formData, sale_date: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                        </div>
                      </div>

                      {/* Qualificação Comprador */}
                      <div className="hidden">
                        <p className="text-xs font-bold text-slate-500 mb-3 uppercase">Qualificação do Comprador</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF/CNPJ</label>
                            <input type="text" value={contractDetails.buyer_document} onChange={e => setContractDetails({...contractDetails, buyer_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">RG</label>
                            <input type="text" value={contractDetails.buyer_rg} onChange={e => setContractDetails({...contractDetails, buyer_rg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Estado Civil</label>
                            <select value={contractDetails.buyer_marital_status} onChange={e => setContractDetails({...contractDetails, buyer_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                              <option value="">Selecione...</option>
                              <option value="Solteiro(a)">Solteiro(a)</option>
                              <option value="Casado(a)">Casado(a)</option>
                              <option value="Divorciado(a)">Divorciado(a)</option>
                              <option value="Viúvo(a)">Viúvo(a)</option>
                              <option value="União Estável">União Estável</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão</label>
                            <input type="text" value={contractDetails.buyer_profession} onChange={e => setContractDetails({...contractDetails, buyer_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Endereço</label>
                            <input type="text" value={contractDetails.buyer_address} onChange={e => setContractDetails({...contractDetails, buyer_address: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                        </div>
                        {(contractDetails.buyer_marital_status === 'Casado(a)' || contractDetails.buyer_marital_status === 'União Estável') && (
                          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-3 animate-fade-in">
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">Nome do Cônjuge</label>
                              <input type="text" value={contractDetails.buyer_spouse_name} onChange={e => setContractDetails({...contractDetails, buyer_spouse_name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF do Cônjuge</label>
                              <input type="text" value={contractDetails.buyer_spouse_document} onChange={e => setContractDetails({...contractDetails, buyer_spouse_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão Cônjuge</label>
                              <input type="text" value={contractDetails.buyer_spouse_profession} onChange={e => setContractDetails({...contractDetails, buyer_spouse_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Qualificação Vendedor */}
                      <div className="hidden">
                        <p className="text-xs font-bold text-slate-500 mb-3 uppercase flex items-center justify-between">
                          Qualificação do Vendedor
                          <span className="text-[10px] text-brand-500 bg-brand-50 px-2 py-1 rounded-md">Puxado do Imóvel</span>
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF/CNPJ</label>
                            <input type="text" value={contractDetails.seller_document} onChange={e => setContractDetails({...contractDetails, seller_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">RG</label>
                            <input type="text" value={contractDetails.seller_rg} onChange={e => setContractDetails({...contractDetails, seller_rg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Estado Civil</label>
                            <select value={contractDetails.seller_marital_status} onChange={e => setContractDetails({...contractDetails, seller_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                              <option value="">Selecione...</option>
                              <option value="Solteiro(a)">Solteiro(a)</option>
                              <option value="Casado(a)">Casado(a)</option>
                              <option value="Divorciado(a)">Divorciado(a)</option>
                              <option value="Viúvo(a)">Viúvo(a)</option>
                              <option value="União Estável">União Estável</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão</label>
                            <input type="text" value={contractDetails.seller_profession} onChange={e => setContractDetails({...contractDetails, seller_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Endereço</label>
                            <input type="text" value={contractDetails.seller_address} onChange={e => setContractDetails({...contractDetails, seller_address: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                        </div>
                        {(contractDetails.seller_marital_status === 'Casado(a)' || contractDetails.seller_marital_status === 'União Estável') && (
                          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-4 gap-3 animate-fade-in">
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">Nome do Cônjuge</label>
                              <input type="text" value={contractDetails.seller_spouse_name} onChange={e => setContractDetails({...contractDetails, seller_spouse_name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF do Cônjuge</label>
                              <input type="text" value={contractDetails.seller_spouse_document} onChange={e => setContractDetails({...contractDetails, seller_spouse_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">RG do Cônjuge</label>
                              <input type="text" value={contractDetails.seller_spouse_rg} onChange={e => setContractDetails({...contractDetails, seller_spouse_rg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão Cônjuge</label>
                              <input type="text" value={contractDetails.seller_spouse_profession} onChange={e => setContractDetails({...contractDetails, seller_spouse_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>

                {/* COLUNA DIREITA: CONDIÇÕES DE PAGAMENTO (DINÂMICO) */}
                <div className="hidden">
                  {isCashContract ? (
                    <section className="bg-emerald-500 text-white p-6 rounded-2xl shadow-lg border border-emerald-400 relative overflow-hidden animate-in fade-in slide-in-from-right-4">
                      <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none"><Icons.DollarSign size={100} /></div>
                      <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                          <Icons.CheckCircle2 size={24} className="text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Pagamento à Vista</h3>
                        <p className="text-emerald-100 text-sm mb-6">O contrato será gerado com cláusula de quitação no ato da assinatura. Não há saldo devedor.</p>
                        <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                          <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-1">Valor a ser Transferido (Pix/TED)</p>
                          <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</p>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <Icons.CreditCard size={16} className="text-brand-500" /> Formas de Pagamento
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Sinal / Entrada (R$)</label>
                          <input type="number" value={formData.sale_down_payment} onChange={e => setFormData({ ...formData, sale_down_payment: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 text-sm font-bold text-slate-800 bg-slate-50" placeholder="0.00" />
                        </div>
                        {(isStandardContract || !isPermutaContract) && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-600 mb-1">Financiamento Bancário (R$)</label>
                              <input type="number" value={formData.sale_financing_value} onChange={e => setFormData({ ...formData, sale_financing_value: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 text-sm" placeholder="0.00" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Banco Financiador</label>
                              <input type="text" value={formData.sale_financing_bank} onChange={e => setFormData({ ...formData, sale_financing_bank: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 text-sm" placeholder="Ex: Caixa" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">FGTS / Consórcio (R$)</label>
                              <input type="number" value={formData.sale_consortium_value} onChange={e => setFormData({ ...formData, sale_consortium_value: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 text-sm" placeholder="0.00" />
                            </div>
                          </div>
                        )}

                        {(isPermutaContract || formData.has_permutation) && (
                          <div className="bg-brand-50 border border-brand-200 p-4 rounded-xl animate-in fade-in">
                            <div className="flex justify-between items-center mb-3">
                              <p className="text-xs font-bold text-brand-700 uppercase">Imóvel como Parte de Pagamento</p>
                              {!isPermutaContract && (
                                <button type="button" onClick={() => setFormData({ ...formData, has_permutation: false })} className="text-xs text-red-500 hover:underline">Remover</button>
                              )}
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Endereço / Descrição</label>
                                <input type="text" value={contractDetails.permuta_address} onChange={e => setContractDetails({...contractDetails, permuta_address: e.target.value})} className="w-full bg-white border border-brand-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Ex: Lote 12, Quadra B..." />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Valor Atribuído (R$)</label>
                                <input type="number" value={formData.permutation_value} onChange={e => setFormData({ ...formData, permutation_value: e.target.value })} className="w-full bg-white border border-brand-200 rounded-lg px-3 py-2 text-sm outline-none font-bold" placeholder="0.00" />
                              </div>
                            </div>
                          </div>
                        )}

                        {!isPermutaContract && !formData.has_permutation && (
                          <button type="button" onClick={() => setFormData({ ...formData, has_permutation: true })} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50 hover:border-brand-500 hover:text-brand-600 transition-all dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:border-brand-500 dark:hover:text-brand-400">
                            + Adicionar Imóvel/Veículo como Permuta
                          </button>
                        )}

                        {/* SALDO DEVEDOR */}
                        <div className={`mt-2 p-4 rounded-xl border ${saldoDevedor > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                          <p className={`text-[10px] font-bold uppercase ${saldoDevedor > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>Saldo Restante</p>
                          <p className={`text-2xl font-black ${saldoDevedor > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoDevedor)}
                          </p>
                          {saldoDevedor > 0 && (
                            <div className="mt-4 pt-4 border-t border-amber-200/50 grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-700 mb-1">Nº de Parcelas Diretas</label>
                                <input type="number" min="1" value={formData.installments_count} onChange={e => setFormData({ ...formData, installments_count: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-amber-200 outline-none focus:border-amber-500 text-sm bg-white" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-700 mb-1">Índice Correção</label>
                                <select value={formData.readjustment_index} onChange={e => setFormData({ ...formData, readjustment_index: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-amber-200 outline-none focus:border-amber-500 text-sm bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                                  <option value="FIXO">Fixo (Sem Juros)</option>
                                  <option value="IPCA">IPCA</option>
                                  <option value="INCC">INCC</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>

            </fieldset>
          </form>
        </div>

        {/* Footer com Glassmorphism */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/80 p-5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-800/80">
          <button type="button" onClick={handleGeneratePDF} disabled={!formData.lead_id || !formData.property_id} className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-brand-500 hover:text-brand-600 dark:bg-slate-900 dark:text-slate-300">
            <Icons.FileText size={18} /> Pré-visualizar PDF
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">
              Cancelar
            </button>
            <button type="submit" form="sale-form" disabled={loading} className="flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all">
              {loading ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.Save size={18} />} Salvar Contrato
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SaleContractModal;
