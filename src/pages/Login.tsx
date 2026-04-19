import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SUPER_ADMIN_BASE_PATH } from '../config/routes';

// ============================================================
// ELEVATIO VENDAS — Login / Cadastro Unificado
// Design: Split layout — form esquerda + visual direita com cards flutuantes
// Cores: idênticas ao LandingPage (azul #1a56db, #0ea5e9, navy escuro)
// ============================================================

// ── Floating UI Card ─────────────────────────────────────────
const FloatingCard: React.FC<{
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ style, children }) => (
  <div style={{
    position: 'absolute',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: 16,
    padding: '14px 18px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.8)',
    fontFamily: "'DM Sans', sans-serif",
    ...style,
  }}>
    {children}
  </div>
);

// ── Avatares empilhados ───────────────────────────────────────
const AvatarStack: React.FC<{ colors: string[] }> = ({ colors }) => (
  <div style={{ display: 'flex' }}>
    {colors.map((c, i) => (
      <div key={i} style={{
        width: 26, height: 26, borderRadius: '50%',
        background: c, border: '2px solid #fff',
        marginLeft: i > 0 ? -8 : 0,
      }} />
    ))}
  </div>
);

// ── Painel direito com imagem e cards ────────────────────────
const RightPanel: React.FC<{ isSignup: boolean }> = ({ isSignup }) => {
  const dotStyle: React.CSSProperties = {
    width: 8, height: 8, borderRadius: '50%', background: '#f59e0b',
    display: 'inline-block', marginLeft: 6,
  };

  return (
    <div style={{
      position: 'relative', flex: 1,
      background: 'linear-gradient(135deg, #0f2460, #1a3a7a)',
      overflow: 'hidden', borderRadius: '0 20px 20px 0',
    }}>
      {/* Foto de fundo */}
      <img
        src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80"
        alt="Equipe imobiliária"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
      />
      {/* Overlay gradiente */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(15,36,96,0.55) 0%, rgba(14,165,233,0.15) 100%)',
      }} />

      {/* Grid decorativo */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── Card topo: reunião agendada ── */}
      <FloatingCard style={{ top: 32, left: 32, minWidth: 200 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Reunião com Equipe</div>
          <div style={dotStyle} />
        </div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>09:30am – 10:00am</div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AvatarStack colors={['#1a56db','#0ea5e9','#38bdf8']} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>3 participantes</span>
        </div>
      </FloatingCard>

      {/* ── Mini calendário semana ── */}
      <FloatingCard style={{ top: 32, right: 24, padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 8px', textAlign: 'center' }}>
          {['D','S','T','Q','Q','S','S'].map((d,i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const }}>{d}</div>
          ))}
          {[22,23,24,25,26,27,28].map((n,i) => (
            <div key={i} style={{
              fontSize: 13, fontWeight: n === 25 ? 800 : 500,
              color: n === 25 ? '#fff' : '#374151',
              background: n === 25 ? 'linear-gradient(135deg, #1a56db, #0ea5e9)' : 'transparent',
              borderRadius: 6, padding: '2px 0', lineHeight: '22px',
            }}>{n}</div>
          ))}
        </div>
      </FloatingCard>

      {/* ── Card inferior: daily meeting ── */}
      <FloatingCard style={{ bottom: 40, left: 28, minWidth: 210 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Daily Meeting</div>
          <div style={{ ...dotStyle, background: '#0ea5e9' }} />
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, fontWeight: 500 }}>12:00pm – 01:00pm</div>
        <AvatarStack colors={['#1a56db','#7c3aed','#0ea5e9','#16a34a']} />
      </FloatingCard>

      {/* ── Tagline central ── */}
      <div style={{
        position: 'absolute', bottom: 32, right: 24,
        fontFamily: "'Sora', sans-serif",
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.05em', textTransform: 'uppercase' as const,
        textAlign: 'right' as const, lineHeight: 1.6,
      }}>
        Site + CRM<br />
        <span style={{ color: '#7dd3fc' }}>em um só lugar</span>
      </div>
    </div>
  );
};

