'use client';

import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

import { mensagemDeErro } from '@/lib/api/erros';

/**
 * Toasts.
 *
 * Divisao de responsabilidade que vale a pena manter:
 *  - TOAST confirma que algo deu certo, ou avisa de uma falha transitoria;
 *  - <Alert> inline mostra conflito de dominio (409) e erro de formulario, que
 *    o usuario precisa continuar lendo enquanto corrige.
 *
 * Um "voce ja possui atendimento neste horario" que some em 4 segundos deixa a
 * pessoa sem saber o que ajustar.
 */
export function ToastProvider() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{ className: 'text-sm' }}
    />
  );
}

export const toast = {
  sucesso: (mensagem: string, descricao?: string) =>
    sonnerToast.success(mensagem, { description: descricao }),
  erro: (mensagem: string, descricao?: string) =>
    sonnerToast.error(mensagem, { description: descricao }),
  info: (mensagem: string, descricao?: string) =>
    sonnerToast.info(mensagem, { description: descricao }),

  /** Atalho para falhas de mutacao: traduz o erro sem repetir o mapeamento. */
  deErro: (erro: unknown) => sonnerToast.error(mensagemDeErro(erro)),
};
