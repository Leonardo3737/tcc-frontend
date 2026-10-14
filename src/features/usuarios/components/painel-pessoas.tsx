'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsGatilho, TabsLista } from '@/components/ui/tabs';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { Skeleton } from '@/components/ui/skeleton';
import { CampoBusca } from '@/components/comum/campo-busca';
import { Paginacao } from '@/components/comum/paginacao';
import { DialogoCadastrarUsuario, type TipoCadastro } from './dialogo-cadastrar-usuario';
import { listarAlunos } from '../api/alunos.service';
import { listarProfessores } from '../api/professores.service';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { useSessao } from '@/providers/sessao-provider';
import { chaves } from '@/lib/query/chaves';
import { cn, iniciais } from '@/lib/utils';
import type { RespostaPaginada } from '@/types/api';
import type { Usuario } from '@/types/dominio';

type Definir = ReturnType<typeof useFiltrosUrl>['definir'];

/**
 * Pessoas: quem tem conta na plataforma, e o lugar onde contas nascem.
 *
 * Nao existe auto-cadastro — POST /alunos e POST /professores sao o unico
 * caminho, ambos restritos a PROFESSOR. Por isso a acao principal de cada aba e
 * "Cadastrar", e a lista existe para conferir se a pessoa ja tem conta antes de
 * criar outra (o 409 de e-mail repetido e previsivel).
 *
 * A aba fica na URL (`?aba=professores`): a tela e compartilhavel e o "voltar"
 * do navegador funciona.
 */
