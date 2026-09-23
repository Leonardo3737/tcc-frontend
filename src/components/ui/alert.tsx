import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type TomAlerta = 'info' | 'sucesso' | 'alerta' | 'erro';

const ESTILOS: Record<TomAlerta, { caixa: string; icone: typeof Info; cor: string }> = {
  info: { caixa: 'border-primaria bg-primaria-suave/60', icone: Info, cor: 'text-primaria' },
  sucesso: {
    caixa: 'border-sucesso bg-sucesso-suave/70',
    icone: CheckCircle2,
    cor: 'text-sucesso',
  },
  alerta: {
    caixa: 'border-alerta-preenchimento bg-alerta-suave/70',
    icone: AlertTriangle,
    cor: 'text-alerta',
  },
  erro: { caixa: 'border-perigo bg-perigo-suave/70', icone: XCircle, cor: 'text-perigo' },
};

/**
 * Alerta inline.
 *
 * Diferente do toast: o toast e para confirmar uma acao que deu certo; o alerta
 * fica na tela e e onde o 409 (conflito de dominio) deve aparecer. Um erro de
 * regra de negocio — "voce ja tem atendimento neste horario" — precisa continuar
 * visivel enquanto o usuario corrige o formulario, e nao sumir em 4 segundos.
 *
 * `role="alert"` faz o leitor de tela anunciar o conteudo assim que ele aparece.
 */
export function Alert({
  tom = 'info',
  titulo,
  className,
  children,
}: {
  tom?: TomAlerta;
  titulo?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { caixa, icone: Icone, cor } = ESTILOS[tom];

  return (
    <div
      role="alert"
      // Faixa lateral em vez de caixa contornada: le-se como nota na margem, e
      // nao compete com os cartoes ao redor.
      className={cn('flex gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-sm', caixa, className)}
    >
      <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', cor)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {titulo && <p className={cn('font-semibold', cor)}>{titulo}</p>}
        {children && <div className="text-texto">{children}</div>}
      </div>
    </div>
  );
}
