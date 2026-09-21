import type { ReactNode } from 'react';

import { Card, CardConteudo } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Cartao de indicador.
 *
 * O valor vem primeiro e grande; o rotulo abaixo. A ordem inversa (rotulo em
 * cima) obriga a ler duas linhas para captar o numero, que e o que a pessoa
 * veio buscar.
 */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  icone,
  className,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardConteudo className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-2xl font-semibold text-texto">{valor}</p>
          {icone && <span className="text-primaria">{icone}</span>}
        </div>

        <p className="text-sm text-texto-suave">{rotulo}</p>
        {detalhe && <p className="text-xs text-texto-suave/80">{detalhe}</p>}
      </CardConteudo>
    </Card>
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
              <span className="text-texto">{status}</span>
              <span className="text-texto-suave">
                {quantidade} <span className="text-xs">({percentual}%)</span>
              </span>
            </div>

            {/* O texto acima já comunica o valor; a barra é reforço visual. */}
            <div className="h-2 overflow-hidden rounded-full bg-fundo" aria-hidden>
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

export const CORES_STATUS_ATENDIMENTO: Record<string, string> = {
  AGENDADO: 'bg-info',
  REALIZADO: 'bg-sucesso',
  CANCELADO: 'bg-perigo',
};

export const CORES_STATUS_MONITORIA: Record<string, string> = {
  PLANEJADA: 'bg-alerta',
  ATIVA: 'bg-sucesso',
  ENCERRADA: 'bg-texto-suave',
  CANCELADA: 'bg-perigo',
};
