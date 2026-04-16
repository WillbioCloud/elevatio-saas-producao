import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { Lead, Property } from '../types';
import { useToast } from '../contexts/ToastContext';
import { buildContractHtml, generateContract } from '../utils/contractGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

interface RentContractModalProps {
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

const RentContractModal: React.FC<RentContractModalProps> = ({ isOpen, onClose, onSuccess, contractData: _contractData }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const userAvatar = user?.user_metadata?.avatar_url || user?.avatar_url || null;
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  
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

  const [documentType, setDocumentType] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorDocument, setGuarantorDocument] = useState('');
  const [guarantorAddress, setGuarantorAddress] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');

  const [contractDetails, setContractDetails] = useState({
    tenant_name: '',
    tenant_document: '', tenant_rg: '', tenant_nationality: 'brasileiro(a)', tenant_profession: '', tenant_marital_status: '', tenant_address: '',
    tenant_spouse_name: '', tenant_spouse_document: '', tenant_spouse_rg: '', tenant_spouse_profession: '',
    landlord_name: '',
    landlord_document: '', landlord_rg: '', landlord_nationality: 'brasileiro(a)', landlord_profession: '', landlord_marital_status: '', landlord_address: '',
    landlord_spouse_name: '', landlord_spouse_document: '', landlord_spouse_rg: '', landlord_spouse_profession: ''
  });

  const [formData, setFormData] = useState({
    lead_id: '',
    client_id: null as string | null,
    property_id: '',
    broker_id: '',
    start_date: '',
    end_date: '',
    rent_value: '',
    condo_value: '',
    iptu_value: '',
    rent_guarantee_type: '',
    rent_readjustment_index: 'IGPM',
    guarantee_value: '',
    deposit_amount: '',
    commission_percentage: '',
    admin_fee_percent: 5,
    broker_fee_percent: 15,
    due_day: '', // Vazio significa: paga no mesmo dia da assinatura (mês cheio)
    dilute_deposit: false,
    deposit_installments: 1,
    punctuality_discount: '', // <-- NOVA CHAVE
    header_variant: 'full_header',
    representation_type: 'corretor',
    guarantor_name: '',
    guarantor_document: '',
    guarantor_email: '',
    guarantor_address: '', // <-- NOVA CHAVE
  });

  const selectedLeadRecord = leads.find((lead) => lead.id === formData.lead_id);
  const contractClientRecord = selectedLeadRecord;
  const selectedProperty = properties.find((property) => property.id === formData.property_id);

  // --- Cálculos Financeiros (Split) ---
  const propertyRent = Number(formData.rent_value || selectedProperty?.price || 0);
  const propertyCondo = Number(formData.condo_value || selectedProperty?.condominium || 0);
  const propertyIptu = Number(formData.iptu_value || selectedProperty?.iptu || 0);

  // O Pacote Total
  const totalMonthlyValue = propertyRent + propertyCondo + propertyIptu;

  // Cálculo dos Valores em R$ (Baseado nas percentagens do formulário)
  const adminFeeValue = (totalMonthlyValue * (Number(formData.admin_fee_percent) || 0)) / 100;
  const brokerFeeValue = (totalMonthlyValue * (Number(formData.broker_fee_percent) || 0)) / 100;
  const guaranteeMonths =
    formData.rent_guarantee_type === 'caucao_1'
      ? 1
      : formData.rent_guarantee_type === 'caucao_2'
        ? 2
        : formData.rent_guarantee_type === 'caucao_3'
          ? 3
          : 0;
  const calculatedGuaranteeValue = guaranteeMonths > 0
    ? totalMonthlyValue * guaranteeMonths
    : Number(formData.guarantee_value || 0);

  let contractDurationMonths = 12;
  if (formData.start_date && formData.end_date) {
    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    contractDurationMonths = months > 0 ? months : 12;
  }
  const totalContractValue = (totalMonthlyValue * contractDurationMonths) + calculatedGuaranteeValue;

  useEffect(() => {
    if (formData.lead_id && !_contractData) {
      const selectedLead = leads.find((lead) => lead.id === formData.lead_id);
      if (selectedLead) {
        setFormData((prev) => ({
          ...prev,
          client_id: selectedLead.id,
        }));
        setContractDetails((prev) => ({
          ...prev,
          tenant_name: selectedLead.name || '',
          tenant_document: selectedLead.cpf || '',
          tenant_rg: selectedLead.rg || '',
          tenant_profession: selectedLead.profissao || '',
          tenant_marital_status: selectedLead.estado_civil || '',
          tenant_address: selectedLead.endereco || '',
        }));
      }
    }
  }, [formData.lead_id, leads, _contractData]);

  useEffect(() => {
    if (formData.property_id && !_contractData && properties.length > 0) {
      const selectedProp = properties.find((property) => property.id === formData.property_id);
      if (selectedProp) {
        const landlordRg = formatRgWithIssuer(
          selectedProp.owner_rg,
          selectedProp.owner_rg_org,
          selectedProp.owner_rg_uf
        );
        const landlordSpouseRg = formatRgWithIssuer(
          selectedProp.owner_spouse_rg,
          selectedProp.owner_spouse_rg_org,
          selectedProp.owner_spouse_rg_uf
        );

        setContractDetails(prev => ({
          ...prev,
          landlord_name: selectedProp.owner_name || '',
          landlord_document: selectedProp.owner_cpf || selectedProp.owner_document || '',
          landlord_rg: landlordRg,
          landlord_nationality: selectedProp.owner_nationality || prev.landlord_nationality,
          landlord_profession: selectedProp.owner_profession || '',
          landlord_marital_status: selectedProp.owner_marital_status || '',
          landlord_address: selectedProp.owner_address || '',
          landlord_spouse_name: selectedProp.owner_spouse_name || '',
          landlord_spouse_document: selectedProp.owner_spouse_cpf || selectedProp.owner_spouse_document || '',
          landlord_spouse_rg: landlordSpouseRg,
        }));
        // Auto-preenchimento inteligente dos valores da locação
        setFormData(prev => ({
          ...prev,
          rent_value: prev.rent_value || String(selectedProp.price ?? ''),
          condo_value: prev.condo_value || String(selectedProp.condominium ?? ''),
          iptu_value: prev.iptu_value || String(selectedProp.iptu ?? ''),
        }));
      }
    }
  }, [formData.property_id, properties, _contractData]);

