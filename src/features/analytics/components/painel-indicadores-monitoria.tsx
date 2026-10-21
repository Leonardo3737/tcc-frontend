'use client';

import { useQuery } from '@tanstack/react-query';

import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { EstadoErro } from '@/components/ui/estados';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  Tabela,
  TabelaCabecalho,
  TabelaCabecalhoCelula,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
} from '@/components/ui/tabela';
import {
  BarrasPorStatus,
  CORES_STATUS_ATENDIMENTO,
  FaixaIndicadores,
  Indicador,
  SkeletonFaixaIndicadores,
} from '@/components/comum/indicador';
import { formatarDuracaoEmMinutos } from '@/lib/datas/fuso';
import { buscarAtividadeMonitores, buscarIndicadoresMonitoria } from '../api/analytics.service';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { chaves } from '@/lib/query/chaves';

/**
 * Indicadores da monitoria.
 *
 * Todos os numeros vem prontos de `/analytics/monitorias/:id` — a taxa de
 * participacao, por exemplo, e calculada no SQL como
 * "alunos atendidos / monitorados ativos". Recalcular aqui abriria espaco para
 * a UI e o backend discordarem sobre o que a metrica significa.
 *
 * A tabela por monitor e restrita ao professor responsavel: e desempenho
 * individual, nao um placar para os colegas.
 */
export function PainelIndicadoresMonitoria() {
  const { monitoria, capacidades } = useContextoMonitoria();

  const indicadores = useQuery({
    queryKey: chaves.monitorias.indicadores(monitoria.id),
    queryFn: () => buscarIndicadoresMonitoria(monitoria.id),
  });

  const monitores = useQuery({
    queryKey: chaves.monitorias.desempenhoMonitores(monitoria.id),
    queryFn: () => buscarAtividadeMonitores(monitoria.id),
    enabled: capacidades.verDesempenhoMonitores,
  });

  if (indicadores.isPending) {
    return <SkeletonFaixaIndicadores />;
  }

  if (indicadores.isError) {
    return (
      <EstadoErro erro={indicadores.error} aoTentarNovamente={() => void indicadores.refetch()} />
    );
  }

  const dados = indicadores.data;

  return (
    <div className="space-y-4">
      <FaixaIndicadores>
        <Indicador rotulo="Atendimentos" valor={dados.atendimentos.total} />
        <Indicador
          rotulo="Monitores ativos"
          valor={dados.monitoresAtivos}
          detalhe={`${dados.monitoradosAtivos} monitorados ativos`}
        />
        <Indicador
          rotulo="Alunos atendidos"
          valor={dados.alunosAtendidos}
          detalhe={`Taxa de participação: ${Math.round(dados.taxaParticipacao * 100)}%`}
        />
        <Indicador
          rotulo="Média das avaliações"
          valor={dados.mediaAvaliacoes?.toFixed(1) ?? '—'}
          detalhe={`${dados.totalAvaliacoes} avaliação(ões)`}
        />
      </FaixaIndicadores>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardCabecalho titulo="Atendimentos por situação" />
          <CardConteudo>
            <BarrasPorStatus
              porStatus={dados.atendimentos.porStatus}
              total={dados.atendimentos.total}
              cores={CORES_STATUS_ATENDIMENTO}
            />
          </CardConteudo>
        </Card>

        <Card>
          <CardCabecalho titulo="Outros números" />
          <CardConteudo>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-texto-suave">Ausências registradas</dt>
                <dd className="font-medium text-texto">{dados.ausencias}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-texto-suave">Materiais publicados</dt>
                <dd className="font-medium text-texto">{dados.materiaisPublicados}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-texto-suave">Período</dt>
                <dd className="font-medium text-texto">{dados.periodo}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-texto-suave">
              A taxa de participação compara monitorados que compareceram com o total de monitorados
              ativos.
            </p>
          </CardConteudo>
        </Card>
      </div>

      {capacidades.verDesempenhoMonitores && (
        <Card>
          <CardCabecalho
            titulo="Atividade por monitor"
            descricao="Visível apenas para o professor responsável."
          />

          {monitores.isPending && (
            <CardConteudo>
              <SkeletonCard />
            </CardConteudo>
          )}

          {monitores.isSuccess && monitores.data.length === 0 && (
            <CardConteudo>
              <p className="text-sm text-texto-suave">Nenhum monitor habilitado ainda.</p>
            </CardConteudo>
          )}

          {monitores.isSuccess && monitores.data.length > 0 && (
            <>
              <div className="hidden md:block">
                <Tabela>
                  <TabelaCabecalho>
                    <TabelaLinha>
                      <TabelaCabecalhoCelula>Monitor</TabelaCabecalhoCelula>
                      <TabelaCabecalhoCelula>Realizados</TabelaCabecalhoCelula>
                      {/* Ao lado de "Realizados": é a mesma pergunta, em tempo. */}
                      <TabelaCabecalhoCelula>Carga horária</TabelaCabecalhoCelula>
                      <TabelaCabecalhoCelula>Agendados</TabelaCabecalhoCelula>
                      <TabelaCabecalhoCelula>Cancelados</TabelaCabecalhoCelula>
                      <TabelaCabecalhoCelula>Alunos</TabelaCabecalhoCelula>
                      <TabelaCabecalhoCelula>Média</TabelaCabecalhoCelula>
                      <TabelaCabecalhoCelula>Horários</TabelaCabecalhoCelula>
                    </TabelaLinha>
                  </TabelaCabecalho>

                  <TabelaCorpo>
                    {monitores.data.map((monitor) => (
                      <TabelaLinha key={monitor.participanteId}>
                        <TabelaCelula className="font-medium">{monitor.nome}</TabelaCelula>
                        <TabelaCelula>{monitor.atendimentosRealizados}</TabelaCelula>
                        <TabelaCelula className="tabular-nums">
                          {formatarDuracaoEmMinutos(monitor.cargaHorariaMinutos)}
                        </TabelaCelula>
                        <TabelaCelula>{monitor.atendimentosAgendados}</TabelaCelula>
                        <TabelaCelula>{monitor.atendimentosCancelados}</TabelaCelula>
                        <TabelaCelula>{monitor.alunosAtendidos}</TabelaCelula>
                        <TabelaCelula>
                          {monitor.mediaAvaliacoes?.toFixed(1) ?? '—'}
                          <span className="ml-1 text-xs text-texto-suave">
                            ({monitor.totalAvaliacoes})
                          </span>
                        </TabelaCelula>
                        <TabelaCelula>{monitor.disponibilidadesAtivas}</TabelaCelula>
                      </TabelaLinha>
                    ))}
                  </TabelaCorpo>
                </Tabela>
              </div>

              {/* Oito colunas não cabem em 375px: no mobile vira cartão. */}
              <ul className="divide-y divide-borda md:hidden">
                {monitores.data.map((monitor) => (
                  <li key={monitor.participanteId} className="space-y-2 p-4">
                    <p className="font-medium text-texto">{monitor.nome}</p>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-texto-suave">Realizados</dt>
                        <dd className="text-texto">{monitor.atendimentosRealizados}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-texto-suave">Carga horária</dt>
                        <dd className="tabular-nums text-texto">
                          {formatarDuracaoEmMinutos(monitor.cargaHorariaMinutos)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-texto-suave">Agendados</dt>
                        <dd className="text-texto">{monitor.atendimentosAgendados}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-texto-suave">Alunos</dt>
                        <dd className="text-texto">{monitor.alunosAtendidos}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-texto-suave">Média</dt>
                        <dd className="text-texto">{monitor.mediaAvaliacoes?.toFixed(1) ?? '—'}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
