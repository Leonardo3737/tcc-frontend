import Link from 'next/link';
import { CalendarRange, User } from 'lucide-react';

import { Badge, BadgePapel, BadgeStatusMonitoria } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { rotas } from '@/config/rotas';
import { formatarDataSimples } from '@/lib/datas/fuso';
import type { Monitoria } from '@/types/dominio';

/**
 * Cartao de monitoria.
 *
 * O papel aparece como badge ao lado do status porque e a informacao mais
 * importante da lista: e ele que determina o que a pessoa pode fazer ali dentro.
 * Numa mesma lista, o usuario ve MONITOR em uma linha e MONITORADO em outra —
 * a demonstracao visual do modelo de dominio.
 */
export function CartaoMonitoria({ monitoria }: { monitoria: Monitoria }) {
  const disciplina = monitoria.disciplina;

  return (
    <Card className="transition-colors hover:border-primaria/40">
      <Link
        href={rotas.monitoria(monitoria.id)}
        className="block rounded-card p-4 focus-visible:ring-2 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-xs text-texto-suave">{disciplina?.codigo ?? '—'}</p>
            <h3 className="truncate font-medium text-texto">{disciplina?.nome ?? 'Monitoria'}</h3>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {monitoria.meuPapel && <BadgePapel papel={monitoria.meuPapel} />}
            {monitoria.souResponsavel && <Badge tom="primaria">Responsável</Badge>}
            <BadgeStatusMonitoria status={monitoria.status} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            {monitoria.periodo}
          </span>

          {monitoria.professor && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" aria-hidden />
              {monitoria.professor.nome}
            </span>
          )}

          {monitoria.dataInicio && monitoria.dataFim && (
            <span>
              {formatarDataSimples(monitoria.dataInicio)} a {formatarDataSimples(monitoria.dataFim)}
            </span>
          )}
        </div>

        {monitoria.descricao && (
          <p className="mt-3 line-clamp-2 text-sm text-texto-suave">{monitoria.descricao}</p>
        )}
      </Link>
    </Card>
  );
}
