import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const COOKIE_CONSENT_KEY = 'elevatio_cookies_accepted';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      setIsVisible(localStorage.getItem(COOKIE_CONSENT_KEY) !== 'true');
    } catch {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    } finally {
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <section
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-[600] mx-auto max-w-5xl rounded-lg border border-white/10 bg-slate-950/85 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl sm:bottom-6 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-slate-200">
          Utilizamos cookies essenciais e tecnologias semelhantes de acordo com a nossa Política de Privacidade para melhorar a sua experiência. Ao continuar navegando, você concorda com estas condições.
        </p>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            to="/privacidade"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Ler Política
          </Link>
          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Entendi
          </button>
        </div>
      </div>
    </section>
  );
}
