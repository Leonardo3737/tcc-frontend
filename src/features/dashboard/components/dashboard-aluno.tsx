'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarClock, CalendarDays, GraduationCap, Star, Trophy } from 'lucide-react';

import { classesBotao } from '@/components/ui/button';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { BadgePapel } from '@/components/ui/badge';
import { EstadoVazio } from '@/components/ui/estados';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Indicador } from '@/components/comum/indicador';
import { CartaoAtendimento } from '@/features/atendimentos/components/cartao-atendimento';
import { CartaoMonitoria } from '@/features/monitorias/components/cartao-monitoria';
import { listarMeusAtendimentos } from '@/features/atendimentos/api/atendimentos.service';
import { listarMinhasMonitorias } from '@/features/monitorias/api/monitorias.service';
import { buscarMeusPontos } from '@/features/gamificacao/api/gamificacao.service';
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
 * "Avaliacoes pendentes" nao e um endpoint: e derivado dos atendimentos
 * REALIZADOS em que a minha inscricao veio marcada com `podeAvaliar` — flag que
 * o proprio backend calcula (REALIZADO + PRESENTE + ainda nao avaliado).
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
   * Realizados recentes, para achar o que ainda posso avaliar.
   * Não existe endpoint "avaliações pendentes"; esta é a forma correta de
   * derivá-la sem inventar contrato.
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

  const pendentesDeAvaliacao = (realizados.data?.dados ?? []).filter((atendimento) =>
    atendimento.inscricoes?.some((inscricao) => inscricao.souEu && inscricao.podeAvaliar),
  );

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Monitorias"
          valor={monitorias.data?.meta.total ?? '—'}
          detalhe="Em andamento"
          icone={<GraduationCap className="h-4 w-4" aria-hidden />}
        />
        <Indicador
          rotulo="Próximos atendimentos"
          valor={proximos.data?.meta.total ?? '—'}
          icone={<CalendarClock className="h-4 w-4" aria-hidden />}
        />
        <Indicador
          rotulo="Atendimentos com presença"
          valor={totalRealizados}
          detalhe="Nos 20 mais recentes"
          icone={<CalendarDays className="h-4 w-4" aria-hidden />}
        />
        <Indicador
          rotulo="Pontos"
          valor={pontos.data?.total ?? '—'}
          icone={<Trophy className="h-4 w-4" aria-hidden />}
        />
      </div>

      {pendentesDeAvaliacao.length > 0 && (
        <Card className="border-alerta/40">
          <CardCabecalho
            titulo={`${pendentesDeAvaliacao.length} atendimento(s) aguardando sua avaliação`}
            descricao="Só quem teve presença registrada pode avaliar (RN06)."
          />
          <CardConteudo>
            <ul className="space-y-2">
              {pendentesDeAvaliacao.slice(0, 3).map((atendimento) => (
                <li key={atendimento.id}>
                  <Link
                    href={rotas.atendimento(atendimento.id)}
                    className="flex items-center gap-3 rounded-lg border border-borda p-3 transition-colors hover:bg-fundo"
                  >
                    <Star className="h-4 w-4 shrink-0 text-alerta" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-texto">
                        {atendimento.assunto}
                      </span>
                      <span className="block text-xs text-texto-suave">
                        {atendimento.monitoria?.nomeDisciplina} · {atendimento.nomeMonitor}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-primaria">Avaliar</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardConteudo>
        </Card>
      )}

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
                <strong>dentro de cada monitoria</strong>. Você pode ser monitor em uma
                disciplina e monitorado em outra.
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
