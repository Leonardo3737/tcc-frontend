import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-borda bg-superficie shadow-sm', className)}
      {...props}
    />
  );
}

export function CardCabecalho({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-borda p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="truncate text-base font-semibold text-texto">{titulo}</h2>
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
      className={cn('flex items-center gap-3 border-t border-borda p-4 sm:p-5', className)}
      {...props}
    />
  );
}
