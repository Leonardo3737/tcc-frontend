import type { ReactNode } from 'react';

import {
  PREENCHIMENTO_STATUS,
  TOM_STATUS_ATENDIMENTO,
  TOM_STATUS_MONITORIA,
} from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { rotuloDeStatus } from '@/lib/dominio/rotulos';
import { cn } from '@/lib/utils';

/**
 * Indicador numerico.
 *
 * O valor vem primeiro e grande; o rotulo abaixo. A ordem inversa (rotulo em
 * cima) obriga a ler duas linhas para captar o numero, que e o que a pessoa
 * veio buscar. Sem icone decorativo: o rotulo ja diz o que o numero e.
 */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  className,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-0.5', className)}>
      <p className="font-titulo text-destaque tabular-nums text-texto">{valor}</p>
      <p className="text-sm font-semibold text-texto">{rotulo}</p>
      {detalhe && <p className="text-xs text-texto-suave">{detalhe}</p>}
    </div>
  );
}

/**
 * Faixa de indicadores lado a lado, separados por fio — um painel so, em vez
 * de uma grade de cartoes identicos.
 */
export function FaixaIndicadores({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-6 gap-y-5 rounded-card border border-borda bg-superficie p-4 sm:p-5 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Barras horizontais para contagem por status.
 *
 * Barra em vez de pizza porque comparar comprimentos e mais preciso do que
 * comparar angulos — e porque `porStatus` sempre traz zeros preenchidos, entao
 * nenhuma categoria some do grafico.
 */
export function BarrasPorStatus({
  porStatus,
  total,
  cores,
}: {
  porStatus: Record<string, number>;
  total: number;
  cores?: Record<string, string>;
}) {
  const entradas = Object.entries(porStatus);

  if (total === 0) {
    return <p className="text-sm text-texto-suave">Nenhum registro ainda.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {entradas.map(([status, quantidade]) => {
        const percentual = total > 0 ? Math.round((quantidade / total) * 100) : 0;

        return (
          <li key={status} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-texto">{rotuloDeStatus(status)}</span>
              <span className="tabular-nums text-texto-suave">
                {quantidade} <span className="text-xs">({percentual}%)</span>
              </span>
            </div>

            {/* O texto acima já comunica o valor; a barra é reforço visual. */}
            <div className="h-2 overflow-hidden rounded-full bg-fundo-suave" aria-hidden>
              <div
                className={cn('h-full rounded-full', cores?.[status] ?? 'bg-primaria')}
                style={{ width: `${percentual}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Mesmas cores dos selos de status — o grafico e o selo falam a mesma lingua. */
export const CORES_STATUS_ATENDIMENTO: Record<string, string> = Object.fromEntries(
  Object.entries(TOM_STATUS_ATENDIMENTO).map(([status, tom]) => [
    status,
    PREENCHIMENTO_STATUS[tom],
  ]),
);

export const CORES_STATUS_MONITORIA: Record<string, string> = Object.fromEntries(
  Object.entries(TOM_STATUS_MONITORIA).map(([status, tom]) => [status, PREENCHIMENTO_STATUS[tom]]),
);

/** Esqueleto com a mesma forma de <FaixaIndicadores> com quatro valores. */
export function SkeletonFaixaIndicadores() {
  return (
    <div
      role="status"
      aria-busy
      aria-label="Carregando indicadores"
      className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-card border border-borda bg-superficie p-4 sm:p-5 lg:grid-cols-4"
    >
      {[0, 1, 2, 3].map((indice) => (
        <div key={indice} className="space-y-1.5">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
