import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { Lead, Property } from '../types';

interface SaleContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractData?: any;
}

const SaleContractModal: React.FC<SaleContractModalProps> = ({ isOpen, onClose, onSuccess, contractData }) => {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);

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
    commission_value: '', // NOVO CAMPO
    sale_is_cash: false,
    sale_payment_method: 'Pix',
    sale_consortium_value: '',
    installments_count: '12',
    due_day: '10',
    readjustment_index: 'IPCA', // IPCA é o padrão atual
    interest_rate: '1.0', // 1% ao mês é padrão de mercado
    spouse_details: '',
  });

  useEffect(() => {
    if (isOpen) fetchData();
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
            return {
              ...prev,
              property_id: firstProp.id,
              sale_total_value: val,
              commission_value: calcVal ? String(calcVal) : prev.commission_value
            };
          });
        } else {
          setProperties([]);
        }
      } else {
        setProperties([]);
      }
    };
    fetchLeadProperties();
  }, [formData.lead_id, leads]);


  // MODO DE VISUALIZAÇÃO: Preenche os dados se contractData existir
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

      setFormData(prev => ({
        ...prev,
        property_id: propId,
        sale_total_value: val,
        commission_value: calcVal ? String(calcVal) : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, property_id: propId }));
    }
  };

  // --- LÓGICA INTELIGENTE DE CÁLCULO DE COMISSÃO E TOTAIS ---
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

  // Calcula se o valor já foi coberto por entrada + créditos
  const totalCovered = downPayment + financing + consortium;
  const isFullyCovered = totalValue > 0 && totalCovered >= totalValue;

  // Efeito para auto-marcar como "À vista" se o valor já estiver 100% coberto e definir o método real
  useEffect(() => {
    if (isFullyCovered) {
      let bestMethod = 'Pix'; // Default

      // Descobre qual foi a maior fonte do dinheiro para marcar no método de pagamento
      if (financing >= consortium && financing > 0) {
        bestMethod = 'Financiamento';
      } else if (consortium > financing && consortium > 0) {
        bestMethod = 'Consórcio';
      } else if (financing > 0 || consortium > 0) {
        bestMethod = 'Misto';
      }

      setFormData(prev => {
        // Só atualiza o estado se for diferente, para evitar loop infinito de re-renderização
        if (!prev.sale_is_cash || prev.sale_payment_method !== bestMethod) {
          return { ...prev, sale_is_cash: true, sale_payment_method: bestMethod };
        }
        return prev;
      });
    }
  }, [isFullyCovered, financing, consortium]);
  
  // O Saldo a Parcelar Direto é a diferença entre o Total e tudo que já foi pago/financiado
  const saldoDevedor = formData.sale_is_cash ? 0 : Math.max(0, totalValue - downPayment - financing - permutation - consortium);
  const parcelasCount = Number(formData.installments_count) || 1;
  const valorParcela = parcelasCount > 0 ? saldoDevedor / parcelasCount : 0;

  // Índices anuais (Média de mercado para simulação realista)
  const INDICES_ANUAIS: Record<string, number> = {
    'IPCA': 4.50,
    'IGPM': 3.70,
    'INCC': 5.10,
    'FIXO': 0
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalValue <= 0) return alert('O valor total da venda deve ser maior que zero.');

    setLoading(true);
    try {
      const payload = {
        type: 'sale',
        status: 'pending', // Requer aprovação da diretoria
        lead_id: formData.lead_id || null,
        property_id: formData.property_id || null,
        broker_id: formData.broker_id || null,
        start_date: formData.sale_date, // Usando a data selecionada
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
      };

      const { data: contract, error } = await supabase.from('contracts').insert([payload]).select().single();
      if (error) throw error;

      if (!formData.sale_is_cash && contract && saldoDevedor > 0) {
        const installments = [];
        let valorAtualParcela = valorParcela;
        const taxaAnualIndice = INDICES_ANUAIS[formData.readjustment_index] || 0;
        const jurosMensal = Number(formData.interest_rate) || 0;

        // O Juros é aplicado ao mês e o Índice é aplicado ao ano (a cada 12 meses)
        const taxaJurosAnualizada = jurosMensal * 12;

        for (let i = 1; i <= parcelasCount; i++) {
          // A cada virada de 12 meses, a parcela sofre reajuste
          if (i > 1 && (i - 1) % 12 === 0) {
            const reajusteTotal = (taxaAnualIndice + taxaJurosAnualizada) / 100;
            valorAtualParcela = valorAtualParcela * (1 + reajusteTotal);
          }

          const dueDate = new Date(formData.sale_date);
          dueDate.setMonth(dueDate.getMonth() + i);
          const targetDay = Number(formData.due_day);
          dueDate.setDate(targetDay);
          if (dueDate.getDate() !== targetDay) dueDate.setDate(0);

          installments.push({
            contract_id: contract.id,
            type: 'monthly',
            installment_number: i,
            amount: valorAtualParcela,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
            notes: `Ano ${Math.ceil(i/12)} - Correção: ${formData.readjustment_index} + ${formData.interest_rate}% a.m.`
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Icons.FileText size={24} className="text-brand-600" /> {contractData ? 'Visualização do Contrato' : 'Novo Contrato de Venda'}
            </h2>
            <p className="text-sm text-slate-500">Preencha os dados do negócio fechado.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><Icons.X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="sale-form" onSubmit={handleSubmit} className="space-y-8">
            <fieldset disabled={!!contractData} className="contents">

            {/* 1. ENVOLVIDOS */}
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Icons.Users size={16} /> Envolvidos no Negócio
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Data da Venda</label>
                  <input type="date" required value={formData.sale_date} onChange={e => setFormData({ ...formData, sale_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Cliente (Comprador)</label>
                  <select required value={formData.lead_id} onChange={e => setFormData({ ...formData, lead_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm">
                    <option value="">Selecione um cliente...</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Imóvel Vendido</label>
                  <select required value={formData.property_id} onChange={handlePropertyChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm">
                    <option value="">Selecione o imóvel...</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Corretor Responsável</label>
                  <select required value={formData.broker_id} onChange={e => setFormData({ ...formData, broker_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm">
                    <option value="">Selecione...</option>
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name.split(' ')[0]}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Dados do Cônjuge / Co-Comprador (Opcional)</label>
                  <input type="text" value={formData.spouse_details} onChange={e => setFormData({ ...formData, spouse_details: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 text-sm bg-white" placeholder="Nome, CPF, Estado Civil..." />
                </div>
              </div>
            </section>

            {/* 2. VALORES E COMISSÃO */}
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Icons.DollarSign size={16} /> Valores Principais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Valor Total da Venda (R$)</label>
                  <input type="number" required value={formData.sale_total_value} onChange={e => handleTotalValueChange(e.target.value)} className="w-full px-4 py-4 rounded-xl border-2 border-brand-300 bg-brand-50 text-brand-900 font-black text-2xl outline-none focus:border-brand-600 shadow-inner" placeholder="Ex: 850000" />
                </div>
                
                {/* BLOCO DA COMISSÃO */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 md:col-span-2 grid grid-cols-2 gap-3">
                  <div className="col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase">Honorários / Comissão</p></div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Porcentagem (%)</label>
                    <input type="number" step="0.1" value={formData.commission_percentage} onChange={e => handleCommissionPctChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 text-sm font-semibold text-slate-700" placeholder="Ex: 5" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Valor (R$)</label>
                    <input type="number" value={formData.commission_value} onChange={e => handleCommissionValChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 text-sm font-bold text-brand-700 bg-white" placeholder="Ex: 42500" />
                  </div>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Sinal / Entrada (R$)</label>
                  <input type="number" value={formData.sale_down_payment} onChange={e => setFormData({ ...formData, sale_down_payment: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 text-sm font-bold text-slate-800" placeholder="Ex: 170000" />
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, sale_down_payment: prev.commission_value }))} className="text-[10px] text-brand-600 hover:text-brand-800 font-bold mt-2 flex items-center gap-1 justify-end transition-colors" title="Preencher com o valor exato da comissão">
                    <Icons.Download size={12}/> Usar Comissão como Sinal
                  </button>
                </div>
              </div>
            </section>

            {/* 3. PARCELAMENTO E FINANCIAMENTO */}
            <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Icons.Wallet size={14} /> Modalidade de Pagamento
                </h3>
                <div className="flex items-center gap-3">
                  <span className="mr-3 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Venda À Vista?</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.sale_is_cash}
                    onClick={() => setFormData(prev => ({ ...prev, sale_is_cash: !prev.sale_is_cash }))}
                    className={`${
                      formData.sale_is_cash ? 'bg-brand-600' : 'bg-slate-200'
                    } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500`}
                  >
                    <span
                      className={`${
                        formData.sale_is_cash ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>
              </div>

              {isFullyCovered && (
                <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1 animate-fade-in">
                  <Icons.CheckCircle size={14} />
                  Valor 100% coberto (Entrada + Crédito). Considerado à vista para o vendedor.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in pt-2 border-t border-slate-200">
                {formData.sale_is_cash ? (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Método de Pagamento</label>
                    <select value={formData.sale_payment_method} onChange={e => setFormData({ ...formData, sale_payment_method: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-sm bg-white">
                      <option value="Pix">Transferência / PIX</option>
                      <option value="TED">TED / DOC</option>
                      <option value="Cheque">Cheque Administrativo</option>
                      <option value="Financiamento">Financiamento Bancário</option>
                      <option value="Consórcio">Consórcio</option>
                      <option value="Misto">Misto (Entrada + Crédito)</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Financiamento Bancário (R$)</label>
                      <input type="number" value={formData.sale_financing_value} onChange={e => setFormData({ ...formData, sale_financing_value: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" placeholder="Ex: 500000" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Consórcio (R$)</label>
                      <input type="number" value={formData.sale_consortium_value} onChange={e => setFormData({ ...formData, sale_consortium_value: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm bg-white" placeholder="Ex: 150000" />
                    </div>
                    
                    {!isFullyCovered && (
                      <div className="md:col-span-2 mt-2">
                        <label className="block text-[10px] font-bold text-brand-600 uppercase mb-2">Parcelamento Direto (Restante do Saldo Devedor)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-3 rounded-lg border border-brand-100 shadow-sm">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qtd. Parcelas</label>
                            <input type="number" value={formData.installments_count} onChange={e => setFormData({ ...formData, installments_count: e.target.value })} className="w-full px-3 py-2 rounded border border-slate-200 outline-none text-sm font-bold" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dia Venc.</label>
                            <input type="number" min="1" max="31" value={formData.due_day} onChange={e => setFormData({ ...formData, due_day: e.target.value })} className="w-full px-3 py-2 rounded border border-slate-200 outline-none text-sm" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Índice</label>
                            <select value={formData.readjustment_index} onChange={e => setFormData({ ...formData, readjustment_index: e.target.value })} className="w-full px-3 py-2 rounded border border-slate-200 outline-none text-sm bg-white">
                              <option value="IGPM">IGP-M</option>
                              <option value="IPCA">IPCA</option>
                              <option value="INCC">INCC</option>
                              <option value="FIXO">Sem Correção</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Juros (a.m)</label>
                            <div className="relative">
                              <input type="number" step="0.1" value={formData.interest_rate} onChange={e => setFormData({ ...formData, interest_rate: e.target.value })} className="w-full px-3 py-2 pr-6 rounded border border-slate-200 outline-none text-sm" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* 4. PERMUTA */}
            <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Icons.RefreshCw size={14} /> Houve Permuta? (Carro/Imóvel)
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={formData.has_permutation} onChange={e => setFormData({ ...formData, has_permutation: e.target.checked })} />
                  <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-brand-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>

              {formData.has_permutation && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in pt-4 mt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Valor Abatido da Permuta (R$)</label>
                    <input type="number" value={formData.permutation_value} onChange={e => setFormData({ ...formData, permutation_value: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold text-brand-700" placeholder="Ex: 80000" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Descrição do Bem</label>
                    <input type="text" value={formData.permutation_details} onChange={e => setFormData({ ...formData, permutation_details: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" placeholder="Ex: Hilux 2022 Branca" />
                  </div>
                </div>
              )}
            </section>

            {/* RESUMO DO FECHAMENTO (MÁGICA MATEMÁTICA) */}
            <section className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Icons.Calculator size={100} /></div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-brand-400">
                <Icons.CheckCircle size={16} /> Resumo Financeiro do Fechamento
              </h3>
              <div className="space-y-2 text-sm relative z-10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor Total Negociado:</span>
                  <span className="font-bold">R$ {totalValue.toLocaleString('pt-BR')}</span>
                </div>
                {downPayment > 0 && <div className="flex justify-between text-slate-300"><span>(-) Sinal / Entrada:</span><span>R$ {downPayment.toLocaleString('pt-BR')}</span></div>}
                {financing > 0 && <div className="flex justify-between text-slate-300"><span>(-) Financiamento:</span><span>R$ {financing.toLocaleString('pt-BR')}</span></div>}
                {permutation > 0 && <div className="flex justify-between text-slate-300"><span>(-) Permuta:</span><span>R$ {permutation.toLocaleString('pt-BR')}</span></div>}
                {consortium > 0 && <div className="flex justify-between text-slate-300"><span>(-) Consórcio:</span><span>R$ {consortium.toLocaleString('pt-BR')}</span></div>}
                
                <div className="pt-3 mt-3 border-t border-slate-700 flex justify-between items-end">
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">= Saldo a Parcelar Direto</span>
                    {!formData.sale_is_cash && saldoDevedor > 0 && (
                      <span className="text-xs text-brand-400 font-medium">Serão geradas {parcelasCount}x de R$ {valorParcela.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                    )}
                    {formData.sale_is_cash && <span className="text-xs text-emerald-400 font-bold bg-emerald-900/50 px-2 py-1 rounded">PAGAMENTO À VISTA</span>}
                  </div>
                  <span className={`text-xl font-black ${saldoDevedor < 0 ? 'text-red-400' : 'text-white'}`}>
                    R$ {saldoDevedor.toLocaleString('pt-BR')}
                  </span>
                </div>
                {saldoDevedor < 0 && (
                  <p className="text-[10px] text-red-400 mt-2 bg-red-900/30 p-2 rounded border border-red-800/50">
                    Aviso: A soma da entrada e recursos ultrapassou o valor total do imóvel. Revise os valores.
                  </p>
                )}
              </div>
            </section>
            </fieldset>

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200">
            Cancelar
          </button>
          {!contractData && (
            <button type="submit" form="sale-form" disabled={loading || saldoDevedor < 0} className="px-6 py-2.5 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg">
              {loading ? 'Processando...' : 'Registrar Venda'} <Icons.ArrowRight size={18} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default SaleContractModal;