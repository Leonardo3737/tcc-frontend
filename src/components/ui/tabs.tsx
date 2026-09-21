'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * Abas sobre Radix (ARIA tablist + navegacao por setas).
 *
 * Uso previsto: abas dentro de uma pagina cujo conteudo nao merece URL propria.
 * Quando cada aba for uma rota — como as da monitoria (participantes,
 * atendimentos, materiais) — use navegacao real do App Router: a aba precisa ser
 * compartilhavel, recarregavel e voltar com o botao do navegador.
 */

export const Tabs = TabsPrimitive.Root;

export function TabsLista({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-borda',
        // A barra some no desktop; no mobile o scroll horizontal e o proprio
        // affordance de que ha mais abas.
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  );
}

export function TabsGatilho({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'alvo-toque shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium',
        'text-texto-suave transition-colors hover:text-texto',
        'data-[state=active]:border-primaria data-[state=active]:text-primaria',
        className,
      )}
      {...props}
    />
  );
}

export function TabsConteudo({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('pt-4', className)} {...props} />;
}
