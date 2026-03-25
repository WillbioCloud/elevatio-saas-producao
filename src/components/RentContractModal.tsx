import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { Lead, Property } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { generateContract } from '../utils/contractGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { RENT_DOCUMENTS, ADMIN_DOCUMENTS } from '../constants/contractTypes';

interface RentContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractData?: any;
}

const RentContractModal: React.FC<RentContractModalProps> = ({ isOpen, onClose, onSuccess, contractData: _contractData }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  
  const [brokerProfile, setBrokerProfile] = useState<{name: string, company_logo: string, cpf_cnpj: string, creci: string} | null>(null);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  const [documentType, setDocumentType] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorDocument, setGuarantorDocument] = useState('');
  const [guarantorAddress, setGuarantorAddress] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');

  const [contractDetails, setContractDetails] = useState({
    tenant_document: '', tenant_rg: '', tenant_nationality: 'brasileiro(a)', tenant_profession: '', tenant_marital_status: '', tenant_address: '',
    tenant_spouse_name: '', tenant_spouse_document: '', tenant_spouse_rg: '', tenant_spouse_profession: '',
    landlord_document: '', landlord_rg: '', landlord_nationality: 'brasileiro(a)', landlord_profession: '', landlord_marital_status: '', landlord_address: '',
    landlord_spouse_name: '', landlord_spouse_document: '', landlord_spouse_rg: '', landlord_spouse_profession: ''
  });

  const [formData, setFormData] = useState({
    lead_id: '',
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
    due_day: '5',
  });

  useEffect(() => {
    if (formData.property_id && properties.length > 0) {
      const selectedProp = properties.find(p => p.id === formData.property_id);
      if (selectedProp) {
        setContractDetails(prev => ({
          ...prev,
          landlord_document: selectedProp.owner_document || prev.landlord_document,
          landlord_rg: (selectedProp as any).owner_rg || prev.landlord_rg,
          landlord_nationality: (selectedProp as any).owner_nationality || prev.landlord_nationality,
          landlord_profession: selectedProp.owner_profession || prev.landlord_profession,
          landlord_marital_status: selectedProp.owner_marital_status || prev.landlord_marital_status,
          landlord_address: selectedProp.owner_address || prev.landlord_address,
        }));
        // Auto-preenchimento inteligente do valor do Aluguel
        if (selectedProp.price && !formData.rent_value) {
          setFormData(prev => ({ ...prev, rent_value: String(selectedProp.price) }));
        }
      }
    }
  }, [formData.property_id, properties]);

  const handleGeneratePDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedLead = leads.find(l => l.id === formData.lead_id);
      const selectedPropertyData = properties.find(p => p.id === formData.property_id);

      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
      if (months <= 0) months = 12;

      const contractDataObj = {
        tenant_name: selectedLead?.name || '',
        tenant_phone: selectedLead?.phone || '',
        tenant_document: contractDetails.tenant_document,
        tenant_profession: contractDetails.tenant_profession,
        tenant_marital_status: contractDetails.tenant_marital_status,
        tenant_address: contractDetails.tenant_address,
        landlord_name: selectedPropertyData?.owner_name || 'Proprietário Atual',
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
        rent_value: formData.rent_value,
        due_day: formData.due_day || '5',
        lease_duration: String(months),
        start_date: formData.start_date ? new Date(formData.start_date).toLocaleDateString('pt-BR') : '___/___/_____',
        end_date: formData.end_date ? new Date(formData.end_date).toLocaleDateString('pt-BR') : '___/___/_____',
        guarantor_name: guarantorName,
        guarantor_document: guarantorDocument,
        guarantor_address: guarantorAddress,
        guarantor_phone: guarantorPhone,
      };

      const selectedBroker = brokers.find(b => b.id === formData.broker_id);
      const brokerName = selectedBroker?.name || brokerProfile?.name;
      const brokerDoc = (selectedBroker as any)?.cpf_cnpj || brokerProfile?.cpf_cnpj;
      const brokerCreci = (selectedBroker as any)?.creci || brokerProfile?.creci;

      await generateContract(documentType, contractDataObj, tenant, brokerProfile?.company_logo, brokerName, brokerDoc, brokerCreci, (brokerProfile as any)?.companies?.name, customTemplates.find(t => `custom_${t.id}` === documentType)?.content);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      addNotification({ title: 'Erro ao gerar documento PDF', message: '', type: 'property' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
      const fetchProfileData = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data } = await supabase.from('profiles').select('name, company_logo, cpf_cnpj, creci, companies(name)').eq('id', authUser.id).single();
          if (data) setBrokerProfile(data as any);
        }
      };
      fetchProfileData();
      const fetchTemplates = async () => {
        const { data } = await supabase.from('contract_templates').select('id, name, content').eq('type', 'rent');
        if (data) setCustomTemplates(data);
      };
      fetchTemplates();
      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);

      setFormData(prev => ({
        ...prev,
        start_date: today.toISOString().split('T')[0],
        end_date: nextYear.toISOString().split('T')[0]
      }));
    }
  }, [isOpen]);

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
      const payload = {
        type: 'rent',
        status: 'pending',
        lead_id: formData.lead_id || null,
        property_id: formData.property_id || null,
        broker_id: formData.broker_id || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        rent_value: rentVal,
        condo_value: condoVal,
        iptu_value: iptuVal,
        rent_guarantee_type: formData.rent_guarantee_type,
        rent_readjustment_index: formData.rent_readjustment_index,
        commission_percentage: Number(formData.commission_percentage) || 0,
        vistoria_items: defaultVistoria,
        company_id: user?.company_id,
      };

      const { data: contract, error } = await supabase.from('contracts').insert([payload]).select().single();
      if (error) throw error;

      if (contract) {
        const installments = [];
        // Lógica de Caução: Multiplica o valor do aluguel puro pela quantidade de meses escolhida
        let guaranteeValue = 0;
        if (formData.rent_guarantee_type === 'caucao_1') guaranteeValue = rentVal * 1;
        else if (formData.rent_guarantee_type === 'caucao_2') guaranteeValue = rentVal * 2;
        else if (formData.rent_guarantee_type === 'caucao_3') guaranteeValue = rentVal * 3;

        for (let i = 1; i <= months; i++) {
          const dueDate = new Date(startDate);
          let installmentAmount = totalMonthly;

          if (i === 1) {
            // 1ª PARCELA: Vence no ato (startDate) e soma o valor da Caução
            installmentAmount = totalMonthly + guaranteeValue;
          } else {
            // DEMAIS PARCELAS: Vencem nos meses subsequentes
            dueDate.setMonth(dueDate.getMonth() + (i - 1));
          }

          installments.push({
            contract_id: contract.id,
            company_id: user?.company_id,
            type: 'rent_monthly',
            installment_number: i,
            amount: installmentAmount,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }

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

      addNotification({
        title: 'Contrato Gerado',
        message: 'Novo contrato de aluguel gerado com sucesso.',
        type: 'property'
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      alert('Erro ao salvar contrato: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white/95 dark:bg-[#0a0f1c]/95 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Icons.KeyRound size={24} className="text-indigo-600" />
              Novo Contrato de Locação
            </h2>
            <p className="text-sm text-slate-500">Preencha os dados do aluguel fechado.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-indigo-100 rounded-full text-slate-400 transition-colors">
            <Icons.X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="rent-form" onSubmit={handleSubmit} className="space-y-8">

            {/* 1. ENVOLVIDOS E PRAZOS */}
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Icons.Calendar size={16} /> Partes e Prazos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Locatário (Inquilino)</label>
                  <select required value={formData.lead_id} onChange={e => setFormData({ ...formData, lead_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm">
                    <option value="">Selecione um cliente...</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Imóvel</label>
                  <select required value={formData.property_id} onChange={e => setFormData({ ...formData, property_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm">
                    <option value="">Selecione o imóvel...</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Corretor Responsável</label>
                  <select required value={formData.broker_id} onChange={e => setFormData({ ...formData, broker_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm">
                    <option value="">Selecione...</option>
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name.split(' ')[0]}</option>)}
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

            {/* 2. VALORES MENSAIS */}
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
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

            {/* 3. GARANTIA E REAJUSTE */}
            <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Icons.Shield size={14} /> Garantia e Condições
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Garantia Locatícia</label>
                  <select required value={formData.rent_guarantee_type} onChange={e => setFormData({ ...formData, rent_guarantee_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm">
                    <option value="">Selecione a garantia...</option>
                    <option value="caucao_1">Caução (1 mês)</option>
                    <option value="caucao_2">Caução (2 meses)</option>
                    <option value="caucao_3">Caução (3 meses)</option>
                    <option value="fiador">Fiador Solidário</option>
                    <option value="seguro_fianca">Seguro Fiança (Credpago, Porto...)</option>
                    <option value="titulo_capitalizacao">Título de Capitalização</option>
                    <option value="sem_garantia">Sem Garantia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Índice de Reajuste</label>
                  <select value={formData.rent_readjustment_index} onChange={e => setFormData({ ...formData, rent_readjustment_index: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 bg-white text-sm">
                    <option value="IGPM">IGP-M</option>
                    <option value="IPCA">IPCA</option>
                    <option value="INPC">INPC</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 4. TIPO DE DOCUMENTO (PARA GERAÇÃO DE PDF) */}
            <section className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
              <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Icons.FileText size={14} /> Modelo de Contrato
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Selecione o tipo de contrato para gerar o PDF</label>
                <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-indigo-300 outline-none focus:border-indigo-500 bg-white text-sm">
                  <option value="">Escolha um modelo...</option>
                  {customTemplates.length > 0 && (
                    <>
                      {customTemplates.map(t => (
                        <option key={`custom_${t.id}`} value={`custom_${t.id}`}>⭐ {t.name}</option>
                      ))}
                      <option disabled>──────────────</option>
                    </>
                  )}
                  <option value="rent_guarantor">Locação Residencial com Fiador</option>
                  <option value="rent_noguarantee">Locação Residencial sem Garantia</option>
                  <option value="rent_commercial">Locação Comercial</option>
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
                        <select value={contractDetails.tenant_marital_status} onChange={e => setContractDetails({...contractDetails, tenant_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500">
                          <option value="">Selecione...</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viúvo(a)">Viúvo(a)</option>
                          <option value="União Estável">União Estável</option>
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
                        <select value={contractDetails.landlord_marital_status} onChange={e => setContractDetails({...contractDetails, landlord_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500">
                          <option value="">Selecione...</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viúvo(a)">Viúvo(a)</option>
                          <option value="União Estável">União Estável</option>
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

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200">
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleGeneratePDF}
            disabled={!formData.lead_id || !formData.property_id || !documentType}
            className="px-5 py-2.5 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Icons.FileText size={18} />
            Gerar PDF
          </button>
          <button type="submit" form="rent-form" disabled={loading} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? 'Salvando...' : 'Registrar Aluguel'} <Icons.ArrowRight size={18} />
          </button>
        </div>

      </div>
    </div>
  );
};

export default RentContractModal;
