'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarCheck, GraduationCap, Plus, Star, UserCheck, Users } from 'lucide-react';

import { classesBotao } from '@/components/ui/button';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  BarrasPorStatus,
  CORES_STATUS_ATENDIMENTO,
  CORES_STATUS_MONITORIA,
  Indicador,
} from '@/components/comum/indicador';
import { CartaoMonitoria } from '@/features/monitorias/components/cartao-monitoria';
import { buscarIndicadoresPlataforma } from '@/features/analytics/api/analytics.service';
import { listarMinhasMonitorias } from '@/features/monitorias/api/monitorias.service';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';

/**
 * Dashboard do professor.
 *
 * Todos os numeros vem de `/analytics/resumo?apenasMinhas=true` — o recorte das
 * monitorias sob responsabilidade dele. Nenhuma metrica e calculada no cliente:
 * o que aparece aqui e exatamente o que o SQL do backend conta.
 */
export function DashboardProfessor() {
  const indicadores = useQuery({
    queryKey: chaves.analytics.resumo(true),
    queryFn: () => buscarIndicadoresPlataforma(true),
  });

  const monitorias = useQuery({
    queryKey: chaves.monitorias.minhas({ limite: 4 }),
    queryFn: () => listarMinhasMonitorias({ limite: 4 }),
  });

  return (
    <div className="space-y-6">
      <section aria-labelledby="titulo-indicadores" className="space-y-3">
        <h2 id="titulo-indicadores" className="text-sm font-medium text-texto-suave">
          Suas monitorias em números
        </h2>

        {indicadores.isPending && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((indice) => (
              <SkeletonCard key={indice} />
            ))}
          </div>
        )}

        {indicadores.isError && (
          <EstadoErro
            erro={indicadores.error}
            aoTentarNovamente={() => void indicadores.refetch()}
          />
        )}

        {indicadores.isSuccess && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Indicador
                rotulo="Monitorias"
                valor={indicadores.data.monitorias.total}
                icone={<GraduationCap className="h-4 w-4" aria-hidden />}
              />
              <Indicador
                rotulo="Atendimentos"
                valor={indicadores.data.atendimentos.total}
                icone={<CalendarCheck className="h-4 w-4" aria-hidden />}
              />
              <Indicador
                rotulo="Alunos atendidos"
                valor={indicadores.data.alunosAtendidos}
                detalhe="Com presença confirmada"
                icone={<UserCheck className="h-4 w-4" aria-hidden />}
              />
              <Indicador
                rotulo="Média das avaliações"
                valor={indicadores.data.mediaAvaliacoes?.toFixed(1) ?? '—'}
                detalhe={`${indicadores.data.totalAvaliacoes} avaliação(ões)`}
                icone={<Star className="h-4 w-4" aria-hidden />}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardCabecalho titulo="Monitorias por situação" />
                <CardConteudo>
                  <BarrasPorStatus
                    porStatus={indicadores.data.monitorias.porStatus}
                    total={indicadores.data.monitorias.total}
                    cores={CORES_STATUS_MONITORIA}
                  />
                </CardConteudo>
              </Card>

              <Card>
                <CardCabecalho titulo="Atendimentos por situação" />
                <CardConteudo>
                  <BarrasPorStatus
                    porStatus={indicadores.data.atendimentos.porStatus}
                    total={indicadores.data.atendimentos.total}
                    cores={CORES_STATUS_ATENDIMENTO}
                  />
                </CardConteudo>
              </Card>

              <Card>
                <CardCabecalho titulo="Participação" />
                <CardConteudo>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="inline-flex items-center gap-1.5 text-texto-suave">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        Monitores ativos
                      </dt>
                      <dd className="font-medium text-texto">
                        {indicadores.data.monitoresAtivos}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-texto-suave">Monitorados ativos</dt>
                      <dd className="font-medium text-texto">
                        {indicadores.data.monitoradosAtivos}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-texto-suave">Pontos distribuídos</dt>
                      <dd className="font-medium text-texto">
                        {indicadores.data.pontosDistribuidos}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-xs text-texto-suave">
                    Monitor e monitorado são vínculos por monitoria — a mesma pessoa pode
                    aparecer nos dois grupos, em ofertas diferentes.
                  </p>
                </CardConteudo>
              </Card>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="titulo-monitorias" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-monitorias" className="text-sm font-medium text-texto-suave">
            Monitorias em andamento
          </h2>

          <Link href={rotas.monitorias} className="text-sm text-primaria hover:underline">
            Ver todas
          </Link>
        </div>

        {monitorias.isPending && (
          <div className="grid gap-3 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {monitorias.isSuccess && monitorias.data.dados.length === 0 && (
          <EstadoVazio
            icone={<GraduationCap className="h-8 w-8" aria-hidden />}
            titulo="Nenhuma monitoria em andamento"
            descricao="Crie uma monitoria para começar a habilitar monitores e receber alunos."
            acao={
              <Link href={rotas.novaMonitoria} className={classesBotao()}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Nova monitoria
              </Link>
            }
          />
        )}

        {monitorias.isSuccess && monitorias.data.dados.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {monitorias.data.dados.map((monitoria) => (
              <CartaoMonitoria key={monitoria.id} monitoria={monitoria} />
            ))}
          </div>
        )}
      </section>

      {indicadores.isSuccess && indicadores.data.monitoresAtivos === 0 && (
        <Alert tom="alerta" titulo="Nenhum monitor habilitado">
          Sem monitores, os alunos não têm a quem solicitar atendimento. Abra uma monitoria e
          habilite um aluno como monitor — é você quem autoriza (RN01).
        </Alert>
      )}
    </div>
  );
}
