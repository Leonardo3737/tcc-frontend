'use client';

import { useQuery } from '@tanstack/react-query';

import { chaves } from '@/lib/query/chaves';
import { listarEditaisAbertos } from '../api/editais.service';

/**
 * Editais aceitando inscricao agora, no cliente.
 *
 * UMA chave para todo mundo (`chaves.editais.abertos`): o TanStack Query
 * deduplica, entao dois destaques na mesma tela compartilham a resposta em vez
 * de pedir duas vezes. Era esse o risco apontado no escopo — a consulta
 * repetida por componente.
 *
 * `staleTime` de 5 minutos pelo mesmo motivo do cache do servidor: o recorte
 * "aberto" muda por virada de DIA no fuso da instituicao, nao a cada minuto.
 *
 * O backend ja devolve ordenado pelo que FECHA PRIMEIRO, e e essa a prioridade
 * quando ha varios abertos — nenhuma regra foi inventada aqui.
 */
export function useEditaisAbertos() {
  const consulta = useQuery({
    queryKey: chaves.editais.abertos,
    queryFn: () => listarEditaisAbertos({ limite: 10 }),
    staleTime: 5 * 60_000,
    /**
     * Um destaque opcional nao deve piscar erro nem insistir: se a consulta
     * falhar, a novidade simplesmente nao aparece.
     */
    retry: false,
  });

  const abertos = consulta.data?.dados ?? [];

  return {
    abertos,
    /** O mais urgente: o primeiro da ordem do servidor, que e o que fecha antes. */
    proximo: abertos[0] ?? null,
    temAberto: abertos.length > 0,
    carregando: consulta.isPending,
  };
}
