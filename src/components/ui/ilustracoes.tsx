import { cn } from '@/lib/utils';

/**
 * Ilustracoes de estado vazio.
 *
 * Traco simples em `currentColor` (herda o cinza do texto suave) com um unico
 * detalhe no acento: leve o bastante para nao disputar com a acao ao lado, e
 * especifico o bastante para dizer DE QUE e o vazio (agenda, pessoas, acervo).
 * Sao decorativas — o texto do estado vazio carrega todo o sentido.
 */
export type NomeIlustracao = 'agenda' | 'pessoas' | 'acervo' | 'busca' | 'grade' | 'tarefas';

const TRACO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Desenho({ nome }: { nome: NomeIlustracao }) {
  switch (nome) {
    case 'agenda':
      return (
        <>
          <rect x="10" y="14" width="44" height="40" rx="5" {...TRACO} />
          <path d="M10 25h44M21 9v9M43 9v9" {...TRACO} />
          <rect x="34" y="34" width="10" height="9" rx="2" className="fill-acento" />
          <path d="M19 35h6M19 44h6" {...TRACO} opacity="0.5" />
        </>
      );
    case 'pessoas':
      return (
        <>
          <circle cx="24" cy="22" r="8" {...TRACO} />
          <path d="M10 50c1.5-9 7-14 14-14s12.5 5 14 14" {...TRACO} />
          <circle cx="44" cy="26" r="6" className="fill-acento" />
          <path d="M40 38c6 0 11 4 13 12" {...TRACO} opacity="0.5" />
        </>
      );
    case 'acervo':
      return (
        <>
          <path d="M12 12h10v40H12zM26 12h10v40H26z" {...TRACO} />
          <path d="M41 15l9-2 7 38-9 2z" {...TRACO} opacity="0.5" />
          <rect x="15" y="20" width="4" height="8" rx="1" className="fill-acento" />
        </>
      );
    case 'busca':
      return (
        <>
          <circle cx="28" cy="28" r="14" {...TRACO} />
          <path d="M38.5 38.5L52 52" {...TRACO} />
          <path d="M22 28h12" {...TRACO} opacity="0.5" />
          <circle cx="50" cy="14" r="4" className="fill-acento" />
        </>
      );
    case 'grade':
      return (
        <>
          <rect x="8" y="12" width="48" height="40" rx="5" {...TRACO} />
          <path d="M24 12v40M40 12v40M8 26h48M8 40h48" {...TRACO} opacity="0.45" />
          <rect x="26" y="28" width="12" height="10" rx="2" className="fill-acento" />
        </>
      );
    case 'tarefas':
      return (
        <>
          <rect x="12" y="10" width="40" height="46" rx="5" {...TRACO} />
          <path d="M21 24l3 3 6-6M21 38l3 3 6-6" {...TRACO} />
          <path d="M35 25h9M35 39h9" {...TRACO} opacity="0.5" />
          <circle cx="48" cy="12" r="5" className="fill-acento" />
        </>
      );
  }
}

export function Ilustracao({ nome, className }: { nome: NomeIlustracao; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      focusable="false"
      className={cn('h-14 w-14 text-neutro/60', className)}
    >
      <Desenho nome={nome} />
    </svg>
  );
}
