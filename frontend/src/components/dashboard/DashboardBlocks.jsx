import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Cartao3D from '@/components/marca/Cartao3D.jsx';
import Contador from '@/components/marca/Contador.jsx';
import IconeModulo3D from '@/components/marca/IconeModulo3D.jsx';

// Peças visuais do painel. Cada bloco leva para a página do módulo.

const TONS = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-700 dark:text-red-400',
  green: 'bg-green-500/10 text-green-700 dark:text-green-400',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

// Número grande + rótulo. Em erro mostra aviso, nunca um zero inventado.
// Cartão creme que inclina em 3D; o número conta até o valor real. Alerta
// (tom vermelho) mantém o ícone vermelho; os outros usam o selo dourado.
export const KpiCard = ({ to, icon: Icon, label, value, hint, tone = 'primary', loading, error }) => (
  <Cartao3D className="h-full min-w-0">
  <Link
    to={to}
    className="group block h-full rounded-xl min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Card className="cartao-creme h-full shadow-sm transition-shadow group-hover:shadow-lg group-hover:border-royal/50">
      <CardContent className="p-3.5 sm:p-4 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between gap-2">
          {tone === 'red' ? (
            <div className={cn('p-2 rounded-lg shrink-0', TONS.red)}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
          ) : <IconeModulo3D icon={Icon} size="sm" />}
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug min-h-[2.5em]">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : error ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar</p>
        ) : (
          <p className={cn('text-2xl sm:text-3xl font-bold tabular-nums leading-none', tone === 'red' ? 'text-red-700' : 'text-marinho')}><Contador valor={value} /></p>
        )}
        {hint && !loading && !error && <p className="text-xs text-muted-foreground line-clamp-2">{hint}</p>}
      </CardContent>
    </Card>
  </Link>
  </Cartao3D>
);

// Cartão de bloco com título, ícone e link "Ver tudo".
export const BlockCard = ({ title, icon: Icon, to, linkLabel = 'Ver tudo', children, className, description }) => (
  <Card className={cn('shadow-sm border-border flex flex-col min-w-0', className)}>
    <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
      <div className="min-w-0">
        <CardTitle className="text-base sm:text-lg text-marinho flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-ouro-escuro shrink-0" aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </CardTitle>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      {to && (
        <Button asChild variant="ghost" size="sm" className="shrink-0 h-9 px-2 text-primary">
          <Link to={to}>{linkLabel}<ChevronRight className="w-4 h-4 ml-0.5" aria-hidden="true" /></Link>
        </Button>
      )}
    </CardHeader>
    <CardContent className="p-4 sm:p-5 pt-2 sm:pt-2 flex-1 min-w-0">{children}</CardContent>
  </Card>
);

export const EmptyState = ({ icon: Icon, title, text, actionLabel, actionTo }) => (
  <div className="flex flex-col items-center justify-center text-center py-8 px-2 gap-2">
    {Icon && (
      <div className="p-3 rounded-full bg-muted text-muted-foreground"><Icon className="w-6 h-6" aria-hidden="true" /></div>
    )}
    <p className="font-medium text-foreground">{title}</p>
    {text && <p className="text-sm text-muted-foreground max-w-xs">{text}</p>}
    {actionLabel && actionTo && (
      <Button asChild size="lg" className="mt-2 h-11">
        <Link to={actionTo}>{actionLabel}</Link>
      </Button>
    )}
  </div>
);

export const BlockError = () => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
    <AlertCircle className="w-4 h-4" aria-hidden="true" />
    Não foi possível carregar estas informações agora.
  </div>
);

export const BlockSkeleton = ({ rows = 3, chart = false }) => (
  chart ? <Skeleton className="h-64 w-full rounded-lg" /> : (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
    </div>
  )
);

// Linha de lista clicável, com área de toque grande.
export const ListRow = ({ to, icon: Icon, iconTone = 'primary', title, subtitle, right }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-lg border border-border p-3 min-h-[56px] hover:bg-muted/50 active:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {Icon && (
      <div className={cn('p-2 rounded-md shrink-0', TONS[iconTone] || TONS.primary)}>
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
    )}
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-foreground truncate">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
  </Link>
);

export const StatusPill = ({ className, children }) => (
  <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap', className)}>
    {children}
  </span>
);

// Botão grande de ação rápida.
export const QuickAction = ({ to, icon: Icon, label }) => (
  <Button asChild variant="outline" className="h-auto min-h-[64px] py-3 flex-col gap-1.5 whitespace-normal text-center">
    <Link to={to}>
      <IconeModulo3D icon={Icon} size="sm" />
      <span className="text-sm font-medium leading-tight">{label}</span>
    </Link>
  </Button>
);
