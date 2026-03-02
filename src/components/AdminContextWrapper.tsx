import React from 'react';
import { Outlet } from 'react-router-dom';
import { LeadsProvider } from '../contexts/LeadsContext';
import { NotificationProvider } from '../contexts/NotificationContext';

// Este wrapper garante que o contexto de Leads só exista dentro do painel Admin
// Isso impede que o site público tente buscar dados restritos e trave a sessão.
const AdminContextWrapper: React.FC = () => {
  return (
    <LeadsProvider>
      <NotificationProvider>
        <Outlet />
      </NotificationProvider>
    </LeadsProvider>
  );
};

export default AdminContextWrapper;