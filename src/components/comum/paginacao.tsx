'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { MetaPaginacao } from '@/types/api';

/**
 * Paginacao SERVER-SIDE.
 *
 * O backend ja pagina (`{dados, meta}` com `total` e `totalPaginas`), entao aqui
 * nao se corta array nenhum: apenas navegamos entre paginas reais. Paginar no
 * cliente sobre um recorte que o servidor ja limitou produziria contagens
 * erradas — e esconderia registros.
 */
export function Paginacao({
  meta,
  aoMudarPagina,
  desabilitado = false,
}: {
  meta: MetaPaginacao;
  aoMudarPagina: (pagina: number) => void;
  desabilitado?: boolean;
}) {
  // Uma pagina so: nao ha o que navegar.
  if (meta.totalPaginas <= 1) {
    return (
      <p className="px-1 py-2 text-xs text-texto-suave">
        {meta.total} {meta.total === 1 ? 'registro' : 'registros'}
      </p>
    );
  }

  const primeiro = (meta.pagina - 1) * meta.limite + 1;
  const ultimo = Math.min(meta.pagina * meta.limite, meta.total);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-col items-center justify-between gap-3 border-t border-borda pt-3 sm:flex-row"
    >
      <p className="text-xs text-texto-suave" aria-live="polite">
        {primeiro}–{ultimo} de {meta.total}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variante="secundaria"
          tamanho="sm"
          disabled={desabilitado || meta.pagina <= 1}
          onClick={() => aoMudarPagina(meta.pagina - 1)}
          iconeEsquerda={<ChevronLeft className="h-4 w-4" aria-hidden />}
        >
          Anterior
        </Button>

        <span className="px-1 text-xs text-texto-suave">
          {meta.pagina} de {meta.totalPaginas}
        </span>

        <Button
          variante="secundaria"
          tamanho="sm"
          disabled={desabilitado || meta.pagina >= meta.totalPaginas}
          onClick={() => aoMudarPagina(meta.pagina + 1)}
          iconeDireita={<ChevronRight className="h-4 w-4" aria-hidden />}
        >
          Próxima
        </Button>
      </div>
    </nav>
  );
}
