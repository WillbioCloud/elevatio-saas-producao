import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type NavigationEntry = {
  url: string;
  timestamp: string;
};

const STORAGE_KEY = 'trimoveis_navigation';
const MAX_ENTRIES = 10;

const SessionManager: React.FC = () => {
  const { pathname } = useLocation();

  // Limpa o histórico quando o usuário sai ou recarrega a página (F5)
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem(STORAGE_KEY);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Registra as páginas visitadas
  useEffect(() => {
    if (!pathname.startsWith('/imoveis/')) return;

    const nextEntry: NavigationEntry = {
      url: pathname,
      timestamp: new Date().toISOString(),
    };

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as NavigationEntry[]) : [];
      const navigationHistory = Array.isArray(parsed) ? parsed : [];

      const updatedHistory = [...navigationHistory, nextEntry].slice(-MAX_ENTRIES);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
      console.log('📍Nova rota visitada:', nextEntry.url);
      console.log('🗂️Metadados atualizados:', updatedHistory);
    } catch (error) {
      console.error('Erro ao registrar navegação:', error);
    }
  }, [pathname]);

  return null;
};

export default SessionManager;