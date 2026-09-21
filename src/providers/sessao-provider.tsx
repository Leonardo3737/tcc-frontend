'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { ConfiguracaoInstituicao, Usuario } from '@/types/dominio';
import { ehAluno, ehProfessor } from '@/lib/autorizacao/capacidades';

/**
 * Sessao e configuracao da instituicao, resolvidas no SERVIDOR e repassadas ao
 * cliente por props.
 *
 * Nao ha fetch aqui de proposito: o layout autenticado ja chamou
 * `GET /usuarios/eu` e `GET /configuracao` durante a renderizacao. Buscar de
 * novo no cliente causaria um flash de "carregando" em toda navegacao e
 * duplicaria requisicoes que ja foram feitas.
 *
 * O `usuario` deste contexto serve para RENDERIZAR (mostrar nome, decidir menu).
 * Nao e credencial: quem autoriza de fato e o backend.
 */
interface ValorSessao {
  usuario: Usuario;
  configuracao: ConfiguracaoInstituicao;
  ehAluno: boolean;
  ehProfessor: boolean;
  /** Fuso da instituicao — atalho, porque toda formatacao de data precisa dele. */
  fuso: string;
}

const ContextoSessao = createContext<ValorSessao | null>(null);

export function SessaoProvider({
  usuario,
  configuracao,
  children,
}: {
  usuario: Usuario;
  configuracao: ConfiguracaoInstituicao;
  children: ReactNode;
}) {
  const valor: ValorSessao = {
    usuario,
    configuracao,
    ehAluno: ehAluno(usuario),
    ehProfessor: ehProfessor(usuario),
    fuso: configuracao.fusoHorario,
  };

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

export function useSessao(): ValorSessao {
  const contexto = useContext(ContextoSessao);

  if (!contexto) {
    throw new Error('useSessao precisa estar dentro de <SessaoProvider> (layout autenticado).');
  }

  return contexto;
}