export function PainelPessoas() {
  const { obter, obterNumero, definir, pendente } = useFiltrosUrl();
  const [cadastrando, setCadastrando] = useState<TipoCadastro | null>(null);

  const aba = obter('aba', 'alunos') === 'professores' ? 'professores' : 'alunos';
  const pagina = obterNumero('pagina', 1);

  return (
    <div className="space-y-4">
      <Tabs
        value={aba}
        onValueChange={(nova) =>
          definir({ aba: nova === 'alunos' ? undefined : nova, busca: undefined })
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <TabsLista className="sm:border-b-0">
            <TabsGatilho value="alunos">Alunos</TabsGatilho>
            <TabsGatilho value="professores">Professores</TabsGatilho>
          </TabsLista>

          <Button
            className="shrink-0"
            onClick={() => setCadastrando(aba === 'alunos' ? 'aluno' : 'professor')}
            iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
          >
            {aba === 'alunos' ? 'Cadastrar aluno' : 'Cadastrar professor'}
          </Button>
        </div>
      </Tabs>

      {aba === 'alunos' ? (
        <ListaAlunos
          busca={obter('busca')}
          pagina={pagina}
          aoFiltrar={definir}
          carregandoUrl={pendente}
          aoCadastrar={() => setCadastrando('aluno')}
        />
      ) : (
        <ListaProfessores
          pagina={pagina}
          aoFiltrar={definir}
          carregandoUrl={pendente}
          aoCadastrar={() => setCadastrando('professor')}
        />
      )}

      <DialogoCadastrarUsuario
        tipo={cadastrando ?? 'aluno'}
        aberto={cadastrando !== null}
        aoFechar={() => setCadastrando(null)}
      />
    </div>
  );
}

function ListaAlunos({
  busca,
  pagina,
  aoFiltrar,
  carregandoUrl,
  aoCadastrar,
}: {
  busca: string;
  pagina: number;
  aoFiltrar: Definir;
  carregandoUrl: boolean;
  aoCadastrar: () => void;
}) {
  const filtro = { busca: busca || undefined, pagina, limite: 20 };

  const consulta = useQuery({
    queryKey: chaves.alunos.lista(filtro),
    queryFn: () => listarAlunos(filtro),
  });

  return (
    <div className="space-y-3">
      <CampoBusca
        valorInicial={busca}
        aoBuscar={(termo) => aoFiltrar({ busca: termo })}
        placeholder="Buscar por nome, matrícula ou e-mail…"
        rotulo="Buscar alunos"
        carregando={carregandoUrl || consulta.isFetching}
        className="sm:max-w-md"
      />

      <ResultadoLista
        consulta={consulta}
        carregandoUrl={carregandoUrl}
        aoMudarPagina={(nova) => aoFiltrar({ pagina: nova })}
        detalhe={(aluno) =>
          [aluno.aluno?.matricula, aluno.aluno?.curso].filter(Boolean).join(' · ') || null
        }
        vazio={
          busca ? (
            <EstadoVazio
              ilustracao="busca"
              titulo="Nenhum aluno encontrado"
              descricao={`Nada corresponde a “${busca}”. Se a pessoa ainda não tem conta, cadastre-a.`}
              acao={
                <Button variante="secundaria" onClick={aoCadastrar}>
                  Cadastrar aluno
                </Button>
              }
            />
          ) : (
            <EstadoVazio
              ilustracao="pessoas"
              titulo="Nenhum aluno cadastrado"
              descricao="Alunos só entram na plataforma com uma conta criada por um professor."
              acao={
                <Button variante="secundaria" onClick={aoCadastrar}>
                  Cadastrar o primeiro aluno
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
}

function ListaProfessores({
  pagina,
  aoFiltrar,
  carregandoUrl,
  aoCadastrar,
}: {
  pagina: number;
  aoFiltrar: Definir;
  carregandoUrl: boolean;
  aoCadastrar: () => void;
}) {
  const filtro = { pagina, limite: 20 };

  const consulta = useQuery({
    queryKey: chaves.professores.lista(filtro),
    queryFn: () => listarProfessores(filtro),
  });

  return (
    <div className="space-y-3">
      {/* GET /professores nao aceita busca: a lista so pagina. */}
      <ResultadoLista
        consulta={consulta}
        carregandoUrl={carregandoUrl}
        aoMudarPagina={(nova) => aoFiltrar({ pagina: nova })}
        detalhe={(professor) =>
          [professor.professor?.departamento, professor.professor?.identificacaoFuncional]
            .filter(Boolean)
            .join(' · ') || null
        }
        vazio={
          <EstadoVazio
            ilustracao="pessoas"
            titulo="Nenhum outro professor cadastrado"
            acao={
              <Button variante="secundaria" onClick={aoCadastrar}>
                Cadastrar professor
              </Button>
            }
          />
        }
      />
    </div>
  );
}

function ResultadoLista({
  consulta,
  carregandoUrl,
  aoMudarPagina,
  detalhe,
  vazio,
}: {
  consulta: ReturnType<typeof useQuery<RespostaPaginada<Usuario>>>;
  carregandoUrl: boolean;
  aoMudarPagina: (pagina: number) => void;
  detalhe: (usuario: Usuario) => string | null;
  vazio: React.ReactNode;
}) {
  const { usuario: eu } = useSessao();

  if (consulta.isPending) return <SkeletonPessoas />;

  if (consulta.isError) {
    return <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />;
  }

  if (consulta.data.dados.length === 0) return <>{vazio}</>;

  return (
    <div className="space-y-3">
      <ul
        className={cn(
          'divide-y divide-borda rounded-card border border-borda bg-superficie transition-opacity',
          consulta.isFetching && 'opacity-70',
        )}
      >
        {consulta.data.dados.map((pessoa) => {
          const linhaDetalhe = detalhe(pessoa);

          return (
            <li key={pessoa.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fundo-suave text-xs font-semibold text-texto-suave"
              >
                {iniciais(pessoa.nome)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate font-semibold text-texto">{pessoa.nome}</span>
                  {pessoa.id === eu.id && <Badge>Você</Badge>}
                  {pessoa.criadoPorUsuarioId === eu.id && pessoa.id !== eu.id && (
                    <Badge tom="primaria">Criada por você</Badge>
                  )}
                  {!pessoa.ativo && <Badge>Desativada</Badge>}
                </p>
                <p className="truncate text-xs text-texto-suave">
                  {pessoa.email}
                  {linhaDetalhe && <span className="hidden sm:inline"> · {linhaDetalhe}</span>}
                </p>
                {linhaDetalhe && (
                  <p className="truncate text-xs text-texto-suave sm:hidden">{linhaDetalhe}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Paginacao
        meta={consulta.data.meta}
        aoMudarPagina={aoMudarPagina}
        desabilitado={consulta.isFetching || carregandoUrl}
      />
    </div>
  );
}

/** Mesmo formato das linhas: avatar, nome e uma linha de detalhe. */
export function SkeletonPessoas() {
  return (
    <ul
      role="status"
      aria-busy
      aria-label="Carregando pessoas"
      className="divide-y divide-borda rounded-card border border-borda bg-superficie"
    >
      {[0, 1, 2, 3, 4].map((indice) => (
        <li key={indice} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
