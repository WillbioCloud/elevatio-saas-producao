import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ReviewRow = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  is_public: boolean | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  company_id: string | null;
  name: string | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
};

type EnrichedReview = ReviewRow & {
  companyName: string;
  reviewerName: string;
};

const SCORE_BUCKETS = [1, 2, 3, 4, 5];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));

const renderStars = (rating: number) => (
  <div className="flex items-center gap-1">
    {SCORE_BUCKETS.map((value) => (
      <Star
        key={value}
        className={`h-4 w-4 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
      />
    ))}
  </div>
);

const getNpsAccent = (score: number) => {
  if (score >= 50) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20';
  }

  if (score >= 0) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20';
  }

  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20';
};

export default function SaasReviews() {
  const { addToast } = useToast();
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingReviewIds, setPendingReviewIds] = useState<string[]>([]);

  const fetchReviews = async (showRefreshState = false) => {
    if (showRefreshState) {
      setIsRefreshing(true);
    } else if (reviews.length === 0) {
      setIsLoading(true);
    }

    try {
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('system_reviews')
        .select('id, user_id, rating, comment, is_public, created_at')
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      const baseReviews = (reviewsData ?? []) as ReviewRow[];
      const uniqueUserIds = Array.from(new Set(baseReviews.map((review) => review.user_id).filter(Boolean)));

      let profilesById = new Map<string, ProfileRow>();
      let companiesById = new Map<string, CompanyRow>();

      if (uniqueUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, company_id')
          .in('id', uniqueUserIds);

        if (profilesError) throw profilesError;

        const profiles = (profilesData ?? []) as ProfileRow[];
        profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

        const uniqueCompanyIds = Array.from(
          new Set(profiles.map((profile) => profile.company_id).filter((value): value is string => Boolean(value)))
        );

        if (uniqueCompanyIds.length > 0) {
          const { data: companiesData, error: companiesError } = await supabase
            .from('companies')
            .select('id, name')
            .in('id', uniqueCompanyIds);

          if (companiesError) throw companiesError;

          const companies = (companiesData ?? []) as CompanyRow[];
          companiesById = new Map(companies.map((company) => [company.id, company]));
        }
      }

      const nextReviews = baseReviews.map((review) => {
        const profile = profilesById.get(review.user_id);
        const company = profile?.company_id ? companiesById.get(profile.company_id) : null;

        return {
          ...review,
          reviewerName: profile?.name || 'Usuario sem nome',
          companyName: company?.name || 'Imobiliaria nao identificada',
        };
      });

      setReviews(nextReviews);
    } catch (error) {
      console.error('Erro ao carregar avaliacoes do sistema:', error);
      addToast('Nao foi possivel carregar as avaliacoes agora.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchReviews();
  }, []);

  const metrics = useMemo(() => {
    if (reviews.length === 0) {
      return {
        averageScore: 0,
        npsScore: 0,
        publicCount: 0,
      };
    }

    const totalScore = reviews.reduce((sum, review) => sum + review.rating, 0);
    const promoters = reviews.filter((review) => review.rating >= 4).length;
    const detractors = reviews.filter((review) => review.rating <= 2).length;
    const publicCount = reviews.filter((review) => review.is_public).length;
    const npsScore = Math.round(((promoters - detractors) / reviews.length) * 100);

    return {
      averageScore: totalScore / reviews.length,
      npsScore,
      publicCount,
    };
  }, [reviews]);

  const chartData = useMemo(
    () =>
      SCORE_BUCKETS.map((value) => ({
        label: `${value} estrela${value > 1 ? 's' : ''}`,
        total: reviews.filter((review) => review.rating === value).length,
      })),
    [reviews]
  );

  const handleTogglePublic = async (reviewId: string, nextValue: boolean) => {
    const previousReviews = reviews;

    setPendingReviewIds((current) => [...current, reviewId]);
    setReviews((current) =>
      current.map((review) =>
        review.id === reviewId ? { ...review, is_public: nextValue } : review
      )
    );

    try {
      const { error } = await supabase
        .from('system_reviews')
        .update({ is_public: nextValue })
        .eq('id', reviewId);

      if (error) throw error;

      addToast(
        nextValue ? 'Review aprovado para o site.' : 'Review removido da vitrine publica.',
        'success'
      );
    } catch (error) {
      console.error('Erro ao atualizar visibilidade do review:', error);
      setReviews(previousReviews);
      addToast('Nao foi possivel atualizar o status publico do review.', 'error');
    } finally {
      setPendingReviewIds((current) => current.filter((id) => id !== reviewId));
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Avaliacoes do Sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Curadoria de depoimentos e pulso de satisfacao do Elevatio Vendas.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void fetchReviews(true)}
          disabled={isRefreshing}
          className="gap-2 self-start lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar painel'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>Media geral</CardDescription>
            <CardTitle className="flex items-center gap-3 text-3xl font-black">
              <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
              {reviews.length > 0 ? metrics.averageScore.toFixed(1) : '0.0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Baseada em {reviews.length} avaliacao{reviews.length === 1 ? '' : 'oes'} registradas.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>NPS do produto</CardDescription>
            <CardTitle className="flex items-center gap-3 text-3xl font-black">
              <TrendingUp className="h-7 w-7 text-primary" />
              {metrics.npsScore}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getNpsAccent(metrics.npsScore)}>
              Promotores: 4-5 | Neutros: 3 | Detratores: 1-2
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>Vitrine publica</CardDescription>
            <CardTitle className="flex items-center gap-3 text-3xl font-black">
              <ShieldCheck className="h-7 w-7 text-emerald-500" />
              {metrics.publicCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Reviews aprovados manualmente para aparecer no site.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribuicao de notas
            </CardTitle>
            <CardDescription>Leitura rapida da satisfacao por faixa de estrela.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[300px] w-full">
              {reviews.length === 0 && !isLoading ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-muted-foreground dark:border-slate-800">
                  Ainda nao existem reviews enviados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 16, right: 12, left: -16, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.45} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '12px',
                      }}
                      formatter={(value: number) => [value, 'Reviews']}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareQuote className="h-5 w-5 text-primary" />
              Curadoria de depoimentos
            </CardTitle>
            <CardDescription>
              Defina quais avaliacoes merecem virar prova social publica.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Imobiliaria</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Comentario</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Publico no Site</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      Carregando avaliacoes...
                    </TableCell>
                  </TableRow>
                ) : reviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      Nenhum review registrado ate agora.
                    </TableCell>
                  </TableRow>
                ) : (
                  reviews.map((review) => {
                    const isPending = pendingReviewIds.includes(review.id);

                    return (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-foreground">{review.companyName}</p>
                            <p className="text-xs text-muted-foreground">{review.reviewerName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {renderStars(review.rating)}
                            <span className="text-xs text-muted-foreground">{review.rating}/5</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-[360px] whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">
                            {review.comment?.trim() || 'Sem comentario enviado.'}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(review.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-3">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                            <Switch
                              checked={Boolean(review.is_public)}
                              onCheckedChange={(checked) => void handleTogglePublic(review.id, checked)}
                              disabled={isPending}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
