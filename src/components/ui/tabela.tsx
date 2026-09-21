import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Tabela responsiva.
 *
 * O envoltorio com `overflow-x-auto` e obrigatorio: sem ele, uma tabela larga
 * empurra o BODY e a pagina inteira passa a rolar na horizontal no celular —
 * um dos defeitos mais comuns de layout responsivo.
 *
 * Para as listas do dominio (participantes, atendimentos) a transformacao em
 * cartoes abaixo de `md` fica em <ListaResponsiva>, que usa esta tabela apenas
 * no caminho desktop.
 */
export function Tabela({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function TabelaCabecalho({ children }: { children: ReactNode }) {
  return <thead className="border-b border-borda bg-fundo/60">{children}</thead>;
}

export function TabelaCorpo({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-borda">{children}</tbody>;
}

export function TabelaLinha({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <tr className={cn('transition-colors hover:bg-fundo/60', className)}>{children}</tr>;
}

export function TabelaCabecalhoCelula({
  className,
  children,
  scope = 'col',
}: {
  className?: string;
  children: ReactNode;
  scope?: 'col' | 'row';
}) {
  return (
    <th
      scope={scope}
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-texto-suave',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TabelaCelula({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <td className={cn('px-3 py-3 align-middle text-texto', className)}>{children}</td>;
}
