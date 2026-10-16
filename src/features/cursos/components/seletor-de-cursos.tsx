'use client';

import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/campo';
import { Skeleton } from '@/components/ui/skeleton';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';
import type { Curso, ResumoCurso } from '@/types/dominio';
import { listarCursos } from '../api/cursos.service';

/**
 * Escolha de curso, em duas formas: uma (aluno, 1:N) e varias (disciplina, N:N).
 *
 * Os dois compartilham a mesma consulta e a mesma regra sobre curso INATIVO:
 * ele nao aparece entre as opcoes, mas CONTINUA visivel quando ja esta
 * vinculado. Esconder um vinculo existente so porque o curso saiu de circulacao
 * faria o formulario devolver um conjunto diferente do que a pessoa viu — e,
 * no caso da disciplina, `cursosIds` SUBSTITUI o conjunto, entao isso
 * desvincularia um curso sem que ninguem tivesse pedido.
 */

/** Teto do PaginacaoDto do backend. */
const LIMITE = 100;

interface ResultadoCursos {
  opcoes: ResumoCurso[];
  carregando: boolean;
  erro: boolean;
  /** Ha mais cursos do que coube em uma pagina — ver `limitacoes-da-api.md`. */
  truncado: boolean;
}

/**
 * Cursos ativos + os que ja estao vinculados, sem repetir.
 *
 * `jaVinculados` entra depois e e deduplicado por id: um curso ativo que ja
 * esteja vinculado nao deve aparecer duas vezes.
 */
