import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type TomAlerta = 'info' | 'sucesso' | 'alerta' | 'erro';

const ESTILOS: Record<TomAlerta, { caixa: string; icone: typeof Info }> = {
  info: { caixa: 'border-info/30 bg-info/5 text-info', icone: Info },
  sucesso: { caixa: 'border-sucesso/30 bg-sucesso/5 text-sucesso', icone: CheckCircle2 },
  alerta: { caixa: 'border-alerta/30 bg-alerta/5 text-alerta', icone: AlertTriangle },
  erro: { caixa: 'border-perigo/30 bg-perigo/5 text-perigo', icone: XCircle },
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
  const { caixa, icone: Icone } = ESTILOS[tom];

  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg border p-3 text-sm', caixa, className)}
    >
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-texto/80">{children}</div>}
      </div>
    </div>
  );
}
