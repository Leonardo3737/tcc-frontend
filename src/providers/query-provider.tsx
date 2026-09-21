'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';

/**
 * Configuracao do TanStack Query.
 *
 * Duas decisoes merecem justificativa:
 *
 * 1. NAO REPETIR 4xx. Repetir um 401, 403, 409 ou 422 nunca muda o resultado —
 *    a resposta e deterministica. Pior: repetir 429 empurra o rate limit do
 *    backend (5 tentativas/min no login) e transforma um erro recuperavel em um
 *    bloqueio. So 5xx e falha de rede sao repetidos.
 *
 * 2. 401 DERRUBA A SESSAO INTEIRA. Um token expirado em uma query significa que
 *    todas as outras tambem vao falhar. Em vez de N toasts, limpamos o cookie e
 *    redirecionamos uma vez.
 */
function criarQueryClient(aoPerderSessao: () => void): QueryClient {
  const naoRepetir4xx = (tentativa: number, erro: unknown): boolean => {
    if (erro instanceof ApiError) {
      if (erro.statusCode >= 400 && erro.statusCode < 500) return false;
      return tentativa < 2;
    }

    return tentativa < 2;
  };

  const tratarErro = (erro: unknown) => {
    if (erro instanceof ApiError && erro.ehNaoAutenticado) {
      aoPerderSessao();
    }
  };

  return new QueryClient({
    defaultOptions: {
      queries: {
        // 30s cobre a janela em que o usuario navega entre abas da mesma
        // monitoria sem refetch, mas nao esconde alteracoes feitas por outros.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: naoRepetir4xx,
      },
      mutations: {
        // Mutacao nunca e repetida automaticamente: quase toda operacao desta
        // API tem efeito de dominio (inscrever, cancelar, avaliar), e repetir
        // uma que falhou por timeout poderia duplicar o efeito.
        retry: false,
        onError: tratarErro,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  /**
   * O client vive em estado, e nao em modulo: em modulo, ele seria compartilhado
   * entre requisicoes no servidor e um usuario poderia ver o cache de outro.
   */
  const [queryClient] = useState(() =>
    criarQueryClient(() => {
      void fetch(rotas.bffLogout, { method: 'POST' }).finally(() => {
        router.replace(`${rotas.login}?expirou=1`);
        router.refresh();
      });
    }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
