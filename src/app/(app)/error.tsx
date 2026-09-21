'use client';

import { useEffect } from 'react';

import { EstadoErro } from '@/components/ui/estados';

/**
 * Fronteira de erro da area autenticada.
 *
 * Fica no grupo `(app)`, e nao so na raiz, para que uma falha em uma pagina nao
 * derrube o shell inteiro: o menu e o cabecalho continuam renderizados e o
 * usuario consegue navegar para outro lugar em vez de ficar preso numa tela
 * morta.
 */
export default function ErroDaArea({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em producao a mensagem original nao chega ao cliente — o `digest`
    // correlaciona esta tela com a entrada correspondente no log do servidor.
    console.error('Erro na área autenticada:', error);
  }, [error]);

  return (
    <div className="py-6">
      <EstadoErro erro={error} aoTentarNovamente={reset} />
    </div>
  );
}