function useCursosDisponiveis(jaVinculados: ResumoCurso[] = []): ResultadoCursos {
  const filtro = { ativo: true, limite: LIMITE };

  const consulta = useQuery({
    queryKey: chaves.cursos.lista(filtro),
    queryFn: () => listarCursos(filtro),
    staleTime: 5 * 60_000, // catálogo muda pouco
  });

  const ativos: Curso[] = consulta.data?.dados ?? [];
  const porId = new Map<string, ResumoCurso>();

  for (const curso of ativos) {
    porId.set(curso.id, { id: curso.id, codigo: curso.codigo, nome: curso.nome });
  }

  for (const curso of jaVinculados) {
    if (!porId.has(curso.id)) porId.set(curso.id, curso);
  }

  return {
    opcoes: [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    carregando: consulta.isPending,
    erro: consulta.isError,
    truncado: (consulta.data?.meta.total ?? 0) > ativos.length,
  };
}

// ---------------------------------------------------------------------------
// Um curso (aluno — relacao 1:N)
// ---------------------------------------------------------------------------

export function SeletorDeCurso({
  valor,
  aoMudar,
  erro,
  obrigatorio,
  label = 'Curso',
  ajuda,
  desabilitado,
  /** Curso atual do aluno, para continuar visível mesmo se tiver sido desativado. */
  cursoAtual,
}: {
  valor: string;
  aoMudar: (cursoId: string) => void;
  erro?: string;
  obrigatorio?: boolean;
  label?: string;
  ajuda?: string;
  desabilitado?: boolean;
  cursoAtual?: ResumoCurso | null;
}) {
  const { opcoes, carregando, erro: falhou, truncado } = useCursosDisponiveis(
    cursoAtual ? [cursoAtual] : [],
  );

  if (carregando) return <EsqueletoCampo label={label} />;

  if (falhou) {
    return (
      <Alert tom="erro" titulo="Não foi possível carregar os cursos">
        Sem a lista de cursos não dá para concluir este cadastro. Recarregue a página.
      </Alert>
    );
  }

  if (opcoes.length === 0) {
    return (
      <Alert tom="alerta" titulo="Nenhum curso cadastrado">
        Todo aluno precisa pertencer a um curso. Cadastre um em <strong>Cursos</strong> antes de
        continuar.
      </Alert>
    );
  }

  return (
    <>
      <Select
        label={label}
        obrigatorio={obrigatorio}
        disabled={desabilitado}
        placeholder="Selecione o curso"
        ajuda={ajuda}
        erro={erro}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        opcoes={opcoes.map((curso) => ({
          valor: curso.id,
          rotulo: `${curso.codigo} · ${curso.nome}`,
        }))}
      />

      {truncado && <AvisoTruncado />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Varios cursos (disciplina — relacao N:N)
// ---------------------------------------------------------------------------

export function SeletorDeCursos({
  valor,
  aoMudar,
  erro,
  /** Cursos já vinculados, para seguirem listados mesmo se desativados. */
  jaVinculados = [],
}: {
  valor: string[];
  aoMudar: (cursosIds: string[]) => void;
  erro?: string;
  jaVinculados?: ResumoCurso[];
}) {
  const idRotulo = useId();
  const idErro = `${idRotulo}-erro`;
  const { opcoes, carregando, erro: falhou, truncado } = useCursosDisponiveis(jaVinculados);

  if (carregando) return <EsqueletoCampo label="Cursos que oferecem a disciplina" />;

  if (falhou) {
    return (
      <Alert tom="erro" titulo="Não foi possível carregar os cursos">
        Uma disciplina precisa de ao menos um curso, então não dá para seguir sem a lista.
        Recarregue a página.
      </Alert>
    );
  }

  if (opcoes.length === 0) {
    return (
      <Alert tom="alerta" titulo="Nenhum curso cadastrado">
        Toda disciplina é oferecida por ao menos um curso. Cadastre um em <strong>Cursos</strong>{' '}
        antes de continuar.
      </Alert>
    );
  }

  const alternar = (cursoId: string) => {
    aoMudar(
      valor.includes(cursoId) ? valor.filter((id) => id !== cursoId) : [...valor, cursoId],
    );
  };

  return (
    <div
      role="group"
      aria-labelledby={idRotulo}
      aria-describedby={erro ? idErro : undefined}
      className="space-y-1.5"
    >
      <span id={idRotulo} className="block text-sm font-semibold text-texto">
        Cursos que oferecem a disciplina
        <span className="ml-0.5 text-perigo" aria-hidden>
          *
        </span>
      </span>

      <p className="text-xs text-texto-suave">
        A mesma disciplina pode servir vários cursos. É esta lista que decide quem pode participar
        das monitorias dela.
      </p>

      <ul
        className={cn(
          'max-h-56 divide-y divide-borda overflow-y-auto rounded-lg border',
          erro ? 'border-perigo' : 'border-borda-forte',
        )}
      >
        {opcoes.map((curso) => {
          const marcado = valor.includes(curso.id);

          return (
            <li key={curso.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-fundo-suave">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(curso.id)}
                  className="h-4 w-4 shrink-0 rounded border-borda-forte text-primaria focus-visible:ring-primaria"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-texto">{curso.nome}</span>
                  <span className="block font-mono text-xs text-texto-suave">{curso.codigo}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {erro && (
        <p id={idErro} role="alert" className="text-xs text-perigo">
          {erro}
        </p>
      )}

      {truncado && <AvisoTruncado />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filtro de listagem (disciplinas, alunos)
// ---------------------------------------------------------------------------

/**
 * "Todos os cursos" + a lista, para recortar uma LISTAGEM.
 *
 * Separado de `SeletorDeCurso` por duas diferencas que importam:
 *
 *  - aqui vazio significa "nao filtrar", nao "falta escolher";
 *  - aqui entram tambem os cursos INATIVOS. Um curso fora de circulacao
 *    continua tendo alunos e disciplinas, e procurar por eles e justamente
 *    quando o filtro serve.
 */
export function FiltroDeCurso({
  valor,
  aoMudar,
  className,
  label = 'Curso',
}: {
  valor: string;
  aoMudar: (cursoId: string) => void;
  className?: string;
  label?: string;
}) {
  const filtro = { limite: LIMITE };

  const consulta = useQuery({
    queryKey: chaves.cursos.lista(filtro),
    queryFn: () => listarCursos(filtro),
    staleTime: 5 * 60_000,
  });

  // Sem cursos (ou com a consulta em erro) o filtro nao recorta nada: some.
  if (!consulta.isSuccess || consulta.data.dados.length === 0) return null;

  const opcoes = [...consulta.data.dados].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <Select
      label={label}
      className={cn('[&>label]:sr-only', className)}
      value={valor}
      onChange={(evento) => aoMudar(evento.target.value)}
      opcoes={[
        { valor: '', rotulo: 'Todos os cursos' },
        ...opcoes.map((curso) => ({
          valor: curso.id,
          rotulo: curso.ativo ? curso.nome : `${curso.nome} (inativo)`,
        })),
      ]}
    />
  );
}

/**
 * O backend limita a pagina a 100 e `GET /cursos` nao tem outro recorte util
 * aqui. Com mais de 100 cursos ativos, a lista fica incompleta — e dizer isso e
 * melhor do que deixar a pessoa procurar um curso que existe e nao aparece.
 */
function AvisoTruncado() {
  return (
    <p className="text-xs text-texto-suave">
      Mostrando os primeiros {LIMITE} cursos ativos. Se faltar algum, cadastre ou reative em
      Cursos.
    </p>
  );
}

function EsqueletoCampo({ label }: { label: string }) {
  return (
    <div className="space-y-1.5" role="status" aria-busy aria-label={`Carregando ${label}`}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
