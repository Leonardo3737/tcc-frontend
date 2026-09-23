import Link from 'next/link';

import { BadgePapel, BadgeResponsavel, BadgeStatusMonitoria } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SeloDisciplina } from '@/components/comum/selo-disciplina';
import { rotas } from '@/config/rotas';
import { classesCorDisciplina } from '@/lib/cores/disciplina';
import { cn } from '@/lib/utils';
import type { Monitoria } from '@/types/dominio';

/**
 * Cartao de monitoria.
 *
 * A faixa e o selo levam a cor da disciplina — e o que permite achar
 * "Calculo I" numa lista sem ler. O papel aparece como etiqueta porque e a
 * informacao que decide o que a pessoa pode fazer ali dentro: numa mesma lista
 * ela ve "Monitor" em uma linha e "Monitorado" em outra.
 */
export function CartaoMonitoria({
  monitoria,
  className,
}: {
  monitoria: Monitoria;
  className?: string;
}) {
  const disciplina = monitoria.disciplina;
  const cores = classesCorDisciplina(disciplina?.codigo);

  return (
    <Card
      faixa={cores.faixa}
      className={cn('transition-colors duration-150 hover:border-borda-forte', className)}
    >
      <Link
        href={rotas.monitoria(monitoria.id)}
        className="flex gap-3 rounded-card py-4 pl-5 pr-4 focus-visible:ring-inset focus-visible:ring-offset-0"
      >
        <SeloDisciplina codigo={disciplina?.codigo} nome={disciplina?.nome} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-titulo text-titulo-cartao text-texto">
                {disciplina?.nome ?? 'Monitoria'}
              </h3>
              <p className="mt-0.5 truncate text-xs text-texto-suave">
                <span className="font-semibold">{disciplina?.codigo ?? '—'}</span> ·{' '}
                {monitoria.periodo}
                {monitoria.professor && <> · {monitoria.professor.nome}</>}
              </p>
            </div>

            <BadgeStatusMonitoria status={monitoria.status} />
          </div>

          {(monitoria.meuPapel || monitoria.souResponsavel) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {monitoria.meuPapel && <BadgePapel papel={monitoria.meuPapel} />}
              {monitoria.souResponsavel && <BadgeResponsavel />}
            </div>
          )}

          {monitoria.descricao && (
            <p className="mt-2 line-clamp-2 text-sm text-texto-suave">{monitoria.descricao}</p>
          )}
        </div>
      </Link>
    </Card>
  );
}

/** Mesmo formato do cartao: selo, titulo, linha de metadados e etiqueta. */
export function SkeletonCartaoMonitoria({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-card border border-borda bg-superficie py-4 pl-5 pr-4',
        className,
      )}
    >
      <Skeleton className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex justify-between gap-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}
