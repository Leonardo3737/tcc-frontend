import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';

import { SessaoProvider } from '@/providers/sessao-provider';
import { MonitoriaProvider } from '@/providers/monitoria-provider';
import {
  PerfilUsuario,
  StatusMonitoria,
  type ConfiguracaoInstituicao,
  type Monitoria,
  type Usuario,
} from '@/types/dominio';

/**
 * Utilitarios de teste.
 *
 * Os providers reais sao usados de proposito — nao ha versao "de teste" da
 * sessao nem do contexto de monitoria. Testar com o provider verdadeiro e o que
 * garante que as capacidades sejam calculadas pelo mesmo codigo que roda em
 * producao.
 */

export const CONFIGURACAO_TESTE: ConfiguracaoInstituicao = {
  fusoHorario: 'America/Sao_Paulo',
  agendamento: {
    duracaoMinimaMinutos: 15,
    duracaoMaximaMinutos: 240,
    antecedenciaMinimaMinutos: 0,
    cancelamentoAntecedenciaMinutos: 0,
  },
};

export function usuarioTeste(
  perfis: PerfilUsuario[] = [PerfilUsuario.ALUNO],
  extras: Partial<Usuario> = {},
): Usuario {
  return {
    id: 'usuario-1',
    nome: 'Ana Martins',
    email: 'ana.martins@ufx.edu.br',
    ativo: true,
    perfis,
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...extras,
  };
}

export function monitoriaTeste(extras: Partial<Monitoria> = {}): Monitoria {
  return {
    id: 'monitoria-1',
    ano: 2026,
    semestre: 2,
    periodo: '2026/2',
    descricao: null,
    status: StatusMonitoria.ATIVA,
    dataInicio: null,
    dataFim: null,
    disciplina: { id: 'd1', codigo: 'MAT101', nome: 'Cálculo I' },
    ...extras,
  };
}

/** QueryClient isolado por teste, sem retry — falha vira falha na hora. */
export function criarQueryClientDeTeste() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderizar(
  elemento: ReactElement,
  opcoes: RenderOptions & {
    usuario?: Usuario;
    monitoria?: Monitoria;
  } = {},
) {
  const { usuario = usuarioTeste(), monitoria, ...resto } = opcoes;
  const queryClient = criarQueryClientDeTeste();

  function Envolvente({ children }: { children: ReactNode }) {
    const conteudo = monitoria ? (
      <MonitoriaProvider monitoria={monitoria}>{children}</MonitoriaProvider>
    ) : (
      children
    );

    return (
      <QueryClientProvider client={queryClient}>
        <SessaoProvider usuario={usuario} configuracao={CONFIGURACAO_TESTE}>
          {conteudo}
        </SessaoProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(elemento, { wrapper: Envolvente, ...resto }), queryClient };
}

/*
 * Nao ha helper de mock do roteador aqui de proposito: `vi.mock` e ICADO para o
 * topo do modulo pelo Vitest, entao envolve-lo numa funcao produz um mock que
 * roda em ordem diferente da que o codigo sugere. Cada suite declara o seu
 * `vi.mock('next/navigation', ...)` no topo do proprio arquivo.
 */
