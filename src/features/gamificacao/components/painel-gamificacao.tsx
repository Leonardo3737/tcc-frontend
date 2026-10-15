'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, CalendarCheck, Medal, Star, Trophy, UserCheck } from 'lucide-react';

import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { Skeleton } from '@/components/ui/skeleton';
import { DataRelativa } from '@/components/comum/data-relativa';
import {
  buscarMeusPontos,
  buscarRanking,
  buscarRegrasDePontuacao,
} from '../api/gamificacao.service';
import { useSessao } from '@/providers/sessao-provider';
import { chaves } from '@/lib/query/chaves';
import { cn, iniciais } from '@/lib/utils';
import { TipoPontuacao, type PosicaoRanking, type ResumoPontuacao } from '@/types/dominio';

const LIMITE_RANKING = 20;

/**
 * Rotulo e icone de cada tipo de evento.
 *
 * Os NUMEROS nao estao aqui: eles vem de `GET /gamificacao/regras` (B2).
 * Escrever "10 pontos" nesta constante criaria uma segunda fonte de verdade que
 * passaria a mentir no primeiro rebalanceamento. A descricao tambem vem do
 * servidor; o texto abaixo e so o complemento de leitura da tela.
 */
const TIPOS: Record<
  string,
  { rotulo: string; descricao: string; icone: typeof CalendarCheck; quem: string }
> = {
  [TipoPontuacao.ATENDIMENTO_REALIZADO]: {
    rotulo: 'Atendimento conduzido',
    descricao: 'Você conduziu uma sessão até o fim, como monitor.',
    icone: CalendarCheck,
    quem: 'monitor',
  },
  [TipoPontuacao.PARTICIPACAO_ATENDIMENTO]: {
    rotulo: 'Participação em atendimento',
    descricao: 'Você compareceu a uma sessão em que estava inscrito.',
    icone: UserCheck,
    quem: 'monitorado',
  },
  [TipoPontuacao.AVALIACAO_RECEBIDA]: {
    rotulo: 'Avaliação recebida',
    descricao: 'Um monitorado avaliou o seu atendimento.',
    icone: Star,
    quem: 'monitor',
  },
};

/**
 * Ranking e extrato pessoal.
 *
 * So existe o que a API oferece: pontos por evento e posicao no ranking. Badges,
 * niveis e conquistas NAO existem no backend e nao sao simulados aqui — invento
 * na interface vira promessa que o servidor nao sustenta.
 *
 * O que a tela ACRESCENTA e leitura: hierarquia para o topo, proporcao entre as
 * pontuacoes e a explicacao de onde os pontos vem. Nenhum dado novo e buscado.
 */
