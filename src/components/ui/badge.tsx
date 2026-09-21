import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  PapelMonitoria,
  StatusAtendimento,
  StatusInscricao,
  StatusMonitoria,
  StatusParticipacao,
} from '@/types/dominio';

type Tom = 'neutro' | 'primaria' | 'sucesso' | 'alerta' | 'perigo' | 'info';

const TONS: Record<Tom, string> = {
  neutro: 'bg-fundo text-texto-suave border-borda',
  primaria: 'bg-primaria-suave text-primaria border-primaria/20',
  sucesso: 'bg-sucesso/10 text-sucesso border-sucesso/20',
  alerta: 'bg-alerta/10 text-alerta border-alerta/20',
  perigo: 'bg-perigo/10 text-perigo border-perigo/20',
  info: 'bg-info/10 text-info border-info/20',
};

export function Badge({
  tom = 'neutro',
  className,
  children,
}: {
  tom?: Tom;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Badges de dominio.
 *
 * Ficam aqui, e nao espalhados, porque a cor de um status e uma decisao de
 * significado: CANCELADA e vermelho em qualquer tela, e mudar isso deve ser uma
 * edicao unica. O texto tambem carrega o sentido — cor sozinha nao e acessivel.
 */

const TOM_STATUS_MONITORIA: Record<StatusMonitoria, Tom> = {
  [StatusMonitoria.PLANEJADA]: 'alerta',
  [StatusMonitoria.ATIVA]: 'sucesso',
  [StatusMonitoria.ENCERRADA]: 'neutro',
  [StatusMonitoria.CANCELADA]: 'perigo',
};

export function BadgeStatusMonitoria({ status }: { status: StatusMonitoria }) {
  return <Badge tom={TOM_STATUS_MONITORIA[status]}>{status}</Badge>;
}

const TOM_STATUS_ATENDIMENTO: Record<StatusAtendimento, Tom> = {
  [StatusAtendimento.AGENDADO]: 'info',
  [StatusAtendimento.REALIZADO]: 'sucesso',
  [StatusAtendimento.CANCELADO]: 'perigo',
};

export function BadgeStatusAtendimento({ status }: { status: StatusAtendimento }) {
  return <Badge tom={TOM_STATUS_ATENDIMENTO[status]}>{status}</Badge>;
}

const TOM_STATUS_INSCRICAO: Record<StatusInscricao, Tom> = {
  [StatusInscricao.INSCRITO]: 'info',
  [StatusInscricao.PRESENTE]: 'sucesso',
  [StatusInscricao.AUSENTE]: 'alerta',
  [StatusInscricao.CANCELADA]: 'neutro',
};

export function BadgeStatusInscricao({ status }: { status: StatusInscricao }) {
  return <Badge tom={TOM_STATUS_INSCRICAO[status]}>{status}</Badge>;
}

/**
 * O papel e CONTEXTUAL: vale dentro de uma monitoria especifica, nunca como
 * atributo da pessoa. O mesmo aluno pode ser MONITOR aqui e MONITORADO ali —
 * e essa distincao e o coracao do modelo de dominio.
 */
export function BadgePapel({ papel }: { papel: PapelMonitoria }) {
  return (
    <Badge tom={papel === PapelMonitoria.MONITOR ? 'primaria' : 'neutro'}>
      {papel === PapelMonitoria.MONITOR ? 'Monitor' : 'Monitorado'}
    </Badge>
  );
}

export function BadgeStatusParticipacao({ status }: { status: StatusParticipacao }) {
  return (
    <Badge tom={status === StatusParticipacao.ATIVO ? 'sucesso' : 'neutro'}>
      {status === StatusParticipacao.ATIVO ? 'Ativo' : 'Encerrado'}
    </Badge>
  );
}
