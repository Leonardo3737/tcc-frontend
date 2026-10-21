'use client';

import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { ListaParaCombo } from '@/hooks/use-lista-para-combo';
import { cn } from '@/lib/utils';

/**
 * Select com busca e carregamento por pagina.
 *
 * Um `<select>` nativo continua sendo a escolha certa para listas curtas e
 * fechadas (modalidade, turno, papel) — ele abre o seletor do sistema no
 * celular e funciona com teclado sem codigo nosso. Este componente existe para
 * o caso oposto: catalogos que crescem sem teto, em que rolar centenas de
 * `<option>` deixa de ser viavel.
 *
 * ACESSIBILIDADE, pelo padrao combobox da WAI-ARIA:
 *  - o gatilho e `role="combobox"` com `aria-expanded` e `aria-controls`;
 *  - a lista e `role="listbox"`, cada item e `role="option"` com
 *    `aria-selected`;
 *  - `aria-activedescendant` aponta o item sob o cursor do teclado, de modo
 *    que o foco REAL permanece no campo de busca enquanto as setas navegam —
 *    e o que permite digitar e navegar ao mesmo tempo;
 *  - Escape fecha e devolve o foco ao gatilho; Enter escolhe; Home/End vao aos
 *    extremos.
 *
 * O componente nao busca nada: recebe `lista` de `useListaParaCombo`, que
 * conversa com o servidor. A busca e sempre remota — filtrar apenas a pagina
 * carregada faria o usuario concluir que um registro nao existe quando ele so
 * esta na pagina seguinte.
 */
