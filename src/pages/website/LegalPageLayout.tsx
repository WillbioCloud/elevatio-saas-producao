import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from './LandingPage';

type LegalPageLayoutProps = {
  title: string;
  subtitle: string;
  updatedAt: string;
  children: ReactNode;
};

export default function LegalPageLayout({ title, subtitle, updatedAt, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        @keyframes ev-dropdown-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .ev-btn-primary {
          background: linear-gradient(135deg, #1a56db, #0ea5e9);
          color: #fff;
          transition: all 0.3s ease;
          box-shadow: 0 4px 14px rgba(14,165,233,0.35);
        }
        .ev-btn-primary:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 12px 24px rgba(14,165,233,0.5);
        }
        .ev-nav-desktop { display: flex; }
        .ev-nav-link:hover { color: #0ea5e9 !important; }
        .ev-nav-btn { font-family: inherit; }
        @media (max-width: 768px) {
          .ev-nav-desktop { display: none !important; }
        }
      `}</style>

      <Navbar forceSolid rootAnchors />

      <main className="px-6 pb-14 pt-28 sm:pb-20 sm:pt-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-sky-600">
              Elevatio Vendas
            </p>
            <h1 className="font-['Sora'] text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              {subtitle}
            </p>
            <p className="mt-4 text-sm font-medium text-slate-500">
              Última atualização: {updatedAt}
            </p>
          </div>

          <article className="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-10 [&_h2]:mt-10 [&_h2]:font-['Sora'] [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-950 [&_p]:text-base [&_p]:leading-8 [&_p]:text-slate-600">
            {children}
          </article>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Elevatio Vendas. Todos os direitos reservados.</p>
          <div className="flex gap-5 font-semibold">
            <Link to="/privacidade" className="transition hover:text-sky-600">Privacidade</Link>
            <Link to="/termos" className="transition hover:text-sky-600">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
