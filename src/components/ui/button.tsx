import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type Variante = 'primaria' | 'secundaria' | 'fantasma' | 'perigo' | 'link';
type Tamanho = 'sm' | 'md' | 'lg' | 'icone' | 'icone-sm';

/**
 * Hierarquia de botoes.
 *
 *  - primaria:   UMA por tela — a acao que responde "o que eu faco aqui?";
 *  - secundaria: alternativas legitimas (contorno, sem preenchimento);
 *  - fantasma:   acoes de apoio e icones em barras;
 *  - perigo:     so no botao que CONFIRMA algo irreversivel. O gatilho que abre a
 *                confirmacao e secundario — vermelho espalhado vira ruido.
 */
const VARIANTES: Record<Variante, string> = {
  primaria: 'bg-primaria text-primaria-contraste hover:bg-primaria-forte active:bg-primaria-forte',
  secundaria:
    'bg-superficie text-texto border border-borda-forte hover:border-texto-suave/60 hover:bg-fundo',
  fantasma: 'text-texto hover:bg-fundo-suave',
  perigo: 'bg-perigo text-white hover:bg-perigo/90',
  link: 'text-primaria underline-offset-4 hover:underline',
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icone: 'h-9 w-9',
  'icone-sm': 'h-8 w-8',
};

const BASE =
  'alvo-toque inline-flex items-center justify-center rounded-md font-semibold ' +
  'transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-50';

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
  return cn(BASE, VARIANTES[variante], TAMANHOS[tamanho], className);
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
      className={cn(BASE, VARIANTES[variante], TAMANHOS[tamanho], className)}
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
