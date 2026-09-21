'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Filtros de lista vivem na URL, nao em useState.
 *
 * Motivo: a tela passa a ser compartilhavel, recarregavel e navegavel pelo botao
 * "voltar" do navegador. Um filtro em estado local se perde no F5 e nao pode ser
 * mandado para um colega — para uma agenda ou uma lista de participantes, isso
 * importa.
 *
 * `useTransition` mantem a lista anterior visivel enquanto a nova carrega, em
 * vez de piscar um esqueleto a cada tecla digitada na busca.
 */
export function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [pendente, iniciarTransicao] = useTransition();

  const obter = useCallback(
    (chave: string, padrao = '') => parametros.get(chave) ?? padrao,
    [parametros],
  );

  const obterNumero = useCallback(
    (chave: string, padrao: number) => {
      const bruto = parametros.get(chave);
      const numero = bruto ? Number(bruto) : Number.NaN;
      return Number.isFinite(numero) ? numero : padrao;
    },
    [parametros],
  );

  const definir = useCallback(
    (alteracoes: Record<string, string | number | undefined | null>) => {
      const novos = new URLSearchParams(parametros.toString());

      for (const [chave, valor] of Object.entries(alteracoes)) {
        if (valor === undefined || valor === null || valor === '') {
          novos.delete(chave);
        } else {
          novos.set(chave, String(valor));
        }
      }

      /**
       * Qualquer mudanca de filtro volta para a pagina 1. Sem isso, filtrar
       * estando na pagina 5 costuma cair num resultado vazio que parece "nao ha
       * nada", quando na verdade ha — so nao naquela pagina.
       */
      if (!('pagina' in alteracoes)) {
        novos.delete('pagina');
      }

      const consulta = novos.toString();

      iniciarTransicao(() => {
        // `scroll: false` evita o pulo para o topo ao paginar uma tabela longa.
        router.replace(consulta ? `${pathname}?${consulta}` : pathname, { scroll: false });
      });
    },
    [parametros, pathname, router],
  );

  const limpar = useCallback(() => {
    iniciarTransicao(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  return { obter, obterNumero, definir, limpar, pendente, parametros };
}
