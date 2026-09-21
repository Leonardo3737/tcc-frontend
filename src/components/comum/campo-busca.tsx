'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Busca com debounce.
 *
 * O debounce nao e cosmetico: sem ele, cada tecla dispara uma requisicao, e o
 * backend tem rate limit global (120 req/min). Digitar "calculo diferencial"
 * gastaria 20 requisicoes do orcamento para exibir um resultado.
 *
 * O input e controlado localmente e so sincroniza com a URL depois da pausa —
 * caso contrario o cursor saltaria a cada re-render vindo da navegacao.
 */
export function CampoBusca({
  valorInicial,
  aoBuscar,
  placeholder = 'Buscar…',
  rotulo = 'Buscar',
  carregando = false,
  className,
  atrasoMs = 400,
}: {
  valorInicial: string;
  aoBuscar: (termo: string) => void;
  placeholder?: string;
  rotulo?: string;
  carregando?: boolean;
  className?: string;
  atrasoMs?: number;
}) {
  const [texto, setTexto] = useState(valorInicial);

  useEffect(() => {
    if (texto === valorInicial) return;

    const temporizador = setTimeout(() => aoBuscar(texto.trim()), atrasoMs);
    return () => clearTimeout(temporizador);
    // `aoBuscar` muda a cada render do pai; incluir na lista reiniciaria o
    // temporizador sem parar e o debounce nunca dispararia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, valorInicial, atrasoMs]);

  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-suave"
        aria-hidden
      />

      <input
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        className="alvo-toque w-full rounded-lg border border-borda bg-superficie py-2 pl-9 pr-16 text-sm shadow-sm placeholder:text-texto-suave/70"
      />

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-texto-suave" aria-hidden />}

        {texto && (
          <button
            type="button"
            onClick={() => {
              setTexto('');
              aoBuscar('');
            }}
            aria-label="Limpar busca"
            className="rounded p-1 text-texto-suave transition-colors hover:bg-fundo hover:text-texto"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
