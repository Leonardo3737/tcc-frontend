'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Dialog/Modal sobre Radix.
 *
 * A dependencia se justifica pelo que ela entrega e que e caro de acertar a mao:
 * armadilha de foco, retorno do foco ao elemento que abriu, fechar no Escape,
 * `aria-modal` e inertizacao do resto da pagina. Um modal sem isso e uma
 * armadilha para quem navega por teclado ou leitor de tela.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogConteudo({
  titulo,
  descricao,
  className,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: string;
  className?: string;
  children?: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-texto/35" />

      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[85vh] overflow-y-auto rounded-card border border-borda bg-superficie shadow-flutuante',
          'animate-zoom-in',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0 space-y-1">
            <DialogPrimitive.Title className="font-titulo text-titulo-secao text-texto">
              {titulo}
            </DialogPrimitive.Title>

            {/* Description sempre presente: o Radix avisa no console quando falta,
                e o leitor de tela perde o contexto do que o modal pede. */}
            <DialogPrimitive.Description
              className={cn('text-sm text-texto-suave', !descricao && 'sr-only')}
            >
              {descricao ?? titulo}
            </DialogPrimitive.Description>
          </div>

          <DialogPrimitive.Close
            className="alvo-toque -m-1 rounded-lg p-1 text-texto-suave transition-colors hover:bg-fundo-suave hover:text-texto"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>

        {children && <div className="p-4 sm:p-5">{children}</div>}

        {rodape && (
          <div className="flex flex-col-reverse gap-2 border-t border-borda bg-fundo/50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            {rodape}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
