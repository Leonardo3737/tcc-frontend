import {
  ModalidadeAtendimento,
  PapelMonitoria,
  StatusAtendimento,
  StatusInscricao,
  StatusMonitoria,
  StatusParticipacao,
} from '@/types/dominio';

/**
 * Rotulos de dominio em linguagem de gente.
 *
 * O enum do backend ("AGENDADO", "MONITORADO") e contrato, nao texto de tela.
 * Centralizar a traducao aqui garante que "Cancelado" seja escrito igual no
 * selo, no grafico e na frase — e que mudar a palavra seja uma edicao so.
 */

export const ROTULO_STATUS_MONITORIA: Record<StatusMonitoria, string> = {
  [StatusMonitoria.PLANEJADA]: 'Planejada',
  [StatusMonitoria.ATIVA]: 'Ativa',
  [StatusMonitoria.ENCERRADA]: 'Encerrada',
  [StatusMonitoria.CANCELADA]: 'Cancelada',
};

export const ROTULO_STATUS_ATENDIMENTO: Record<StatusAtendimento, string> = {
  [StatusAtendimento.AGENDADO]: 'Agendado',
  [StatusAtendimento.REALIZADO]: 'Realizado',
  [StatusAtendimento.CANCELADO]: 'Cancelado',
};

export const ROTULO_STATUS_INSCRICAO: Record<StatusInscricao, string> = {
  [StatusInscricao.INSCRITO]: 'Inscrito',
  [StatusInscricao.PRESENTE]: 'Presente',
  [StatusInscricao.AUSENTE]: 'Ausente',
  [StatusInscricao.CANCELADA]: 'Desistiu',
};

export const ROTULO_STATUS_PARTICIPACAO: Record<StatusParticipacao, string> = {
  [StatusParticipacao.ATIVO]: 'Ativo',
  [StatusParticipacao.ENCERRADO]: 'Encerrado',
};

export const ROTULO_PAPEL: Record<PapelMonitoria, string> = {
  [PapelMonitoria.MONITOR]: 'Monitor',
  [PapelMonitoria.MONITORADO]: 'Monitorado',
};

export const ROTULO_MODALIDADE: Record<ModalidadeAtendimento, string> = {
  [ModalidadeAtendimento.PRESENCIAL]: 'Presencial',
  [ModalidadeAtendimento.REMOTO]: 'Remoto',
};

/** Rotulo para uma chave vinda de `porStatus` (analytics), que chega como string. */
export function rotuloDeStatus(status: string): string {
  return (
    (ROTULO_STATUS_ATENDIMENTO as Record<string, string>)[status] ??
    (ROTULO_STATUS_MONITORIA as Record<string, string>)[status] ??
    status
  );
}
