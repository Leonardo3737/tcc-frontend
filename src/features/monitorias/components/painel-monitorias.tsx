'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { GraduationCap, Plus } from 'lucide-react';

import { Button, classesBotao } from '@/components/ui/button';
import { Select } from '@/components/ui/campo';
import { Tabs, TabsGatilho, TabsLista } from '@/components/ui/tabs';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import { CampoBusca } from '@/components/comum/campo-busca';
import { Paginacao } from '@/components/comum/paginacao';
import { CartaoMonitoria } from './cartao-monitoria';
import { listarMinhasMonitorias, listarMonitorias } from '../api/monitorias.service';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { useSessao } from '@/providers/sessao-provider';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';
import { StatusMonitoria } from '@/types/dominio';

/**
 * Duas visoes na mesma tela:
 *
 *  - "Minhas": GET /monitorias/minhas — traz `meuPapel` e `souResponsavel`.
 *    O backend filtra PLANEJADA + ATIVA por padrao, entao o historico e um
 *    pedido explicito.
 *  - "Explorar": GET /monitorias — catalogo aberto, onde o aluno descobre onde
 *    se inscrever.
 *
 * Sao endpoints diferentes com semanticas diferentes; separá-los em abas evita
 * a confusao de uma lista unica que as vezes tem papel e as vezes nao.
 */
export function PainelMonitorias() {
  const { obter, obterNumero, definir, pendente } = useFiltrosUrl();
  const { ehProfessor } = useSessao();

  const aba = obter('aba', 'minhas');
  const busca = obter('busca');
  const situacao = obter('situacao');
  const pagina = obterNumero('pagina', 1);

  return (
    <div className="space-y-4">
      <Tabs value={aba} onValueChange={(nova) => definir({ aba: nova, pagina: undefined })}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsLista>
            <TabsGatilho value="minhas">Minhas monitorias</TabsGatilho>
            <TabsGatilho value="explorar">Explorar</TabsGatilho>
          </TabsLista>

          {ehProfessor && (
            <Link href={rotas.novaMonitoria} className={classesBotao('primaria', 'sm', 'shrink-0')}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nova monitoria
            </Link>
          )}
        </div>
      </Tabs>

      {aba === 'minhas' ? (
        <VisaoMinhas
          situacao={situacao}
          pagina={pagina}
          aoFiltrar={definir}
          carregandoUrl={pendente}
        />
      ) : (
        <VisaoExplorar
          busca={busca}
          situacao={situacao}
          pagina={pagina}
          aoFiltrar={definir}
          carregandoUrl={pendente}
        />
      )}
    </div>
  );
}

type Definir = ReturnType<typeof useFiltrosUrl>['definir'];

function VisaoMinhas({
  situacao,
  pagina,
  aoFiltrar,
  carregandoUrl,
}: {
  situacao: string;
  pagina: number;
  aoFiltrar: Definir;
  carregandoUrl: boolean;
}) {
  /**
   * `status` ausente = o padrao do backend (PLANEJADA + ATIVA).
   * "Histórico" pede os dois status terminais de uma vez, o que o backend aceita
   * como parametro repetido.
   */
  const status =
    situacao === 'historico'
      ? [StatusMonitoria.ENCERRADA, StatusMonitoria.CANCELADA]
      : situacao === 'ativas'
        ? [StatusMonitoria.ATIVA]
        : undefined;

  const filtro = { status, pagina, limite: 12 };

  const consulta = useQuery({
    queryKey: chaves.monitorias.minhas(filtro),
    queryFn: () => listarMinhasMonitorias(filtro),
  });

  return (
    <div className="space-y-4">
      <Select
        label="Situação"
        className="sm:w-56 [&>label]:sr-only"
        value={situacao}
        onChange={(evento) => aoFiltrar({ situacao: evento.target.value })}
        opcoes={[
          { valor: '', rotulo: 'Em andamento' },
          { valor: 'ativas', rotulo: 'Somente ativas' },
          { valor: 'historico', rotulo: 'Histórico (encerradas e canceladas)' },
        ]}
      />

      {consulta.isPending && <SkeletonLista itens={3} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<GraduationCap className="h-8 w-8" aria-hidden />}
          titulo={
            situacao === 'historico'
              ? 'Nenhuma monitoria no histórico'
              : 'Você ainda não participa de nenhuma monitoria'
          }
          descricao={
            situacao === 'historico'
              ? 'Monitorias encerradas ou canceladas aparecerão aqui.'
              : 'Explore o catálogo para encontrar uma monitoria e participar como monitorado.'
          }
          acao={
            situacao !== 'historico' && (
              <Button variante="secundaria" onClick={() => aoFiltrar({ aba: 'explorar' })}>
                Explorar monitorias
              </Button>
            )
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {consulta.data.dados.map((monitoria) => (
              <CartaoMonitoria key={monitoria.id} monitoria={monitoria} />
            ))}
          </div>

          <Paginacao
            meta={consulta.data.meta}
            aoMudarPagina={(nova) => aoFiltrar({ pagina: nova })}
            desabilitado={consulta.isFetching || carregandoUrl}
          />
        </>
      )}
    </div>
  );
}

function VisaoExplorar({
  busca,
  situacao,
  pagina,
  aoFiltrar,
  carregandoUrl,
}: {
  busca: string;
  situacao: string;
  pagina: number;
  aoFiltrar: Definir;
  carregandoUrl: boolean;
}) {
  const filtro = {
    busca: busca || undefined,
    // Padrão ATIVA: são as monitorias em que o aluno consegue efetivamente
    // agendar atendimento. As PLANEJADAS aceitam inscrição, mas não agendamento.
    status: situacao === 'todas' ? undefined : (situacao as StatusMonitoria) || StatusMonitoria.ATIVA,
    pagina,
    limite: 12,
  };

  const consulta = useQuery({
    queryKey: chaves.monitorias.lista(filtro),
    queryFn: () => listarMonitorias(filtro),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <CampoBusca
          valorInicial={busca}
          aoBuscar={(termo) => aoFiltrar({ busca: termo })}
          placeholder="Buscar por disciplina ou professor…"
          rotulo="Buscar monitorias"
          carregando={carregandoUrl || consulta.isFetching}
          className="flex-1"
        />

        <Select
          label="Situação"
          className="sm:w-48 [&>label]:sr-only"
          value={situacao}
          onChange={(evento) => aoFiltrar({ situacao: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Ativas' },
            { valor: StatusMonitoria.PLANEJADA, rotulo: 'Planejadas' },
            { valor: 'todas', rotulo: 'Todas' },
          ]}
        />
      </div>

      {consulta.isPending && <SkeletonLista itens={3} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<GraduationCap className="h-8 w-8" aria-hidden />}
          titulo="Nenhuma monitoria encontrada"
          descricao={
            busca
              ? `Nada corresponde a “${busca}”. Tente outra disciplina ou professor.`
              : 'Não há monitorias com esta situação no momento.'
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {consulta.data.dados.map((monitoria) => (
              <CartaoMonitoria key={monitoria.id} monitoria={monitoria} />
            ))}
          </div>

          <Paginacao
            meta={consulta.data.meta}
            aoMudarPagina={(nova) => aoFiltrar({ pagina: nova })}
            desabilitado={consulta.isFetching || carregandoUrl}
          />
        </>
      )}
    </div>
  );
}