  const handleGeneratePDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedPropertyData = properties.find(p => p.id === formData.property_id);

      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
      if (months <= 0) months = 12;

      let guaranteeValuePdf = 0;
      if (formData.rent_guarantee_type === 'caucao_1') guaranteeValuePdf = totalMonthlyValue * 1;
      else if (formData.rent_guarantee_type === 'caucao_2') guaranteeValuePdf = totalMonthlyValue * 2;
      else if (formData.rent_guarantee_type === 'caucao_3') guaranteeValuePdf = totalMonthlyValue * 3;

      const contractDataObj = {
        tenant_name: contractDetails.tenant_name || contractClientRecord?.name || '',
        tenant_phone: contractClientRecord?.phone || '',
        tenant_document: contractDetails.tenant_document,
        tenant_profession: contractDetails.tenant_profession,
        tenant_marital_status: contractDetails.tenant_marital_status,
        tenant_address: contractDetails.tenant_address,
        landlord_name: contractDetails.landlord_name || selectedPropertyData?.owner_name || 'Proprietário Atual',
        landlord_phone: selectedPropertyData?.owner_phone || '',
        landlord_document: contractDetails.landlord_document,
        landlord_profession: contractDetails.landlord_profession,
        landlord_marital_status: contractDetails.landlord_marital_status,
        landlord_address: contractDetails.landlord_address,
        landlord_spouse_name: contractDetails.landlord_spouse_name,
        landlord_spouse_document: contractDetails.landlord_spouse_document,
        landlord_spouse_profession: contractDetails.landlord_spouse_profession,
        landlord_spouse_rg: contractDetails.landlord_spouse_rg,
        tenant_spouse_name: contractDetails.tenant_spouse_name,
        tenant_spouse_document: contractDetails.tenant_spouse_document,
        tenant_spouse_profession: contractDetails.tenant_spouse_profession,
        tenant_spouse_rg: contractDetails.tenant_spouse_rg,
        tenant_rg: contractDetails.tenant_rg,
        tenant_nationality: contractDetails.tenant_nationality,
        landlord_rg: contractDetails.landlord_rg,
        landlord_nationality: contractDetails.landlord_nationality,
        property_address: selectedPropertyData ? `${(selectedPropertyData as any).street || selectedPropertyData.address || ''}, ${(selectedPropertyData as any).number || 'S/N'} - ${(selectedPropertyData as any).neighborhood || ''}, CEP ${(selectedPropertyData as any).zip_code || ''}, ${selectedPropertyData.city || ''} - ${(selectedPropertyData as any).state || ''}` : '',
        property_registration: selectedPropertyData?.property_registration || '',
        property_registry_office: selectedPropertyData?.property_registry_office || '',
        property_municipal_registration: selectedPropertyData?.property_municipal_registration || '',
        rent_value: String(totalMonthlyValue),
        due_day: formData.due_day || '5',
        lease_duration: String(months),
        start_date: formData.start_date ? new Date(formData.start_date).toLocaleDateString('pt-BR') : '___/___/_____',
        end_date: formData.end_date ? new Date(formData.end_date).toLocaleDateString('pt-BR') : '___/___/_____',
        guarantor_name: guarantorName,
        guarantor_document: guarantorDocument,
        guarantor_address: formData.guarantor_address || guarantorAddress,
        guarantor_phone: guarantorPhone,
        tenant_address: selectedLeadRecord?.address || contractDetails.tenant_address,
        header_variant: formData.header_variant,
        representation_type: formData.representation_type,
        guarantor_email: formData.guarantor_email,
        due_day: formData.due_day || 'mesmo_dia',
        dilute_deposit: formData.dilute_deposit,
        deposit_installments: formData.deposit_installments,
        punctuality_discount: formData.punctuality_discount,
        // Dados Financeiros Extras para o Template HTML
        valor_caucao: guaranteeValuePdf > 0 ? guaranteeValuePdf.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A',
        parcelas_caucao: formData.dilute_deposit ? String(formData.deposit_installments) : '1',
      };

      const selectedBroker = brokers.find(b => b.id === formData.broker_id);
      const brokerName = selectedBroker?.name || brokerProfile?.name;
      const brokerDoc = (selectedBroker as any)?.cpf_cnpj || brokerProfile?.cpf_cnpj;
      const brokerCreci = (selectedBroker as any)?.creci || brokerProfile?.creci;

