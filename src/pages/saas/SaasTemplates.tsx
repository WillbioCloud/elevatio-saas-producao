import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../../components/Icons';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'construction' | 'exclusive';
  exclusive_company_id: string | null;
}

interface Company {
  id: string;
  name: string;
  subdomain: string;
}

export default function SaasTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    slug: '',
    description: '',
    status: 'construction' as const
  });

  useEffect(() => {
    fetchTemplates();
    fetchCompanies();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saas_templates')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Erro ao buscar templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, subdomain')
        .order('name', { ascending: true });
      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Erro ao buscar imobiliárias:', err);
    }
  };

  const toggleTemplateStatus = async (template: Template) => {
    if (template.status === 'exclusive') return;
    const newStatus = template.status === 'active' ? 'construction' : 'active';
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, status: newStatus } : t));
    try {
      const { error } = await supabase
        .from('saas_templates')
        .update({ status: newStatus })
        .eq('id', template.id);
      if (error) throw error;
    } catch (err) {
      fetchTemplates();
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTemplate) return;
    setIsSaving(true);
    try {
      const finalCompanyId = editingTemplate.status === 'exclusive' ? editingTemplate.exclusive_company_id : null;
      const { error } = await supabase
        .from('saas_templates')
        .update({
          name: editingTemplate.name,
          description: editingTemplate.description,
          status: editingTemplate.status,
          exclusive_company_id: finalCompanyId
        })
        .eq('id', editingTemplate.id);
      if (error) throw error;
      await fetchTemplates();
      setEditingTemplate(null);
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao salvar as configurações do template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cleanSlug = newTemplate.slug
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
      const { error } = await supabase
        .from('saas_templates')
        .insert([{
          ...newTemplate,
          slug: cleanSlug
        }]);
      if (error) throw error;
      await fetchTemplates();
      setIsCreateDrawerOpen(false);
      setNewTemplate({ name: '', slug: '', description: '', status: 'construction' });
    } catch (error: any) {
      console.error('Erro ao criar template:', error);
      alert('Erro ao criar template. Verifique se o slug já não existe.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && templates.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">Templates de Sites</h1>
          <p className="mt-1 text-muted-foreground">Controle a disponibilidade dos temas no Wizard e no Painel dos clientes.</p>
        </div>
        <Button onClick={() => setIsCreateDrawerOpen(true)} className="gap-2 shadow-sm">
          <Icons.Plus size={16} /> Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="relative border-border/50 shadow-sm overflow-hidden flex flex-col group">
            <CardHeader className="pb-3">
              <div className="absolute top-5 right-5">
                {template.status === 'active' && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Disponível
                  </Badge>
                )}
                {template.status === 'construction' && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 gap-1">
                    <Icons.Wrench size={10} /> Em Construção
                  </Badge>
                )}
                {template.status === 'exclusive' && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 gap-1">
                    <Icons.Lock size={10} /> Exclusivo
                  </Badge>
                )}
              </div>
              <div className="h-40 w-full rounded-xl bg-muted/50 flex items-center justify-center border border-border group-hover:border-primary/30 transition-colors">
                <Icons.LayoutTemplate size={40} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg font-black">{template.name}</CardTitle>
                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">/{template.slug}</span>
              </div>
              <CardDescription className="text-sm mb-6 flex-1">{template.description}</CardDescription>
              <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleTemplateStatus(template)}
                  disabled={template.status === 'exclusive'}
                  className={cn(
                    "gap-1.5 text-xs font-bold",
                    template.status === 'active' && "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30",
                    template.status === 'construction' && "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30",
                    template.status === 'exclusive' && "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {template.status === 'active' ? <><Icons.EyeOff size={14} /> Ocultar</> : template.status === 'construction' ? <><Icons.Eye size={14} /> Liberar</> : <><Icons.Lock size={14} /> VIP</>}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditingTemplate(template)} className="text-muted-foreground hover:text-primary">
                  <Icons.Settings size={18} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Drawer de Criação */}
      {isCreateDrawerOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !isSaving && setIsCreateDrawerOpen(false)} />
          <div className="relative w-full max-w-md h-screen bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
              <h2 className="text-lg font-black">Novo Template</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsCreateDrawerOpen(false)} className="text-muted-foreground">
                <Icons.X size={20} />
              </Button>
            </div>
            <form onSubmit={handleCreateTemplate} className="flex-1 p-6 space-y-6 flex flex-col">
              <div className="space-y-4 flex-1">
                <div>
                  <Label className="text-xs font-bold uppercase">Nome do Template</Label>
                  <Input
                    required
                    value={newTemplate.name}
                    onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Ex: Moderno V2"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase">Slug (Identificador no código)</Label>
                  <Input
                    required
                    value={newTemplate.slug}
                    onChange={e => setNewTemplate({ ...newTemplate, slug: e.target.value })}
                    placeholder="ex: moderno-v2"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase">Descrição</Label>
                  <Textarea
                    required
                    value={newTemplate.description}
                    onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Descreva as características..."
                    className="mt-1 h-24 resize-none"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isSaving} className="w-full gap-2">
                {isSaving ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Save size={18} />}
                Salvar Template no Catálogo
              </Button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Drawer de Edição */}
      {editingTemplate && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSaving && setEditingTemplate(null)} />
          <div className="relative w-full max-w-md h-screen bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
              <div>
                <h2 className="text-lg font-black">Configurar Template</h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">/{editingTemplate.slug}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingTemplate(null)} disabled={isSaving} className="text-muted-foreground">
                <Icons.X size={20} />
              </Button>
            </div>
            <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 flex flex-col">
              <div className="space-y-4 flex-1">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider">Nome Comercial</Label>
                  <Input
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider">Descrição Curta</Label>
                  <Textarea
                    value={editingTemplate.description}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    required
                    className="mt-1 h-24 resize-none"
                  />
                </div>
                <div className="pt-4 border-t border-border">
                  <Label className="text-xs font-bold uppercase tracking-wider mb-3 block">Disponibilidade</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <label className={cn("flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all", editingTemplate.status === 'active' ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-border hover:bg-muted/30")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", editingTemplate.status === 'active' ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground")}>
                          {editingTemplate.status === 'active' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold", editingTemplate.status === 'active' ? "text-emerald-800 dark:text-emerald-400" : "text-foreground")}>Público / Ativo</p>
                          <p className="text-xs text-muted-foreground">Visível no Wizard para todos.</p>
                        </div>
                      </div>
                      <input type="radio" name="status" value="active" className="hidden" onChange={() => setEditingTemplate({ ...editingTemplate, status: 'active' })} checked={editingTemplate.status === 'active'} />
                    </label>
                    <label className={cn("flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all", editingTemplate.status === 'construction' ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-border hover:bg-muted/30")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", editingTemplate.status === 'construction' ? "border-amber-500 bg-amber-500" : "border-muted-foreground")}>
                          {editingTemplate.status === 'construction' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold", editingTemplate.status === 'construction' ? "text-amber-800 dark:text-amber-400" : "text-foreground")}>Em Construção</p>
                          <p className="text-xs text-muted-foreground">Oculto temporariamente.</p>
                        </div>
                      </div>
                      <input type="radio" name="status" value="construction" className="hidden" onChange={() => setEditingTemplate({ ...editingTemplate, status: 'construction' })} checked={editingTemplate.status === 'construction'} />
                    </label>
                    <label className={cn("flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all", editingTemplate.status === 'exclusive' ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30" : "border-border hover:bg-muted/30")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", editingTemplate.status === 'exclusive' ? "border-purple-500 bg-purple-500" : "border-muted-foreground")}>
                          {editingTemplate.status === 'exclusive' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold", editingTemplate.status === 'exclusive' ? "text-purple-800 dark:text-purple-400" : "text-foreground")}>Exclusivo VIP</p>
                          <p className="text-xs text-muted-foreground">Apenas uma imobiliária pode usar.</p>
                        </div>
                      </div>
                      <input type="radio" name="status" value="exclusive" className="hidden" onChange={() => setEditingTemplate({ ...editingTemplate, status: 'exclusive' })} checked={editingTemplate.status === 'exclusive'} />
                    </label>
                  </div>
                </div>
                {editingTemplate.status === 'exclusive' && (
                  <div className="pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2 block">Vincular à Imobiliária</Label>
                    <Select
                      value={editingTemplate.exclusive_company_id || ''}
                      onValueChange={(v) => setEditingTemplate({ ...editingTemplate, exclusive_company_id: v })}
                    >
                      <SelectTrigger className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                        <SelectValue placeholder="Selecione o Cliente VIP..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name} ({company.subdomain})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-border">
                <Button type="submit" disabled={isSaving} className="w-full gap-2">
                  {isSaving ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Save size={18} />}
                  Salvar Configurações
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}