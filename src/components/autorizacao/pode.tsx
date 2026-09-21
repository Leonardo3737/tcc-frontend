'use client';

import type { ReactNode } from 'react';

import { useSessao } from '@/providers/sessao-provider';
import { temPerfil, type Capacidades } from '@/lib/autorizacao/capacidades';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import type { PerfilUsuario } from '@/types/dominio';

/**
 * Guards declarativos de UI.
 *
 * ------------------------------------------------------------------
 * NAO SAO SEGURANCA. Esconder um botao nao impede ninguem de chamar a
 * API — quem barra e o backend. Isto existe para nao oferecer ao usuario
 * uma acao que ele receberia 403 ao tentar.
 * ------------------------------------------------------------------
 */

/** Perfil global (ALUNO / PROFESSOR). Passa quem tiver QUALQUER um dos listados. */
export function PodePorPerfil({
  perfis,
  fallback = null,
  children,
}: {
  perfis: PerfilUsuario[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { usuario } = useSessao();
  return <>{temPerfil(usuario, ...perfis) ? children : fallback}</>;
}

/**
 * Capacidade contextual dentro de uma monitoria.
 *
 * A prop e o NOME da capacidade, nao uma expressao booleana montada no local de
 * uso — é o que mantem a regra viva em `capacidades.ts` e impede que ela seja
 * reescrita ligeiramente diferente em cada tela.
 *
 * Uso: <Pode capacidade="habilitarMonitor"><Button .../></Pode>
 */
export function Pode({
  capacidade,
  fallback = null,
  children,
}: {
  capacidade: keyof Capacidades;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { capacidades } = useContextoMonitoria();
  return <>{capacidades[capacidade] ? children : fallback}</>;
}
