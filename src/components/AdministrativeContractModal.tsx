import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { buildContractHtml } from '../utils/contractGenerator';
import { ADMIN_DOCUMENTS } from '../constants/contractTypes';
import { format } from 'date-fns';

interface Props { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
  initialPropertyId?: string; // NOVO: Para receber o imóvel da tela atual
}

export default function AdministrativeContractModal({ isOpen, onClose, onSuccess, initialPropertyId }: Props) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState(ADMIN_DOCUMENTS[0]?.id || 'proposal_buy');

  const [formData, setFormData] = useState({
    lead_id: '',
    property_id: initialPropertyId || '',
    contract_value: '',
    down_payment: '', // NOVO: Sinal/Arras
    payment_method: '', // NOVO: Forma de pagamento
    start_date: format(new Date(), 'yyyy-MM-dd'),
    validity_days: '5', // NOVO: Validade da proposta
    observations: '',
    witness_name: '',
    witness_document: '',
    // Dados extra temporários caso o Lead esteja incompleto
    proponent_profession: '',
    proponent_marital_status: '',
    proponent_address: '',
    proponent_phone: '',
    // Dados extra do Imóvel
    property_registration: '',
    property_registry_office: '',
    property_tax_id: ''
  });

  // Efeito para sincronizar a prop caso ela mude depois da montagem
  useEffect(() => {
    if (initialPropertyId) {
      setFormData(prev => ({ ...prev, property_id: initialPropertyId }));
    }
  }, [initialPropertyId]);

  useEffect(() => {
    if (isOpen && user?.company_id) {
      supabase.from('leads').select('*').eq('company_id', user.company_id).then(({ data }) => setLeads(data || []));
      supabase.from('properties').select('*').eq('company_id', user.company_id).then(({ data }) => setProperties(data || []));
    }
  }, [isOpen, user?.company_id]);

  // Atualiza o valor padrão ao selecionar o imóvel
  useEffect(() => {
    if (formData.property_id) {
      const prop = properties.find(p => p.id === formData.property_id);
      if (prop) setFormData(prev => ({
        ...prev,
        contract_value: prop.price || prop.rent_value || prev.contract_value || '',
        property_registration: prop.registration || prop.property_registration || prev.property_registration,
        property_registry_office: prop.registry_office || prop.property_registry_office || prev.property_registry_office,
        property_tax_id: prop.iptu || prop.property_tax_id || prev.property_tax_id
      }));
    }
  }, [formData.property_id, properties]);

  const handleAction = async (isPreview = false) => {
    try {
      setLoading(true);

      // 1. Mapeamento Seguro do Payload Base
      let fullData: any = {
        ...formData,
        document_type: documentType,
        contract_value: formData.contract_value ? Number(formData.contract_value) : 0,
        down_payment: formData.down_payment ? Number(formData.down_payment) : 0,
        validity_days: formData.validity_days || '5',
        payment_method: formData.payment_method || '',
        witness_name_1: formData.witness_name || '',
        witness_doc_1: formData.witness_document || '',
        // Subscreve dados extra
        buyer_profession: formData.proponent_profession || '',
        buyer_marital_status: formData.proponent_marital_status || '',
        buyer_address: formData.proponent_address || '',
        buyer_phone: formData.proponent_phone || '',
        property_registration: formData.property_registration || '',
        property_registry_office: formData.property_registry_office || '',
        property_tax_id: formData.property_tax_id || '',
      };

      // 2. Enriquecer com dados do Imóvel (se selecionado)
      if (formData.property_id) {
        const { data: propData, error: propErr } = await supabase
          .from('properties')
          .select('*')
          .eq('id', formData.property_id)
          .single();

        if (propErr) {
          console.error('Erro ao buscar imóvel:', propErr);
          throw new Error('Falha ao buscar dados do imóvel vinculado.');
        }
        if (propData) {
          fullData = {
            ...propData,
            ...fullData,
            property_address: propData.address || fullData.property_address || '',
            property_description: propData.description || propData.title || fullData.property_description || '',
            property_registration: fullData.property_registration || propData.registration || propData.property_registration || '',
            property_registry_office: fullData.property_registry_office || propData.registry_office || propData.property_registry_office || '',
            property_tax_id: fullData.property_tax_id || propData.iptu || propData.property_tax_id || ''
          };
        }
      }

      // 3. Enriquecer com dados do Lead (se selecionado)
      if (formData.lead_id) {
        const { data: leadData, error: leadErr } = await supabase
          .from('leads')
          .select('*')
          .eq('id', formData.lead_id)
          .single();

        if (leadErr) {
          console.error('Erro ao buscar lead:', leadErr);
          throw new Error('Falha ao buscar dados do cliente vinculado.');
        }
        if (leadData) {
          fullData = {
            ...fullData,
            ...leadData,
            buyer_name: leadData.name || '',
            buyer_document: leadData.cpf || leadData.document || '',
            buyer_profession: fullData.buyer_profession || leadData.profession || leadData.profissao || '',
            buyer_marital_status: fullData.buyer_marital_status || leadData.marital_status || leadData.estado_civil || '',
            buyer_address: fullData.buyer_address || leadData.address || leadData.endereco || '',
            buyer_phone: fullData.buyer_phone || leadData.phone || '',
            buyer_email: leadData.email || fullData.buyer_email || ''
          };
        }
      }

      // 4. Gerar o HTML da Minuta
      const html = await buildContractHtml(
        documentType,
        fullData,
        tenant,
        tenant?.logo_url,
        user?.user_metadata?.full_name || 'Corretor',
        user?.user_metadata?.document || user?.user_metadata?.cpf || '',
        user?.user_metadata?.creci || ''
      );

      if (!html) throw new Error('O gerador de HTML retornou vazio.');

      // 5. Acionar a Pré-visualização
      if (isPreview) {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(html);
          newWindow.document.close();
        } else {
          addToast('Pop-up bloqueado pelo navegador. Permita para pré-visualizar.', 'info');
        }
        return;
      }

      // 6. Salvar no Banco (Com null-safety para UUIDs vazios)
      const { error: insertError } = await supabase.from('contracts').insert({
        property_id: formData.property_id || null,
        lead_id: formData.lead_id || null,
        user_id: user?.id,
        company_id: user?.company_id,
        type: 'administrative',
        status: 'draft',
        contract_data: fullData,
        html_content: html
      });

      if (insertError) {
        console.error('Erro no insert:', insertError);
        throw new Error('Falha ao gravar o contrato no banco de dados.');
      }

      addToast('Documento administrativo salvo com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro na ação do documento:', error);
      addToast(error.message || 'Erro ao processar documento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-white/10">
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-2.5 rounded-xl text-purple-600">
                <Icons.FileSignature size={24} />
              </div>
              Novo Documento Administrativo
            </h2>
            <p className="text-sm text-slate-500 mt-1">Gere propostas, recibos de chaves, termos de visita e aditivos.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icons.X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {/* CARD INFORMATIVO */}
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 flex items-start gap-4 dark:border-purple-500/20 dark:bg-purple-500/10">
            <Icons.Info className="text-purple-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">
                Gerador de Documentos Diversos
              </h4>
              <p className="text-xs text-purple-700/80 dark:text-purple-400/80 mt-1 leading-relaxed">
                Estes documentos são modelos padronizados para o dia a dia da imobiliária (como visitas e propostas) e <strong>não consomem</strong> o limite do seu plano de contratos definitivos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Icons.Settings size={16} className="text-purple-500" /> Configurações do Documento
                </h4>
                <div className="space-y-5">
                  <div className="flex flex-col justify-end">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Tipo de Documento</label>
                    <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-colors shadow-sm">
                      {ADMIN_DOCUMENTS.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Data de Início</label>
                      <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 shadow-sm" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Valor (Opcional)</label>
                      <input type="number" placeholder="R$ 0,00" value={formData.contract_value} onChange={e => setFormData({...formData, contract_value: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 shadow-sm" />
                    </div>
                  </div>

                  {/* SE FOR UMA PROPOSTA DE COMPRA OU LOCAÇÃO, EXIBE CAMPOS FINANCEIROS EXTRAS */}
                  {(documentType === 'proposal_buy' || documentType === 'proposal_rent') && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-500/20">
                      <div className="flex flex-col justify-end">
                        <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-400 mb-2 uppercase">Sinal / Arras</label>
                        <input type="number" placeholder="R$ 0,00" value={formData.down_payment} onChange={e => setFormData({...formData, down_payment: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 shadow-sm" />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-400 mb-2 uppercase">Prazo (Dias Úteis)</label>
                        <input type="number" value={formData.validity_days} onChange={e => setFormData({...formData, validity_days: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 shadow-sm" />
                      </div>
                      <div className="col-span-2 flex flex-col justify-end">
                        <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-400 mb-2 uppercase">Condições de Pagamento</label>
                        <input type="text" placeholder="Ex: Saldo financiado via Caixa Econômica..." value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 shadow-sm" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Icons.User size={16} className="text-purple-500" /> Testemunha (Opcional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col justify-end">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Nome da Testemunha</label>
                    <input type="text" placeholder="Nome completo" value={formData.witness_name} onChange={e => setFormData({...formData, witness_name: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 shadow-sm" />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">CPF/Documento</label>
                    <input type="text" placeholder="Apenas números" value={formData.witness_document} onChange={e => setFormData({...formData, witness_document: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 shadow-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: VÍNCULOS E OBSERVAÇÕES */}
            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Icons.Link size={16} className="text-purple-500" /> Vínculos do Sistema
                </h4>
                <div className="space-y-5">
                  <div className="flex flex-col justify-end">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Vincular a um Lead</label>
                    <select 
                      value={formData.lead_id} 
                      onChange={e => {
                        const val = e.target.value;
                        const lead = leads.find(l => l.id === val);
                        setFormData(prev => ({
                          ...prev,
                          lead_id: val,
                          proponent_profession: lead?.profession || lead?.profissao || prev.proponent_profession,
                          proponent_marital_status: lead?.marital_status || lead?.estado_civil || prev.proponent_marital_status,
                          proponent_address: lead?.address || lead?.endereco || prev.proponent_address,
                          proponent_phone: lead?.phone || prev.proponent_phone,
                          // Se o lead já tiver um imóvel de interesse, auto-seleciona ele:
                          property_id: lead?.property_id || lead?.propertyId || lead?.sold_property_id || prev.property_id
                        }));
                      }} 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 shadow-sm"
                    >
                      <option value="">Selecione um lead (opcional)</option>
                      {leads.map(lead => (
                        <option key={lead.id} value={lead.id}>{lead.name} {lead.email ? `- ${lead.email}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Vincular a um Imóvel</label>
                    <select 
                      value={formData.property_id} 
                      onChange={e => {
                        const val = e.target.value;
                        const prop = properties.find(p => p.id === val);
                        setFormData(prev => ({
                          ...prev,
                          property_id: val,
                          property_registration: prop?.registration || prop?.property_registration || prev.property_registration,
                          property_registry_office: prop?.registry_office || prop?.property_registry_office || prev.property_registry_office,
                          property_tax_id: prop?.iptu || prop?.property_tax_id || prev.property_tax_id,
                          contract_value: prop?.price || prop?.rent_value || prev.contract_value // Puxa o valor do imóvel automático
                        }));
                      }} 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 shadow-sm"
                    >
                      <option value="">Selecione um imóvel (opcional)</option>
                      {properties.map(prop => (
                        <option key={prop.id} value={prop.id}>{prop.title} - {prop.address}</option>
                      ))}
                    </select>
                  </div>

                  {/* DADOS COMPLEMENTARES DA PROPOSTA */}
                  {(documentType === 'proposal_buy' || documentType === 'proposal_rent') && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completar Dados em Falta</h5>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Profissão do Proponente</label>
                          <input type="text" value={formData.proponent_profession} onChange={e => setFormData({...formData, proponent_profession: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Estado Civil</label>
                          <input type="text" value={formData.proponent_marital_status} onChange={e => setFormData({...formData, proponent_marital_status: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Endereço do Proponente</label>
                          <input type="text" value={formData.proponent_address} onChange={e => setFormData({...formData, proponent_address: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Cartório e Matrícula do Imóvel</label>
                          <div className="flex gap-2">
                            <input type="text" placeholder="Cartório" value={formData.property_registry_office} onChange={e => setFormData({...formData, property_registry_office: e.target.value})} className="w-1/2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500" />
                            <input type="text" placeholder="Matrícula" value={formData.property_registration} onChange={e => setFormData({...formData, property_registration: e.target.value})} className="w-1/2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col h-full">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Icons.FileText size={16} className="text-purple-500" /> Observações e Cláusulas
                </h4>
                <textarea
                  rows={4}
                  placeholder="Insira cláusulas extras, condições especiais ou detalhes relevantes para este documento..."
                  value={formData.observations}
                  onChange={e => setFormData({...formData, observations: e.target.value})}
                  className="w-full flex-1 min-h-[120px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 resize-none custom-scrollbar shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button
            onClick={() => handleAction(true)}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm shadow-sm disabled:opacity-50"
          >
            {loading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Eye size={18} />} Pré-visualizar Minuta
          </button>

          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleAction(false)}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 text-sm"
            >
              {loading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Save size={18} />} Gerar Documento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
