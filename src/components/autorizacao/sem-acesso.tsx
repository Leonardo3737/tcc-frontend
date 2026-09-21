import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

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
    <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-borda bg-superficie/60 px-6 py-16 text-center">
      <ShieldOff className="h-8 w-8 text-texto-suave" aria-hidden />

      <div className="space-y-1">
        <h2 className="font-medium text-texto">{titulo}</h2>
        <p className="mx-auto max-w-md text-sm text-texto-suave">{descricao}</p>
      </div>

      <Link
        href={rotas.inicio}
        className="rounded-lg border border-borda bg-superficie px-4 py-2 text-sm font-medium text-texto transition-colors hover:bg-fundo"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
