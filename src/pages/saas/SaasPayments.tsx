import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Icons } from '../../components/Icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';

interface Payment {
  id: string;
  status: string;
  value: number;
  netValue: number;
  dueDate: string;
  paymentDate: string | null;
  invoiceUrl: string;
  companyName: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1"><Icons.CheckCircle size={14} /> Pago</Badge>;
    case 'PENDING':
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 gap-1"><Icons.Clock size={14} /> Pendente</Badge>;
    case 'OVERDUE':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 gap-1"><Icons.AlertCircle size={14} /> Vencido</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function SaasPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-asaas-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível carregar os pagamentos agora.');
      }

      const nextPayments = Array.isArray(payload?.payments)
        ? payload.payments
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      setPayments(nextPayments);
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error);
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar os pagamentos agora.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Icons.DollarSign className="text-primary" />
            Gestão de Pagamentos
          </h1>
          <p className="text-muted-foreground">
            Acompanhe todas as faturas geradas e recebidas via Asaas.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchPayments}
          disabled={loading}
          className="gap-2"
        >
          <Icons.RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Atualizar Lista
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider font-medium">Cliente</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Valor Bruto</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Vencimento</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Pago em</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errorMessage ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-destructive">
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhum pagamento registado até ao momento.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <p className="font-bold text-foreground">{payment.companyName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{payment.id}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(payment.value)}</TableCell>
                    <TableCell>{formatDate(payment.dueDate)}</TableCell>
                    <TableCell>{payment.paymentDate ? formatDate(payment.paymentDate) : '-'}</TableCell>
                    <TableCell>
                      <a
                        href={payment.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:text-primary/80 font-bold text-sm flex items-center gap-1"
                      >
                        Ver Fatura <Icons.ExternalLink size={14} />
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}