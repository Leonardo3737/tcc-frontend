import { Skeleton, SkeletonLista } from '@/components/ui/skeleton';

/**
 * Esqueleto padrao da area autenticada.
 *
 * Reproduz a forma da pagina (titulo + lista de cartoes) para que o conteudo
 * real substitua o esqueleto sem salto de layout. Paginas com forma muito
 * diferente devem trazer o proprio `loading.tsx`.
 */
export default function CarregandoArea() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <SkeletonLista itens={3} />
    </div>
  );
}
