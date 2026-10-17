import { ArrowRight, Megaphone } from 'lucide-react';
import Link from 'next/link';

import { rotas } from '@/config/rotas';
import { cn } from '@/lib/utils';
import type { EditalPublico } from '@/types/dominio';
import { formatarDataDeCalendario } from '../situacao';

/**
 * Destaque de "novidade" para a inscricao em edital.
 *
 * Componente de apresentacao PURO, sem consulta propria — quem decide se ele
 * aparece e quem ja tem a lista de editais abertos: a tela de login (que a
 * busca no servidor) e o dashboard do aluno (que a busca no cliente, por hook
 * compartilhado). Consultar aqui dentro faria a mesma requisicao duas vezes na
 * mesma arvore.
 *
 * Chama atencao sem disputar com o conteudo principal: a cor e o acento que o
 * design system ja usa para acao secundaria, nao um banner de cor nova.
 */
export function ChamadaDeInscricao({
  edital,
  className,
  tom = 'claro',
}: {
  edital: EditalPublico;
  className?: string;
  /** `escuro` para o painel do login, que tem fundo da cor primaria. */
  tom?: 'claro' | 'escuro';
}) {
  const escuro = tom === 'escuro';

  return (
    <Link
      href={`${rotas.inscricao}?edital=${edital.id}`}
      className={cn(
        'group flex items-start gap-3 rounded-xl border p-4 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        escuro
          ? 'border-white/20 bg-white/10 hover:bg-white/[0.16] focus-visible:ring-white focus-visible:ring-offset-primaria-forte'
          : 'border-acento/40 bg-acento-suave hover:border-acento focus-visible:ring-acento',
        className,
      )}
    >
      {/* <span
        aria-hidden
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          escuro ? 'bg-white/15 text-white' : 'bg-acento text-white',
        )}
      >
        <Megaphone className="h-4 w-4" />
      </span> */}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'inline-flex items-center rounded-full gap-2 px-4 py-1 text-[0.9rem] font-semibold uppercase tracking-wide',
            escuro ? 'bg-white/20 text-white' : 'bg-acento text-white',
          )}
        >
          Novidade!
          <Megaphone className="h-6 w-6" />
        </span>

        <span
          className={cn(
            'mt-1.5 block text-sm font-semibold',
            escuro ? 'text-white' : 'text-texto',
          )}
        >
          Inscrições abertas para monitoria {edital.ano}/{edital.semestre}
        </span>

        <span className={cn('block text-xs', escuro ? 'text-white/75' : 'text-texto-suave')}>
          Candidate-se até {formatarDataDeCalendario(edital.fimInscricoes)}. Não é preciso ter
          conta.
        </span>
      </span>

      <ArrowRight
        aria-hidden
        className={cn(
          'mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
          escuro ? 'text-white/70' : 'text-acento-forte',
        )}
      />
    </Link>
  );
}
