import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type Variante = 'primaria' | 'secundaria' | 'fantasma' | 'perigo' | 'link';
type Tamanho = 'sm' | 'md' | 'lg' | 'icone';

const VARIANTES: Record<Variante, string> = {
  primaria: 'bg-primaria text-primaria-contraste hover:bg-primaria/90 shadow-sm',
  secundaria: 'bg-superficie text-texto border border-borda hover:bg-fundo shadow-sm',
  fantasma: 'text-texto hover:bg-fundo',
  perigo: 'bg-perigo text-white hover:bg-perigo/90 shadow-sm',
  link: 'text-primaria underline-offset-4 hover:underline',
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icone: 'h-9 w-9',
};

/**
 * Classes do botao, para aplicar em um `<Link>`.
 *
 * Existe porque `<Button>` envolvendo `<Link>` produz um `<button>` dentro de um
 * `<a>` — HTML invalido e um pesadelo de acessibilidade (dois elementos
 * interativos aninhados, ordem de foco imprevisivel). Navegacao e `<a>`; acao e
 * `<button>`. Quando a aparencia precisa ser a mesma, o que se compartilha e o
 * estilo, nao o elemento.
 */
export function classesBotao(
  variante: Variante = 'primaria',
  tamanho: Tamanho = 'md',
  className?: string,
): string {
  return cn(
    'alvo-toque inline-flex items-center justify-center rounded-lg font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTES[variante],
    TAMANHOS[tamanho],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  /**
   * Em carregamento o botao fica desabilitado e mostra spinner.
   *
   * Nao e so estetica: impede o duplo envio. Nesta API, um segundo clique em
   * "Inscrever-se" ou "Avaliar" produz 409, e o usuario leria um erro por ter
   * clicado rapido demais.
   */
  carregando?: boolean;
  iconeEsquerda?: ReactNode;
  iconeDireita?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variante = 'primaria',
    tamanho = 'md',
    carregando = false,
    iconeEsquerda,
    iconeDireita,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'alvo-toque inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...props}
    >
      {carregando ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        iconeEsquerda
      )}
      {children}
      {!carregando && iconeDireita}
    </button>
  );
});
