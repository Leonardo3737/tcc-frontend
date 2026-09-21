'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Pencil, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardConteudo } from '@/components/ui/card';
import { Select } from '@/components/ui/campo';
import {
  Tabela,
  TabelaCabecalho,
  TabelaCabecalhoCelula,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
} from '@/components/ui/tabela';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import { CampoBusca } from '@/components/comum/campo-busca';
import { Paginacao } from '@/components/comum/paginacao';
import { DialogoDisciplina } from './dialogo-disciplina';
import { listarDisciplinas } from '../api/disciplinas.service';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { chaves } from '@/lib/query/chaves';
import type { Disciplina } from '@/types/dominio';

/**
 * Lista do catalogo.
 *
 * Somente PROFESSOR chega aqui (a pagina barra antes), entao as acoes de escrita
 * podem aparecer sem checagem adicional — mas o backend continua sendo quem
 * autoriza de fato.
 */
export function PainelDisciplinas() {
  const { obter, obterNumero, definir, pendente } = useFiltrosUrl();
  const [emEdicao, setEmEdicao] = useState<Disciplina | undefined>();
  const [dialogoAberto, setDialogoAberto] = useState(false);

  const busca = obter('busca');
  const situacao = obter('situacao');
  const pagina = obterNumero('pagina', 1);

  const filtro = {
    busca: busca || undefined,
    ativa: situacao === '' ? undefined : situacao === 'ativas',
    pagina,
    limite: 20,
  };

  const consulta = useQuery({
    queryKey: chaves.disciplinas.lista(filtro),
    queryFn: () => listarDisciplinas(filtro),
    staleTime: 5 * 60_000, // catálogo muda pouco
  });

  function abrirCriacao() {
    setEmEdicao(undefined);
    setDialogoAberto(true);
  }

  function abrirEdicao(disciplina: Disciplina) {
    setEmEdicao(disciplina);
    setDialogoAberto(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CampoBusca
          valorInicial={busca}
          aoBuscar={(termo) => definir({ busca: termo })}
          placeholder="Buscar por código ou nome…"
          rotulo="Buscar disciplinas"
          carregando={pendente || consulta.isFetching}
          className="flex-1"
        />

        <Select
          label="Situação"
          className="sm:w-44 [&>label]:sr-only"
          value={situacao}
          onChange={(evento) => definir({ situacao: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Todas' },
            { valor: 'ativas', rotulo: 'Somente ativas' },
            { valor: 'inativas', rotulo: 'Somente inativas' },
          ]}
        />

        <Button onClick={abrirCriacao} iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}>
          Nova disciplina
        </Button>
      </div>

      {consulta.isPending && <SkeletonLista itens={4} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<BookOpen className="h-8 w-8" aria-hidden />}
          titulo={busca ? 'Nenhuma disciplina encontrada' : 'Catálogo vazio'}
          descricao={
            busca
              ? `Nada corresponde a “${busca}”. Tente outro código ou nome.`
              : 'Cadastre a primeira disciplina para poder criar monitorias.'
          }
          acao={
            !busca && (
              <Button onClick={abrirCriacao} iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}>
                Nova disciplina
              </Button>
            )
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <Card>
          {/* Tabela no desktop */}
          <div className="hidden md:block">
            <Tabela>
              <TabelaCabecalho>
                <TabelaLinha>
                  <TabelaCabecalhoCelula>Código</TabelaCabecalhoCelula>
                  <TabelaCabecalhoCelula>Nome</TabelaCabecalhoCelula>
                  <TabelaCabecalhoCelula>Situação</TabelaCabecalhoCelula>
                  <TabelaCabecalhoCelula className="text-right">Ações</TabelaCabecalhoCelula>
                </TabelaLinha>
              </TabelaCabecalho>

              <TabelaCorpo>
                {consulta.data.dados.map((disciplina) => (
                  <TabelaLinha key={disciplina.id}>
                    <TabelaCelula className="font-mono text-xs font-medium">
                      {disciplina.codigo}
                    </TabelaCelula>
                    <TabelaCelula>{disciplina.nome}</TabelaCelula>
                    <TabelaCelula>
                      <Badge tom={disciplina.ativa ? 'sucesso' : 'neutro'}>
                        {disciplina.ativa ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TabelaCelula>
                    <TabelaCelula className="text-right">
                      <Button
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => abrirEdicao(disciplina)}
                        iconeEsquerda={<Pencil className="h-3.5 w-3.5" aria-hidden />}
                      >
                        Editar
                      </Button>
                    </TabelaCelula>
                  </TabelaLinha>
                ))}
              </TabelaCorpo>
            </Tabela>
          </div>

          {/* Cartoes no mobile: a tabela de 4 colunas nao cabe em 375px */}
          <div className="divide-y divide-borda md:hidden">
            {consulta.data.dados.map((disciplina) => (
              <div key={disciplina.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-xs text-texto-suave">{disciplina.codigo}</p>
                  <p className="font-medium text-texto">{disciplina.nome}</p>
                  <Badge tom={disciplina.ativa ? 'sucesso' : 'neutro'}>
                    {disciplina.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>

                <Button
                  variante="secundaria"
                  tamanho="icone"
                  onClick={() => abrirEdicao(disciplina)}
                  aria-label={`Editar ${disciplina.nome}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <CardConteudo className="pt-0">
            <Paginacao
              meta={consulta.data.meta}
              aoMudarPagina={(nova) => definir({ pagina: nova })}
              desabilitado={consulta.isFetching}
            />
          </CardConteudo>
        </Card>
      )}

      <DialogoDisciplina
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        disciplina={emEdicao}
      />
    </div>
  );
}
