'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  capacidades as calcularCapacidades,
  contextoDaMonitoria,
  type Capacidades,
  type ContextoMonitoria,
} from '@/lib/autorizacao/capacidades';
import type { Monitoria } from '@/types/dominio';

/**
 * Contexto de UMA monitoria.
 *
 * Resolvido uma vez no `layout.tsx` de `/monitorias/[monitoriaId]` — que ja
 * chama `GET /monitorias/:id` — e herdado por todas as abas. Sem isso, cada aba
 * repetiria a mesma requisicao so para descobrir o papel do usuario.
 *
 * E aqui que o conceito central do dominio vira codigo: `meuPapel` e do usuario
 * NESTA monitoria. A mesma pessoa carrega outro contexto na monitoria ao lado, e
 * nenhum componente deve guardar "o papel do usuario" fora deste escopo.
 */
interface ValorContextoMonitoria {
  monitoria: Monitoria;
  contexto: ContextoMonitoria;
  capacidades: Capacidades;
}

const Contexto = createContext<ValorContextoMonitoria | null>(null);

export function MonitoriaProvider({
  monitoria,
  children,
}: {
  monitoria: Monitoria;
  children: ReactNode;
}) {
  const valor = useMemo<ValorContextoMonitoria>(() => {
    const contexto = contextoDaMonitoria(monitoria);
    return { monitoria, contexto, capacidades: calcularCapacidades(contexto) };
  }, [monitoria]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useContextoMonitoria(): ValorContextoMonitoria {
  const valor = useContext(Contexto);

  if (!valor) {
    throw new Error(
      'useContextoMonitoria precisa estar dentro de <MonitoriaProvider> ' +
        '(layout de /monitorias/[monitoriaId]).',
    );
  }

  return valor;
}
