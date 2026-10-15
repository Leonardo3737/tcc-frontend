'use client';

import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { CartaoAtendimento, SkeletonCartaoAtendimento } from './cartao-atendimento';
import { agruparPorDia, dataCurta, diasDeCalendario, rotuloDia } from '@/lib/datas/relativa';
import { cn } from '@/lib/utils';
import type { Atendimento } from '@/types/dominio';

/**
 * Lista de atendimentos organizada por DIA.
 *
 * Cada dia e uma secao com cabecalho proprio ("Hoje", "Amanha", "Sexta, 17 de
 * outubro") e os atendimentos daquele dia em coluna unica, na ordem de
 * horario. Agenda se le de cima para baixo; a grade de duas colunas anterior
 * obrigava a ziguezaguear para seguir a sequencia do dia.
 *
 * O cabecalho fica preso no topo ao rolar (`sticky`): num dia cheio, a pessoa
 * nao perde de vista de qual dia sao os horarios que esta lendo.
 *
 * A ordem e a do servidor (asc em "proximos", desc no historico) e nao e
 * refeita aqui — ver `agruparPorDia`.
 */
export function AgendaPorDia({
  atendimentos,
  fuso,
  mostrarMonitoria = true,
}: {
  atendimentos: Atendimento[];
  fuso: string;
  mostrarMonitoria?: boolean;
}) {
  const grupos = useMemo(() => agruparPorDia(atendimentos, fuso), [atendimentos, fuso]);
  const agora = new Date();

  return (
    <div className="space-y-6">
      {grupos.map(({ chave, itens }) => {
        const primeiro = itens[0]!.inicio;
        const rotulo = rotuloDia(primeiro, agora, fuso);
        const distancia = diasDeCalendario(primeiro, agora, fuso);
        const ehHoje = distancia === 0;
        const relativo = Math.abs(distancia) <= 1;
        const idTitulo = `dia-${chave}`;

        return (
          <section key={chave} aria-labelledby={idTitulo}>
            <div
              className={cn(
                // top-14: abaixo da barra superior do celular; no desktop ela nao existe.
                'sticky top-14 z-10 -mx-1 mb-2 flex items-baseline gap-2 bg-fundo px-1 py-2 lg:top-0',
                distancia < 0 && 'text-texto-suave',
              )}
            >
              {ehHoje && (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 -translate-y-0.5 self-center rounded-full bg-acento"
                />
              )}
              <h2
                id={idTitulo}
                className={cn(
                  'font-titulo text-titulo-secao',
                  distancia < 0 ? 'text-texto-suave' : 'text-texto',
                )}
              >
                {rotulo}
              </h2>
              {/* "Hoje" sozinho nao diz a data; o complemento diz. */}
              {relativo && (
                <span className="text-sm text-texto-suave">{dataCurta(primeiro, fuso)}</span>
              )}
              <span className="ml-auto text-xs tabular-nums text-texto-suave">
                {itens.length} {itens.length === 1 ? 'atendimento' : 'atendimentos'}
              </span>
            </div>

            <ul className="space-y-2">
              {itens.map((atendimento) => (
                <li key={atendimento.id}>
                  <CartaoAtendimento
                    atendimento={atendimento}
                    fuso={fuso}
                    mostrarMonitoria={mostrarMonitoria}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Mesma forma da agenda: cabecalho de dia e linhas de atendimento. */
export function SkeletonAgendaPorDia() {
  return (
    <div role="status" aria-busy aria-label="Carregando atendimentos" className="space-y-6">
      {[2, 1].map((linhas, indice) => (
        <div key={indice}>
          <div className="mb-2 flex items-baseline gap-2 py-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: linhas }).map((_, linha) => (
              <SkeletonCartaoAtendimento key={linha} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
