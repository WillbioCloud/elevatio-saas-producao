import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, CheckCircle, Loader2, LogIn, Mail, UserCircle } from 'lucide-react';

export default function SiteSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPlan = location.state?.plan;
  const Maps = (path: string) => navigate(path);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLoginMode, setIsLoginMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [signupTrap, setSignupTrap] = useState('');
  const signupStartedAtRef = useRef(Date.now());

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.anim-content',
        { opacity: 0, x: 30 },
        { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' },
      );
    }, containerRef);

    return () => ctx.revert();
  }, [isLoginMode, signupSuccess]);

  useEffect(() => {
    if (!isLoginMode && !signupSuccess) {
      signupStartedAtRef.current = Date.now();
      setAcceptedLegalTerms(false);
      setSignupTrap('');
    }
  }, [isLoginMode, signupSuccess]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) throw new Error('Chaves do servidor em falta.');

      const supabase = createClient(supabaseUrl, anonKey);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw new Error('E-mail ou senha incorretos.');
      }

      if (data.user) {
        navigate('/admin/dashboard', { replace: true, state: { plan: selectedPlan } });
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) throw new Error('Chaves do servidor em falta.');

      // Captcha MVP: honeypot + tempo mínimo de interação.
      // Futuro: substituir por Cloudflare Turnstile com validação do token no backend.
      if (signupTrap.trim()) throw new Error('Não foi possível concluir o cadastro.');
      if (Date.now() - signupStartedAtRef.current < 2000) {
        throw new Error('Aguarde alguns segundos antes de enviar o cadastro.');
      }
      if (!acceptedLegalTerms) {
        throw new Error('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
      }

      // Salvar o plano no localStorage antes do signup
      if (selectedPlan) {
        localStorage.setItem('trimoveis_selected_plan', selectedPlan);
      }

      const supabase = createClient(supabaseUrl, anonKey);

      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName, company_name: '', role: 'owner' },
          emailRedirectTo: `${window.location.origin}/admin/login`,
        },
      });

      if (authError) throw new Error(`Erro ao criar conta: ${authError.message}`);

      if (data.user && !data.session) {
        setIsEmailSent(true);
        return;
      }

      if (data.user) {
        navigate('/admin/pendente', { state: { plan: selectedPlan } });
      }
      
      // A CHAVE EXTRA ESTAVA AQUI, FOI REMOVIDA!

      setSignupSuccess(true);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 animate-in fade-in zoom-in duration-500">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 text-center shadow-2xl border border-slate-100 dark:border-slate-700">
          <div className="w-20 h-20 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail size={40} />
          </div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
            Verifique seu E-mail
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed mb-8">
            Enviamos um link de confirmação para o seu endereço de e-mail. Por favor, clique no link para ativar sua conta e acessar a plataforma.
          </p>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-700 dark:text-amber-400 text-sm font-medium">
            Não encontrou o e-mail? Verifique sua caixa de Spam ou Lixo Eletrônico.
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/login')}
            className="mt-8 text-brand-600 dark:text-brand-400 font-bold hover:underline"
          >
            Ir para a tela de Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-brand-500 selection:text-white"
      ref={containerRef}
    >
      <nav className="w-full px-8 h-24 flex items-center justify-between border-b border-white/5 absolute top-0 z-50">
        <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <span className="font-bold text-2xl tracking-tight">
            Elevatio<span className="text-brand-500">Vendas</span>
          </span>
        </button>
        <div className="text-sm font-medium text-gray-400 hidden sm:block">
          {isLoginMode ? (
            <>
              Novo por aqui?
              <button onClick={() => setIsLoginMode(false)} className="text-brand-400 hover:text-brand-300 ml-1 font-bold">
                Criar uma conta
              </button>
            </>
          ) : (
            <>
              Já tem uma conta?
              <button onClick={() => setIsLoginMode(true)} className="text-brand-400 hover:text-brand-300 ml-1 font-bold">
                Fazer Login
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center pt-24 pb-12 px-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

        <div className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 sm:p-12 shadow-2xl relative min-h-[400px]">
          {isLoginMode ? (
            <div className="anim-content max-w-md mx-auto mt-4">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-400">
                  <LogIn className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Bem-vindo de volta</h2>
                <p className="text-gray-400">Insira as suas credenciais para aceder ao CRM.</p>
              </div>

              {selectedPlan && (
                <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                  <p className="text-sm text-brand-400">
                    Plano selecionado: <strong className="capitalize text-white">{selectedPlan}</strong>
                  </p>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-300">Senha</label>
                    <button type="button" className="text-xs text-brand-400 hover:text-brand-300">
                      Esqueceu a senha?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{errorMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-70 text-white rounded-xl px-6 py-4 mt-6 font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Entrando...
                    </>
                  ) : (
                    'Entrar no Sistema'
                  )}
                </button>
              </form>

              <div className="mt-8 text-center sm:hidden text-sm text-gray-400">
                Novo por aqui?
                <button onClick={() => setIsLoginMode(false)} className="text-brand-400 font-bold ml-1">
                  Criar conta
                </button>
              </div>
            </div>
          ) : signupSuccess ? (
            <div className="anim-content max-w-xl mx-auto flex flex-col items-center justify-center text-center min-h-[320px]">
              <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mb-6 text-brand-400">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Conta criada com sucesso! 🎉</h2>
              <p className="text-gray-300 mb-10 leading-relaxed">
                Enviámos um link de confirmação para o seu e-mail. Clique no link para validar a sua conta e acessar o CRM.
              </p>
              <button
                onClick={() => Maps('/')}
                className="bg-brand-600 hover:bg-brand-500 text-white rounded-xl px-8 py-4 font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
              >
                Voltar ao Início <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="anim-content max-w-xl mx-auto mt-4">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-400">
                  <UserCircle className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Crie a sua conta gratuita</h2>
                <p className="text-gray-400">Comece em segundos e confirme o seu e-mail para aceder ao CRM.</p>
              </div>

              {selectedPlan && (
                <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                  <p className="text-sm text-brand-400">
                    Plano selecionado: <strong className="capitalize text-white">{selectedPlan}</strong>
                  </p>
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">E-mail Profissional</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Senha Segura</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>

                <div
                  aria-hidden="true"
                  className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
                >
                  <label htmlFor="site-signup-company-site">Site da empresa</label>
                  <input
                    id="site-signup-company-site"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={signupTrap}
                    onChange={(e) => setSignupTrap(e.target.value)}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-300">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedLegalTerms}
                    onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-500"
                  />
                  <span>
                    Li e concordo com os{' '}
                    <Link
                      to="/termos"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-brand-300 underline underline-offset-4 hover:text-brand-200"
                    >
                      Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link
                      to="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-brand-300 underline underline-offset-4 hover:text-brand-200"
                    >
                      Política de Privacidade
                    </Link>
                    .
                  </span>
                </label>

                {errorMsg && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{errorMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !acceptedLegalTerms}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-70 text-white rounded-xl px-6 py-4 mt-6 font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Processando...
                    </>
                  ) : (
                    'Criar Conta Grátis'
                  )}
                </button>
              </form>

              <div className="mt-8 text-center sm:hidden text-sm text-gray-400">
                Já tem uma conta?
                <button onClick={() => setIsLoginMode(true)} className="text-brand-400 font-bold ml-1">
                  Fazer login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
