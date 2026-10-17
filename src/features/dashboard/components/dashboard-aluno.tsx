'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarClock, GraduationCap } from 'lucide-react';

import { classesBotao } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { BadgePapel } from '@/components/ui/badge';
import { EstadoVazio } from '@/components/ui/estados';
import { SkeletonCard } from '@/components/ui/skeleton';
import { FaixaIndicadores, Indicador } from '@/components/comum/indicador';
import { CartaoAtendimento } from '@/features/atendimentos/components/cartao-atendimento';
import { CartaoMonitoria } from '@/features/monitorias/components/cartao-monitoria';
import { listarMeusAtendimentos } from '@/features/atendimentos/api/atendimentos.service';
import { listarMinhasMonitorias } from '@/features/monitorias/api/monitorias.service';
import { buscarMeusPontos } from '@/features/gamificacao/api/gamificacao.service';
import { NovidadeInscricao } from '@/features/editais/components/novidade-inscricao';
import { FilaDePendencias } from './fila-pendencias';
import { useSessao } from '@/providers/sessao-provider';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';
import { PapelMonitoria, StatusAtendimento, StatusInscricao } from '@/types/dominio';

/**
 * Dashboard do aluno.
 *
 * O destaque e a lista de monitorias com o PAPEL em cada uma — e a demonstracao
 * visual do modelo: a mesma pessoa aparece como MONITOR em uma linha e
 * MONITORADO em outra.
 *
 * As pendencias (presenca a registrar, avaliacao a dar) ficam em
 * <FilaDePendencias>, que as busca pelos filtros derivados do servidor. Antes
 * elas eram aproximadas aqui, filtrando os 20 realizados mais recentes — quem
 * tinha historico maior nao via parte delas.
 */
export function DashboardAluno() {
  const { fuso } = useSessao();

  const monitorias = useQuery({
    queryKey: chaves.monitorias.minhas({ limite: 6 }),
    queryFn: () => listarMinhasMonitorias({ limite: 6 }),
  });

  const proximos = useQuery({
    queryKey: chaves.atendimentos.meus({ status: StatusAtendimento.AGENDADO, limite: 4 }),
    queryFn: () =>
      listarMeusAtendimentos({
        status: StatusAtendimento.AGENDADO,
        ordenarPor: 'inicio',
        direcao: 'asc',
        limite: 4,
      }),
  });

  /**
   * Realizados recentes, só para o indicador de presenças. O que está pendente
   * de avaliação não sai mais daqui: vem do filtro `pendentesDeAvaliacao`,
   * dentro de <FilaDePendencias>.
   */
  const realizados = useQuery({
    queryKey: chaves.atendimentos.meus({ status: StatusAtendimento.REALIZADO, limite: 20 }),
    queryFn: () =>
      listarMeusAtendimentos({
        status: StatusAtendimento.REALIZADO,
        ordenarPor: 'inicio',
        direcao: 'desc',
        limite: 20,
      }),
  });

  const pontos = useQuery({
    queryKey: chaves.gamificacao.meusPontos({}),
    queryFn: () => buscarMeusPontos(),
  });

  const souMonitorEmAlguma = (monitorias.data?.dados ?? []).some(
    (monitoria) => monitoria.meuPapel === PapelMonitoria.MONITOR,
  );

  const totalRealizados = (realizados.data?.dados ?? []).filter((atendimento) =>
    atendimento.inscricoes?.some(
      (inscricao) => inscricao.souEu && inscricao.status === StatusInscricao.PRESENTE,
    ),
  ).length;

  return (
    <div className="space-y-6">
      <FaixaIndicadores>
        <Indicador
          rotulo="Monitorias"
          valor={monitorias.data?.meta.total ?? '—'}
          detalhe="Em andamento"
        />
        <Indicador rotulo="Próximos atendimentos" valor={proximos.data?.meta.total ?? '—'} />
        <Indicador
          rotulo="Atendimentos com presença"
          valor={totalRealizados}
          detalhe="Nos 20 mais recentes"
        />
        <Indicador rotulo="Pontos" valor={pontos.data?.total ?? '—'} />
      </FaixaIndicadores>

      {/*
        Acima da fila de pendências de propósito: é uma novidade com prazo, e
        some sozinha quando não há edital aberto. Abaixo dos indicadores, para
        não disputar com o resumo do próprio aluno.
      */}
      <NovidadeInscricao />

      <FilaDePendencias />

      <section aria-labelledby="titulo-minhas-monitorias" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-minhas-monitorias" className="text-sm font-medium text-texto-suave">
            Minhas monitorias
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
            titulo="Você ainda não participa de nenhuma monitoria"
            descricao="Explore o catálogo e participe como monitorado para começar a agendar atendimentos."
            acao={
              <Link href={`${rotas.monitorias}?aba=explorar`} className={classesBotao()}>
                Explorar monitorias
              </Link>
            }
          />
        )}

        {monitorias.isSuccess && monitorias.data.dados.length > 0 && (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {monitorias.data.dados.map((monitoria) => (
                <CartaoMonitoria key={monitoria.id} monitoria={monitoria} />
              ))}
            </div>

            {/*
              O ponto do TCC dito na tela: o papel é por monitoria, não da pessoa.
              Só aparece quando ele de fato varia entre as monitorias do usuário.
            */}
            {souMonitorEmAlguma && (
              <Alert tom="info">
                Repare nos selos <BadgePapel papel={PapelMonitoria.MONITOR} /> e{' '}
                <BadgePapel papel={PapelMonitoria.MONITORADO} />: o papel vale{' '}
                <strong>dentro de cada monitoria</strong>. Você pode ser monitor em uma disciplina e
                monitorado em outra.
              </Alert>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="titulo-proximos" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-proximos" className="text-sm font-medium text-texto-suave">
            Próximos atendimentos
          </h2>
          <Link href={rotas.atendimentos} className="text-sm text-primaria hover:underline">
            Ver agenda
          </Link>
        </div>

        {proximos.isPending && (
          <div className="grid gap-3 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {proximos.isSuccess && proximos.data.dados.length === 0 && (
          <EstadoVazio
            icone={<CalendarClock className="h-8 w-8" aria-hidden />}
            titulo="Nenhum atendimento agendado"
            descricao={
              souMonitorEmAlguma
                ? 'Abra uma sessão como monitor ou solicite atendimento onde você é monitorado.'
                : 'Entre em uma das suas monitorias e solicite atendimento a um monitor.'
            }
          />
        )}

        {proximos.isSuccess && proximos.data.dados.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {proximos.data.dados.map((atendimento) => (
              <CartaoAtendimento key={atendimento.id} atendimento={atendimento} fuso={fuso} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
