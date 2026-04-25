import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const UFs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const ORGAOS = ['SSP', 'Detran', 'Polícia Federal', 'Cartório Civil', 'OAB', 'CREA', 'CRM'];

export default function AdminClients() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados do Modal e Edicao
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Estado para Contratos e Assinaturas do Cliente
  const [clientContracts, setClientContracts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchClients();
  }, [user?.company_id, user?.role]);

  // Abertura Automatica via URL (Vindo do Kanban)
  useEffect(() => {
    const editLeadId = searchParams.get('editLeadId');
    if (editLeadId && clients.length > 0) {
      const clientToEdit = clients.find((c) => c.id === editLeadId);
      if (clientToEdit) {
        handleOpenClient(clientToEdit);
        setIsEditing(true);
        // Limpa a URL para nao reabrir se ele atualizar a pagina
        setSearchParams({});
      }
    }
  }, [searchParams, clients, setSearchParams]);

  // Busca os Contratos e Assinaturas sempre que um cliente e aberto
  useEffect(() => {
    if (selectedClient) {
      fetchClientContracts(selectedClient.id);
    } else {
      setClientContracts([]);
      setIsEditing(false);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    if (!user?.company_id && user?.role !== 'super_admin') {
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*, properties!leads_property_id_fkey(title, address)')
        .in('status', ['Fechado', 'Venda Fechada', 'fechado', 'venda fechada'])
        .order('created_at', { ascending: false });

      if (user?.role !== 'super_admin' && user?.company_id) {
        query = query.eq('company_id', user.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientContracts = async (leadId: string) => {
    try {
      // 1. Busca os contratos
      const { data: contracts, error: contractError } = await supabase
        .from('contracts')
        .select('id, type, status, created_at')
        .eq('lead_id', leadId);

      if (contractError) throw contractError;

      if (!contracts || contracts.length === 0) {
        setClientContracts([]);
        return;
      }

      // 2. Busca as assinaturas atreladas a esses contratos
      const contractIds = contracts.map((c) => c.id);
      const { data: signatures, error: sigError } = await supabase
        .from('contract_signatures')
        .select('id, contract_id, status, signer_role, signer_name')
        .in('contract_id', contractIds);

      if (sigError) throw sigError;

      // 3. Junta tudo
      const contractsWithSigs = contracts.map((contract) => ({
        ...contract,
        contract_signatures: signatures?.filter((sig) => sig.contract_id === contract.id) || []
      }));

      setClientContracts(contractsWithSigs);
    } catch (error) {
      console.error('Erro ao buscar contratos do cliente:', error);
      setClientContracts([]);
    }
  };

  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setEditForm((prev: any) => ({ ...prev, cep: cleanCep }));

    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setEditForm((prev: any) => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }));
        }
      } catch (e) {
        console.error('Erro ao buscar CEP', e);
      }
    }
  };

  const handleOpenClient = (client: any) => {
    setSelectedClient(client);
    setEditForm({
      cpf: client.cpf || '',
      rg: client.rg || '',
      estado_civil: client.estado_civil || '',
      profissao: client.profissao || '',
      endereco: client.endereco || '',
      phone: client.phone || '',
      email: client.email || '',
      name: client.name || '',
      cep: client.cep || '',
      street: client.street || '',
      address_number: client.address_number || '',
      neighborhood: client.neighborhood || '',
      city: client.city || '',
      state: client.state || '',
      rg_org: client.rg_org || '',
      rg_uf: client.rg_uf || '',
      spouse_name: client.spouse_name || '',
      spouse_cpf: client.spouse_cpf || '',
      spouse_rg: client.spouse_rg || '',
      spouse_rg_org: client.spouse_rg_org || '',
      spouse_rg_uf: client.spouse_rg_uf || ''
    });
  };

  const handleSaveClient = async () => {
    if (!selectedClient) return;
    setIsSaving(true);
    try {
      // Concatena o endereco para que o contrato em PDF continue funcionando
      let enderecoFormatado = editForm.endereco;
      if (editForm.street && editForm.address_number) {
        enderecoFormatado = `${editForm.street}, ${editForm.address_number} - ${editForm.neighborhood}, ${editForm.city} - ${editForm.state}, CEP: ${editForm.cep}`;
      }

      const dataToSave = {
        ...editForm,
        rg_org: editForm.rg_org || '',
        rg_uf: editForm.rg_uf || '',
        spouse_rg_org: editForm.spouse_rg_org || '',
        spouse_rg_uf: editForm.spouse_rg_uf || '',
        endereco: enderecoFormatado
      };

      const { error } = await supabase.from('leads').update(dataToSave).eq('id', selectedClient.id);
      if (error) throw error;

      setClients(clients.map((c) => (c.id === selectedClient.id ? { ...c, ...dataToSave } : c)));
      setSelectedClient({ ...selectedClient, ...dataToSave });
      setIsEditing(false);
    } catch (error) {
      alert('Erro ao salvar os dados do cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const normalizedSearch = searchTerm.toLowerCase();
  const filteredClients = clients.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(normalizedSearch) ||
      (c.cpf || '').includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(normalizedSearch)
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto font-['DM_Sans'] antialiased animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Carteira de Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de clientes consolidados e qualificações jurídicas.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Icons.Loader2 className="animate-spin text-slate-300 mb-4" size={32} />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Icons.Users className="text-slate-400" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Nenhum cliente encontrado</h3>
          </div>
        ) : (
          <div className="overflow-x-auto w-full custom-scrollbar pb-2">
            <table className="w-full min-w-[800px] md:min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">Documento (CPF)</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                          {client.name ? client.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{client.name || 'Sem Nome'}</p>
                          <p className="text-[11px] text-slate-500 uppercase">{client.status}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {client.cpf ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 font-mono">
                          {client.cpf}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md w-fit border border-amber-100">
                          <Icons.AlertCircle size={12} /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenClient(client)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
                      >
                        <Icons.Eye size={14} /> Ficha Completa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedClient && (
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSaving && setSelectedClient(null)} />
          <div className="relative z-10 flex min-h-full items-start justify-center p-4 pt-16 sm:items-center sm:pt-4">
            <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {selectedClient.name ? selectedClient.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedClient.name || 'Sem Nome'}</h2>
                  <p className="text-sm text-slate-500">
                    Cliente desde {new Date(selectedClient.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    <Icons.Edit2 size={16} /> Editar Dados
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveClient}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
                    >
                      {isSaving ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Save size={16} />} Salvar
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors ml-2"
                >
                  <Icons.X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
              {selectedClient.properties && (
                <section className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 text-brand-600 shadow-sm">
                    <Icons.Home size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Imóvel de Interesse</p>
                    <h4 className="text-sm font-bold text-slate-900">{selectedClient.properties.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{selectedClient.properties.address || 'Endereço não informado'}</p>
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Icons.UserCircle size={16} /> Qualificação Jurídica
                </h3>

                {isEditing ? (
                  <div className="flex flex-col gap-6 bg-slate-50/50 p-5 rounded-xl border border-slate-200">
                    {/* DADOS PESSOAIS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-500">Nome Completo</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">E-mail</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Telefone / WhatsApp</label>
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">CPF</label>
                        <input
                          type="text"
                          value={editForm.cpf}
                          onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
                          className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2">
                        <div>
                          <label className="text-xs font-bold text-slate-500">RG (Número)</label>
                          <input
                            type="text"
                            value={editForm.rg}
                            onChange={(e) => setEditForm({ ...editForm, rg: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500">Órgão</label>
                          <select
                            value={editForm.rg_org}
                            onChange={(e) => setEditForm({ ...editForm, rg_org: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          >
                            <option value="">Selecione...</option>
                            {ORGAOS.map((org) => (
                              <option key={org} value={org}>
                                {org}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500">UF</label>
                          <select
                            value={editForm.rg_uf}
                            onChange={(e) => setEditForm({ ...editForm, rg_uf: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          >
                            <option value="">UF...</option>
                            {UFs.map((uf) => (
                              <option key={uf} value={uf}>
                                {uf}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Profissão</label>
                        <input
                          type="text"
                          value={editForm.profissao}
                          onChange={(e) => setEditForm({ ...editForm, profissao: e.target.value })}
                          className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Estado Civil</label>
                        <select
                          value={editForm.estado_civil}
                          onChange={(e) => setEditForm({ ...editForm, estado_civil: e.target.value })}
                          className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                        >
                          <option value="">Selecione...</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viúvo(a)">Viúvo(a)</option>
                          <option value="União Estável">União Estável</option>
                        </select>
                      </div>
                    </div>

                    {/* DADOS DO CONJUGE */}
                    {['Casado(a)', 'União Estável'].includes(editForm.estado_civil) && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 border border-brand-200 bg-brand-50 rounded-lg">
                        <div className="sm:col-span-4 text-brand-800 font-bold text-xs uppercase">Dados do Cônjuge</div>
                        <div className="sm:col-span-4">
                          <label className="text-xs font-bold text-slate-500">Nome do Cônjuge</label>
                          <input
                            type="text"
                            value={editForm.spouse_name}
                            onChange={(e) => setEditForm({ ...editForm, spouse_name: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500">CPF</label>
                          <input
                            type="text"
                            value={editForm.spouse_cpf}
                            onChange={(e) => setEditForm({ ...editForm, spouse_cpf: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500">RG (Número)</label>
                          <input
                            type="text"
                            value={editForm.spouse_rg}
                            onChange={(e) => setEditForm({ ...editForm, spouse_rg: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500">Órgão</label>
                          <select
                            value={editForm.spouse_rg_org}
                            onChange={(e) => setEditForm({ ...editForm, spouse_rg_org: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          >
                            <option value="">Selecione...</option>
                            {ORGAOS.map((org) => (
                              <option key={org} value={org}>
                                {org}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500">UF</label>
                          <select
                            value={editForm.spouse_rg_uf}
                            onChange={(e) => setEditForm({ ...editForm, spouse_rg_uf: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          >
                            <option value="">UF...</option>
                            {UFs.map((uf) => (
                              <option key={uf} value={uf}>
                                {uf}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* ENDERECO COM VIA CEP */}
                    <div>
                      <div className="text-slate-800 font-bold text-xs uppercase mb-3 border-b pb-1">Endereço Residencial</div>
                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-500">CEP</label>
                          <input
                            type="text"
                            value={editForm.cep}
                            onChange={(e) => handleCepChange(e.target.value)}
                            maxLength={8}
                            placeholder="Apenas números"
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white focus:border-brand-500 transition-colors"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-xs font-bold text-slate-500">Rua / Logradouro</label>
                          <input
                            type="text"
                            value={editForm.street}
                            onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="text-xs font-bold text-slate-500">Número</label>
                          <input
                            type="text"
                            value={editForm.address_number}
                            onChange={(e) => setEditForm({ ...editForm, address_number: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-500">Bairro</label>
                          <input
                            type="text"
                            value={editForm.neighborhood}
                            onChange={(e) => setEditForm({ ...editForm, neighborhood: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-xs font-bold text-slate-500">Cidade</label>
                          <input
                            type="text"
                            value={editForm.city}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="text-xs font-bold text-slate-500">UF</label>
                          <input
                            type="text"
                            value={editForm.state}
                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                            maxLength={2}
                            className="w-full h-9 px-3 mt-1 rounded-md border border-slate-300 text-sm bg-white uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 font-medium mb-1">CPF</p>
                      <p className="text-sm font-semibold text-slate-900 font-mono">{selectedClient.cpf || 'Não informado'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 font-medium mb-1">RG</p>
                      <p className="text-sm font-semibold text-slate-900 font-mono">{selectedClient.rg || 'Não informado'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 font-medium mb-1">Estado Civil</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedClient.estado_civil || 'Não informado'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 font-medium mb-1">Profissão</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedClient.profissao || 'Não informado'}</p>
                    </div>
                    <div className="sm:col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 font-medium mb-1">Endereço de Residência</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedClient.endereco || 'Não informado'}</p>
                    </div>
                  </div>
                )}
              </section>

              <section className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Icons.FileSignature size={16} /> Contratos & Assinaturas
                </h3>

                {clientContracts.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                    <p className="text-sm text-slate-500">Nenhum contrato gerado para este cliente ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientContracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Contrato de {contract.type === 'sale' ? 'Venda' : 'Locação'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Gerado em {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          {contract.contract_signatures?.length > 0 ? (
                            contract.contract_signatures.map((sig: any) => (
                              <div key={sig.id} className="flex items-center justify-between sm:justify-end gap-3 text-sm">
                                <span className="text-xs font-medium text-slate-600">
                                  {sig.signer_name} ({sig.signer_role}):
                                </span>
                                {sig.status === 'signed' ? (
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                    <Icons.CheckCircle2 size={12} /> Assinado
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                                    <Icons.Clock size={12} /> Pendente
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 font-medium italic">Nenhuma assinatura solicitada</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
