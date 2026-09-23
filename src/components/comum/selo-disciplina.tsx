import { classesCorDisciplina, siglaDisciplina } from '@/lib/cores/disciplina';
import { cn } from '@/lib/utils';

/**
 * Selo com as iniciais da disciplina, na cor estavel dela.
 *
 * Decorativo (`aria-hidden`): o nome e o codigo aparecem sempre ao lado. A cor
 * ajuda a localizar "Calculo I" numa lista sem ler — nao substitui o rotulo.
 */
export function SeloDisciplina({
  codigo,
  nome,
  tamanho = 'md',
  className,
}: {
  codigo: string | null | undefined;
  nome: string | null | undefined;
  tamanho?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const cores = classesCorDisciplina(codigo);

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-md font-titulo font-semibold text-white',
        tamanho === 'sm' && 'h-6 w-6 text-[0.625rem]',
        tamanho === 'md' && 'h-9 w-9 text-xs',
        tamanho === 'lg' && 'h-12 w-12 text-sm',
        cores.solido,
        className,
      )}
    >
      {siglaDisciplina(nome, codigo)}
    </span>
  );
}
