'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * Menu suspenso sobre Radix — navegacao por setas, Home/End, busca por digitacao
 * e fechamento no Escape vem prontos. Reimplementar roving tabindex a mao e
 * exatamente o tipo de codigo que parece funcionar e falha no teclado.
 */

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownConteudo({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-52 overflow-hidden rounded-lg border border-borda bg-superficie p-1 shadow-lg',
          'animate-fade-in',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  className,
  destrutivo = false,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { destrutivo?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors',
        'data-[highlighted]:bg-fundo data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destrutivo ? 'text-perigo data-[highlighted]:bg-perigo/10' : 'text-texto',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownSeparador({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator className={cn('my-1 h-px bg-borda', className)} {...props} />
  );
}

export function DropdownRotulo({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn('px-2.5 py-1.5 text-xs font-medium text-texto-suave', className)}
      {...props}
    />
  );
}
