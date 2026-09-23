'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';

import { Select } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import { SkeletonCartaoAtendimento } from './cartao-atendimento';
import { Paginacao } from '@/components/comum/paginacao';
import { CartaoAtendimento } from './cartao-atendimento';
import { listarMeusAtendimentos } from '../api/atendimentos.service';
import { useSessao } from '@/providers/sessao-provider';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { chaves } from '@/lib/query/chaves';
import { StatusAtendimento } from '@/types/dominio';

/**
 * Agenda pessoal, atravessando TODAS as monitorias.
 *
 * `GET /atendimentos/meus` monta a consulta a partir dos vinculos do aluno —
 * como monitor OU como inscrito. Quem tem apenas perfil PROFESSOR recebe lista
 * vazia, e isso e coerente com o dominio: o professor nao atende nem e atendido,
 * nao ha vinculo dele que ocupe agenda. A tela explica isso em vez de parecer um
 * defeito.
 */
export function PainelMeusAtendimentos() {
  const { fuso, ehAluno, ehProfessor } = useSessao();
  const { obter, obterNumero, definir } = useFiltrosUrl();

  const situacao = obter('situacao', 'proximos');
  const pagina = obterNumero('pagina', 1);

  const proximos = situacao === 'proximos';

  const filtro = {
    ...(proximos ? { status: StatusAtendimento.AGENDADO } : {}),
    ...(situacao === 'realizados' ? { status: StatusAtendimento.REALIZADO } : {}),
    ...(situacao === 'cancelados' ? { status: StatusAtendimento.CANCELADO } : {}),
    ordenarPor: 'inicio' as const,
    // Próximos olham para frente; histórico, para trás.
    direcao: proximos ? ('asc' as const) : ('desc' as const),
    pagina,
    limite: 12,
  };

  const consulta = useQuery({
    queryKey: chaves.atendimentos.meus(filtro),
    queryFn: () => listarMeusAtendimentos(filtro),
    enabled: ehAluno,
  });

  if (!ehAluno) {
    return (
      <Alert tom="info" titulo="Você não tem agenda pessoal">
        A agenda pessoal reúne os atendimentos em que você atende ou é atendido — o que
        depende de um vínculo de monitor ou monitorado.
        {ehProfessor && ' Como professor, acompanhe os atendimentos dentro de cada monitoria.'}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Select
        label="Situação"
        className="sm:w-56 [&>label]:sr-only"
        value={situacao}
        onChange={(evento) => definir({ situacao: evento.target.value })}
        opcoes={[
          { valor: 'proximos', rotulo: 'Próximos (agendados)' },
          { valor: 'realizados', rotulo: 'Realizados' },
          { valor: 'cancelados', rotulo: 'Cancelados' },
          { valor: 'todos', rotulo: 'Todos' },
        ]}
      />

      {consulta.isPending && <SkeletonLista itens={3} item={SkeletonCartaoAtendimento} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<CalendarDays className="h-8 w-8" aria-hidden />}
          titulo={proximos ? 'Nenhum atendimento agendado' : 'Nada por aqui'}
          descricao={
            proximos
              ? 'Quando você agendar ou se inscrever em um atendimento, ele aparecerá aqui.'
              : 'Nenhum atendimento com esta situação.'
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {consulta.data.dados.map((atendimento) => (
              <CartaoAtendimento key={atendimento.id} atendimento={atendimento} fuso={fuso} />
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