export function ComboBox({
  label,
  valor,
  rotuloSelecionado,
  aoEscolher,
  lista,
  placeholder = 'Selecione…',
  placeholderBusca = 'Buscar…',
  textoVazio = 'Nada encontrado',
  /** Opcao que limpa a selecao (filtros). Ausente = selecao obrigatoria. */
  opcaoVazia,
  obrigatorio,
  erro,
  ajuda,
  disabled,
  className,
  rotuloOculto = false,
}: {
  label: string;
  valor: string;
  /**
   * Texto do item escolhido.
   *
   * Vem de fora porque o selecionado pode NAO estar entre os carregados — um
   * filtro restaurado da URL aponta um id que talvez só apareça na página 4.
   * Sem isto o gatilho ficaria vazio com um filtro ativo.
   */
  rotuloSelecionado?: string;
  aoEscolher: (valor: string) => void;
  lista: ListaParaCombo;
  placeholder?: string;
  placeholderBusca?: string;
  textoVazio?: string;
  opcaoVazia?: string;
  obrigatorio?: boolean;
  erro?: string;
  ajuda?: string;
  disabled?: boolean;
  className?: string;
  rotuloOculto?: boolean;
}) {
  const id = useId();
  const idLista = `${id}-lista`;
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;

  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);

  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const refLista = useRef<HTMLUListElement>(null);

  const { itens, texto, setTexto, carregando, erro: falhou } = lista;

  /** A opção de limpar entra como primeira linha navegável, quando existe. */
  const opcoes = opcaoVazia
    ? [{ valor: '', rotulo: opcaoVazia }, ...itens]
    : itens;

  // Fecha ao clicar fora. `mousedown` e não `click`: fechar no clique deixaria
  // o popover capturar o evento antes de sumir.
  useEffect(() => {
    if (!aberto) return;

    const aoApontar = (evento: MouseEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    };

    document.addEventListener('mousedown', aoApontar);
    return () => document.removeEventListener('mousedown', aoApontar);
  }, [aberto]);

  // Ao abrir, o foco vai para a busca: é onde se digita, e as setas funcionam
  // dali por causa do `aria-activedescendant`.
  useEffect(() => {
    if (aberto) campoBusca.current?.focus();
  }, [aberto]);

  // Digitar reinicia o cursor: a lista mudou embaixo dele.
  useEffect(() => setIndice(0), [texto]);

  // Mantém o item sob o cursor visível ao navegar com o teclado.
  useEffect(() => {
    if (!aberto) return;
    refLista.current?.querySelector(`#${CSS.escape(`${id}-op-${indice}`)}`)?.scrollIntoView({
      block: 'nearest',
    });
  }, [indice, aberto, id]);

  const fechar = () => {
    setAberto(false);
    gatilho.current?.focus();
  };

  const escolher = (novo: string) => {
    aoEscolher(novo);
    setTexto('');
    fechar();
  };

  const aoTeclar = (evento: React.KeyboardEvent) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      fechar();
      return;
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (opcoes.length === 0) return;

      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      setIndice((atual) => (atual + passo + opcoes.length) % opcoes.length);
      return;
    }

    if (evento.key === 'Home' || evento.key === 'End') {
      evento.preventDefault();
      setIndice(evento.key === 'Home' ? 0 : opcoes.length - 1);
      return;
    }

    if (evento.key === 'Enter') {
      evento.preventDefault();
      const alvo = opcoes[indice];
      if (alvo) escolher(alvo.valor);
    }
  };

  const descricoes = [erro ? idErro : ajuda ? idAjuda : null].filter(Boolean).join(' ');
  /**
   * Com um valor escolhido mas rotulo ainda desconhecido, o gatilho diz
   * "Carregando…" — nao um travessao (que parece valor quebrado) nem o texto
   * de "sem filtro" (que afirmaria o oposto do que esta acontecendo).
   */
  const textoDoGatilho = valor
    ? (rotuloSelecionado ?? 'Carregando…')
    : (opcaoVazia ?? placeholder);

  return (
    <div ref={raiz} className={cn('relative', className)}>
      <label
        htmlFor={`${id}-gatilho`}
        className={cn(
          'block text-sm font-semibold text-texto',
          rotuloOculto && 'sr-only',
        )}
      >
        {label}
        {obrigatorio && (
          <span className="ml-0.5 text-perigo" aria-hidden>
            *
          </span>
        )}
      </label>

      <button
        ref={gatilho}
        id={`${id}-gatilho`}
        type="button"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-haspopup="listbox"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricoes || undefined}
        aria-required={obrigatorio || undefined}
        disabled={disabled}
        onClick={() => setAberto((atual) => !atual)}
        className={cn(
          'alvo-toque flex w-full items-center justify-between gap-2 rounded-md border bg-superficie px-3 py-2 text-left text-sm transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-60',
          erro ? 'border-perigo' : 'border-borda-forte hover:border-texto-suave/60',
          valor ? 'text-texto' : 'text-texto-suave',
        )}
      >
        <span className="min-w-0 truncate">{textoDoGatilho}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-texto-suave" aria-hidden />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-borda-forte bg-superficie shadow-lg">
          <div className="relative border-b border-borda">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-suave"
              aria-hidden
            />
            <input
              ref={campoBusca}
              type="text"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              onKeyDown={aoTeclar}
              placeholder={placeholderBusca}
              aria-label={`Buscar em ${label.toLowerCase()}`}
              aria-controls={idLista}
              aria-activedescendant={opcoes[indice] ? `${id}-op-${indice}` : undefined}
              autoComplete="off"
              className="w-full bg-transparent py-2.5 pl-9 pr-9 text-sm text-texto outline-none placeholder:text-texto-suave/70"
            />

            {texto && (
              <button
                type="button"
                onClick={() => {
                  setTexto('');
                  campoBusca.current?.focus();
                }}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-texto-suave hover:text-texto"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          <ul
            ref={refLista}
            id={idLista}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-y-auto py-1"
          >
            {carregando && (
              <li className="space-y-2 px-3 py-2" aria-busy>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </li>
            )}

            {falhou && !carregando && (
              <li className="px-3 py-3 text-sm text-texto-suave" role="alert">
                Não foi possível carregar a lista.
              </li>
            )}

            {!carregando && !falhou && opcoes.length === 0 && (
              <li className="px-3 py-3 text-sm text-texto-suave">{textoVazio}</li>
            )}

            {opcoes.map((opcao, posicao) => {
              const selecionado = opcao.valor === valor;

              return (
                <li
                  key={opcao.valor || '__vazio'}
                  id={`${id}-op-${posicao}`}
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => escolher(opcao.valor)}
                  onMouseEnter={() => setIndice(posicao)}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 px-3 py-2 text-sm',
                    posicao === indice && 'bg-primaria-suave',
                    selecionado && 'font-semibold text-primaria',
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      selecionado ? 'text-primaria' : 'invisible',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-texto">{opcao.rotulo}</span>
                    {opcao.descricao && (
                      <span className="block truncate text-xs text-texto-suave">
                        {opcao.descricao}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <RodapeDaLista lista={lista} />
        </div>
      )}

      {ajuda && !erro && (
        <p id={idAjuda} className="text-xs text-texto-suave">
          {ajuda}
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

/**
 * "Carregar mais".
 *
 * So aparece quando a API diz que ha proxima pagina. O total vem junto para
 * dar nocao do tamanho: "carregar mais" sem numero nao diz se faltam cinco
 * registros ou quinhentos.
 */
function RodapeDaLista({ lista }: { lista: ListaParaCombo }) {
  const { temMais, carregarMais, carregandoMais, total } = lista;

  if (!temMais) return null;

  return (
    <div className="border-t border-borda px-3 py-2">
      <button
        type="button"
        onClick={carregarMais}
        disabled={carregandoMais}
        className="inline-flex items-center gap-1.5 rounded text-xs font-semibold text-primaria hover:underline disabled:opacity-60"
      >
        {carregandoMais && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        {carregandoMais ? 'Carregando…' : `Carregar mais (${total} no total)`}
      </button>
    </div>
  );
}
