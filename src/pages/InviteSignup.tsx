import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';

type InviteCompanyInfo = {
  id: string;
  name: string;
  role: 'admin' | 'corretor';
};

export default function InviteSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<InviteCompanyInfo | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadInvite = async () => {
      if (!token) {
        setError('Link de convite inválido ou ausente.');
        setLoading(false);
        return;
      }

      try {
        const decoded = JSON.parse(atob(token)) as { c?: string; r?: string };
        const inviteRole = decoded.r === 'admin' ? 'admin' : decoded.r === 'corretor' ? 'corretor' : null;

        if (!decoded.c || !inviteRole) {
          throw new Error('Token malformado');
        }

        const { data, error: companyError } = await supabase
          .from('companies')
          .select('name')
          .eq('id', decoded.c)
          .single();

        if (ignore) return;

        if (companyError) {
          throw companyError;
        }

        if (data) {
          setCompanyInfo({ id: decoded.c, name: data.name, role: inviteRole });
        } else {
          setError('Imobiliária não encontrada.');
        }
      } catch (inviteError) {
        console.error('Erro ao validar convite:', inviteError);
        if (!ignore) {
          setError('O link de convite está corrompido.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadInvite();

    return () => {
      ignore = true;
    };
  }, [token]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyInfo) return;
    setIsSubmitting(true);
    setError('');

    try {
      // 1. Cria o utilizador no Auth do Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: companyInfo.role,
            company_id: companyInfo.id // Injeta o ID da imobiliária direto no metadata!
          }
        }
      });

      if (authError) throw authError;

      // VERIFICAÇÃO DE SEGURANÇA: E-MAIL JÁ CADASTRADO
      // O Supabase retorna um usuário com a array identities vazia caso o e-mail já exista.
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        throw new Error('Este e-mail já está cadastrado no sistema. Tente fazer login ou use outro e-mail.');
      }

      if (authData.user) {
        // 2. Insere ou Atualiza o perfil (UPSERT)
        // Usamos upsert() para contornar Triggers automáticos do banco que possam já ter criado a linha.
        const { error: profileError } = await supabase.from('profiles').upsert([{
          id: authData.user.id,
          company_id: companyInfo.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone.replace(/\D/g, ''),
          role: companyInfo.role,
          active: false // Exige aprovação do Admin na aba Equipe
        }]);

        if (profileError) throw profileError;
        
        alert('Cadastro realizado com sucesso! Aguarde a aprovação do administrador.');
        navigate('/pending-approval');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Icons.Loader2 className="animate-spin text-brand-500" size={40} />
      </div>
    );
  }

  if (error || !companyInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-dark-card p-8 rounded-3xl shadow-xl text-center border border-slate-100 dark:border-dark-border">
          <Icons.XCircle size={64} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Convite Inválido</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold w-full"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-dark-card p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-dark-border">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icons.Building size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Junte-se à Equipe</h2>
          <p className="text-slate-500 mt-2">
            Você foi convidado para ser{' '}
            <strong className="text-brand-600">
              {companyInfo.role === 'admin' ? 'Administrador' : 'Corretor'}
            </strong>{' '}
            na imobiliária{' '}
            <strong className="text-slate-800 dark:text-slate-200">{companyInfo.name}</strong>.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nome Completo
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              E-mail Profissional
            </label>
            <input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              WhatsApp / Telefone
            </label>
            <input
              required
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              Criar Senha (Mín. 6 caracteres)
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Icons.Loader2 className="animate-spin" size={20} />
            ) : (
              <Icons.UserPlus size={20} />
            )}
            Cadastrar e Aguardar Aprovação
          </button>
        </form>
      </div>
    </div>
  );
}
