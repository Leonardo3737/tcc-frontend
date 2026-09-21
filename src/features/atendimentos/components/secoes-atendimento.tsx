'use client';

import { useQuery } from '@tanstack/react-query';
import { History, Star } from 'lucide-react';

import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { BadgeStatusInscricao } from '@/components/ui/badge';
import { listarAvaliacoesDoAtendimento } from '@/features/avaliacoes/api/avaliacoes.service';
import { chaves } from '@/lib/query/chaves';
import { formatarDataHora } from '@/lib/datas/fuso';
import { iniciais } from '@/lib/utils';
import type { Atendimento } from '@/types/dominio';

/**
 * Blocos de LEITURA do detalhe do atendimento.
 *
 * Separados do detalhe porque nao participam de nenhuma acao: exibem inscritos,
 * historico e avaliacoes. Manter tudo num arquivo so fazia o componente
 * principal passar de 700 linhas, e o fluxo de acoes — que e o que importa
 * entender ali — se perdia no meio da renderizacao de listas.
 */

export function ListaInscricoes({ atendimento, fuso }: { atendimento: Atendimento; fuso: string }) {
  const inscricoes = atendimento.inscricoes ?? [];

  return (
    <Card>
      <CardCabecalho
        titulo="Inscritos"
        descricao={
          atendimento.vagas > 1
            ? `${atendimento.vagasOcupadas} de ${atendimento.vagas} vagas ocupadas`
            : 'Atendimento individual'
        }
      />
      <CardConteudo>
        {inscricoes.length === 0 ? (
          <p className="text-sm text-texto-suave">
            Ninguém inscrito ainda.
            {atendimento.aceitaInscricao && ' A sessão está aberta para inscrições.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {inscricoes.map((inscricao) => (
              <li
                key={inscricao.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-borda p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primaria-suave text-xs font-semibold text-primaria"
                  >
                    {iniciais(inscricao.nomeAluno ?? '?')}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm text-texto">
                      {inscricao.nomeAluno ?? 'Monitorado'}
                      {inscricao.souEu && (
                        <span className="ml-1.5 text-xs text-texto-suave">(você)</span>
                      )}
                    </p>
                    <p className="text-xs text-texto-suave">
                      Inscrito em {formatarDataHora(inscricao.inscritoEm, fuso)}
                    </p>
                  </div>
                </div>

                <BadgeStatusInscricao status={inscricao.status} />
              </li>
            ))}
          </ul>
        )}
      </CardConteudo>
    </Card>
  );
}

/** Trilha de eventos do atendimento — inclui reagendamentos (RN10). */
export function HistoricoAtendimento({
  atendimento,
  fuso,
}: {
  atendimento: Atendimento;
  fuso: string;
}) {
  const historico = atendimento.historico ?? [];

  if (historico.length === 0) return null;

  return (
    <Card>
      <CardCabecalho titulo="Histórico" descricao="Trilha completa de eventos (RN10)." />
      <CardConteudo>
        <ol className="space-y-3">
          {historico.map((evento, indice) => (
            <li key={`${evento.criadoEm}-${indice}`} className="flex gap-3 text-sm">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-texto-suave" aria-hidden />
              <div className="min-w-0">
                <p className="text-texto">
                  {evento.statusAnterior
                    ? evento.statusAnterior === evento.statusNovo
                      ? // Mesmo status = reagendamento. O CHECK do banco exige
                        // motivo justamente nesse caso, então ele sempre existe.
                        'Reagendado'
                      : `${evento.statusAnterior} → ${evento.statusNovo}`
                    : `Criado como ${evento.statusNovo}`}
                </p>
                {evento.motivo && <p className="text-xs text-texto-suave">{evento.motivo}</p>}
                <p className="text-xs text-texto-suave/80">
                  {evento.alteradoPorNome ?? 'Usuário'} · {formatarDataHora(evento.criadoEm, fuso)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardConteudo>
    </Card>
  );
}

/**
 * Avaliacoes do atendimento, com media.
 *
 * A autoria NAO trafega na API (decisao D-10 do backend): o monitor ve a nota
 * para melhorar, sem saber quem a deu. A UI reforça isso por escrito, para que
 * ninguem tente inferir autoria pela ordem da lista.
 */
export function Avaliacoes({ atendimentoId }: { atendimentoId: string }) {
  const consulta = useQuery({
    queryKey: chaves.atendimentos.avaliacoes(atendimentoId),
    queryFn: () => listarAvaliacoesDoAtendimento(atendimentoId),
    // O backend responde 404 quando o atendimento ainda não tem inscrições —
    // não é falha de verdade, e repetir não mudaria nada.
    retry: false,
  });

  if (consulta.isError || !consulta.data || consulta.data.total === 0) return null;

  return (
    <Card>
      <CardCabecalho
        titulo="Avaliações"
        descricao={`${consulta.data.total} avaliação(ões) · média ${
          consulta.data.media?.toFixed(1) ?? '—'
        }`}
      />
      <CardConteudo>
        <ul className="space-y-3">
          {consulta.data.avaliacoes.map((avaliacao) => (
            <li key={avaliacao.id} className="rounded-lg border border-borda p-3">
              <div className="flex items-center gap-1" aria-label={`Nota ${avaliacao.nota} de 5`}>
                {[1, 2, 3, 4, 5].map((valor) => (
                  <Star
                    key={valor}
                    className={
                      valor <= avaliacao.nota
                        ? 'h-3.5 w-3.5 fill-alerta text-alerta'
                        : 'h-3.5 w-3.5 text-borda'
                    }
                    aria-hidden
                  />
                ))}
              </div>

              {avaliacao.comentario && (
                <p className="mt-2 text-sm text-texto">{avaliacao.comentario}</p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-texto-suave">As avaliações são anônimas para o monitor.</p>
      </CardConteudo>
    </Card>
  );
}
