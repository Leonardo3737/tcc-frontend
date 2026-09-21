import Link from 'next/link';
import { MapPin, Users, Video } from 'lucide-react';

import { Badge, BadgeStatusAtendimento } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { rotas } from '@/config/rotas';
import { formatarDataHoraExtensa, formatarIntervalo } from '@/lib/datas/fuso';
import { ModalidadeAtendimento, OrigemAtendimento, type Atendimento } from '@/types/dominio';

/**
 * Cartao de atendimento.
 *
 * Mostra a disciplina quando ela vem na resposta — o backend inclui o resumo da
 * monitoria em todas as rotas de atendimento, o que torna a agenda pessoal
 * (que atravessa varias monitorias) legivel sem uma requisicao por linha.
 */
export function CartaoAtendimento({
  atendimento,
  mostrarMonitoria = true,
  fuso,
}: {
  atendimento: Atendimento;
  mostrarMonitoria?: boolean;
  fuso: string;
}) {
  const remoto = atendimento.modalidade === ModalidadeAtendimento.REMOTO;
  const emGrupo = atendimento.vagas > 1;

  return (
    <Card className="transition-colors hover:border-primaria/40">
      <Link
        href={rotas.atendimento(atendimento.id)}
        className="block rounded-card p-4 focus-visible:ring-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {mostrarMonitoria && atendimento.monitoria && (
              <p className="font-mono text-xs text-texto-suave">
                {atendimento.monitoria.codigoDisciplina} · {atendimento.monitoria.periodo}
              </p>
            )}

            <h3 className="truncate font-medium text-texto">{atendimento.assunto}</h3>

            <p className="text-sm text-texto-suave">
              {formatarDataHoraExtensa(atendimento.inicio, fuso)} ·{' '}
              {formatarIntervalo(atendimento.inicio, atendimento.fim, fuso)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <BadgeStatusAtendimento status={atendimento.status} />
            {atendimento.aceitaInscricao && <Badge tom="info">Aceita inscrição</Badge>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
          <span className="inline-flex items-center gap-1.5">
            {remoto ? (
              <Video className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <MapPin className="h-3.5 w-3.5" aria-hidden />
            )}
            {atendimento.local ?? (remoto ? 'Remoto' : 'Presencial')}
          </span>

          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {emGrupo
              ? `${atendimento.vagasOcupadas}/${atendimento.vagas} vagas`
              : 'Individual'}
          </span>

          {atendimento.nomeMonitor && <span>Monitor: {atendimento.nomeMonitor}</span>}

          {atendimento.origem === OrigemAtendimento.SOLICITACAO_ALUNO && (
            <span className="text-texto-suave/80">Solicitado por aluno</span>
          )}
        </div>

        {/* Cancelado permanece na listagem (RN10), com o motivo à vista. */}
        {atendimento.motivoCancelamento && (
          <p className="mt-3 rounded-md bg-perigo/5 px-2.5 py-1.5 text-xs text-perigo">
            {atendimento.motivoCancelamento}
          </p>
        )}
      </Link>
    </Card>
  );
}
