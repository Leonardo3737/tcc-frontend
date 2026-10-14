'use client';

import { useEffect } from 'react';

import './globals.css';
import { TelaServidorIndisponivel } from '@/components/comum/servidor-indisponivel';
import { ehServidorIndisponivel } from '@/lib/api/erros';

/**
 * Ultima rede: erro que escapou de todas as fronteiras, inclusive do layout
 * raiz. Sem este arquivo, o Next mostra a tela branca "Application error: a
 * server-side exception has occurred", que nao diz nada a quem usa.
 *
 * Substitui o layout raiz inteiro, por isso declara `<html>` e `<body>` e
 * importa o CSS por conta propria (as fontes do layout nao carregam aqui; o
 * texto cai na fonte do sistema, o que e aceitavel numa tela de excecao).
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro não tratado:', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        {ehServidorIndisponivel(error) ? (
          <TelaServidorIndisponivel />
        ) : (
          <main className="flex min-h-dvh items-center justify-center bg-fundo px-4 py-10">
            <div className="w-full max-w-lg rounded-card border border-borda bg-superficie p-6 sm:p-8">
              <h1 className="font-titulo text-titulo-pagina text-texto">Algo deu errado</h1>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-texto">
                Não foi possível abrir esta página agora. Tente de novo em instantes; se o problema
                continuar, avise o professor responsável pela sua monitoria.
              </p>
              {error.digest && (
                <p className="mt-3 text-xs text-texto-suave">
                  Código para suporte: <span className="font-mono">{error.digest}</span>
                </p>
              )}
              <button
                type="button"
                onClick={reset}
                className="alvo-toque mt-6 inline-flex h-10 items-center rounded-md bg-primaria px-4 text-sm font-semibold text-primaria-contraste hover:bg-primaria-forte"
              >
                Tentar de novo
              </button>
            </div>
          </main>
        )}
      </body>
    </html>
  );
}
