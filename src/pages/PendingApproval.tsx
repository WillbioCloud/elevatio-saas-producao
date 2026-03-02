import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const PendingApproval: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 md:p-12 shadow-xl text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Icons.Clock size={42} />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
          Cadastro em Análise
        </h1>

        <p className="text-slate-600 text-base md:text-lg leading-relaxed mb-8">
          Olá! Sua conta foi criada com sucesso, mas o acesso ao CRM é restrito. Aguarde a aprovação do administrador para acessar o painel.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Voltar para o Site
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Icons.LogOut size={16} className="mr-3" />
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;