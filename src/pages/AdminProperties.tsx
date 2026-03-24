import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lead, Property } from '../types';
import { Icons } from '../components/Icons';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { getPlanConfig, normalizePlanType } from '../config/plans';
import { TOOLTIPS } from '../constants/tooltips';
import PropertyPreviewModal from '../components/PropertyPreviewModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../../components/ui/alert-dialog';

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const getListingType = (listingType?: Property['listing_type']) => listingType || 'sale';

const isPropertyUnavailable = (property: Property): boolean =>
  property.is_available === false || property.status === 'Vendido' || property.status === 'Alugado';

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  return maybe.name === 'AbortError' || maybe.message?.includes('AbortError') === true;
};

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group inline-flex items-center hover:z-[999] ml-2">
    <Icons.Info size={14} className="text-slate-400 cursor-help hover:text-brand-500 transition-colors" />
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] pointer-events-none normal-case">
      {text}
    </div>
  </div>
);

const AdminProperties: React.FC = () => {
  const { user } = useAuth();
  const userPlan = normalizePlanType(user?.company?.plan) ?? 'free';
  const planConfig = getPlanConfig(user?.company?.plan);
  const isAdmin = user?.role === 'admin';

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('Todos');
  const [listingFilter, setListingFilter] = useState<'all' | 'sale' | 'rent' | 'sales' | 'rented' | 'archived'>('all');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight_id');
  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);
  const [sales, setSales] = useState<Lead[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [editingProposalLead, setEditingProposalLead] = useState<Lead | null>(null);
  const [proposalForm, setProposalForm] = useState({
    commission_value: '',
    payment_method: '',
    contract_date: '',
    proposal_notes: ''
  });
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Estados do Modal de Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const maxProperties = planConfig.maxProperties;
  const currentPropertiesCount = properties.length;
  const canAddProperty = currentPropertiesCount < maxProperties;

  const fetchProperties = async () => {
    const shouldShowInitialLoading = properties.length === 0;
    if (shouldShowInitialLoading) {
      setLoading(true);
    }

    let aborted = false;

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*, profiles(name, phone, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData: Property[] = data.map((item: any) => ({
          ...item,
          location: item.location || {
            city: item.city || '',
            neighborhood: item.neighborhood || '',
            state: item.state || '',
            address: item.address || ''
          },
          agent: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
          images: item.images || [],
          features: item.features || []
        }));
        setProperties(formattedData);
      }
    } catch (error) {
      if (isAbortError(error)) {
        aborted = true;
        return;
      }

      console.error("Erro ao buscar imóveis:", error);
    } finally {
      if (!aborted && shouldShowInitialLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    const previewId = searchParams.get('preview_id');
    if (!previewId) return;

    const fetchPreview = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, profiles(name, phone, email)')
        .eq('id', previewId)
        .single();

      if (data && !error) {
        const formattedData = {
          ...data,
          agent: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles,
        };
        setPreviewProperty(formattedData as Property);
      }
    };

    fetchPreview();
  }, [searchParams]);

  const handleClosePreview = () => {
    setPreviewProperty(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('preview_id');
    setSearchParams(nextParams);
  };

  const handleDelete = async (id: string) => {
    // 1. Encontra o imóvel atual para pegar as URLs das imagens
    const propertyToDelete = properties.find(p => p.id === id);

    setAlertConfig({
      isOpen: true,
      title: 'Excluir imóvel',
      description: 'Tem certeza que deseja excluir este imóvel? Todas as imagens associadas também serão apagadas fisicamente do servidor. Esta ação não poderá ser desfeita.',
      actionLabel: 'Excluir',
      onConfirm: async () => {
        try {
          // 2. Tenta deletar as imagens do Storage primeiro
          if (propertyToDelete?.images && propertyToDelete.images.length > 0) {
            // Extrai apenas o caminho do arquivo a partir da URL pública
            const pathsToRemove = propertyToDelete.images.map(url => {
              try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/properties/');
                return pathParts.length > 1 ? pathParts[1] : null;
              } catch (e) {
                return null;
              }
            }).filter(Boolean) as string[];

            if (pathsToRemove.length > 0) {
              const { error: storageError } = await supabase.storage.from('properties').remove(pathsToRemove);
              if (storageError) {
                console.error('Aviso: Falha ao deletar algumas imagens do Storage', storageError);
              }
            }
          }

          // 3. Deleta o registro do banco de dados
          const { error: dbError } = await supabase.from('properties').delete().eq('id', id);

          if (dbError) {
            throw dbError;
          }

          fetchProperties();
        } catch (error: any) {
          console.error('Erro ao deletar:', error);
          alert(`Não foi possível excluir o imóvel.\nMotivo: ${error.message}\n(Verifique as regras de Foreign Key no Supabase).`);
        }
      }
    });
  };

  const handleReactivate = async (id: string) => {
    const { error } = await supabase.from('properties').update({ status: 'Disponível' }).eq('id', id);

    if (error) {
      console.error('Erro ao reativar imóvel:', error);
      alert('Não foi possível reativar o imóvel.');
      return;
    }

    fetchProperties();
  };


  const handleMarkAsSoldOrRented = async (property: Property) => {
    if (property.status === 'Vendido' || property.status === 'Alugado' || property.status === 'Inativo') {
      alert(`Este imóvel está marcado como "${property.status}". O botão rápido não pode alterar status definitivos para evitar erros de contrato. Entre na edição do imóvel caso realmente precise alterar.`);
      return;
    }

    const listingType = getListingType(property.listing_type);
    const isSale = listingType === 'sale';
    const currentlyUnavailable = isPropertyUnavailable(property);

    const actionText = isSale
      ? 'Vendido'
      : currentlyUnavailable
        ? 'Disponível'
        : 'Alugado';

    const confirmMessage = isSale
      ? 'Tem certeza que deseja marcar este imóvel como Vendido? Ele sairá do site público.'
      : currentlyUnavailable
        ? 'Tem certeza que deseja reativar este imóvel para aluguel?'
        : 'Tem certeza que deseja marcar este imóvel como Alugado? Ele sairá do site público.';

    setAlertConfig({
      isOpen: true,
      title: 'Alterar status do imóvel',
      description: confirmMessage,
      actionLabel: 'Confirmar',
      onConfirm: async () => {
        // 👇 O SEGREDO ESTÁ AQUI: Removemos o is_available do payload
        // pois ele provavelmente não existe na tabela do Supabase.
        const payload = isSale
          ? { status: 'Vendido' }
          : currentlyUnavailable
            ? { status: 'Disponível' }
            : { status: 'Alugado' };

        const { error } = await supabase.from('properties').update(payload).eq('id', property.id);

        // Adicionei um alerta de erro para não falhar silenciosamente no futuro
        if (error) {
          console.error('Erro do Supabase:', error);
          alert('Erro ao atualizar o banco de dados: ' + error.message);
          return;
        }

        if (property.agent_id && property.agent_id !== user?.id) {
          await supabase.from('notifications').insert([
            {
              user_id: property.agent_id,
              title: `Imóvel ${actionText}`,
              message: `Seu imóvel "${property.title}" foi marcado como ${actionText}.`,
              type: 'system',
              read: false
            }
          ]);
        }

        // Recarrega a lista para mostrar a mudança
        fetchProperties();
      }
    });
  };


  const handleToggleFeatured = async (property: Property) => {
    const newValue = !property.featured;
    const { error } = await supabase.from('properties').update({ featured: newValue }).eq('id', property.id);

    if (error) {
      alert('Erro ao atualizar destaque: ' + error.message);
      return;
    }

    fetchProperties();
  };

  // Funções de Importação
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportPreview(data);
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const formattedData = importPreview.map((row: any) => {
        // Tenta pegar o título da coluna certa, mesmo se o Excel vier com acento
        const title = row['Titulo'] || row['Título'] || 'Imóvel Importado';
        
        return {
          title: title,
          description: row['Descricao'] || row['Descrição'] || '',
          price: Number(row['Preco'] || row['Preço']) || 0,
          type: row['Tipo'] || 'Casa',
          listing_type: 'sale', // Define Venda como padrão para não quebrar o banco
          status: 'Disponível', // Define como Disponível por padrão
          city: row['Cidade'] || 'Não informada',
          neighborhood: row['Bairro'] || 'Não informado',
          state: row['Estado'] || 'GO',
          bedrooms: Number(row['Quartos']) || 0,
          bathrooms: Number(row['Banheiros']) || 0,
          area: Number(row['Area'] || row['Área']) || 0,
          garage: Number(row['Vagas']) || 0,
          slug: title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000),
          agent_id: user?.id
        };
      });

      const { error } = await supabase.from('properties').insert(formattedData);
      if (error) throw error;
      
      setIsImportModalOpen(false);
      setImportPreview([]);
      fetchProperties();
      alert('Importação concluída com sucesso!');
    } catch (error: any) {
      console.error('Erro detalhado da importação:', error);
      alert(`Erro ao importar para o banco de dados.\nDetalhe: ${error.message || 'Verifique se os dados são válidos.'}`);
    } finally {
      setImporting(false);
    }
  };


  const fetchSales = async () => {
    setSalesLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('status', 'Fechado')
        .order('created_at', { ascending: false });

      if (!isAdmin && user?.id) query = query.eq('assigned_to', user.id);

      const { data, error } = await query;
      if (error) throw error;

      const leadsData = (data || []) as any[];
      const soldIds = Array.from(new Set(leadsData.map((lead) => lead.sold_property_id || lead.property_id || lead.propertyId).filter(Boolean)));

      if (soldIds.length === 0) {
        setSales(leadsData as Lead[]);
        return;
      }

      const { data: soldProperties, error: soldError } = await supabase
        .from('properties')
        .select('id, title, price, listing_type, agent_id')
        .in('id', soldIds);

      if (soldError) throw soldError;

      const propertyMap = new Map((soldProperties || []).map((property: any) => [property.id, property]));

      setSales(
        leadsData.map((lead) => {
          const propId = lead.sold_property_id || lead.property_id || lead.propertyId;
          const soldProperty = propertyMap.get(propId);
          return {
            ...(lead as Lead),
            sold_property_id: propId,
            property: soldProperty ? { ...(soldProperty as any) } : undefined
          };
        })
      );
    } catch (error: any) {
      if (isAbortError(error)) return;
      console.error('Erro ao buscar vendas realizadas:', error);
      alert('Aviso: Não foi possível carregar as vendas. Detalhe: ' + error.message);
    } finally {
      setSalesLoading(false);
    }
  };

  useEffect(() => {
    if (listingFilter === 'sales' || listingFilter === 'rented') {
      fetchSales();
    }
  }, [listingFilter, user?.id, isAdmin]);

  const filteredProperties = properties.filter(p => {
    const neighborhood = p.location?.neighborhood?.toLowerCase() || '';
    const title = p.title?.toLowerCase() || '';
    const searchTerm = search.toLowerCase();
    const matchesSearch = title.includes(searchTerm) || neighborhood.includes(searchTerm);
    const matchesType = typeFilter === 'Todos' || p.type === typeFilter;
    const propertyListingType = getListingType(p.listing_type);
    const matchesListingType =
      listingFilter === 'all' ||
      listingFilter === 'sales' ||
      listingFilter === 'rented' ||
      listingFilter === 'archived' ||
      propertyListingType === listingFilter;

    if (showOnlyMine && p.agent_id !== user?.id) return false;

    if (listingFilter === 'all' || listingFilter === 'sale' || listingFilter === 'rent') {
      if (p.status === 'Vendido' || p.status === 'Alugado') return false;
    } else if (listingFilter === 'archived') {
      if (p.status !== 'Vendido') return false;
    }

    return matchesSearch && matchesType && matchesListingType;
  });

  const filteredSales = sales.filter((sale: any) => {
    const isMine = showOnlyMine
      ? sale.assigned_to === user?.id || sale.property?.agent_id === user?.id
      : true;
    const isRent = sale.property?.listing_type === 'rent';

    if (listingFilter === 'sales') return isMine && !isRent;
    if (listingFilter === 'rented') return isMine && isRent;
    return false;
  });


  // --- EFEITO DE SCROLL E HIGHLIGHT CORRIGIDO ---
  useEffect(() => {
    if (!highlightId || loading || filteredProperties.length === 0) return;

    // Pequeno delay para garantir que o DOM foi pintado
    const timeoutId = window.setTimeout(() => {
      // Procuramos pelo ID prefixado 'row-' para garantir unicidade
      const element = document.getElementById(`row-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightId, loading, filteredProperties.length]);


  const listingTabs = [
    { key: 'all', label: 'Todos' },
    { key: 'sale', label: 'Venda' },
    { key: 'rent', label: 'Aluguel' },
    { key: 'sales', label: 'Vendas Realizadas' },
    { key: 'rented', label: 'Imóveis Alugados' },
    { key: 'archived', label: 'Arquivados' }
  ] as const;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            {isAdmin ? 'Portfólio Global' : 'Meus Imóveis'}
            <InfoTooltip text={TOOLTIPS.properties.pageTitle} />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Gerencie a carteira de imóveis da imobiliária.</p>
        </div>
        
        {isAdmin && (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="px-5 py-3 rounded-xl font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all flex items-center gap-2 shadow-sm"
            >
              <Icons.FileSpreadsheet size={18} className="text-emerald-600" /> 
              Importar Excel
            </button>
            
            <Link
              to="/admin/imoveis/novo"
              onClick={(event) => {
                if (!canAddProperty) {
                  event.preventDefault();
                  alert(`LIMITE ATINGIDO!

O seu plano atual (${userPlan.toUpperCase()}) permite gerir até ${maxProperties} imóveis simultaneamente. Tem atualmente ${currentPropertiesCount} imóveis.

Por favor, faça um upgrade para adicionar mais propriedades.`);
                }
              }}
              className="bg-gradient-to-r from-brand-600 to-sky-500 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all shadow-[0_4px_14px_rgba(14,165,233,0.35)] flex items-center gap-2"
            >
              <Icons.Plus size={20} /> Novo Imóvel
            </Link>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl p-5 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-200/60 dark:border-white/5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {listingTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setListingFilter(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors border ${
                  listingFilter === tab.key
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={showOnlyMine}
              onChange={(e) => setShowOnlyMine(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Mostrar apenas meus imóveis
          </label>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por título, bairro..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-500 transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-500 text-slate-600 font-medium"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="Todos">Todos os Tipos</option>
          <option value="Casa">Casa</option>
          <option value="Apartamento">Apartamento</option>
          <option value="Terreno">Terreno</option>
          <option value="Comercial">Comercial</option>
          <option value="Cobertura">Cobertura</option>
        </select>
        </div>
      </div>

      {/* Tabela de Imóveis / Vendas */}
      {(listingFilter === 'sales' || listingFilter === 'rented') ? (
        salesLoading ? (
          <div className="text-center py-20"><Icons.Loader2 className="animate-spin mx-auto text-brand-600" size={40} /></div>
        ) : (
          <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-200/60 dark:border-white/5 overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="p-4">Cliente (Lead)</th>
                    <th className="p-4">Imóvel Vendido</th>
                    <th className="p-4">Valor Fechado</th>
                    <th className="p-4">Data Fechamento</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm text-slate-600">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 italic">
                        {listingFilter === 'sales' ? 'Nenhuma venda realizada encontrada.' : 'Nenhum imóvel alugado encontrado.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50">
                        <td className="p-4 font-semibold text-slate-800">{sale.name}</td>
                        <td className="p-4">{(sale as any)?.property?.title || 'Imóvel não identificado'}</td>
                        <td className="p-4 font-semibold text-emerald-700">{formatBRL(Number((sale as any)?.deal_value || 0))}</td>
                        <td className="p-4">{(sale as any)?.contract_date ? new Date((sale as any).contract_date).toLocaleDateString('pt-BR') : new Date((sale as any).created_at || Date.now()).toLocaleDateString('pt-BR')}</td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProposalLead(sale);
                              setProposalForm({
                                commission_value: String((sale as any)?.commission_value || ''),
                                payment_method: (sale as any)?.payment_method || '',
                                contract_date: (sale as any)?.contract_date || '',
                                proposal_notes: (sale as any)?.proposal_notes || ''
                              });
                            }}
                            className="px-3 py-2 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 font-semibold hover:bg-brand-100 transition-colors"
                          >
                            Detalhes da Proposta
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : loading && properties.length === 0 ? (
        <div className="text-center py-20"><Icons.Loader2 className="animate-spin mx-auto text-brand-600" size={40} /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-visible">
          {/* Rolagem horizontal no mobile */}
          <div className="overflow-x-auto overflow-y-visible pr-6">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-xs">
                <tr>
                  <th className="p-4">Imóvel</th>
                  <th className="p-4 text-center">Destaque</th>
                  <th className="p-4">Preço</th>
                  <th className="p-4">Bairro</th>
                  <th className="p-4">Cidade</th>
                  {/* AQUI: Coluna visível para TODOS */}
                  <th className="p-4">
                    Responsável <InfoTooltip text="Quem captou este imóvel" />
                  </th>
                  <th className="p-4 text-center">Preview</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-600">
                {filteredProperties.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400 italic">
                      Nenhum imóvel encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredProperties.map(property => {
                    const listingType = getListingType(property.listing_type);
                    const isRent = listingType === 'rent';
                    const isUnavailable = isPropertyUnavailable(property);
                    const isSaleSold = listingType === 'sale' && isUnavailable;
                    const statusButtonLabel = isRent
                      ? isUnavailable
                        ? 'Reativar Imóvel / Disponibilizar'
                        : 'Marcar como Alugado'
                      : 'Marcar como Vendido';
                    const statusButtonTitle = isRent
                      ? isUnavailable
                        ? 'Reativar imóvel para locação'
                        : 'Marcar como Alugado'
                      : 'Marcar como Vendido';
                    const displayedPrice = isRent
                      ? `${formatBRL(Number(property.rent_package_price || property.price || 0))}/mês`
                      : formatBRL(Number(property.price || 0));

                    return (
                    <tr
                      key={property.id}
                      id={`row-${property.id}`}
                      className={`border-b border-gray-100 transition-all ${
                        highlightId === property.id
                          ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-400 shadow-md relative z-10'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-100">
                            {property.images?.[0] ? (
                              <img src={property.images[0]} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-slate-400"><Icons.Image size={16} /></div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold font-serif text-slate-800 dark:text-white line-clamp-1 max-w-[180px] text-base" title={property.title}>{property.title}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                                isRent
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                {isRent ? 'Aluguel' : 'Venda'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase border border-slate-200">
                                {property.type}
                              </span>
                              {(property.status === 'Vendido' || property.status === 'Alugado') && (
                                <span className="text-[9px] bg-rose-100 px-1.5 py-0.5 rounded text-rose-700 font-bold uppercase border border-rose-200">
                                  {property.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(property)}
                          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                          title={property.featured ? 'Remover dos Destaques' : 'Adicionar aos Destaques'}
                        >
                          <Icons.Star size={20} className={property.featured ? "text-yellow-400 fill-yellow-400" : "text-slate-300"} />
                        </button>
                      </td>

                      <td className="p-4 font-bold text-slate-700">
                        {displayedPrice}
                      </td>

                      <td className="p-4 text-slate-600">
                        {property.location?.neighborhood || '-'}
                      </td>

                      <td className="p-4 text-slate-600">
                        {property.location?.city || '-'}
                      </td>
                      
                      {/* Coluna Responsável - Visível para TODOS */}
                      <td className="p-4">
                        {property.agent ? (
                          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 pr-3 rounded-full w-fit">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                              {property.agent.name.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-indigo-700 truncate max-w-[100px]">
                              {property.agent.name.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 pr-3 rounded-full w-fit">
                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold">
                              <Icons.Shield size={12} />
                            </div>
                            <span className="text-xs font-bold text-brand-700">Imobiliária</span>
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => setPreviewProperty(property)}
                          className="inline-flex p-2 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Visualizar preview"
                        >
                          <Icons.Eye size={18} />
                        </button>
                      </td>

                      <td className="p-4 text-right">
                        {(isAdmin || property.agent_id === user?.id) ? (
                          <div className="group flex justify-end gap-2 opacity-100 group-hover:opacity-100 transition-opacity">
                            {listingFilter !== 'archived' && (
                              <>
                                {!isSaleSold && (
                                  <button
                                    onClick={() => handleMarkAsSoldOrRented(property)}
                                    className={`p-2 rounded-lg transition-colors ${
                                      isRent
                                        ? isUnavailable
                                          ? 'text-amber-600 hover:bg-amber-50'
                                          : 'text-emerald-600 hover:bg-emerald-50'
                                        : 'text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                    title={statusButtonTitle}
                                    aria-label={statusButtonLabel}
                                  >
                                    {isRent && isUnavailable ? <Icons.RefreshCw size={18} /> : <Icons.CheckCircle size={18} />}
                                  </button>
                                )}

                                <Link
                                  to={`/admin/imoveis/editar/${property.id}`}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Icons.Edit size={18} />
                                </Link>

                                {/* NOVO: Botão de Excluir na listagem principal */}
                                <button
                                  onClick={() => handleDelete(property.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Excluir Imóvel"
                                >
                                  <Icons.Trash2 size={18} />
                                </button>
                              </>
                            )}

                            {listingFilter === 'archived' && (
                              <>
                                <button
                                  onClick={() => handleReactivate(property.id)}
                                  className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg"
                                  title="Devolver imóvel para Venda"
                                >
                                  <Icons.RefreshCw size={14} className="inline mr-1" /> Reativar
                                </button>
                                <button
                                  onClick={() => handleDelete(property.id)}
                                  className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 px-3 py-1.5 rounded-lg"
                                >
                                  <Icons.Trash2 size={14} className="inline mr-1" /> Excluir
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {editingProposalLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Detalhes da Proposta</h3>
                <p className="text-sm text-slate-500 mt-1">Lead: <span className="font-semibold text-slate-700">{editingProposalLead.name}</span></p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProposalLead(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Icons.X size={20} />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comissão (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={proposalForm.commission_value}
                  onChange={(e) => setProposalForm((prev) => ({ ...prev, commission_value: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pagamento</label>
                <input
                  type="text"
                  value={proposalForm.payment_method}
                  onChange={(e) => setProposalForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Ex: Financiamento + entrada"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data do Contrato</label>
                <input
                  type="date"
                  value={proposalForm.contract_date}
                  onChange={(e) => setProposalForm((prev) => ({ ...prev, contract_date: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações da Proposta</label>
              <textarea
                value={proposalForm.proposal_notes}
                onChange={(e) => setProposalForm((prev) => ({ ...prev, proposal_notes: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 min-h-[120px]"
                placeholder="Condições negociadas, prazos, observações importantes..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProposalLead(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { error } = await supabase
                    .from('leads')
                    .update({
                      commission_value: Number(proposalForm.commission_value || 0),
                      payment_method: proposalForm.payment_method || null,
                      contract_date: proposalForm.contract_date || null,
                      proposal_notes: proposalForm.proposal_notes || null
                    })
                    .eq('id', editingProposalLead.id);

                  if (error) {
                    console.error('Erro ao salvar detalhes da proposta:', error);
                    alert(`Não foi possível salvar a proposta: ${error.message}`);
                    return;
                  }

                  setEditingProposalLead(null);
                  fetchSales();
                }}
                className="px-5 py-2 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700"
              >
                Salvar Proposta
              </button>
            </div>
          </div>
        </div>
      )}

      <PropertyPreviewModal
        isOpen={Boolean(previewProperty)}
        onClose={handleClosePreview}
        data={{
          title: previewProperty?.title || '',
          description: previewProperty?.description || '',
          type: previewProperty?.type || 'Imóvel',
          listing_type: getListingType(previewProperty?.listing_type),
          price: Number(previewProperty?.price || 0),
          bedrooms: Number(previewProperty?.bedrooms || 0),
          bathrooms: Number(previewProperty?.bathrooms || 0),
          garage: Number(previewProperty?.garage || 0),
          area: Number(previewProperty?.area || 0),
          features: previewProperty?.features || [],
          neighborhood: previewProperty?.location?.neighborhood || previewProperty?.neighborhood || '',
          city: previewProperty?.location?.city || previewProperty?.city || '',
          state: previewProperty?.location?.state || previewProperty?.state || '',
          images: previewProperty?.images || []
        }}
      />

      {/* Modal de Importação (Mantido) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Icons.FileSpreadsheet className="text-green-600" />
                Importar Imóveis via Excel
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icons.X size={24} />
              </button>
            </div>
            
            <div className="p-8">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-400 hover:bg-brand-50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Icons.Upload size={48} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 font-medium">Clique ou arraste sua planilha aqui</p>
                <p className="text-xs text-slate-400 mt-2">Formatos suportados: .xlsx, .xls</p>
              </div>

              {importPreview.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-bold text-slate-700 mb-3">Pré-visualização ({importPreview.length} imóveis)</h4>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-500 font-bold">
                        <tr>
                          <th className="p-2">Título</th>
                          <th className="p-2">Bairro</th>
                          <th className="p-2">Preço</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {importPreview.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td className="p-2 truncate max-w-[150px]">{row['Titulo']}</td>
                            <td className="p-2">{row['Bairro']}</td>
                            <td className="p-2">{row['Preco']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.length > 5 && <p className="text-center text-xs text-slate-400 p-2">... e mais {importPreview.length - 5}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={importPreview.length === 0 || importing}
                onClick={confirmImport}
                className="px-6 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? <Icons.Loader2 className="animate-spin" /> : <Icons.CheckCircle />}
                {importing ? 'Importando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={alertConfig?.isOpen || false} onOpenChange={(open) => !open && setAlertConfig(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertConfig?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                alertConfig?.onConfirm();
                setAlertConfig(null);
              }}
            >
              {alertConfig?.actionLabel || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProperties;
