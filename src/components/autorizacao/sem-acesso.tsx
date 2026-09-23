import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

import { classesBotao } from '@/components/ui/button';
import { rotas } from '@/config/rotas';

/**
 * Tela de acesso restrito.
 *
 * Por que renderizar isto em vez de redirecionar:
 *
 * Um `redirect()` chamado dentro de uma PAGINA acontece depois que o layout ja
 * comecou a ser transmitido. O Next entao nao consegue mais responder 307 e cai
 * num `<meta http-equiv="refresh">` com 1 segundo de atraso — o usuario ve a
 * tela restrita aparecer e sumir. Redirecionar so produz HTTP limpo quando a
 * decisao acontece ANTES do primeiro flush, ou seja, no layout (e por isso
 * `exigirSessao` funciona bem la).
 *
 * Dizer "esta area e restrita a professores" tambem e mais honesto do que
 * devolver a pessoa ao painel sem explicacao.
 *
 * Continua sendo UX: o backend responderia 403 de qualquer forma.
 */
export function SemAcesso({
  titulo = 'Área restrita',
  descricao,
}: {
  titulo?: string;
  descricao: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-dashed border-borda-forte bg-superficie/60 px-5 py-6 sm:flex-row sm:items-center sm:px-6">
      <ShieldOff className="h-8 w-8 shrink-0 text-texto-suave" aria-hidden />

      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-titulo text-titulo-cartao text-texto">{titulo}</h2>
        <p className="max-w-prose text-sm text-texto-suave">{descricao}</p>
      </div>

      <Link href={rotas.inicio} className={classesBotao('secundaria', 'md', 'shrink-0')}>
        Voltar ao início
      </Link>
    </div>
  );
}
