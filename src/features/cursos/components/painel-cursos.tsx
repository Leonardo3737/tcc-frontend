'use client';

import { useQuery } from '@tanstack/react-query';
import { Library, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { CampoBusca } from '@/components/comum/campo-busca';
import { Paginacao } from '@/components/comum/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/campo';
import { Card, CardConteudo } from '@/components/ui/card';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import {
  Tabela,
  TabelaCabecalho,
  TabelaCabecalhoCelula,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
} from '@/components/ui/tabela';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { chaves } from '@/lib/query/chaves';
import type { Curso } from '@/types/dominio';
import { listarCursos } from '../api/cursos.service';
import { DialogoCurso } from './dialogo-curso';

/**
 * Lista do catalogo de cursos.
 *
 * Somente PROFESSOR chega aqui (a pagina barra antes), entao as acoes de escrita
 * podem aparecer sem checagem adicional — mas o backend continua sendo quem
 * autoriza de fato (AD-F02).
 */
export function PainelCursos() {
  const { obter, obterNumero, definir, pendente } = useFiltrosUrl();
  const [emEdicao, setEmEdicao] = useState<Curso | undefined>();
  const [dialogoAberto, setDialogoAberto] = useState(false);

  const busca = obter('busca');
  const situacao = obter('situacao');
  const pagina = obterNumero('pagina', 1);

  const filtro = {
    busca: busca || undefined,
    ativo: situacao === '' ? undefined : situacao === 'ativos',
    pagina,
    limite: 20,
  };

  const consulta = useQuery({
    queryKey: chaves.cursos.lista(filtro),
    queryFn: () => listarCursos(filtro),
    staleTime: 5 * 60_000, // catálogo muda pouco
  });

  function abrirCriacao() {
    setEmEdicao(undefined);
    setDialogoAberto(true);
  }

  function abrirEdicao(curso: Curso) {
    setEmEdicao(curso);
    setDialogoAberto(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CampoBusca
          valorInicial={busca}
          aoBuscar={(termo) => definir({ busca: termo })}
          placeholder="Buscar por código ou nome…"
          rotulo="Buscar cursos"
          carregando={pendente || consulta.isFetching}
          className="flex-1"
        />

        <Select
          label="Situação"
          className="sm:w-44 [&>label]:sr-only"
          value={situacao}
          onChange={(evento) => definir({ situacao: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Todos' },
            { valor: 'ativos', rotulo: 'Somente ativos' },
            { valor: 'inativos', rotulo: 'Somente inativos' },
          ]}
        />

        <Button onClick={abrirCriacao} iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}>
          Novo curso
        </Button>
      </div>

      {consulta.isPending && <SkeletonLista itens={4} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<Library className="h-8 w-8" aria-hidden />}
          titulo={busca ? 'Nenhum curso encontrado' : 'Catálogo vazio'}
          descricao={
            busca
              ? `Nada corresponde a “${busca}”. Tente outro código ou nome.`
              : 'Cadastre o primeiro curso: toda disciplina precisa de ao menos um, e todo aluno pertence a um.'
          }
          acao={
            !busca && (
              <Button
                onClick={abrirCriacao}
                iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}
              >
                Novo curso
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
                {consulta.data.dados.map((curso) => (
                  <TabelaLinha key={curso.id}>
                    <TabelaCelula className="font-mono text-xs font-medium">
                      {curso.codigo}
                    </TabelaCelula>
                    <TabelaCelula>{curso.nome}</TabelaCelula>
                    <TabelaCelula>
                      <Badge tom={curso.ativo ? 'sucesso' : 'neutro'}>
                        {curso.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TabelaCelula>
                    <TabelaCelula className="text-right">
                      <Button
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => abrirEdicao(curso)}
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
            {consulta.data.dados.map((curso) => (
              <div key={curso.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-xs text-texto-suave">{curso.codigo}</p>
                  <p className="font-medium text-texto">{curso.nome}</p>
                  <Badge tom={curso.ativo ? 'sucesso' : 'neutro'}>
                    {curso.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                <Button
                  variante="secundaria"
                  tamanho="icone"
                  onClick={() => abrirEdicao(curso)}
                  aria-label={`Editar ${curso.nome}`}
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

      <DialogoCurso
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        curso={emEdicao}
      />
    </div>
  );
}