      await generateContract(
        documentType,
        contractDataObj,
        tenant,
        brokerProfile?.company?.logo_url ?? undefined,
        brokerName,
        brokerDoc,
        brokerCreci,
        brokerProfile?.company?.name ?? undefined,
        customTemplates.find(t => `custom_${t.id}` === documentType)?.content
      );
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      addToast('Erro ao gerar documento PDF', 'error', { avatar: userAvatar });
    } finally {
      setLoading(false);
    }
  };

  // MODO DE VISUALIZAÇÃO E PREENCHIMENTO INICIAL
  useEffect(() => {
    if (isOpen) {
      fetchData();
      
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
      fetchProfileData();
      
      const fetchTemplates = async () => {
        const { data } = await supabase.from('contract_templates').select('id, name, content').eq('type', 'rent');
        if (data) setCustomTemplates(data);
      };
      fetchTemplates();

      // Se existir _contractData, estamos no MODO VISUALIZAÇÃO!
      if (_contractData) {
        const rawGuaranteeType = String(_contractData.rent_guarantee_type || '').toLowerCase();
        const storedDocumentType =
          typeof _contractData?.contract_data?.document_type === 'string' && _contractData.contract_data.document_type
            ? _contractData.contract_data.document_type
            : rawGuaranteeType.includes('sem') || rawGuaranteeType === 'none'
              ? 'rent_noguarantee'
              : 'rent_guarantor';

        setDocumentType(storedDocumentType);
        setFormData(prev => ({
          ...prev,
          lead_id: _contractData.lead_id || '',
          client_id: _contractData.client_id || _contractData.lead_id || null,
          property_id: _contractData.property_id || '',
          broker_id: _contractData.broker_id || '',
          start_date: _contractData.start_date || '',
          end_date: _contractData.end_date || '',
          rent_value: String(_contractData.rent_value || ''),
          condo_value: String(_contractData.condo_value || ''),
          iptu_value: String(_contractData.iptu_value || ''),
          rent_guarantee_type: _contractData.rent_guarantee_type || '',
          rent_readjustment_index: _contractData.rent_readjustment_index || 'IGPM',
          admin_fee_percent: _contractData.admin_fee_percent !== undefined ? Number(_contractData.admin_fee_percent) : 10,
          broker_fee_percent: _contractData.broker_fee_percent !== undefined ? Number(_contractData.broker_fee_percent) : 100,
        }));

        if (_contractData.contract_data) {
          setContractDetails(prev => ({
            ...prev,
            ..._contractData.contract_data
          }));
          setGuarantorName(_contractData.contract_data.guarantor_name || '');
          setGuarantorDocument(_contractData.contract_data.guarantor_document || '');
          setGuarantorAddress(_contractData.contract_data.guarantor_address || '');
          setGuarantorPhone(_contractData.contract_data.guarantor_phone || '');
        }
      } else {
        // MODO CRIAÇÃO: Preenche datas padrões e puxa as comissões das configurações
        const today = new Date();
        const nextYear = new Date(today);
        nextYear.setFullYear(today.getFullYear() + 1);

        setFormData(prev => ({
          ...prev,
          start_date: today.toISOString().split('T')[0],
          end_date: nextYear.toISOString().split('T')[0],
          admin_fee_percent: user?.company?.default_commission ?? 10,
          broker_fee_percent: user?.company?.broker_commission ?? 30,
        }));
      }
    }
  }, [isOpen, _contractData, user?.company?.broker_commission, user?.company?.default_commission]);

  useEffect(() => {
    const fetchLeadProperties = async () => {
      if (!formData.lead_id) {
        setProperties([]);
        return;
      }

      const selectedLead = leads.find(l => l.id === formData.lead_id);
      if (!selectedLead) return;

      const leadBroker = (selectedLead as any).assigned_to;
      if (leadBroker) {
        setFormData(prev => ({ ...prev, broker_id: leadBroker }));
      }

      const propIds = new Set<string>();
      if ((selectedLead as any).property_id) propIds.add((selectedLead as any).property_id);
      if ((selectedLead as any).sold_property_id) propIds.add((selectedLead as any).sold_property_id);

      const interests = (selectedLead as any).interested_properties || [];
      interests.forEach((p: any) => { if (p.id) propIds.add(p.id); });

      if (propIds.size > 0) {
        const { data } = await supabase
          .from('properties')
          .select('*')
          .in('id', Array.from(propIds))
          .eq('listing_type', 'rent');

        if (data && data.length > 0) {
          setProperties(data as any);
          setFormData(prev => ({ ...prev, property_id: data[0].id }));
        } else {
          setProperties([]);
        }
      } else {
        setProperties([]);
      }
    };

    fetchLeadProperties();
  }, [formData.lead_id, leads]);

  const fetchData = async () => {
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .or('funnel_step.eq.venda_ganha,status.in.(Fechado,Venda Fechada,Venda Ganha)');

    if (leadsData) setLeads(leadsData as any);

    const { data: brokersData } = await supabase.from('profiles').select('id, name, cpf_cnpj, creci').eq('active', true);
    if (brokersData) setBrokers(brokersData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    if (months <= 0) months = 12;

    const rentVal = Number(formData.rent_value) || 0;
    const condoVal = Number(formData.condo_value) || 0;
    const iptuVal = Number(formData.iptu_value) || 0;
    const totalMonthly = rentVal + condoVal + iptuVal;

    const defaultVistoria = [
      { id: '1', item: 'Pintura Geral', status: 'ok', repair_cost: 0 },
      { id: '2', item: 'Portas e Fechaduras', status: 'ok', repair_cost: 0 },
      { id: '3', item: 'Janelas e Vidros', status: 'ok', repair_cost: 0 },
      { id: '4', item: 'Hidráulica (Torneiras/Descargas)', status: 'ok', repair_cost: 0 },
      { id: '5', item: 'Elétrica (Tomadas/Lâmpadas)', status: 'ok', repair_cost: 0 },
      { id: '6', item: 'Pisos e Rodapés', status: 'ok', repair_cost: 0 }
    ];

    try {
      const selectedLeadForSave = leads.find(l => l.id === formData.lead_id);
      const contractClientForSave = selectedLeadForSave;
      const selectedPropForSave = properties.find(p => p.id === formData.property_id);
      const selectedTemplate = customTemplates.find(t => `custom_${t.id}` === documentType);
      const resolvedClientId = formData.client_id || formData.lead_id || null;

      let guaranteeValuePdf = 0;
      if (formData.rent_guarantee_type === 'caucao_1') guaranteeValuePdf = totalMonthly * 1;
      else if (formData.rent_guarantee_type === 'caucao_2') guaranteeValuePdf = totalMonthly * 2;
      else if (formData.rent_guarantee_type === 'caucao_3') guaranteeValuePdf = totalMonthly * 3;

      const contractDataObj = {
        tenant_name: contractDetails.tenant_name || contractClientForSave?.name || '',
        tenant_phone: contractClientForSave?.phone || '',
        tenant_document: contractDetails.tenant_document,
        tenant_profession: contractDetails.tenant_profession,
        tenant_marital_status: contractDetails.tenant_marital_status,
        tenant_address: contractDetails.tenant_address,
        landlord_name: contractDetails.landlord_name || selectedPropForSave?.owner_name || 'Proprietário Atual',
        landlord_phone: selectedPropForSave?.owner_phone || '',
        landlord_document: contractDetails.landlord_document,
        landlord_profession: contractDetails.landlord_profession,
        landlord_marital_status: contractDetails.landlord_marital_status,
        landlord_address: contractDetails.landlord_address,
        landlord_spouse_name: contractDetails.landlord_spouse_name,
        landlord_spouse_document: contractDetails.landlord_spouse_document,
        landlord_spouse_profession: contractDetails.landlord_spouse_profession,
        landlord_spouse_rg: contractDetails.landlord_spouse_rg,
        tenant_spouse_name: contractDetails.tenant_spouse_name,
        tenant_spouse_document: contractDetails.tenant_spouse_document,
        tenant_spouse_profession: contractDetails.tenant_spouse_profession,
        tenant_spouse_rg: contractDetails.tenant_spouse_rg,
        tenant_rg: contractDetails.tenant_rg,
        tenant_nationality: contractDetails.tenant_nationality,
        landlord_rg: contractDetails.landlord_rg,
        landlord_nationality: contractDetails.landlord_nationality,
        property_address: selectedPropForSave ? `${(selectedPropForSave as any).street || selectedPropForSave.address || ''}, ${(selectedPropForSave as any).number || 'S/N'} - ${(selectedPropForSave as any).neighborhood || ''}, CEP ${(selectedPropForSave as any).zip_code || ''}, ${selectedPropForSave.city || ''} - ${(selectedPropForSave as any).state || ''}` : '',
        property_registration: selectedPropForSave?.property_registration || '',
        property_registry_office: selectedPropForSave?.property_registry_office || '',
        property_municipal_registration: selectedPropForSave?.property_municipal_registration || '',
        rent_value: String(totalMonthlyValue),
        due_day: formData.due_day || '5',
        lease_duration: String(months),
        start_date: formData.start_date ? new Date(formData.start_date).toLocaleDateString('pt-BR') : '___/___/_____',
        end_date: formData.end_date ? new Date(formData.end_date).toLocaleDateString('pt-BR') : '___/___/_____',
        guarantor_name: guarantorName,
        guarantor_document: guarantorDocument,
        guarantor_address: formData.guarantor_address || guarantorAddress,
        guarantor_phone: guarantorPhone,
        tenant_address: selectedLeadRecord?.address || contractDetails.tenant_address,
        // Variáveis financeiras enviadas para o PDF
        punctuality_discount: formData.punctuality_discount,
        due_day: formData.due_day,
        dilute_deposit: formData.dilute_deposit,
        deposit_installments: formData.deposit_installments,
        // Dados Financeiros Extras para o Template HTML
        valor_caucao: guaranteeValuePdf > 0 ? guaranteeValuePdf.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A',
        parcelas_caucao: formData.dilute_deposit ? String(formData.deposit_installments) : '1',
      };
      const rawTemplate = selectedTemplate?.content || '';
      const selectedBroker = brokers.find(b => b.id === formData.broker_id);
      const brokerName = selectedBroker?.name || brokerProfile?.name;
      const brokerDoc = (selectedBroker as any)?.cpf_cnpj || brokerProfile?.cpf_cnpj;
      const brokerCreci = (selectedBroker as any)?.creci || brokerProfile?.creci;
      const contractHtmlData = {
        ...contractDataObj,
        lead: contractClientForSave,
        property: selectedPropForSave,
      };
      const finalHtml = await buildContractHtml(
        rawTemplate.trim().length > 0 && !documentType.startsWith('custom_') ? 'custom_runtime' : documentType,
        contractHtmlData,
        tenant,
        brokerProfile?.company?.logo_url ?? undefined,
        brokerName,
        brokerDoc,
        brokerCreci,
        brokerProfile?.company?.name ?? undefined,
        rawTemplate || undefined
      );

      const payload = {
        type: 'rent',
        status: 'pending',
        lead_id: formData.lead_id || null,
        client_id: resolvedClientId,
        property_id: formData.property_id || null,
        broker_id: formData.broker_id || null,
        created_by: user?.id, // ADICIONADO: Garante a autoria
        start_date: formData.start_date,
        end_date: formData.end_date,
        rent_value: (Number(selectedPropForSave?.rent_value || rentVal) || 0) + (Number(selectedPropForSave?.condo_value || condoVal) || 0) + (Number(selectedPropForSave?.iptu_value || iptuVal) || 0),
        condo_value: condoVal,
        iptu_value: iptuVal,
        rent_guarantee_type: formData.rent_guarantee_type,
        rent_readjustment_index: formData.rent_readjustment_index,
        commission_percentage: Number(formData.commission_percentage) || 0,

        // CORREÇÃO CRÍTICA: Salvando as taxas do Split!
        admin_fee_percent: Number(formData.admin_fee_percent) || 0,
        broker_fee_percent: Number(formData.broker_fee_percent) || 0,

        // CORREÇÃO CRÍTICA: Salvando os nomes para a aba Financeiro ler depois!
        contract_data: {
          ...contractDetails,
          ...contractDataObj,
          document_type: documentType,
          template_content: rawTemplate || null,
          lessor_name: contractDetails.landlord_name || selectedPropForSave?.owner_name || 'Proprietário',
          lessee_name: contractDetails.tenant_name || contractClientForSave?.name || 'Inquilino',
          guarantor_name: guarantorName,
          guarantor_document: guarantorDocument,
          guarantor_address: guarantorAddress,
          guarantor_phone: guarantorPhone,
          tenant_name: contractDetails.tenant_name || contractClientForSave?.name || '',
          tenant_email: contractClientForSave?.email,
          owner_name: contractDetails.landlord_name || selectedPropForSave?.owner_name || '',
          owner_email: properties.find(p => p.id === formData.property_id)?.owner_email,
          guarantor_email: formData.guarantor_email,
          representation_type: formData.representation_type,
          header_variant: formData.header_variant,
          due_day: formData.due_day || 'mesmo_dia',
          dilute_deposit: formData.dilute_deposit,
          deposit_installments: formData.deposit_installments,
          punctuality_discount: formData.punctuality_discount,
          broker_name: brokerProfile?.name,
        },
        content: rawTemplate,
        html_content: finalHtml,
        vistoria_items: defaultVistoria,
        company_id: user?.company_id,
      };

      const { data: contract, error } = await supabase.from('contracts').insert([payload]).select().single();
      if (error) throw error;

      if (resolvedClientId) {
        const { error: clientEnrichmentError } = await supabase
          .from('leads')
          .update({
            cpf: contractDetails.tenant_document,
            rg: contractDetails.tenant_rg,
            profissao: contractDetails.tenant_profession,
            estado_civil: contractDetails.tenant_marital_status,
            endereco: contractDetails.tenant_address
          })
          .eq('id', resolvedClientId);

        if (clientEnrichmentError) {
          console.error('Erro ao enriquecer o cadastro do cliente:', clientEnrichmentError);
        }
      }

      if (contract) {
        const installments = [];
        // --- INÍCIO: MOTOR FINANCEIRO DE LOCAÇÃO ---
        let guaranteeValue = 0;
        if (formData.rent_guarantee_type === 'caucao_1') guaranteeValue = totalMonthly * 1;
        else if (formData.rent_guarantee_type === 'caucao_2') guaranteeValue = totalMonthly * 2;
        else if (formData.rent_guarantee_type === 'caucao_3') guaranteeValue = totalMonthly * 3;

        // Calcula a fração da diluição
        const diluteCount = formData.dilute_deposit ? (Number(formData.deposit_installments) || 1) : 1;
        const depositPerInstallment = guaranteeValue > 0 ? (guaranteeValue / diluteCount) : 0;

        // Cálculos de Data e Pró-rata para a 1ª Parcela
        let firstDueDate = new Date(startDate);
        let firstMonthProrata = totalMonthly;

        if (formData.due_day && formData.due_day !== '') {
          const dueDay = parseInt(formData.due_day, 10);
          // Tenta setar o vencimento para o mês atual
          firstDueDate = new Date(startDate.getFullYear(), startDate.getMonth(), dueDay);

          // Se o dia de vencimento escolhido for menor ou igual ao dia de início, joga o 1º vencimento para o próximo mês
          if (firstDueDate <= startDate) {
            firstDueDate.setMonth(firstDueDate.getMonth() + 1);
          }

          // Diferença exata de dias entre o início do contrato e o primeiro vencimento
          const diffTime = Math.abs(firstDueDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Pró-rata baseado no mês comercial de 30 dias (se o período for menor ou igual a 31 dias)
          if (diffDays > 0 && diffDays <= 31) {
            firstMonthProrata = (totalMonthly / 30) * diffDays;
          }
        } else {
          // Se não escolheu dia fixo, vence em 30 dias após a assinatura
          firstDueDate.setMonth(firstDueDate.getMonth() + 1);
        }

        // Loop de Geração das Parcelas
        for (let i = 1; i <= months; i++) {
          const currentDueDate = new Date(firstDueDate);
          if (i > 1) {
            currentDueDate.setMonth(currentDueDate.getMonth() + (i - 1));
          }

          // A primeira parcela pega o valor do pró-rata, as demais o valor cheio
          let installmentAmount = i === 1 ? firstMonthProrata : totalMonthly;

          // Diluição da Caução: Soma a fração do depósito enquanto estiver no limite de meses escolhido
          if (i <= diluteCount && guaranteeValue > 0) {
            installmentAmount += depositPerInstallment;
          }

          installments.push({
            contract_id: contract.id,
            company_id: user?.company_id,
            type: 'rent_monthly',
            installment_number: i,
            amount: Number(installmentAmount.toFixed(2)),
            due_date: currentDueDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }
        // --- FIM: MOTOR FINANCEIRO DE LOCAÇÃO ---

        const { error: installmentsError } = await supabase.from('installments').insert(installments);
        if (installmentsError) {
          console.error("Erro ao gerar parcelas:", installmentsError);
          throw new Error("Contrato criado, mas houve uma falha ao gerar as parcelas mensais.");
        }
      }

      if (formData.property_id) {
        await supabase
          .from('properties')
          .update({ status: 'Alugado' })
          .eq('id', formData.property_id);
      }

      addToast('Novo contrato de aluguel gerado com sucesso.', 'success', { avatar: userAvatar });

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

        {/* Header Locação */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-600 p-2.5 text-white shadow-lg shadow-violet-500/20">
              <Icons.KeyRound size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">Contrato de Locação</h2>
              <p className="text-sm font-medium text-slate-500 italic">Emissão de documentos para aluguel residencial/comercial.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700">
            <Icons.X size={24} />
          </button>
        </div>

        {/* Body Seccionado */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 bg-white dark:bg-slate-900">
          <form id="rent-form" onSubmit={handleSubmit} className="space-y-8">
            <fieldset disabled={!!_contractData} className="contents">

            {/* 1. ENVOLVIDOS E PRAZOS */}
            <section className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 dark:text-slate-300 dark:border-slate-700">
                <Icons.Calendar size={16} /> Partes e Prazos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Locatário (Inquilino)</label>
                  <select required value={formData.lead_id} onChange={e => setFormData({ ...formData, lead_id: e.target.value, client_id: e.target.value || null })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <option value="" className="text-slate-900">Selecione um cliente...</option>
                    {leads.map(l => <option key={l.id} value={l.id} className="text-slate-900">{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Imóvel</label>
                  <select required value={formData.property_id} onChange={e => setFormData({ ...formData, property_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <option value="" className="text-slate-900">Selecione o imóvel...</option>
                    {properties.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Corretor Responsável</label>
                  <select required value={formData.broker_id} onChange={e => setFormData({ ...formData, broker_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <option value="" className="text-slate-900">Selecione...</option>
                    {brokers.map(b => <option key={b.id} value={b.id} className="text-slate-900">{b.name.split(' ')[0]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Início do Contrato</label>
                  <input type="date" required value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Fim do Contrato</label>
                  <input type="date" required value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 text-sm" />
                </div>
              </div>
            </section>

            {/* --- INÍCIO: CONFIGURAÇÕES DO CONTRATO E VENCIMENTO --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 mt-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Estilo do Cabeçalho</label>
                <select 
                  value={formData.header_variant || 'full_header'} 
                  onChange={(e) => setFormData({ ...formData, header_variant: e.target.value })} 
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="full_header">Completo (Logo + Nome + Contato)</option>
                  <option value="logo_name_phone">Logo + Nome + Telefone</option>
                  <option value="logo_name">Apenas Logo e Nome</option>
                  <option value="logo_only">Apenas Logotipo</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Dia de Pagamento</label>
                <select 
                  value={formData.due_day || ''} 
                  onChange={(e) => setFormData({ ...formData, due_day: e.target.value })} 
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="">Mesmo dia do contrato (Sem Pró-rata)</option>
                  <option value="01">Todo dia 01</option>
                  <option value="05">Todo dia 05</option>
                  <option value="10">Todo dia 10</option>
                  <option value="15">Todo dia 15</option>
                  <option value="20">Todo dia 20</option>
                  <option value="25">Todo dia 25</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Desconto Pontualidade (R$)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={formData.punctuality_discount} 
                  onChange={(e) => setFormData({ ...formData, punctuality_discount: e.target.value })} 
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-brand-600 bg-white dark:bg-slate-900 dark:text-brand-400 outline-none" 
                  placeholder="Ex: 100" 
                />
                <p className="text-[10px] text-slate-400 mt-1">Concedido se pago até o vencimento.</p>
              </div>
            </div>
            {/* --- FIM: CONFIGURAÇÕES DO CONTRATO E VENCIMENTO --- */}

            {/* DADOS DO FIADOR (Aparece apenas se a locação tiver fiador) */}
            {documentType === 'rent_guarantor' && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-amber-600 flex items-center gap-2">
                  <Icons.Users size={14}/> Dados do Fiador
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-amber-50/30 dark:bg-amber-500/5 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/10">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Nome do Fiador</label>
                    <input 
                      type="text" 
                      value={formData.guarantor_name || ''} 
                      onChange={(e) => setFormData({ ...formData, guarantor_name: e.target.value })} 
                      className="w-full rounded-xl border border-amber-200 p-3 text-sm font-bold text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 dark:border-amber-800 outline-none" 
                      placeholder="Nome Completo" 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">CPF / CNPJ</label>
                    <input 
                      type="text" 
                      value={formData.guarantor_document || ''} 
                      onChange={(e) => setFormData({ ...formData, guarantor_document: e.target.value })} 
                      className="w-full rounded-xl border border-amber-200 p-3 text-sm font-bold text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 dark:border-amber-800 outline-none" 
                      placeholder="000.000.000-00" 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">E-mail</label>
                    <input 
                      type="email" 
                      value={formData.guarantor_email || ''} 
                      onChange={(e) => setFormData({ ...formData, guarantor_email: e.target.value })} 
                      className="w-full rounded-xl border border-amber-200 p-3 text-sm font-bold text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 dark:border-amber-800 outline-none" 
                      placeholder="email@exemplo.com" 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Endereço Completo</label>
                    <input 
                      type="text" 
                      value={formData.guarantor_address || ''} 
                      onChange={(e) => setFormData({ ...formData, guarantor_address: e.target.value })} 
                      className="w-full rounded-xl border border-amber-200 p-3 text-sm font-bold text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 dark:border-amber-800 outline-none" 
                      placeholder="Rua, Número, Cidade - UF" 
                    />
                  </div>
                </div>
              </div>
            )}
            {/* --- FIM: CONFIGURAÇÕES EXTRAS --- */}

            {/* 2. VALORES MENSAIS */}
            <section className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 dark:text-slate-300 dark:border-slate-700">
                <Icons.DollarSign size={16} /> Valores Mensais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Valor do Aluguel (R$)</label>
                  <input type="number" required value={formData.rent_value} onChange={e => setFormData({ ...formData, rent_value: e.target.value })} className="w-full px-3 py-3 rounded-lg border-2 border-indigo-200 bg-indigo-50 text-indigo-900 font-bold text-lg outline-none focus:border-indigo-500" placeholder="Ex: 2500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Condomínio (R$)</label>
                  <input type="number" value={formData.condo_value} onChange={e => setFormData({ ...formData, condo_value: e.target.value })} className="w-full px-3 py-3 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 text-sm" placeholder="Ex: 500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">IPTU Mensal (R$)</label>
                  <input type="number" value={formData.iptu_value} onChange={e => setFormData({ ...formData, iptu_value: e.target.value })} className="w-full px-3 py-3 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 text-sm" placeholder="Ex: 150" />
                </div>
              </div>
            </section>

            {/* --- SECÇÃO DE COMISSIONAMENTO E TAXAS --- */}
            <div className="mt-8 mb-6 rounded-2xl border border-brand-100 bg-brand-50/40 p-6 dark:border-brand-900/30 dark:bg-brand-900/10">
              <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-brand-700 dark:text-brand-400">
                <Icons.PieChart size={20} />
                Comissionamento e Repasses (Split)
              </h3>

              <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Valor Total Mensal (Aluguel + Cond. + IPTU):</span>
                <span className="text-xl font-black text-slate-800 dark:text-white">
                  R$ {totalMonthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <label className="mb-3 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Taxa de Administração (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-2/5">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.admin_fee_percent}
                        onChange={(e) => setFormData({ ...formData, admin_fee_percent: Number(e.target.value) })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-8 font-black text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                    </div>
                    <span className="text-xl font-light text-slate-300">=</span>
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-emerald-500">R$</span>
                      <input
                        type="text"
                        disabled
                        value={adminFeeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        className="w-full cursor-not-allowed rounded-xl border border-emerald-100 bg-emerald-50 py-3 pl-11 pr-4 font-black text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400"
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-500">Valor mensal retido pela imobiliária.</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <label className="mb-3 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Comissão do Corretor (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-2/5">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.broker_fee_percent}
                        onChange={(e) => setFormData({ ...formData, broker_fee_percent: Number(e.target.value) })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-8 font-black text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                    </div>
                    <span className="text-xl font-light text-slate-300">=</span>
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-blue-500">R$</span>
                      <input
                        type="text"
                        disabled
                        value={brokerFeeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        className="w-full cursor-not-allowed rounded-xl border border-blue-100 bg-blue-50 py-3 pl-11 pr-4 font-black text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400"
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-500">Comissão destinada ao corretor da transação.</p>
                </div>
              </div>
            </div>

            {/* 3. GARANTIA E REAJUSTE */}
            <section className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2 dark:text-slate-300">
                <Icons.Shield size={14} /> Garantia e Condições
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Garantia Locatícia</label>
                  <select required value={formData.rent_guarantee_type} onChange={e => setFormData({ ...formData, rent_guarantee_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <option value="" className="text-slate-900">Selecione a garantia...</option>
                    <option value="caucao_1" className="text-slate-900">Caução (1 mês)</option>
                    <option value="caucao_2" className="text-slate-900">Caução (2 meses)</option>
                    <option value="caucao_3" className="text-slate-900">Caução (3 meses)</option>
                    <option value="fiador" className="text-slate-900">Fiador Solidário</option>
                    <option value="seguro_fianca" className="text-slate-900">Seguro Fiança (Credpago, Porto...)</option>
                    <option value="titulo_capitalizacao" className="text-slate-900">Título de Capitalização</option>
                    <option value="sem_garantia" className="text-slate-900">Sem Garantia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Índice de Reajuste</label>
                  <select value={formData.rent_readjustment_index} onChange={e => setFormData({ ...formData, rent_readjustment_index: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <option value="IGPM" className="text-slate-900">IGP-M</option>
                    <option value="IPCA" className="text-slate-900">IPCA</option>
                    <option value="INPC" className="text-slate-900">INPC</option>
                  </select>
                </div>
              </div>

              {/* LÓGICA DE DILUIÇÃO CONDICIONAL (Aparece apenas se a garantia atual for Caução) */}
              {(formData.rent_guarantee_type?.toLowerCase().includes('caucao') || formData.rent_guarantee_type?.toLowerCase().includes('caução')) && (
                <div className="col-span-full md:col-span-2 bg-brand-50/50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800/30 p-4 rounded-xl mt-4 animate-in fade-in flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="dilute-deposit"
                        checked={formData.dilute_deposit} 
                        onChange={(e) => setFormData({
                          ...formData, 
                          dilute_deposit: e.target.checked, 
                          deposit_installments: e.target.checked ? 2 : 1
                        })}
                        className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <label htmlFor="dilute-deposit" className="text-sm font-bold text-brand-700 dark:text-brand-400 cursor-pointer">
                        Diluir Caução nas primeiras parcelas?
                      </label>
                    </div>
                  </div>
                  {formData.dilute_deposit && (
                    <div className="flex-1 w-full">
                      <select 
                        value={formData.deposit_installments} 
                        onChange={(e) => setFormData({
                          ...formData, 
                          deposit_installments: Number(e.target.value)
                        })}
                        className="w-full rounded-lg border border-brand-200 p-2.5 text-sm font-bold text-brand-700 bg-white outline-none ring-2 ring-brand-500/20"
                      >
                        <option value={2}>Diluir em 2 vezes (50% / 50%)</option>
                        <option value={3}>Diluir em 3 vezes (33% / 33% / 33%)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 4. TIPO DE DOCUMENTO (PARA GERAÇÃO DE PDF) */}
            <section className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2 dark:text-slate-300">
                <Icons.FileText size={14} /> Modelo de Contrato
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Selecione o tipo de contrato para gerar o PDF</label>
                <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-indigo-300 outline-none focus:border-indigo-500 bg-white text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                  <option value="" className="text-slate-900">Escolha um modelo...</option>
                  {customTemplates.length > 0 && (
                    <>
                      {customTemplates.map(t => (
                        <option key={`custom_${t.id}`} value={`custom_${t.id}`} className="text-slate-900">⭐ {t.name}</option>
                      ))}
                      <option disabled>──────────────</option>
                    </>
                  )}
                  <option value="rent_guarantor" className="text-slate-900">Locação Residencial com Fiador</option>
                  <option value="rent_noguarantee" className="text-slate-900">Locação Residencial sem Garantia</option>
                  <option value="rent_commercial" className="text-slate-900">Locação Comercial</option>
                </select>
              </div>

              {/* Dados Complementares para o Contrato */}
              {documentType && documentType !== '' && (
                <div className="pt-4 border-t border-slate-100 mt-4 animate-fade-in space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Icons.FileText size={16} className="text-brand-500" /> Qualificação das Partes (Para o Contrato)
                  </h4>

                  {/* Locatário (Inquilino) */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados do Locatário (Inquilino)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">CPF/CNPJ</label>
                        <input type="text" value={contractDetails.tenant_document} onChange={e => setContractDetails({...contractDetails, tenant_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">RG e Órgão</label>
                        <input type="text" placeholder="Ex: 12345 SSP-GO" value={contractDetails.tenant_rg} onChange={e => setContractDetails({...contractDetails, tenant_rg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Nacionalidade</label>
                        <input type="text" value={contractDetails.tenant_nationality} onChange={e => setContractDetails({...contractDetails, tenant_nationality: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Estado Civil</label>
                        <select value={contractDetails.tenant_marital_status} onChange={e => setContractDetails({...contractDetails, tenant_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:bg-slate-950 dark:text-slate-100">
                          <option value="" className="text-slate-900">Selecione...</option>
                          <option value="Solteiro(a)" className="text-slate-900">Solteiro(a)</option>
                          <option value="Casado(a)" className="text-slate-900">Casado(a)</option>
                          <option value="Divorciado(a)" className="text-slate-900">Divorciado(a)</option>
                          <option value="Viúvo(a)" className="text-slate-900">Viúvo(a)</option>
                          <option value="União Estável" className="text-slate-900">União Estável</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Profissão</label>
                        <input type="text" value={contractDetails.tenant_profession} onChange={e => setContractDetails({...contractDetails, tenant_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Endereço Atual</label>
                        <input type="text" value={contractDetails.tenant_address} onChange={e => setContractDetails({...contractDetails, tenant_address: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500" />
                      </div>
                      {(contractDetails.tenant_marital_status === 'Casado(a)' || contractDetails.tenant_marital_status === 'União Estável') && (
                        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2 pt-3 border-t border-slate-200 animate-fade-in">
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Nome do Cônjuge</label>
                            <input type="text" value={contractDetails.tenant_spouse_name} onChange={e => setContractDetails({...contractDetails, tenant_spouse_name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF do Cônjuge</label>
                            <input type="text" value={contractDetails.tenant_spouse_document} onChange={e => setContractDetails({...contractDetails, tenant_spouse_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">RG do Cônjuge</label>
                            <input type="text" value={contractDetails.tenant_spouse_rg} onChange={e => setContractDetails({...contractDetails, tenant_spouse_rg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão</label>
                            <input type="text" value={contractDetails.tenant_spouse_profession} onChange={e => setContractDetails({...contractDetails, tenant_spouse_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Locador (Proprietário) */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados do Locador (Proprietário)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">CPF/CNPJ</label>
                        <input type="text" value={contractDetails.landlord_document} onChange={e => setContractDetails({...contractDetails, landlord_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">RG e Órgão</label>
                        <input type="text" placeholder="Ex: 12345 SSP-GO" value={contractDetails.landlord_rg} onChange={e => setContractDetails({...contractDetails, landlord_rg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Nacionalidade</label>
                        <input type="text" value={contractDetails.landlord_nationality} onChange={e => setContractDetails({...contractDetails, landlord_nationality: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Estado Civil</label>
                        <select value={contractDetails.landlord_marital_status} onChange={e => setContractDetails({...contractDetails, landlord_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:bg-slate-950 dark:text-slate-100">
                          <option value="" className="text-slate-900">Selecione...</option>
                          <option value="Solteiro(a)" className="text-slate-900">Solteiro(a)</option>
                          <option value="Casado(a)" className="text-slate-900">Casado(a)</option>
                          <option value="Divorciado(a)" className="text-slate-900">Divorciado(a)</option>
                          <option value="Viúvo(a)" className="text-slate-900">Viúvo(a)</option>
                          <option value="União Estável" className="text-slate-900">União Estável</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Profissão</label>
                        <input type="text" value={contractDetails.landlord_profession} onChange={e => setContractDetails({...contractDetails, landlord_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Endereço Atual</label>
                        <input type="text" value={contractDetails.landlord_address} onChange={e => setContractDetails({...contractDetails, landlord_address: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500" />
                      </div>
                      {(contractDetails.landlord_marital_status === 'Casado(a)' || contractDetails.landlord_marital_status === 'União Estável') && (
                        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2 pt-3 border-t border-slate-200 animate-fade-in">
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Nome do Cônjuge</label>
                            <input type="text" value={contractDetails.landlord_spouse_name} onChange={e => setContractDetails({...contractDetails, landlord_spouse_name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF do Cônjuge</label>
                            <input type="text" value={contractDetails.landlord_spouse_document} onChange={e => setContractDetails({...contractDetails, landlord_spouse_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">RG do Cônjuge</label>
                            <input type="text" value={contractDetails.landlord_spouse_rg} onChange={e => setContractDetails({...contractDetails, landlord_spouse_rg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Profissão</label>
                            <input type="text" value={contractDetails.landlord_spouse_profession} onChange={e => setContractDetails({...contractDetails, landlord_spouse_profession: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Campos Dinâmicos: Fiador (Aparece apenas se o contrato exigir fiador) */}
              {documentType === 'rent_guarantor' && (
                <div className="pt-4 mt-4 border-t border-indigo-200 animate-fade-in bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <h4 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                    <Icons.Shield size={16} /> Dados do Fiador Exigidos
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Fiador</label>
                      <input
                        type="text"
                        value={guarantorName}
                        onChange={e => setGuarantorName(e.target.value)}
                        placeholder="Nome completo"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CPF do Fiador</label>
                      <input
                        type="text"
                        value={guarantorDocument}
                        onChange={e => setGuarantorDocument(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Endereço do Fiador</label>
                      <input
                        type="text"
                        value={guarantorAddress}
                        onChange={e => setGuarantorAddress(e.target.value)}
                        placeholder="Rua, número, bairro, cidade"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Telefone do Fiador</label>
                      <input
                        type="text"
                        value={guarantorPhone}
                        onChange={e => setGuarantorPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            </fieldset>
          </form>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/80 p-5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-800/80">
          <button type="button" onClick={handleGeneratePDF} disabled={!formData.lead_id || !formData.property_id || !documentType} className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-violet-500 hover:text-violet-600 dark:bg-slate-900 dark:text-slate-300">
            <Icons.FileText size={18} /> Visualizar Minuta
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">
              Cancelar
            </button>
            <button type="submit" form="rent-form" disabled={loading} className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all">
              {loading ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.Save size={18} />} Salvar Locação
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RentContractModal;
