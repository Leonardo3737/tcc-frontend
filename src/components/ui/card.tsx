import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Cartao.
 *
 * Borda fina e nenhuma sombra: cartao e uma regiao da pagina, nao algo que
 * flutua sobre ela. A hierarquia vem do espaco e, quando ha um dado que
 * identifica o conteudo (a disciplina, o papel), de uma FAIXA de cor na lateral
 * — que diz mais do que uma sombra generica.
 *
 * `faixa` recebe a classe `before:bg-*` (ver `classesCorDisciplina().faixa`).
 */
export function Card({
  className,
  faixa,
  ...props
}: HTMLAttributes<HTMLDivElement> & { faixa?: string }) {
  return (
    <div
      className={cn(
        'rounded-card border border-borda bg-superficie',
        faixa &&
          "relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        faixa,
        className,
      )}
      {...props}
    />
  );
}

export function CardCabecalho({
  titulo,
  descricao,
  acao,
  className,
  nivel = 'h2',
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
  nivel?: 'h2' | 'h3';
}) {
  const Titulo = nivel;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pt-5',
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <Titulo className="font-titulo text-titulo-cartao text-texto">{titulo}</Titulo>
        {descricao && <p className="text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

export function CardConteudo({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function CardRodape({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t border-borda bg-fundo/50 px-4 py-3 sm:px-5',
        className,
      )}
      {...props}
    />
  );
}
