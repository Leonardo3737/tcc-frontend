import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Marca da plataforma.
 *
 * Dois circulos que se sobrepoem: quem ensina e quem aprende, e a area comum
 * entre eles — que e o atendimento. Desenho simples o bastante para funcionar
 * em 20px e sem depender de imagem externa.
 */
export function SimboloMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden focusable="false" className={cn('h-7 w-7', className)}>
      <rect width="32" height="32" rx="8" className="fill-primaria" />
      <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="white" strokeWidth="2.2" />
      <circle
        cx="19.5"
        cy="16"
        r="6.5"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        opacity="0.7"
      />
      <path d="M16 10.6a6.5 6.5 0 0 1 0 10.8a6.5 6.5 0 0 1 0-10.8z" className="fill-acento" />
    </svg>
  );
}

export function Marca({
  href,
  compacta = false,
  sobreEscuro = false,
}: {
  href: string;
  compacta?: boolean;
  /** Na sidebar em petroleo o texto fica claro. */
  sobreEscuro?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md font-titulo text-base font-semibold tracking-tight',
        sobreEscuro ? 'text-white' : 'text-texto',
      )}
    >
      <SimboloMarca className={sobreEscuro ? '[&>rect]:fill-white/10' : undefined} />
      {compacta ? <span className="sr-only">Monitoria</span> : <span>Monitoria</span>}
    </Link>
  );
}
