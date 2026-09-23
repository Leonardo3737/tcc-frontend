import Link from 'next/link';
import { MapPin, Video } from 'lucide-react';

import { BadgeStatusAtendimento } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarraVagas } from '@/components/comum/barra-vagas';
import { DataRelativa } from '@/components/comum/data-relativa';
import { rotas } from '@/config/rotas';
import { classesCorDisciplina } from '@/lib/cores/disciplina';
import { formatarHora } from '@/lib/datas/fuso';
import { cn } from '@/lib/utils';
import {
  ModalidadeAtendimento,
  OrigemAtendimento,
  StatusAtendimento,
  type Atendimento,
} from '@/types/dominio';

/**
 * Cartao de atendimento, em forma de linha de agenda.
 *
 * O horario fica numa coluna propria a esquerda — e a primeira coisa que se
 * procura numa agenda. A disciplina vem na faixa de cor e no rotulo: o backend
 * inclui o resumo da monitoria em todas as rotas de atendimento, o que torna a
 * agenda pessoal (que atravessa varias monitorias) legivel sem uma requisicao
 * por linha.
 *
 * Cancelado continua na lista (RN10), esmaecido e com o horario riscado: a
 * forma diz "nao vai acontecer" sem precisar de vermelho.
 */
export function CartaoAtendimento({
  atendimento,
  mostrarMonitoria = true,
  fuso,
}: {
  atendimento: Atendimento;
  mostrarMonitoria?: boolean;
  fuso: string;
}) {
  const remoto = atendimento.modalidade === ModalidadeAtendimento.REMOTO;
  const cancelado = atendimento.status === StatusAtendimento.CANCELADO;
  const cores = classesCorDisciplina(atendimento.monitoria?.codigoDisciplina);

  return (
    <Card faixa={cores.faixa} className="transition-colors duration-150 hover:border-borda-forte">
      <Link
        href={rotas.atendimento(atendimento.id)}
        className="flex gap-4 rounded-card py-3.5 pl-5 pr-4 focus-visible:ring-inset focus-visible:ring-offset-0"
      >
        <div className={cn('w-14 shrink-0 tabular-nums', cancelado && 'text-texto-suave')}>
          <p className={cn('font-titulo text-base font-semibold', cancelado && 'line-through')}>
            {formatarHora(atendimento.inicio, fuso)}
          </p>
          <p className="text-xs text-texto-suave">até {formatarHora(atendimento.fim, fuso)}</p>
        </div>

        <div className={cn('min-w-0 flex-1 space-y-1', cancelado && 'opacity-75')}>
          {mostrarMonitoria && atendimento.monitoria && (
            <p className={cn('truncate text-xs font-semibold', cores.texto)}>
              {atendimento.monitoria.nomeDisciplina}
              <span className="font-normal text-texto-suave">
                {' '}
                · {atendimento.monitoria.codigoDisciplina}
              </span>
            </p>
          )}

          <h3 className="truncate font-titulo text-titulo-cartao text-texto">
            {atendimento.assunto}
          </h3>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-texto-suave">
            <DataRelativa instante={atendimento.inicio} comHora={false} className="text-texto" />
            <span className="inline-flex min-w-0 items-center gap-1">
              {remoto ? (
                <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="truncate">
                {atendimento.local ?? (remoto ? 'Remoto' : 'Presencial')}
              </span>
            </span>
            {atendimento.nomeMonitor && <span>com {atendimento.nomeMonitor}</span>}
            {atendimento.origem === OrigemAtendimento.SOLICITACAO_ALUNO && (
              <span>pedido por aluno</span>
            )}
          </p>

          {atendimento.motivoCancelamento && (
            <p className="text-xs text-texto-suave">
              <span className="font-semibold">Motivo:</span> {atendimento.motivoCancelamento}
            </p>
          )}
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <BadgeStatusAtendimento status={atendimento.status} />
          {!cancelado && (
            <BarraVagas
              vagas={atendimento.vagas}
              ocupadas={atendimento.vagasOcupadas}
              aceitaInscricao={atendimento.aceitaInscricao}
              compacta
            />
          )}
        </div>
      </Link>

      {/* No celular, status e vagas descem para uma linha propria. */}
      <div className="flex items-center justify-between gap-3 border-t border-borda py-2 pl-5 pr-4 sm:hidden">
        <BadgeStatusAtendimento status={atendimento.status} />
        {!cancelado && (
          <BarraVagas
            vagas={atendimento.vagas}
            ocupadas={atendimento.vagasOcupadas}
            aceitaInscricao={atendimento.aceitaInscricao}
            compacta
          />
        )}
      </div>
    </Card>
  );
}

/** Mesmo formato: coluna de horario, tres linhas de texto e o bloco de status. */
export function SkeletonCartaoAtendimento({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex gap-4 rounded-card border border-borda bg-superficie py-3.5 pl-5 pr-4',
        className,
      )}
    >
      <div className="w-14 shrink-0 space-y-1.5">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <div className="hidden w-28 shrink-0 space-y-2 sm:block">
        <Skeleton className="ml-auto h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-1.5 w-28" />
      </div>
    </div>
  );
}
