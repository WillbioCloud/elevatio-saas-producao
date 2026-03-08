import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { Lead, Property } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface RentContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractData?: any;
}

const RentContractModal: React.FC<RentContractModalProps> = ({ isOpen, onClose, onSuccess, contractData: _contractData }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);

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
    commission_percentage: '', // Ex: Primeiro aluguel (100%) ou Taxa de administração mensal (8%)
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
      // Set default dates (Today and 12 months from now)
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

  // Carrega dinamicamente APENAS os imóveis de interesse do Lead selecionado
  useEffect(() => {
    const fetchLeadProperties = async () => {
      if (!formData.lead_id) {
        setProperties([]);
        return;
      }

      const selectedLead = leads.find(l => l.id === formData.lead_id);
      if (!selectedLead) return;

      // AUTO-PREENCHE O CORRETOR DO LEAD
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
          .eq('listing_type', 'rent'); // Apenas locação

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

    const { data: brokersData } = await supabase.from('profiles').select('id, name').eq('active', true);
    if (brokersData) setBrokers(brokersData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Calcula a Duração (Meses)
    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    if (months <= 0) months = 12; // fallback

    // 2. Calcula o valor total da parcela mensal
    const rentVal = Number(formData.rent_value) || 0;
    const condoVal = Number(formData.condo_value) || 0;
    const iptuVal = Number(formData.iptu_value) || 0;
    const totalMonthly = rentVal + condoVal + iptuVal;

    // 3. Cria a lista base de Vistoria
    const defaultVistoria = [
      { id: '1', item: 'Pintura Geral', status: 'ok', repair_cost: 0 },
      { id: '2', item: 'Portas e Fechaduras', status: 'ok', repair_cost: 0 },
      { id: '3', item: 'Janelas e Vidros', status: 'ok', repair_cost: 0 },
      { id: '4', item: 'Hidráulica (Torneiras/Descargas)', status: 'ok', repair_cost: 0 },
      { id: '5', item: 'Elétrica (Tomadas/Lâmpadas)', status: 'ok', repair_cost: 0 },
      { id: '6', item: 'Pisos e Rodapés', status: 'ok', repair_cost: 0 }
    ];

    try {
      // 4. Salva o Contrato
      const payload = {
        type: 'rent',
        status: 'pending', // Requer aprovação da diretoria
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
        company_id: user.company_id,
      };

      const { data: contract, error } = await supabase.from('contracts').insert([payload]).select().single();
      if (error) throw error;

      // 5. Gera as Parcelas Automaticamente
      if (contract) {
        const installments = [];
        for (let i = 1; i <= months; i++) {
          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i); // Vence 1 mês após o início

          installments.push({
            contract_id: contract.id,
            type: 'rent_monthly',
            installment_number: i,
            amount: totalMonthly,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
            company_id: user.company_id,
          });
        }
        await supabase.from('installments').insert(installments);
      }

      // AUTOMATIZAÇÃO: Tira o imóvel do catálogo e marca como Alugado
      if (formData.property_id) {
        await supabase
          .from('properties')
          .update({ status: 'Alugado' })
          .eq('id', formData.property_id);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

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

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200">
            Cancelar
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