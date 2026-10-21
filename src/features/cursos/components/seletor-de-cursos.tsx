'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search, X } from 'lucide-react';
import { useId } from 'react';

import { Alert } from '@/components/ui/alert';
import { ComboBox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { useListaParaCombo, type ItemDeCombo } from '@/hooks/use-lista-para-combo';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';
import type { Curso, ResumoCurso } from '@/types/dominio';
import { detalharCurso, listarCursos } from '../api/cursos.service';

/**
 * Escolha de curso, em tres formas: uma (aluno, 1:N), varias (disciplina, N:N)
 * e recorte de listagem (filtro).
 *
 * As tres buscam NO SERVIDOR (`GET /cursos` aceita `busca`) e carregam por
 * pagina. O catalogo cresce sem teto, e um `<select>` com todos os registros
 * deixa de ser utilizavel bem antes de deixar de caber na memoria.
 *
 * Regra comum sobre curso INATIVO: ele nao aparece entre as opcoes de
 * formulario, mas CONTINUA visivel quando ja esta vinculado. Esconder um
 * vinculo existente faria o formulario devolver um conjunto diferente do que a
 * pessoa viu — e, no caso da disciplina, `cursosIds` SUBSTITUI o conjunto,
 * entao isso desvincularia um curso sem que ninguem tivesse pedido.
 */

const paraItem = (curso: Curso | ResumoCurso): ItemDeCombo => ({
  valor: curso.id,
  rotulo: curso.nome,
  descricao: curso.codigo,
});

/**
 * Rotulo do curso selecionado quando ele NAO esta entre os carregados.
 *
 * Acontece sempre que um filtro e restaurado da URL: o id aponta um curso que
 * talvez so apareca na pagina 4. Sem esta consulta o gatilho ficaria vazio com
 * um filtro ativo — a tela diria "todos os cursos" enquanto filtra por um.
 */
function useRotuloDeCurso(id: string, jaConhecido?: string) {
  const consulta = useQuery({
    queryKey: chaves.cursos.detalhe(id),
    enabled: Boolean(id) && !jaConhecido,
    queryFn: () => detalharCurso(id),
    staleTime: 5 * 60_000,
  });

  return jaConhecido ?? consulta.data?.nome;
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
  const lista = useListaParaCombo({
    chave: chaves.cursos.lista({ ativo: true }),
    buscar: (parametros) => listarCursos({ ...parametros, ativo: true }),
    paraItem,
  });

  /**
   * O curso já vinculado entra na frente, mesmo inativo — e some da lista
   * normal para não duplicar.
   */
  const itens = cursoAtual
    ? [paraItem(cursoAtual), ...lista.itens.filter((item) => item.valor !== cursoAtual.id)]
    : lista.itens;

  const rotuloSelecionado = useRotuloDeCurso(
    valor,
    itens.find((item) => item.valor === valor)?.rotulo,
  );

  if (lista.erro) {
    return (
      <Alert tom="erro" titulo="Não foi possível carregar os cursos">
        Sem a lista de cursos não dá para concluir este cadastro. Recarregue a página.
      </Alert>
    );
  }

  if (!lista.carregando && lista.total === 0 && !cursoAtual) {
    return (
      <Alert tom="alerta" titulo="Nenhum curso cadastrado">
        Todo aluno precisa pertencer a um curso. Cadastre um em <strong>Cursos</strong> antes de
        continuar.
      </Alert>
    );
  }

  return (
    <ComboBox
      label={label}
      valor={valor}
      {...(rotuloSelecionado ? { rotuloSelecionado } : {})}
      aoEscolher={aoMudar}
      lista={{ ...lista, itens }}
      placeholder="Selecione o curso"
      placeholderBusca="Buscar curso…"
      textoVazio="Nenhum curso encontrado"
      {...(obrigatorio ? { obrigatorio } : {})}
      {...(erro ? { erro } : {})}
      {...(ajuda ? { ajuda } : {})}
      {...(desabilitado ? { disabled: desabilitado } : {})}
    />
  );
}

// ---------------------------------------------------------------------------
// Varios cursos (disciplina — relacao N:N)
// ---------------------------------------------------------------------------

/**
 * Lista de marcacao, nao combobox: aqui a pessoa compara e marca varios, e
 * esconder as opcoes atras de um popover a obrigaria a abrir e fechar para
 * conferir o que ja escolheu. O que entra do combobox e o que faltava — busca
 * no servidor e carregamento por pagina.
 */
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

  const lista = useListaParaCombo({
    chave: chaves.cursos.lista({ ativo: true }),
    buscar: (parametros) => listarCursos({ ...parametros, ativo: true }),
    paraItem,
  });

  // Vinculados primeiro, sem repetir os que também vêm na página.
  const itens = [
    ...jaVinculados.map(paraItem),
    ...lista.itens.filter((item) => !jaVinculados.some((curso) => curso.id === item.valor)),
  ];

  if (lista.erro) {
    return (
      <Alert tom="erro" titulo="Não foi possível carregar os cursos">
        Uma disciplina precisa de ao menos um curso, então não dá para seguir sem a lista.
        Recarregue a página.
      </Alert>
    );
  }

  if (!lista.carregando && lista.total === 0 && jaVinculados.length === 0) {
    return (
      <Alert tom="alerta" titulo="Nenhum curso cadastrado">
        Toda disciplina é oferecida por ao menos um curso. Cadastre um em <strong>Cursos</strong>{' '}
        antes de continuar.
      </Alert>
    );
  }

  const alternar = (cursoId: string) => {
    aoMudar(valor.includes(cursoId) ? valor.filter((id) => id !== cursoId) : [...valor, cursoId]);
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

      <div
        className={cn(
          'overflow-hidden rounded-lg border',
          erro ? 'border-perigo' : 'border-borda-forte',
        )}
      >
        <div className="relative border-b border-borda">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-suave"
            aria-hidden
          />
          <input
            type="text"
            value={lista.texto}
            onChange={(evento) => lista.setTexto(evento.target.value)}
            placeholder="Buscar curso…"
            aria-label="Buscar cursos"
            autoComplete="off"
            className="w-full bg-transparent py-2.5 pl-9 pr-9 text-sm text-texto outline-none placeholder:text-texto-suave/70"
          />
          {lista.texto && (
            <button
              type="button"
              onClick={() => lista.setTexto('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-texto-suave hover:text-texto"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        <ul className="max-h-56 divide-y divide-borda overflow-y-auto">
          {lista.carregando && (
            <li className="space-y-2 p-3" aria-busy>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          )}

          {!lista.carregando && itens.length === 0 && (
            <li className="px-3 py-3 text-sm text-texto-suave">Nenhum curso encontrado.</li>
          )}

          {itens.map((curso) => {
            const marcado = valor.includes(curso.valor);

            return (
              <li key={curso.valor}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-fundo-suave">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(curso.valor)}
                    className="h-4 w-4 shrink-0 rounded border-borda-forte text-primaria focus-visible:ring-primaria"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-texto">{curso.rotulo}</span>
                    <span className="block font-mono text-xs text-texto-suave">
                      {curso.descricao}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {lista.temMais && (
          <div className="border-t border-borda px-3 py-2">
            <button
              type="button"
              onClick={lista.carregarMais}
              disabled={lista.carregandoMais}
              className="inline-flex items-center gap-1.5 rounded text-xs font-semibold text-primaria hover:underline disabled:opacity-60"
            >
              {lista.carregandoMais && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {lista.carregandoMais
                ? 'Carregando…'
                : `Carregar mais (${lista.total} no total)`}
            </button>
          </div>
        )}
      </div>

      {/* Marcados que saíram da lista pela busca continuam contados. */}
      {valor.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-texto-suave">
          <Check className="h-3 w-3 text-primaria" aria-hidden />
          {valor.length === 1 ? '1 curso selecionado' : `${valor.length} cursos selecionados`}
        </p>
      )}

      {erro && (
        <p id={idErro} role="alert" className="text-xs text-perigo">
          {erro}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filtro de listagem
// ---------------------------------------------------------------------------

/**
 * "Todos os cursos" + a lista, para recortar uma LISTAGEM.
 *
 * Duas diferencas em relacao ao campo de formulario: vazio significa "nao
 * filtrar", e aqui entram tambem os cursos INATIVOS — um curso fora de
 * circulacao continua tendo alunos e disciplinas, e procura-los e justamente
 * quando o filtro serve.
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
  const lista = useListaParaCombo({
    chave: chaves.cursos.lista({}),
    buscar: listarCursos,
    paraItem: (curso: Curso) => ({
      valor: curso.id,
      rotulo: curso.ativo ? curso.nome : `${curso.nome} (inativo)`,
      descricao: curso.codigo,
    }),
  });

  const rotuloSelecionado = useRotuloDeCurso(
    valor,
    lista.itens.find((item) => item.valor === valor)?.rotulo,
  );

  // Sem cursos (ou com a consulta em erro) o filtro não recorta nada: some.
  if (lista.erro || (!lista.carregando && lista.total === 0 && !valor)) return null;

  return (
    <ComboBox
      label={label}
      rotuloOculto
      valor={valor}
      {...(rotuloSelecionado ? { rotuloSelecionado } : {})}
      aoEscolher={aoMudar}
      lista={lista}
      opcaoVazia="Todos os cursos"
      placeholderBusca="Buscar curso…"
      textoVazio="Nenhum curso encontrado"
      {...(className ? { className } : {})}
    />
  );
}
