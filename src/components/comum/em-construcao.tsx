import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';

import { EstadoVazio } from '@/components/ui/estados';

/**
 * Marcador honesto de area ainda nao implementada.
 *
 * Existe porque o menu ja aponta para estas rotas: sem elas, cada item levaria a
 * um 404, que o usuario leria como defeito. A lista de `proximosPassos` deixa
 * explicito o que vem por ali — util tambem para acompanhar o plano de etapas.
 */
export function EmConstrucao({
  titulo,
  descricao,
  proximosPassos,
}: {
  titulo: string;
  descricao: string;
  proximosPassos?: ReactNode;
}) {
  return (
    <EstadoVazio
      icone={<Construction className="h-8 w-8" aria-hidden />}
      titulo={titulo}
      descricao={descricao}
      acao={
        proximosPassos && (
          <div className="mx-auto max-w-md text-left text-sm text-texto-suave">
            {proximosPassos}
          </div>
        )
      }
    />
  );
}
