import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Cabecalho padrao de pagina.
 *
 * O `<h1>` fica aqui, e nao em cada tela, para garantir exatamente um por
 * pagina — a estrutura de titulos e o que permite navegar por cabecalhos em
 * leitor de tela.
 */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold text-texto sm:text-2xl">{titulo}</h1>
        {descricao && <p className="text-sm text-texto-suave">{descricao}</p>}
      </div>

      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