// ── Componente principal ─────────────────────────────────────
const getPostAuthPath = (role?: unknown) =>
  role === 'super_admin' ? `${SUPER_ADMIN_BASE_PATH}/dashboard` : '/admin/dashboard';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn } = useAuth();
  const selectedPlan =
    searchParams.get('plan') ||
    localStorage.getItem('trimoveis_selected_plan') ||
    localStorage.getItem('elevatio_selected_plan') ||
    localStorage.getItem('selectedPlan') ||
    '';

  // Detectar modo: se vier ?mode=signup ou ?plan=xxx, abre cadastro
  const [isLogin, setIsLogin] = useState(() => {
    const mode = searchParams.get('mode');
    const plan =
      searchParams.get('plan') ||
      localStorage.getItem('trimoveis_selected_plan') ||
      localStorage.getItem('elevatio_selected_plan') ||
      localStorage.getItem('selectedPlan');
    return mode !== 'signup' && !plan;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState(
    () =>
      localStorage.getItem('trimoveis_company_name') ||
      localStorage.getItem('elevatio_company_name') ||
      ''
  );
  const [keepLogged, setKeepLogged] = useState(true);

  // Tratar error_description do OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorDesc = params.get('error_description');
    if (errorDesc) {
      setError(decodeURIComponent(errorDesc).replace(/\+/g, ' '));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Redirecionar se já logado
  useEffect(() => {
    if (!user) return;

    const role = user.role ?? (user.user_metadata as Record<string, unknown> | undefined)?.role;
    navigate(getPostAuthPath(role), { replace: true });
  }, [user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error, user: signedUser } = await signIn(email, password);
        if (error) throw error;
        const role = signedUser?.role ?? (signedUser?.user_metadata as Record<string, unknown> | undefined)?.role;
        navigate(getPostAuthPath(role), { replace: true });
      } else {
        if (!name.trim()) throw new Error('Por favor, informe seu nome.');
        if (!companyName.trim()) throw new Error('Por favor, informe o nome da sua imobiliária.');

        // Salva plano e nome da imobiliaria para o wizard consumir depois
        if (selectedPlan) {
          localStorage.setItem('selectedPlan', selectedPlan);
          localStorage.setItem('trimoveis_selected_plan', selectedPlan);
          localStorage.setItem('elevatio_selected_plan', selectedPlan);
        }
        localStorage.setItem('trimoveis_company_name', companyName.trim());
        localStorage.setItem('elevatio_company_name', companyName.trim());

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              company_name: companyName.trim(),
              role: 'owner',
            },
            emailRedirectTo: `${window.location.origin}/admin/login`,
          },
        });
        if (error) throw error;

        if (data.user && !data.session) {
          setIsEmailSent(true);
          return;
        }

        navigate('/admin/dashboard', {
          replace: true,
          state: {
            plan: selectedPlan || undefined,
            companyName: companyName.trim(),
          },
        });
      }
    } catch (err: any) {
      let msg = 'Ocorreu um erro inesperado.';
      if (err.message?.includes('invalid format')) msg = 'Formato de e-mail inválido.';
      if (err.message?.includes('already registered')) msg = 'Este e-mail já está cadastrado.';
      if (err.message?.includes('password')) msg = 'A senha deve ter no mínimo 6 caracteres.';
      if (err.message?.includes('nome')) msg = err.message;
      if (err.message?.includes('imobiliária')) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setIsEmailSent(false);
    setName('');
    setEmail('');
    setPassword('');
    setCompanyName('');
  };

  // ── Input reutilizável ────────────────────────────────────
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
            onClick={() => {
              setIsEmailSent(false);
              setIsLogin(true);
              navigate('/admin/login', { replace: true });
            }}
            className="mt-8 text-brand-600 dark:text-brand-400 font-bold hover:underline"
          >
            Ir para a tela de Login
          </button>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px 12px 44px',
    fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 400,
    background: '#f8fafc', border: '1.5px solid #e2e8f0',
    borderRadius: 12, outline: 'none', color: '#0f172a',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontFamily: "'DM Sans', sans-serif",
    fontSize: 12, fontWeight: 600, color: '#64748b',
    marginBottom: 6, letterSpacing: '0.03em',
  };

  const iconWrap: React.CSSProperties = {
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    color: '#94a3b8', pointerEvents: 'none',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .ev-input:focus { border-color: #1a56db !important; box-shadow: 0 0 0 3px rgba(26,86,219,0.12) !important; background: #fff !important; }
        .ev-input::placeholder { color: #cbd5e1; }
        .ev-btn-ghost:hover { background: rgba(26,86,219,0.06) !important; }
        .ev-link:hover { color: #1a56db !important; }
        @keyframes ev-slide-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .ev-animate { animation: ev-slide-in 0.3s ease forwards; }
      `}</style>

      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f2fe 50%, #f5f3ff 100%)',
        padding: '24px 16px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          width: '100%', maxWidth: 960,
          background: '#fff', borderRadius: 24,
          boxShadow: '0 32px 80px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.06)',
          display: 'flex', overflow: 'hidden',
          minHeight: 600,
        }}>
          
          {/* ── LADO ESQUERDO: Formulário ── */}
          <div style={{
            width: '50%', padding: '48px 44px',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(170deg, #ffffff 0%, #fafbff 100%)',
          }}>
            
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <img
                src="/logo/logo.png"
                alt="Elevatio Vendas Logo"
                style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }}
              />
              <Link to="/" style={{ textDecoration: 'none' }}>
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Elevatio<span style={{ color: '#0ea5e9' }}>Vendas</span>
                </span>
              </Link>
            </div>

            {/* Heading */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: 26, fontWeight: 800, letterSpacing: '-0.8px',
                  color: '#0f172a', marginBottom: 6, lineHeight: 1.2,
                }}>
                  {isLogin ? 'Bem-vindo de volta' : 'Criar uma conta'}
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                  {isLogin
                    ? 'Acesse seu painel CRM.'
                    : selectedPlan
                      ? `Cadastre-se para ativar o plano ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}.`
                      : 'Cadastre-se e ganhe 7 dias grátis.'
                  }
                </p>
                {/* Badge plano selecionado */}
                {!isLogin && selectedPlan && (
                  <div style={{
                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(26,86,219,0.08)', border: '1px solid rgba(26,86,219,0.2)',
                    borderRadius: 100, padding: '4px 12px',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1a56db"/><path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1a56db' }}>Plano {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} selecionado</span>
                  </div>
                )}
              </div>

              {/* Erro */}
              {error && (
                <div className="ev-animate" style={{
                  marginBottom: 20, padding: '12px 16px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#ef4444"/><path d="M12 8v5M12 16h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                  <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 500 }}>{error}</span>
                </div>
              )}

              {/* Formulário */}
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Nome (só no cadastro) */}
                {!isLogin && (
                  <div className="ev-animate" style={{ position: 'relative' }}>
                    <label style={labelStyle}>Nome completo</label>
                    <div style={{ position: 'relative' }}>
                      <svg style={iconWrap} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <input
                        type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)}
                        required={!isLogin} className="ev-input" style={inputStyle} autoComplete="name"
                      />
                    </div>
                  </div>
                )}

                {/* Nome da imobiliária (só no cadastro) */}
                {!isLogin && (
                  <div className="ev-animate" style={{ position: 'relative' }}>
                    <label style={labelStyle}>Nome da imobiliária</label>
                    <div style={{ position: 'relative' }}>
                      <svg style={iconWrap} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      <input
                        type="text" placeholder="Ex: Prime Brokers" value={companyName} onChange={e => setCompanyName(e.target.value)}
                        required={!isLogin} className="ev-input" style={inputStyle} autoComplete="organization"
                      />
                    </div>
                  </div>
                )}

                {/* E-mail */}
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>E-mail</label>
                  <div style={{ position: 'relative' }}>
                    <svg style={iconWrap} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
                    <input
                      type="email" placeholder="voce@imobiliaria.com" value={email} onChange={e => setEmail(e.target.value)}
                      required className="ev-input" style={inputStyle} autoComplete="email"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <svg style={iconWrap} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <input
                      type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                      required className="ev-input" style={{ ...inputStyle, paddingRight: 44 }} autoComplete={isLogin ? 'current-password' : 'new-password'}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                      {showPassword
                        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Manter conectado / Esqueceu senha (só no login) */}
                {isLogin && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <div onClick={() => setKeepLogged(!keepLogged)} style={{
                        width: 18, height: 18, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
                        border: keepLogged ? 'none' : '1.5px solid #cbd5e1',
                        background: keepLogged ? 'linear-gradient(135deg, #1a56db, #0ea5e9)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {keepLogged && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><path d="M5 12l5 5L19 7"/></svg>}
                      </div>
                      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Manter conectado</span>
                    </label>
                    <a href="#" className="ev-link" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}>
                      Esqueceu a senha?
                    </a>
                  </div>
                )}

                {/* Botão principal */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
                    background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1a56db, #0ea5e9)',
                    color: '#fff', border: 'none', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 6px 20px rgba(26,86,219,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s', marginTop: 4,
                  }}
                  onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.opacity = '0.92'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  {loading ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      {isLogin ? 'Entrando...' : 'Criando conta...'}
                    </>
                  ) : (
                    <>
                      {isLogin ? 'Acessar Painel' : 'Criar Conta'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Footer da esquerda */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
                <button onClick={switchMode} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#1a56db', fontFamily: "'DM Sans', sans-serif", textDecoration: 'underline', textDecorationColor: 'rgba(26,86,219,0.3)', textUnderlineOffset: 3, padding: 0 }}>
                  {isLogin ? 'Cadastrar' : 'Fazer login'}
                </button>
              </p>
              <a href="#" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>Termos & Condições</a>
            </div>
          </div>

          {/* ── LADO DIREITO: Visual ── */}
          <div style={{ flex: 1, display: 'flex' }}>
            <RightPanel isSignup={!isLogin} />
          </div>
        </div>

        {/* Keyframe spin inline */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
};

export default Login;
