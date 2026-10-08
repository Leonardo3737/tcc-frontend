import type { ReactNode } from 'react';
import { BookOpen, Briefcase, Presentation } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ROTULO_PAPEL,
  ROTULO_STATUS_ATENDIMENTO,
  ROTULO_STATUS_INSCRICAO,
  ROTULO_STATUS_MONITORIA,
  ROTULO_STATUS_PARTICIPACAO,
} from '@/lib/dominio/rotulos';
import {
  PapelMonitoria,
  StatusAtendimento,
  StatusInscricao,
  StatusMonitoria,
  StatusParticipacao,
} from '@/types/dominio';

type Tom = 'neutro' | 'primaria' | 'sucesso' | 'alerta' | 'perigo' | 'info' | 'acento';

const TONS: Record<Tom, string> = {
  neutro: 'bg-fundo-suave text-texto-suave',
  primaria: 'bg-primaria-suave text-primaria',
  sucesso: 'bg-sucesso-suave text-sucesso',
  alerta: 'bg-alerta-suave text-alerta',
  perigo: 'bg-perigo-suave text-perigo',
  info: 'bg-primaria-suave text-primaria',
  acento: 'bg-acento-suave text-acento-forte',
};

/** Etiqueta generica: fundo tingido, sem borda. */
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
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold',
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
 * Duas FORMAS diferentes, de proposito:
 *  - STATUS e ponto + rotulo sobre fundo neutro ("• Agendado");
 *  - PAPEL e etiqueta preenchida com icone ("[icone] Monitor").
 *
 * Assim status e papel nao se confundem mesmo quando o matiz e parecido
 * (AGENDADO e MONITORADO vivem na familia do petroleo). E, como a forma e o
 * rotulo carregam o sentido, a cor nunca e a unica portadora da informacao.
 */

type TomStatus = 'programado' | 'positivo' | 'atencao' | 'terminal' | 'descartado';

const PONTO_STATUS: Record<TomStatus, string> = {
  programado: 'bg-primaria',
  positivo: 'bg-sucesso',
  atencao: 'bg-alerta-preenchimento',
  terminal: 'bg-neutro',
  // Cancelado: anel vazio em vez de ponto cheio — a forma diz "nao aconteceu".
  descartado: 'bg-transparent ring-1 ring-inset ring-neutro',
};

/** Classe de preenchimento por tom de status, para barras e graficos. */
export const PREENCHIMENTO_STATUS: Record<TomStatus, string> = {
  programado: 'bg-primaria',
  positivo: 'bg-sucesso',
  atencao: 'bg-alerta-preenchimento',
  terminal: 'bg-neutro',
  descartado: 'bg-borda-forte',
};

function BadgeStatus({ tom, children }: { tom: TomStatus; children: ReactNode }) {
  const apagado = tom === 'terminal' || tom === 'descartado';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-borda bg-superficie py-0.5 pl-2 pr-2.5 text-xs font-semibold',
        apagado ? 'text-texto-suave' : 'text-texto',
      )}
    >
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', PONTO_STATUS[tom])} />
      {children}
    </span>
  );
}

export const TOM_STATUS_MONITORIA: Record<StatusMonitoria, TomStatus> = {
  [StatusMonitoria.PLANEJADA]: 'programado',
  [StatusMonitoria.ATIVA]: 'positivo',
  [StatusMonitoria.ENCERRADA]: 'terminal',
  [StatusMonitoria.CANCELADA]: 'descartado',
};

export function BadgeStatusMonitoria({ status }: { status: StatusMonitoria }) {
  return (
    <BadgeStatus tom={TOM_STATUS_MONITORIA[status]}>{ROTULO_STATUS_MONITORIA[status]}</BadgeStatus>
  );
}

export const TOM_STATUS_ATENDIMENTO: Record<StatusAtendimento, TomStatus> = {
  [StatusAtendimento.AGENDADO]: 'programado',
  [StatusAtendimento.REALIZADO]: 'positivo',
  [StatusAtendimento.CANCELADO]: 'descartado',
};

export function BadgeStatusAtendimento({ status }: { status: StatusAtendimento }) {
  return (
    <BadgeStatus tom={TOM_STATUS_ATENDIMENTO[status]}>
      {ROTULO_STATUS_ATENDIMENTO[status]}
    </BadgeStatus>
  );
}

const TOM_STATUS_INSCRICAO: Record<StatusInscricao, TomStatus> = {
  [StatusInscricao.INSCRITO]: 'programado',
  [StatusInscricao.PRESENTE]: 'positivo',
  [StatusInscricao.AUSENTE]: 'atencao',
  [StatusInscricao.CANCELADA]: 'descartado',
};

export function BadgeStatusInscricao({ status }: { status: StatusInscricao }) {
  return (
    <BadgeStatus tom={TOM_STATUS_INSCRICAO[status]}>{ROTULO_STATUS_INSCRICAO[status]}</BadgeStatus>
  );
}

export function BadgeStatusParticipacao({ status }: { status: StatusParticipacao }) {
  return (
    <BadgeStatus tom={status === StatusParticipacao.ATIVO ? 'positivo' : 'terminal'}>
      {ROTULO_STATUS_PARTICIPACAO[status]}
    </BadgeStatus>
  );
}

/**
 * Cores de papel, reutilizadas fora do selo (faixa de cartao, bloco na grade).
 * O papel e CONTEXTUAL: vale dentro de uma monitoria especifica, nunca como
 * atributo da pessoa.
 */
export const CORES_PAPEL = {
  [PapelMonitoria.MONITOR]: {
    etiqueta: 'bg-papel-monitor-suave text-papel-monitor',
    preenchimento: 'bg-papel-monitor',
    texto: 'text-papel-monitor',
  },
  [PapelMonitoria.MONITORADO]: {
    etiqueta: 'bg-papel-monitorado-suave text-papel-monitorado',
    preenchimento: 'bg-papel-monitorado-preenchimento',
    texto: 'text-papel-monitorado',
  },
  responsavel: {
    etiqueta: 'bg-papel-professor-suave text-papel-professor',
    preenchimento: 'bg-papel-professor',
    texto: 'text-papel-professor',
  },
} as const;

export const ICONE_PAPEL = {
  [PapelMonitoria.MONITOR]: Presentation,
  [PapelMonitoria.MONITORADO]: BookOpen,
  responsavel: Briefcase,
} as const;

function EtiquetaPapel({
  chave,
  children,
  className,
}: {
  chave: keyof typeof CORES_PAPEL;
  children: ReactNode;
  className?: string;
}) {
  const Icone = ICONE_PAPEL[chave];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold',
        CORES_PAPEL[chave].etiqueta,
        className,
      )}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

export function BadgePapel({ papel, className }: { papel: PapelMonitoria; className?: string }) {
  return (
    <EtiquetaPapel chave={papel} className={className}>
      {ROTULO_PAPEL[papel]}
    </EtiquetaPapel>
  );
}

/** O professor responsavel tambem e um papel na monitoria — so que de quem administra. */
export function BadgeResponsavel({
  className,
  compacto = false,
}: {
  className?: string;
  compacto?: boolean;
}) {
  return (
    <EtiquetaPapel chave="responsavel" className={className}>
      {compacto ? 'Responsável' : 'Professor responsável'}
    </EtiquetaPapel>
  );
}
