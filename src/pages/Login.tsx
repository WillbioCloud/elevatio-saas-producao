import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from '../components/Icons';
import { COMPANY_NAME } from '../constants';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp } = useAuth();
  const selectedPlan = (location.state as { plan?: string } | null)?.plan;
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLogged, setKeepLogged] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorDesc = params.get('error_description');

    if (errorDesc) {
      setError(decodeURIComponent(errorDesc).replace(/\+/g, ' '));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const role = user.role ?? (user.user_metadata as Record<string, unknown>)?.role;
      const navState =
        location.state && typeof location.state === 'object'
          ? (location.state as Record<string, unknown>)
          : undefined;

      if (role === 'super_admin') {
        navigate('/saas/dashboard', { replace: true, state: navState });
      } else {
        navigate('/admin/dashboard', { replace: true, state: { plan: selectedPlan } });
      }
    }
  }, [user, navigate, selectedPlan]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const navState =
        location.state && typeof location.state === 'object'
          ? (location.state as Record<string, unknown>)
          : undefined;

      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        const currentUser = (await supabase.auth.getUser()).data.user;
        const role = (currentUser as { role?: string })?.role ?? (currentUser?.user_metadata as Record<string, unknown>)?.role;
        if (role === 'super_admin') {
          navigate('/saas/dashboard', { replace: true, state: navState });
        } else {
          navigate('/admin/dashboard', { replace: true, state: { plan: selectedPlan } });
        }
      } else {
        if (!name) throw new Error('Por favor, informe seu nome.');

        const { error } = await signUp(name, email.trim(), password);
        if (error) throw error;

        const currentUser = (await supabase.auth.getUser()).data.user;
        const role = (currentUser as { role?: string })?.role ?? (currentUser?.user_metadata as Record<string, unknown>)?.role;
        if (role === 'super_admin') {
          navigate('/saas/dashboard', { replace: true, state: navState });
        } else {
          navigate('/admin/dashboard', { replace: true, state: { plan: selectedPlan } });
        }
      }
    } catch (err: any) {
      console.error(err);
      // Tratamento de erro mais amigável
      let msg = 'Ocorreu um erro.';
      if (err.message?.includes('invalid format')) msg = 'Formato de e-mail inválido.';
      if (err.message?.includes('already registered')) msg = 'Este e-mail já está cadastrado.';
      if (err.message?.includes('password')) msg = 'A senha deve ter no mínimo 6 caracteres.';
      
      setError(msg);
    } finally {
      setLoading(false);
    }
};

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-dark-bg flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-card rounded-3xl shadow-2xl w-full max-w-4xl flex overflow-hidden border border-brand-100 dark:border-dark-border min-h-[600px]">
        
        {/* Lado Esquerdo - Visual e Branding */}
        <div className="hidden md:flex w-1/2 bg-slate-900 relative flex-col justify-between p-12 text-white">
          <div className="absolute inset-0 opacity-40">
            <img 
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1453&q=80" 
              alt="Background" 
              className="w-full h-full object-cover grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 to-brand-900/80 mix-blend-multiply"></div>
          </div>
          
          <div className="mb-8 text-center relative">
          {/* BOTÃO REMOVIDO DAQUI */}

          {/* Nome da Empresa agora é um Link seguro para a Home */}
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-blue-500 mb-2 cursor-pointer">
              {COMPANY_NAME}
            </h1>
          </Link>
          
          <p className="text-slate-500 dark:text-slate-400">
            {isLogin ? 'Bem-vindo de volta! Acesse sua conta do CRM.' : 'Crie sua conta para gerenciar imóveis.'}
          </p>
        </div>

          <div className="relative z-10 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <Icons.TrendingUp size={20} className="text-brand-400" />
                </div>
                <span>Gestão de Leads Inteligente</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <Icons.Users size={20} className="text-brand-400" />
                </div>
                <span>Distribuição de Equipe</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <Icons.Shield size={20} className="text-brand-400" />
                </div>
                <span>Painel Administrativo Seguro</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-slate-500">
            &copy; {new Date().getFullYear()} {COMPANY_NAME}. Todos os direitos reservados.
          </div>
        </div>

        {/* Lado Direito - Formulário */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white dark:bg-dark-card transition-colors">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 font-serif">
                {isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isLogin 
                  ? 'Insira suas credenciais para acessar o painel do CRM.' 
                  : 'Preencha os dados abaixo para se registrar.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 text-sm rounded-r flex items-center gap-2 animate-fade-in">
                <Icons.AlertCircle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
              
              {/* Nome (Só aparece no cadastro) */}
              {!isLogin && (
                <div className="animate-slide-up">
                  <label htmlFor="name" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Nome Completo</label>
                  <div className="relative">
                    <Icons.Users className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input 
                      id="name"
                      type="text" 
                      name="name"
                      autoComplete="name"
                      placeholder="Seu nome"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">E-mail Corporativo</label>
                <div className="relative">
                  <Icons.Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input 
                    id="email"
                    name="email"
                    type="email" 
                    autoComplete="email"
                    placeholder="voce@imobiliaria.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Senha</label>
                <div className="relative">
                  <Icons.Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input 
                    id="password"
                    name="password"
                    type="password" 
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Checkbox Manter Conectado (Só no login) */}
              {isLogin && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${keepLogged ? 'bg-brand-500 border-brand-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                      {keepLogged && <Icons.Check size={14} className="text-white" />}
                    </div>
                    <input 
                      name="keep_logged"
                      type="checkbox" 
                      className="hidden"
                      checked={keepLogged}
                      onChange={(e) => setKeepLogged(e.target.checked)}
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">Manter conectado</span>
                  </label>
                  <a href="#" className="text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors">Esqueceu a senha?</a>
                </div>
              )}


              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
              >
                {loading ? (
                  <>
                    <Icons.RefreshCw className="animate-spin" size={20} />
                    {isLogin ? 'Entrando...' : 'Criando conta...'}
                  </>
                ) : (
                  <>
                    {isLogin ? 'Acessar Painel' : 'Criar Conta'}
                    <Icons.ChevronRight size={20} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center pt-6 border-t border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isLogin ? 'Ainda não tem acesso?' : 'Já possui uma conta?'}
                <button 
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="ml-2 font-bold text-slate-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors underline decoration-brand-200 underline-offset-4"
                >
                  {isLogin ? 'Solicitar cadastro' : 'Fazer Login'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;