'use client';

import { useEffect, useState } from 'react';

import { useSessao } from '@/providers/sessao-provider';
import { formatarDataHora } from '@/lib/datas/fuso';
import { descreverDataRelativa, distanciaCurta } from '@/lib/datas/relativa';
import { cn } from '@/lib/utils';

/**
 * Relogio compartilhado que avanca a cada minuto.
 *
 * "em 2 h" envelhece: sem atualizar, a tela aberta desde a manha diria "em 5 h"
 * para algo que ja passou. Um minuto e a resolucao do que se mostra.
 */
function useAgora(intervaloMs = 60_000): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const temporizador = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(temporizador);
  }, [intervaloMs]);

  return agora;
}

/**
 * "hoje, 14:00", "amanhã, 09:30", "qui, 25/09, 14:00" — e, com `comDistancia`,
 * "hoje, 14:00 · em 2 h".
 *
 * Sempre no fuso da instituicao (vem da sessao, que veio de GET /configuracao).
 * O `title` e o `dateTime` levam a data completa: quem passa o mouse ou usa
 * leitor de tela tem o dado exato, nao so a aproximacao.
 *
 * `suppressHydrationWarning` porque o texto depende do relogio: o servidor
 * renderiza num instante e o navegador hidrata noutro. A diferenca, quando
 * existe, e de um minuto, e a primeira atualizacao ja a corrige.
 */
export function DataRelativa({
  instante,
  comHora = true,
  comDistancia = false,
  className,
}: {
  instante: string;
  comHora?: boolean;
  comDistancia?: boolean;
  className?: string;
}) {
  const { fuso } = useSessao();
  const agora = useAgora();

  const texto = descreverDataRelativa(instante, agora, fuso, { comHora });
  const distancia = comDistancia ? distanciaCurta(instante, agora) : null;

  return (
    <time
      dateTime={instante}
      title={formatarDataHora(instante, fuso)}
      className={cn('tabular-nums', className)}
      suppressHydrationWarning
    >
      {texto}
      {distancia && <span className="text-texto-suave"> · {distancia}</span>}
    </time>
  );
}
