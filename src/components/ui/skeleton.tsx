import { cn } from '@/lib/utils';

/**
 * Esqueleto de carregamento.
 *
 * Regra que vale para todos os usos: o esqueleto deve ter a MESMA altura do
 * conteudo final. Um esqueleto menor produz salto de layout quando os dados
 * chegam — que e justamente o incomodo que ele deveria evitar.
 *
 * `aria-hidden` porque isto e ruido visual para leitor de tela; quem anuncia o
 * carregamento e a regiao com `aria-busy` ao redor.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-borda/70', className)} />;
}

export function SkeletonTexto({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: linhas }).map((_, indice) => (
        <Skeleton
          key={indice}
          // A ultima linha mais curta imita a quebra natural de um paragrafo.
          className={cn('h-4', indice === linhas - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-card border border-borda bg-superficie p-4 sm:p-5', className)}>
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

export function SkeletonLista({ itens = 4 }: { itens?: number }) {
  return (
    <div className="space-y-3" role="status" aria-busy aria-label="Carregando lista">
      {Array.from({ length: itens }).map((_, indice) => (
        <SkeletonCard key={indice} />
      ))}
    </div>
  );
}
