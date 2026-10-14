'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarDays, CalendarPlus } from 'lucide-react';

import { classesBotao } from '@/components/ui/button';
import { Select } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import { SkeletonCartaoAtendimento } from './cartao-atendimento';
import { Paginacao } from '@/components/comum/paginacao';
import { CartaoAtendimento } from './cartao-atendimento';
import { listarAtendimentosDaMonitoria } from '../api/atendimentos.service';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { useSessao } from '@/providers/sessao-provider';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';
import { StatusAtendimento, StatusMonitoria } from '@/types/dominio';

/**
 * Agenda da monitoria.
 *
 * CANCELADOS e REALIZADOS continuam na lista (RN10): a agenda tambem e o
 * historico. Filtrar por status e escolha do usuario, nunca um "esconder o que
 * deu errado".
 */
export function PainelAtendimentosMonitoria() {
  const { monitoria, capacidades } = useContextoMonitoria();
  const { fuso } = useSessao();
  const { obter, obterNumero, definir } = useFiltrosUrl();

  const situacao = obter('situacao');
  const pagina = obterNumero('pagina', 1);

  /**
   * A ordenação acompanha a intenção da visão: "próximos" olha para frente
   * (ascendente), "histórico" olha para trás (descendente). O backend expõe
   * `ordenarPor`/`direcao` exatamente nesta rota por causa dessas duas leituras.
   */
  const proximos = situacao === '' || situacao === 'agendados';

  const filtro = {
    status: situacao === 'agendados' ? StatusAtendimento.AGENDADO : undefined,
    ...(situacao === 'realizados' ? { status: StatusAtendimento.REALIZADO } : {}),
    ...(situacao === 'cancelados' ? { status: StatusAtendimento.CANCELADO } : {}),
    ...(situacao === 'abertos' ? { aceitandoInscricao: true } : {}),
    ordenarPor: 'inicio' as const,
    direcao: proximos ? ('asc' as const) : ('desc' as const),
    pagina,
    limite: 12,
  };

  const consulta = useQuery({
    queryKey: chaves.monitorias.atendimentos(monitoria.id, filtro),
    queryFn: () => listarAtendimentosDaMonitoria(monitoria.id, filtro),
  });

  const podeAgendar = capacidades.agendarAtendimento;
  const monitoriaAtiva = monitoria.status === StatusMonitoria.ATIVA;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          label="Situação"
          className="sm:w-56 [&>label]:sr-only"
          value={situacao}
          onChange={(evento) => definir({ situacao: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Todos' },
            { valor: 'abertos', rotulo: 'Aceitando inscrição' },
            { valor: 'agendados', rotulo: 'Agendados' },
            { valor: 'realizados', rotulo: 'Realizados' },
            { valor: 'cancelados', rotulo: 'Cancelados' },
          ]}
        />

        {podeAgendar && (
          <Link
            href={rotas.monitoriaAgendar(monitoria.id)}
            className={classesBotao('primaria', 'md', 'sm:ml-auto')}
          >
            <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
            Agendar
          </Link>
        )}
      </div>

      {!monitoriaAtiva && (
        <Alert tom="alerta">
          A monitoria está <strong>{monitoria.status}</strong>. O agendamento de novos atendimentos
          exige monitoria ATIVA.
        </Alert>
      )}

      {consulta.isPending && <SkeletonLista itens={3} item={SkeletonCartaoAtendimento} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<CalendarDays className="h-8 w-8" aria-hidden />}
          titulo="Nenhum atendimento"
          descricao={
            situacao
              ? 'Nenhum atendimento com esta situação.'
              : podeAgendar
                ? 'Ainda não há atendimentos nesta monitoria. Que tal agendar o primeiro?'
                : 'Ainda não há atendimentos nesta monitoria.'
          }
          acao={
            podeAgendar &&
            monitoriaAtiva && (
              <Link href={rotas.monitoriaAgendar(monitoria.id)} className={classesBotao()}>
                <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
                Agendar atendimento
              </Link>
            )
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {consulta.data.dados.map((atendimento) => (
              <CartaoAtendimento
                key={atendimento.id}
                atendimento={atendimento}
                mostrarMonitoria={false}
                fuso={fuso}
              />
            ))}
          </div>

          <Paginacao
            meta={consulta.data.meta}
            aoMudarPagina={(nova) => definir({ pagina: nova })}
            desabilitado={consulta.isFetching}
          />
        </>
      )}
    </div>
  );
}
