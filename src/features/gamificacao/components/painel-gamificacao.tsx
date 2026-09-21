'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, Trophy } from 'lucide-react';

import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonCard } from '@/components/ui/skeleton';
import { buscarMeusPontos, buscarRanking } from '../api/gamificacao.service';
import { useSessao } from '@/providers/sessao-provider';
import { chaves } from '@/lib/query/chaves';
import { formatarDataHora } from '@/lib/datas/fuso';
import { cn } from '@/lib/utils';
import { TipoPontuacao } from '@/types/dominio';

const ROTULO_TIPO: Record<string, string> = {
  [TipoPontuacao.ATENDIMENTO_REALIZADO]: 'Atendimento conduzido',
  [TipoPontuacao.PARTICIPACAO_ATENDIMENTO]: 'Participação em atendimento',
  [TipoPontuacao.AVALIACAO_RECEBIDA]: 'Avaliação recebida',
};

/**
 * Ranking e extrato pessoal.
 *
 * Só existe o que a API oferece: pontos por evento e posição no ranking.
 * Badges, níveis e conquistas NÃO existem no backend e não são simulados aqui —
 * inventá-los criaria uma promessa que o servidor não sustenta.
 */
export function PainelGamificacao() {
  const { usuario, fuso, ehAluno } = useSessao();

  const ranking = useQuery({
    queryKey: chaves.gamificacao.ranking({ limite: 20 }),
    queryFn: () => buscarRanking({ limite: 20 }),
  });

  const meusPontos = useQuery({
    queryKey: chaves.gamificacao.meusPontos({}),
    queryFn: () => buscarMeusPontos(),
    enabled: ehAluno,
  });

  const minhaPosicao = ranking.data?.find((posicao) => posicao.usuarioId === usuario.id);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardCabecalho
            titulo="Ranking"
            descricao="Pontuação acumulada em todas as monitorias."
          />

          {ranking.isPending && (
            <CardConteudo>
              <SkeletonCard />
            </CardConteudo>
          )}

          {ranking.isError && (
            <CardConteudo>
              <EstadoErro erro={ranking.error} aoTentarNovamente={() => void ranking.refetch()} />
            </CardConteudo>
          )}

          {ranking.isSuccess && ranking.data.length === 0 && (
            <CardConteudo>
              <EstadoVazio
                icone={<Trophy className="h-8 w-8" aria-hidden />}
                titulo="Ranking vazio"
                descricao="Os pontos aparecem depois que atendimentos forem realizados e avaliados."
              />
            </CardConteudo>
          )}

          {ranking.isSuccess && ranking.data.length > 0 && (
            <ul className="divide-y divide-borda">
              {ranking.data.map((posicao) => {
                const souEu = posicao.usuarioId === usuario.id;

                return (
                  <li
                    key={posicao.usuarioId}
                    className={cn(
                      'flex items-center gap-3 p-3 sm:px-5',
                      souEu && 'bg-primaria-suave',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        posicao.posicao <= 3
                          ? 'bg-alerta/15 text-alerta'
                          : 'bg-fundo text-texto-suave',
                      )}
                      aria-label={`Posição ${posicao.posicao}`}
                    >
                      {posicao.posicao}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-texto">
                        {posicao.nome}
                        {souEu && <span className="ml-1.5 text-xs text-primaria">(você)</span>}
                      </span>
                      <span className="block text-xs text-texto-suave">
                        {posicao.eventos} {posicao.eventos === 1 ? 'evento' : 'eventos'}
                      </span>
                    </span>

                    <span className="shrink-0 text-sm font-semibold text-texto">
                      {posicao.pontos} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        {ehAluno && (
          <Card>
            <CardCabecalho titulo="Meus pontos" />

            {meusPontos.isPending && (
              <CardConteudo>
                <SkeletonCard />
              </CardConteudo>
            )}

            {meusPontos.isSuccess && (
              <CardConteudo className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-texto">{meusPontos.data.total}</span>
                  <span className="text-sm text-texto-suave">pontos</span>
                </div>

                {minhaPosicao && (
                  <Badge tom="primaria">{minhaPosicao.posicao}º no ranking geral</Badge>
                )}

                {Object.keys(meusPontos.data.porTipo).length > 0 && (
                  <dl className="space-y-1.5 border-t border-borda pt-3 text-sm">
                    {Object.entries(meusPontos.data.porTipo).map(([tipo, pontos]) => (
                      <div key={tipo} className="flex items-center justify-between gap-2">
                        <dt className="text-texto-suave">{ROTULO_TIPO[tipo] ?? tipo}</dt>
                        <dd className="font-medium text-texto">{pontos}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {meusPontos.data.total === 0 && (
                  <p className="text-sm text-texto-suave">
                    Você ainda não tem pontos. Eles vêm de atendimentos realizados, presença
                    confirmada e avaliações recebidas.
                  </p>
                )}
              </CardConteudo>
            )}
          </Card>
        )}

        {ehAluno && meusPontos.isSuccess && meusPontos.data.ultimosEventos.length > 0 && (
          <Card>
            <CardCabecalho titulo="Últimos eventos" />
            <CardConteudo>
              <ul className="space-y-2">
                {meusPontos.data.ultimosEventos.map((evento) => (
                  <li
                    key={`${evento.referenciaId}-${evento.tipo}`}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-alerta" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-texto">{ROTULO_TIPO[evento.tipo] ?? evento.tipo}</span>
                      <span className="block text-xs text-texto-suave">
                        {formatarDataHora(evento.criadoEm, fuso)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-texto">
                      +{evento.pontos}
                    </span>
                  </li>
                ))}
              </ul>
            </CardConteudo>
          </Card>
        )}
      </div>
    </div>
  );
}
