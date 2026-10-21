'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { RespostaPaginada } from '@/types/api';

/**
 * Alimenta um <ComboBox> com uma listagem paginada da API.
 *
 * Resolve tres coisas que, feitas a mao em cada tela, divergiriam:
 *
 *  1. DEBOUNCE. O backend tem rate limit global (120 req/min). Sem pausa, cada
 *     tecla vira uma requisicao e digitar "calculo diferencial" gasta 20 do
 *     orcamento para exibir um resultado.
 *  2. PAGINAS ACUMULADAS. "Carregar mais" dentro de um dropdown precisa somar
 *     as paginas, nao substituir — numeros de pagina em popover sao
 *     desorientadores.
 *  3. BUSCA NO SERVIDOR, sempre. Todas as listagens de catalogo da API
 *     (`/cursos`, `/disciplinas`, `/alunos`, `/professores` e
 *     `/professores/publicos`) aceitam `busca`. Filtrar apenas a pagina
 *     carregada e chamar isso de busca faria o usuario concluir que um
 *     registro nao existe quando ele so esta na pagina 3 — por isso nao ha
 *     modo local aqui.
 */

const ATRASO_MS = 400;
/** Teto do PaginacaoDto do backend. */
const LIMITE = 50;

export interface ItemDeCombo {
  valor: string;
  rotulo: string;
  descricao?: string;
}

export interface ListaParaCombo {
  itens: ItemDeCombo[];
  /** O que o usuario digitou (imediato, sem debounce) — para o input. */
  texto: string;
  setTexto: (texto: string) => void;
  carregando: boolean;
  carregandoMais: boolean;
  erro: boolean;
  temMais: boolean;
  carregarMais: () => void;
  /** Total que a API diz existir, com o filtro atual. */
  total: number;
}

export function useListaParaCombo<T>({
  chave,
  buscar,
  paraItem,
  habilitado = true,
  limite = LIMITE,
}: {
  /** Parte estavel da query key. O termo de busca e acrescentado aqui dentro. */
  chave: readonly unknown[];
  buscar: (parametros: {
    pagina: number;
    limite: number;
    busca?: string;
  }) => Promise<RespostaPaginada<T>>;
  paraItem: (registro: T) => ItemDeCombo;
  habilitado?: boolean;
  limite?: number;
}): ListaParaCombo {
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');

  /**
   * Debounce. Sem ele, cada tecla vira uma requisicao e o rate limit global
   * (120/min) se esgota em uma unica busca digitada por extenso.
   */
  useEffect(() => {
    const temporizador = setTimeout(() => setTermo(texto.trim()), ATRASO_MS);
    return () => clearTimeout(temporizador);
  }, [texto]);

  const consulta = useInfiniteQuery({
    queryKey: [...chave, 'combo', termo, limite],
    enabled: habilitado,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      buscar({
        pagina: pageParam,
        limite,
        ...(termo ? { busca: termo } : {}),
      }),
    getNextPageParam: (ultima) =>
      ultima.meta.pagina < ultima.meta.totalPaginas ? ultima.meta.pagina + 1 : undefined,
    staleTime: 5 * 60_000, // catálogos mudam pouco
  });

  const itens = useMemo(
    () => (consulta.data?.pages ?? []).flatMap((pagina) => pagina.dados.map(paraItem)),
    // `paraItem` é redefinida a cada render do chamador; incluí-la refaria a
    // lista sem necessidade a cada ciclo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consulta.data],
  );

  return {
    itens,
    texto,
    setTexto,
    carregando: consulta.isPending,
    carregandoMais: consulta.isFetchingNextPage,
    erro: consulta.isError,
    temMais: consulta.hasNextPage,
    carregarMais: () => void consulta.fetchNextPage(),
    total: consulta.data?.pages[0]?.meta.total ?? 0,
  };
}
