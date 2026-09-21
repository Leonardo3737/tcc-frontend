import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type {
  Atendimento,
  EventoHistorico,
  ModalidadeAtendimento,
  StatusAtendimento,
} from '@/types/dominio';

/**
 * Atendimentos: a SESSAO e suas inscricoes.
 *
 * Um atendimento individual e apenas uma sessao com `vagas = 1` — nao ha dois
 * caminhos de codigo. As inscricoes vivem dentro do atendimento
 * (`POST /atendimentos/:id/inscricao`), nao como recurso separado.
 *
 * Nao existe DELETE: cancelar preserva a linha, o motivo e o autor (RN10).
 */

export type CampoOrdenacao = 'inicio' | 'criadoEm';
export type DirecaoOrdenacao = 'asc' | 'desc';

export interface FiltroAtendimentos {
  status?: StatusAtendimento;
  /** Limites de `inicio`, em ISO 8601. */
  de?: string;
  ate?: string;
  /** Filtra pelo VÍNCULO do monitor. */
  monitorParticipanteId?: string;
  /** Somente sessões AGENDADAS, com vaga e ainda não iniciadas. */
  aceitandoInscricao?: boolean;
  ordenarPor?: CampoOrdenacao;
  direcao?: DirecaoOrdenacao;
  pagina?: number;
  limite?: number;
}

/** Agenda pessoal, atravessando todas as monitorias. */
export function listarMeusAtendimentos(
  filtro: FiltroAtendimentos = {},
): Promise<RespostaPaginada<Atendimento>> {
  return apiCliente.get<RespostaPaginada<Atendimento>>('/atendimentos/meus', {
    query: { ...filtro },
  });
}

export function listarAtendimentosDaMonitoria(
  monitoriaId: string,
  filtro: FiltroAtendimentos = {},
): Promise<RespostaPaginada<Atendimento>> {
  return apiCliente.get<RespostaPaginada<Atendimento>>(`/monitorias/${monitoriaId}/atendimentos`, {
    query: { ...filtro },
  });
}

export function detalharAtendimento(atendimentoId: string): Promise<Atendimento> {
  return apiCliente.get<Atendimento>(`/atendimentos/${atendimentoId}`);
}

export function listarHistorico(atendimentoId: string): Promise<EventoHistorico[]> {
  return apiCliente.get<EventoHistorico[]>(`/atendimentos/${atendimentoId}/historico`);
}

export interface DadosAgendamento {
  /**
   * Vínculo do MONITOR que vai atender.
   * Obrigatório quando quem agenda é MONITORADO; ignorado quando o próprio
   * monitor abre a sessão (ele nunca agenda em nome de outro).
   */
  monitorParticipanteId?: string;
  /** ISO 8601 com fuso — montado a partir do fuso da INSTITUIÇÃO. */
  inicio: string;
  fim: string;
  assunto: string;
  modalidade: ModalidadeAtendimento;
  local?: string;
  /** Capacidade da sessão. 1 = atendimento individual. */
  vagas?: number;
}

/**
 * Um único endpoint atende os dois iniciadores (D-08):
 * MONITOR abre uma sessão (`origem = OFERTA_MONITOR`); MONITORADO solicita e já
 * entra inscrito nela (`origem = SOLICITACAO_ALUNO`). O servidor decide a origem
 * a partir do papel de quem pediu — não é um campo do corpo.
 */
export function agendarAtendimento(
  monitoriaId: string,
  dados: DadosAgendamento,
): Promise<Atendimento> {
  return apiCliente.post<Atendimento>(`/monitorias/${monitoriaId}/atendimentos`, dados);
}

export function inscreverEmAtendimento(atendimentoId: string): Promise<Atendimento> {
  return apiCliente.post<Atendimento>(`/atendimentos/${atendimentoId}/inscricao`);
}

/**
 * Desistência do monitorado. Se ele era o solicitante e ninguém mais restou
 * inscrito, o backend cancela o atendimento inteiro automaticamente.
 */
export function cancelarInscricao(atendimentoId: string): Promise<Atendimento> {
  return apiCliente.post<Atendimento>(`/atendimentos/${atendimentoId}/inscricao/cancelar`);
}

/**
 * AGENDADO -> REALIZADO, registrando presenças.
 *
 * `ausentes` recebe IDs DE INSCRIÇÃO (`inscricoes[].id`), não de participante
 * nem de usuário. Quem não for listado é considerado PRESENTE.
 */
export function realizarAtendimento(
  atendimentoId: string,
  ausentes: string[] = [],
): Promise<Atendimento> {
  return apiCliente.post<Atendimento>(`/atendimentos/${atendimentoId}/realizar`, { ausentes });
}

export function cancelarAtendimento(atendimentoId: string, motivo: string): Promise<Atendimento> {
  return apiCliente.post<Atendimento>(`/atendimentos/${atendimentoId}/cancelar`, { motivo });
}

/**
 * Reagenda mantendo o status AGENDADO.
 *
 * As inscrições acompanham o novo horário via ON UPDATE CASCADE no banco. Se
 * algum inscrito tiver conflito de agenda, o reagendamento inteiro é recusado
 * com 409 — comportamento correto, e a mensagem diz quem conflita.
 */
export function reagendarAtendimento(
  atendimentoId: string,
  dados: { inicio: string; fim: string; motivo: string },
): Promise<Atendimento> {
  return apiCliente.post<Atendimento>(`/atendimentos/${atendimentoId}/reagendar`, dados);
}