export function PainelGamificacao() {
  const { usuario, ehAluno } = useSessao();

  const ranking = useQuery({
    queryKey: chaves.gamificacao.ranking({ limite: LIMITE_RANKING }),
    queryFn: () => buscarRanking({ limite: LIMITE_RANKING }),
  });

  const meusPontos = useQuery({
    queryKey: chaves.gamificacao.meusPontos({}),
    queryFn: () => buscarMeusPontos(),
    enabled: ehAluno,
  });

  const minhaPosicao = ranking.data?.find((posicao) => posicao.usuarioId === usuario.id);

  // Serve de escala para as barras: tudo e relativo a quem lidera.
  const pontuacaoLider = ranking.data?.[0]?.pontos ?? 0;

  const podio = ranking.data?.slice(0, 3) ?? [];
  // O podio so faz sentido com os tres lugares ocupados; com menos, a lista basta.
  const temPodio = podio.length === 3;
  const demais = ranking.data?.slice(temPodio ? 3 : 0) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardCabecalho
            titulo="Classificação geral"
            descricao="Soma de pontos em todas as monitorias."
            acao={
              ranking.isSuccess && ranking.data.length > 0 ? (
                <Badge tom="neutro">
                  {ranking.data.length === LIMITE_RANKING
                    ? `${LIMITE_RANKING} primeiros`
                    : `${ranking.data.length} classificados`}
                </Badge>
              ) : undefined
            }
          />

          {ranking.isPending && <EsqueletoRanking />}

          {ranking.isError && (
            <CardConteudo>
              <EstadoErro erro={ranking.error} aoTentarNovamente={() => void ranking.refetch()} />
            </CardConteudo>
          )}

          {ranking.isSuccess && ranking.data.length === 0 && (
            <CardConteudo>
              <EstadoVazio
                icone={<Trophy className="h-8 w-8" aria-hidden />}
                titulo="Ainda não há pontuação"
                descricao="O ranking começa a se formar quando os primeiros atendimentos forem realizados e avaliados."
              />
            </CardConteudo>
          )}

          {ranking.isSuccess && ranking.data.length > 0 && (
            <>
              {temPodio && <Podio posicoes={podio} usuarioId={usuario.id} />}

              {demais.length > 0 && (
                <ul className="divide-y divide-borda">
                  {demais.map((posicao) => (
                    <LinhaRanking
                      key={posicao.usuarioId}
                      posicao={posicao}
                      souEu={posicao.usuarioId === usuario.id}
                      pontuacaoLider={pontuacaoLider}
                    />
                  ))}
                </ul>
              )}

              {/*
                Quem nao aparece no recorte fica sem referencia nenhuma. Dizer
                isso e melhor do que deixar a pessoa procurando o proprio nome.
              */}
              {ehAluno && !minhaPosicao && (
                <p className="border-t border-borda px-4 py-3 text-xs text-texto-suave sm:px-5">
                  Você ainda não aparece entre os {LIMITE_RANKING} primeiros.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        {ehAluno && (
          <CartaoMeusPontos
            consulta={meusPontos}
            posicao={minhaPosicao}
            pontuacaoLider={pontuacaoLider}
          />
        )}

        <CartaoComoFunciona ehAluno={ehAluno} />

        {ehAluno && meusPontos.isSuccess && meusPontos.data.ultimosEventos.length > 0 && (
          <CartaoUltimosEventos resumo={meusPontos.data} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Podio
// ---------------------------------------------------------------------------

/**
 * Estilo por colocacao.
 *
 * Ouro, prata e bronze saem dos tokens que ja existem (`alerta-preenchimento`,
 * `neutro`, `acento`) — nenhuma cor nova entra na paleta por causa desta tela.
 * A cor nunca aparece sozinha: o numero da posicao esta sempre escrito.
 */
const MEDALHAS = [
  { anel: 'ring-alerta-preenchimento', pastilha: 'bg-alerta-preenchimento text-texto', barra: 'bg-alerta-preenchimento' },
  { anel: 'ring-neutro', pastilha: 'bg-neutro text-white', barra: 'bg-neutro' },
  { anel: 'ring-acento', pastilha: 'bg-acento text-white', barra: 'bg-acento' },
] as const;

function Podio({ posicoes, usuarioId }: { posicoes: PosicaoRanking[]; usuarioId: string }) {
  const [primeiro, segundo, terceiro] = posicoes;

  if (!primeiro || !segundo || !terceiro) return null;

  // Ordem visual de podio: 2º à esquerda, 1º ao centro (mais alto), 3º à direita.
  const ordenados = [
    { dado: segundo, indice: 1, altura: 'lg:pt-6' },
    { dado: primeiro, indice: 0, altura: '' },
    { dado: terceiro, indice: 2, altura: 'lg:pt-8' },
  ];

  return (
    <div className="border-b border-borda bg-fundo-suave/60 px-3 py-5 sm:px-5">
      <ul className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {ordenados.map(({ dado, indice, altura }) => {
          const medalha = MEDALHAS[indice]!;
          const souEu = dado.usuarioId === usuarioId;
          const lider = indice === 0;

          return (
            <li key={dado.usuarioId} className={cn('flex flex-col items-center text-center', altura)}>
              <span
                className={cn(
                  'relative flex shrink-0 items-center justify-center rounded-full bg-superficie font-semibold text-texto ring-2',
                  medalha.anel,
                  lider ? 'h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg' : 'h-11 w-11 text-sm sm:h-12 sm:w-12',
                )}
                aria-hidden
              >
                {iniciais(dado.nome)}

                <span
                  className={cn(
                    'absolute -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-fundo-suave',
                    medalha.pastilha,
                  )}
                >
                  {dado.posicao}
                </span>
              </span>

              <span className="mt-3 w-full">
                {/* O numero da posicao tambem vai no texto: a medalha e reforco, nao a informacao. */}
                <span className="sr-only">{dado.posicao}º lugar: </span>
                <span
                  className={cn(
                    'block truncate text-sm font-semibold text-texto',
                    lider && 'sm:text-base',
                  )}
                  title={dado.nome}
                >
                  {dado.nome}
                </span>

                {souEu && <span className="text-xs font-medium text-primaria">você</span>}

                <span className="mt-0.5 block font-titulo text-titulo-cartao text-texto">
                  {dado.pontos}
                  <span className="ml-1 text-xs font-normal text-texto-suave">pts</span>
                </span>

                <span className="block text-xs text-texto-suave">
                  {dado.eventos} {dado.eventos === 1 ? 'evento' : 'eventos'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

function LinhaRanking({
  posicao,
  souEu,
  pontuacaoLider,
}: {
  posicao: PosicaoRanking;
  souEu: boolean;
  pontuacaoLider: number;
}) {
  const proporcao = pontuacaoLider > 0 ? Math.round((posicao.pontos / pontuacaoLider) * 100) : 0;

  return (
    <li
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 sm:px-5',
        // Faixa lateral em vez de fundo chapado: destaca sem apagar a leitura
        // das colunas, e segue o padrao de destaque dos cartoes.
        souEu &&
          "bg-primaria-suave/50 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primaria before:content-['']",
      )}
    >
      <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-texto-suave">
        {posicao.posicao}
      </span>

      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fundo-suave text-xs font-semibold text-texto-suave"
      >
        {iniciais(posicao.nome)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-texto">
          {posicao.nome}
          {souEu && <span className="ml-1.5 text-xs font-semibold text-primaria">você</span>}
        </span>

        <span className="mt-1 flex items-center gap-2">
          {/*
            A barra da a escala que o numero sozinho nao da: "14 pts" nao diz
            se esta perto ou longe de quem lidera. Ela e decorativa — o valor
            exato esta escrito ao lado.
          */}
          <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-fundo-suave sm:w-28">
            <span
              className={cn('block h-full rounded-full', souEu ? 'bg-primaria' : 'bg-primaria/40')}
              style={{ width: `${proporcao}%` }}
            />
          </span>

          <span className="text-xs text-texto-suave">
            {posicao.eventos} {posicao.eventos === 1 ? 'evento' : 'eventos'}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums text-texto">{posicao.pontos}</span>
        <span className="block text-xs text-texto-suave">pts</span>
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Coluna lateral
// ---------------------------------------------------------------------------

function CartaoMeusPontos({
  consulta,
  posicao,
  pontuacaoLider,
}: {
  consulta: ReturnType<typeof useQuery<ResumoPontuacao>>;
  posicao?: PosicaoRanking;
  pontuacaoLider: number;
}) {
  return (
    <Card faixa={posicao ? 'before:bg-primaria' : undefined}>
      <CardCabecalho titulo="Meus pontos" />

      {consulta.isPending && (
        <CardConteudo className="space-y-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
        </CardConteudo>
      )}

      {consulta.isError && (
        <CardConteudo>
          <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
        </CardConteudo>
      )}

      {consulta.isSuccess && (
        <CardConteudo className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <p className="flex items-baseline gap-1.5">
              <span className="font-titulo text-destaque tabular-nums text-texto">
                {consulta.data.total}
              </span>
              <span className="text-sm text-texto-suave">pontos</span>
            </p>

            {posicao && (
              <Badge tom="primaria">
                <Medal className="h-3.5 w-3.5" aria-hidden />
                {posicao.posicao}º lugar
              </Badge>
            )}
          </div>

          {consulta.data.total === 0 ? (
            <p className="text-sm text-texto-suave">
              Você ainda não pontuou. Os pontos chegam quando você conduz um atendimento,
              comparece a um em que se inscreveu, ou recebe uma avaliação como monitor.
            </p>
          ) : (
            <>
              {/*
                Distancia ate o topo — so quando ha topo e ele nao e o proprio
                usuario. Da um objetivo concreto sem inventar meta nenhuma.
              */}
              {posicao && posicao.posicao > 1 && pontuacaoLider > consulta.data.total && (
                <p className="text-xs text-texto-suave">
                  <strong className="font-semibold text-texto">
                    {pontuacaoLider - consulta.data.total} ponto
                    {pontuacaoLider - consulta.data.total === 1 ? '' : 's'}
                  </strong>{' '}
                  até a liderança.
                </p>
              )}

              <DivisaoPorTipo porTipo={consulta.data.porTipo} total={consulta.data.total} />
            </>
          )}
        </CardConteudo>
      )}
    </Card>
  );
}

/** De onde vieram os pontos, com a proporcao de cada origem. */
function DivisaoPorTipo({
  porTipo,
  total,
}: {
  porTipo: Record<string, number>;
  total: number;
}) {
  const entradas = Object.entries(porTipo).sort(([, a], [, b]) => b - a);

  if (entradas.length === 0) return null;

  return (
    <dl className="space-y-2.5 border-t border-borda pt-3">
      {entradas.map(([tipo, pontos]) => {
        const info = TIPOS[tipo];
        const Icone = info?.icone ?? Award;
        const proporcao = total > 0 ? Math.round((pontos / total) * 100) : 0;

        return (
          <div key={tipo} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <dt className="flex min-w-0 items-center gap-1.5 text-texto-suave">
                <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{info?.rotulo ?? tipo}</span>
              </dt>
              <dd className="shrink-0 font-semibold tabular-nums text-texto">{pontos}</dd>
            </div>

            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-fundo-suave">
              <div className="h-full rounded-full bg-primaria/50" style={{ width: `${proporcao}%` }} />
            </div>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * De onde vem a pontuacao.
 *
 * Preenche a coluna lateral com algo util em vez de espaco vazio — e responde a
 * pergunta que o ranking sempre levanta: "como eu pontuo?". Para o professor,
 * que nao entra no ranking, este cartao e o que explica a ausencia.
 */
function CartaoComoFunciona({ ehAluno }: { ehAluno: boolean }) {
  /**
   * B2 — a tabela de pontos vem do servidor.
   *
   * Antes deste endpoint o cartão explicava que existem pontos sem poder dizer
   * quanto cada coisa vale, o que é justamente a pergunta que o ranking levanta.
   * Enquanto a consulta não responde, a lista aparece sem os valores — é a
   * mesma tela de antes, não um estado quebrado.
   */
  const regras = useQuery({
    queryKey: chaves.gamificacao.regras,
    queryFn: buscarRegrasDePontuacao,
    // Muda só em deploy: não faz sentido revalidar a cada foco de janela.
    staleTime: 60 * 60 * 1000,
  });

  const pontosPorTipo = new Map(
    (regras.data?.regras ?? []).map((regra) => [regra.tipo as string, regra]),
  );

  return (
    <Card>
      <CardCabecalho titulo="Como os pontos funcionam" />
      <CardConteudo className="space-y-3">
        <ul className="space-y-3">
          {Object.entries(TIPOS).map(([tipo, info]) => {
            const Icone = info.icone;
            const regra = pontosPorTipo.get(tipo);

            return (
              <li key={tipo} className="flex gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria">
                  <Icone className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-texto">{info.rotulo}</span>

                    {/*
                      `pontos: null` significa VARIÁVEL, não zero — avaliação
                      recebida vale a própria nota. Exibir "0 pontos" aqui
                      anunciaria o oposto do que acontece.
                    */}
                    {regra && (
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-primaria">
                        {regra.pontos === null ? '1 a 5 pts' : `+${regra.pontos} pts`}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-texto-suave">
                    {regra?.descricao ?? info.descricao}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {!ehAluno && (
          <Alert tom="info">
            O ranking é dos <strong>alunos</strong>: os pontos vêm de atuar como monitor ou de
            participar como monitorado. Professores acompanham a monitoria pelos indicadores.
          </Alert>
        )}
      </CardConteudo>
    </Card>
  );
}

function CartaoUltimosEventos({ resumo }: { resumo: ResumoPontuacao }) {
  return (
    <Card>
      <CardCabecalho titulo="Últimos eventos" descricao="Onde cada ponto foi ganho." />
      <CardConteudo>
        <ul className="space-y-3">
          {resumo.ultimosEventos.map((evento) => {
            const info = TIPOS[evento.tipo];
            const Icone = info?.icone ?? Award;

            return (
              <li
                key={`${evento.referenciaId}-${evento.tipo}`}
                className="flex items-start gap-2.5 text-sm"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fundo-suave text-texto-suave">
                  <Icone className="h-3 w-3" aria-hidden />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-texto">{info?.rotulo ?? evento.tipo}</span>
                  <DataRelativa
                    instante={evento.criadoEm}
                    className="block text-xs text-texto-suave"
                  />
                </span>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-sucesso">
                  +{evento.pontos}
                </span>
              </li>
            );
          })}
        </ul>
      </CardConteudo>
    </Card>
  );
}

/** Esqueleto com a forma da lista — podio no topo e linhas abaixo. */
function EsqueletoRanking() {
  return (
    <div role="status" aria-busy aria-label="Carregando classificação">
      <div className="flex items-end justify-center gap-4 border-b border-borda bg-fundo-suave/60 px-5 py-5">
        {[11, 14, 11].map((tamanho, indice) => (
          <div key={indice} className="flex flex-col items-center gap-2">
            <Skeleton className={cn('rounded-full', tamanho === 14 ? 'h-14 w-14' : 'h-11 w-11')} />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>

      <ul className="divide-y divide-borda">
        {[0, 1, 2, 3].map((indice) => (
          <li key={indice} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-1.5 w-28" />
            </div>
            <Skeleton className="h-4 w-10" />
          </li>
        ))}
      </ul>
    </div>
  );
}
