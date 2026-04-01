import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { Lead, Property } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { generateContract } from '../utils/contractGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { SALE_DOCUMENTS, ADMIN_DOCUMENTS } from '../constants/contractTypes';

interface SaleContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractData?: any;
}

const SaleContractModal: React.FC<SaleContractModalProps> = ({ isOpen, onClose, onSuccess, contractData }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState('sale_standard');
  const [brokerProfile, setBrokerProfile] = useState<{name: string, company_logo: string, cpf_cnpj: string, creci: string} | null>(null);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  // Variáveis Mágicas: O formulário adapta-se com base no tipo de contrato!
  const isCashContract = documentType === 'sale_cash';
  const isPermutaContract = documentType === 'permuta';
  const isStandardContract = documentType === 'sale_standard';

  const [contractDetails, setContractDetails] = useState({
    buyer_document: '',
    buyer_profession: '',
    buyer_marital_status: '',
    buyer_address: '',
    buyer_spouse_name: '',
    buyer_spouse_document: '',
    buyer_spouse_profession: '',
    seller_document: '',
    seller_profession: '',
    seller_marital_status: '',
    seller_address: '',
    seller_spouse_name: '',
    seller_spouse_document: '',
    seller_spouse_profession: '',
    permuta_address: '',
    permuta_description: '',
    permuta_value: ''
  });

  const [formData, setFormData] = useState({
    lead_id: '',
    property_id: '',
    broker_id: '',
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

  // Autofill dos dados do Proprietário quando um imóvel é selecionado
  useEffect(() => {
    if (formData.property_id && properties.length > 0) {
      const selectedProp = properties.find(p => p.id === formData.property_id);
      if (selectedProp) {
        setContractDetails(prev => ({
          ...prev,
          seller_document: selectedProp.owner_document || prev.seller_document,
          seller_profession: selectedProp.owner_profession || prev.seller_profession,
          seller_marital_status: selectedProp.owner_marital_status || prev.seller_marital_status,
          seller_address: selectedProp.owner_address || prev.seller_address,
          seller_spouse_name: selectedProp.owner_spouse_name || prev.seller_spouse_name,
          seller_spouse_document: selectedProp.owner_spouse_document || prev.seller_spouse_document,
        }));
      }
    }
  }, [formData.property_id, properties]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  // Busca o perfil completo do corretor ao abrir o modal
  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data } = await supabase.from('profiles').select('name, company_logo, cpf_cnpj, creci, companies(name)').eq('id', authUser.id).single();
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
      setFormData(prev => ({
        ...prev,
        lead_id: contractData.lead_id || '',
        property_id: contractData.property_id || '',
        broker_id: contractData.broker_id || '',
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
      const selectedLead = leads.find(l => l.id === formData.lead_id);
      const selectedPropertyData = properties.find(p => p.id === formData.property_id);
      const contractDataObj = {
        buyer_name: selectedLead?.name || '',
        buyer_phone: selectedLead?.phone || '',
        buyer_email: selectedLead?.email || '',
        buyer_document: contractDetails.buyer_document,
        buyer_profession: contractDetails.buyer_profession,
        buyer_marital_status: contractDetails.buyer_marital_status,
        buyer_address: contractDetails.buyer_address,
        buyer_spouse_name: contractDetails.buyer_spouse_name,
        buyer_spouse_document: contractDetails.buyer_spouse_document,
        buyer_spouse_profession: contractDetails.buyer_spouse_profession,
        seller_name: selectedPropertyData?.owner_name || 'Proprietário Atual',
        seller_phone: selectedPropertyData?.owner_phone || '',
        seller_email: selectedPropertyData?.owner_email || '',
        seller_document: contractDetails.seller_document,
        seller_profession: contractDetails.seller_profession,
        seller_marital_status: contractDetails.seller_marital_status,
        seller_address: contractDetails.seller_address,
        seller_spouse_name: contractDetails.seller_spouse_name,
        seller_spouse_document: contractDetails.seller_spouse_document,
        seller_spouse_profession: contractDetails.seller_spouse_profession,
        permuta_address: contractDetails.permuta_address,
        permuta_description: contractDetails.permuta_description,
        permuta_value: contractDetails.permuta_value,
        property_address: selectedPropertyData ? `${selectedPropertyData.address}, ${selectedPropertyData.city}` : '',
        property_description: selectedPropertyData?.title || '',
        property_registration: selectedPropertyData?.property_registration || '',
        property_registry_office: selectedPropertyData?.property_registry_office || '',
        property_municipal_registration: selectedPropertyData?.property_municipal_registration || '',
        total_value: formData.sale_total_value,
        down_payment: formData.sale_down_payment || '0',
        bank_name: formData.sale_financing_bank || '',
        bank_agency: '',
        bank_account: '',
      };
      const selectedTemplate = customTemplates.find(t => `custom_${t.id}` === documentType);
      await generateContract(documentType, contractDataObj, tenant, brokerProfile?.company_logo, brokerProfile?.name, brokerProfile?.cpf_cnpj, brokerProfile?.creci, (brokerProfile as any)?.companies?.name, selectedTemplate?.content);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      addNotification({ title: 'Erro ao gerar documento PDF', message: '', type: 'property' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalValue <= 0) return alert('O valor total da venda deve ser maior que zero.');
    setLoading(true);
    try {
      const payload = {
        type: 'sale', status: 'pending',
        lead_id: formData.lead_id || null,
        property_id: formData.property_id || null,
        broker_id: formData.broker_id || null,
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
        company_id: user?.company_id,
      };
      const { data: contract, error } = await supabase.from('contracts').insert([payload]).select().single();
      if (error) throw error;

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
      addNotification({ title: 'Contrato Gerado', message: 'Novo contrato de venda gerado com sucesso.', type: 'property' });
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
      <div className="bg-white/95 dark:bg-[#0a0f1c]/95 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Icons.FileText size={24} className="text-brand-600" /> {contractData ? 'Visualização do Contrato' : 'Novo Contrato de Venda'}
            </h2>
            <p className="text-sm text-slate-500">Preencha os dados do negócio fechado.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><Icons.X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 custom-scrollbar">
          <form id="sale-form" onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
            <fieldset disabled={!!contractData} className="contents">

              {/* SECTION 1: TIPO DE CONTRATO */}
              <section className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                  <Icons.FileText size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <Icons.FileText size={24} className="text-brand-400" />
                      Qual o tipo de contrato?
                    </h3>
                    <p className="text-slate-400 text-sm">O modelo selecionado define os campos que serão preenchidos abaixo.</p>
                  </div>
                  <div className="w-full md:w-1/2">
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-base font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none cursor-pointer hover:bg-slate-700 transition-colors"
                    >
                      {customTemplates.length > 0 && (
                        <optgroup label="Meus Modelos Personalizados (Imobiliária)">
                          {customTemplates.map(t => (
                            <option key={`custom_${t.id}`} value={`custom_${t.id}`}>⭐ {t.name}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Modelos Padrão do Sistema">
                        {SALE_DOCUMENTS.map(doc => (<option key={doc.id} value={doc.id}>{doc.title}</option>))}
                      </optgroup>
                      <optgroup label="Administrativos e Outros">
                        {ADMIN_DOCUMENTS.map(doc => (<option key={doc.id} value={doc.id}>{doc.title}</option>))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* COLUNA ESQUERDA: DADOS BASE */}
                <div className="lg:col-span-7 space-y-6">

                  {/* IMÓVEL E VALORES */}
                  <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Icons.Home size={16} className="text-brand-500" /> Imóvel e Valor
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Imóvel Negociado *</label>
                        <select required value={formData.property_id} onChange={handlePropertyChange} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-slate-50 text-sm font-medium">
                          <option value="">Selecione o imóvel...</option>
                          {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Valor Total Fechado (R$) *</label>
                        <input type="number" required value={formData.sale_total_value} onChange={e => handleTotalValueChange(e.target.value)} className="w-full px-4 py-4 rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-900 font-black text-2xl outline-none focus:border-brand-500 transition-colors" placeholder="0.00" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Comissão (%)</label>
                          <input type="number" step="0.1" value={formData.commission_percentage} onChange={e => handleCommissionPctChange(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 text-sm bg-slate-50" placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Comissão (R$)</label>
                          <input type="number" value={formData.commission_value} onChange={e => handleCommissionValChange(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 text-sm font-bold text-brand-700 bg-slate-50" placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* PARTES ENVOLVIDAS */}
                  <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Icons.Users size={16} className="text-brand-500" /> Envolvidos
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Comprador (Lead) *</label>
                        <select required value={formData.lead_id} onChange={e => setFormData({ ...formData, lead_id: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-slate-50 text-sm font-medium">
                          <option value="">Selecione o cliente...</option>
                          {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Corretor Responsável *</label>
                          <select required value={formData.broker_id} onChange={e => setFormData({ ...formData, broker_id: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-slate-50 text-sm">
                            <option value="">Selecione...</option>
                            {brokers.map(b => <option key={b.id} value={b.id}>{b.name.split(' ')[0]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Data da Venda *</label>
                          <input type="date" required value={formData.sale_date} onChange={e => setFormData({ ...formData, sale_date: e.target.value })} className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500 bg-slate-50 text-sm" />
                        </div>
                      </div>

                      {/* Qualificação Comprador */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 mb-3 uppercase">Qualificação do Comprador</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF/CNPJ</label>
                            <input type="text" value={contractDetails.buyer_document} onChange={e => setContractDetails({...contractDetails, buyer_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Estado Civil</label>
                            <select value={contractDetails.buyer_marital_status} onChange={e => setContractDetails({...contractDetails, buyer_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
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
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
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
                            <label className="block text-[10px] uppercase text-slate-500 mb-1">Estado Civil</label>
                            <select value={contractDetails.seller_marital_status} onChange={e => setContractDetails({...contractDetails, seller_marital_status: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
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
                          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-3 animate-fade-in">
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">Nome do Cônjuge</label>
                              <input type="text" value={contractDetails.seller_spouse_name} onChange={e => setContractDetails({...contractDetails, seller_spouse_name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 mb-1">CPF do Cônjuge</label>
                              <input type="text" value={contractDetails.seller_spouse_document} onChange={e => setContractDetails({...contractDetails, seller_spouse_document: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
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
                <div className="lg:col-span-5 space-y-6">
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
                          <button type="button" onClick={() => setFormData({ ...formData, has_permutation: true })} className="w-full py-2 border border-dashed border-slate-300 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">
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
                                <select value={formData.readjustment_index} onChange={e => setFormData({ ...formData, readjustment_index: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-amber-200 outline-none focus:border-amber-500 text-sm bg-white">
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

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          {!contractData ? (
            <button type="button" onClick={handleGeneratePDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-bold">
              <Icons.FileText size={16} /> Gerar PDF (Pré-visualização)
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-bold">Cancelar</button>
            {!contractData && (
              <button type="submit" form="sale-form" disabled={loading} className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                {loading ? <><Icons.Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Icons.Save size={16} /> Salvar Contrato</>}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SaleContractModal;
