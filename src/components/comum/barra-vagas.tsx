import { cn } from '@/lib/utils';

/**
 * "3 de 5 vagas", com barra de preenchimento.
 *
 * O NUMERO e a informacao; a barra e reforco de leitura rapida (por isso e
 * `aria-hidden`). A frase muda conforme o que a pessoa precisa decidir:
 * quando ha vaga e o atendimento aceita inscricao, o destaque vai para o que
 * resta ("2 livres"), em acento — e o convite a agir.
 *
 * `aceitaInscricao` vem calculado pelo servidor (relogio e regras dele); aqui
 * so e usado para decidir o destaque, nunca recalculado.
 */
export function BarraVagas({
  vagas,
  ocupadas,
  aceitaInscricao = false,
  compacta = false,
  className,
}: {
  vagas: number;
  ocupadas: number;
  aceitaInscricao?: boolean;
  compacta?: boolean;
  className?: string;
}) {
  const livres = Math.max(vagas - ocupadas, 0);
  const percentual = vagas > 0 ? Math.min(100, Math.round((ocupadas / vagas) * 100)) : 0;
  const lotado = livres === 0;
  const destacar = aceitaInscricao && !lotado;

  const texto =
    vagas === 1
      ? lotado
        ? 'Individual · ocupado'
        : 'Individual · livre'
      : `${ocupadas} de ${vagas} vagas`;

  return (
    <div className={cn('min-w-0', compacta ? 'w-28' : 'w-full max-w-44', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="truncate text-texto">{texto}</span>
        {vagas > 1 && (
          <span
            className={cn(
              'shrink-0 font-semibold',
              destacar ? 'text-acento-forte' : 'text-texto-suave',
            )}
          >
            {lotado ? 'lotado' : `${livres} ${livres === 1 ? 'livre' : 'livres'}`}
          </span>
        )}
      </div>

      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fundo-suave" aria-hidden>
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-200',
            lotado ? 'bg-neutro' : destacar ? 'bg-acento' : 'bg-primaria',
          )}
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}
