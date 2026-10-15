import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type {
  Atendimento,
  EventoHistorico,
  HorariosLivresResposta,
  LoteDeAtendimentos,
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
  /**
   * A4 — sessões AGENDADAS que já começaram e em que EU sou o monitor.
   *
   * Só funciona em `/atendimentos/meus`; nas demais rotas o backend devolve 400
   * de propósito, em vez de ignorar em silêncio.
   */
  aguardandoRegistro?: boolean;
  /** A4 — REALIZADOS em que estive PRESENTE e ainda não avaliei. Idem acima. */
  pendentesDeAvaliacao?: boolean;
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

export interface FiltroHorariosLivres {
  /** Janela de busca, em ISO 8601. Máximo de 60 dias — acima disso o backend recusa com 400. */
  de: string;
  ate: string;
  /** Tamanho do slot. Omitido, o servidor usa `configuracao.agendamento.duracaoPadraoMinutos`. */
  duracaoMinutos?: number;
  /** Omitido, considera todos os monitores ativos da monitoria. */
  monitorParticipanteId?: string;
}

/**
 * A1 — horários concretos e clicáveis, para substituir data/início/fim digitados.
 *
 * Esta conta NÃO pode ser feita no cliente, e a tentativa produziria horários
 * que o servidor recusa: a janela de disponibilidade é validada em SQL com
 * `AT TIME ZONE`, as constraints EXCLUDE da RN03 também batem contra as
 * inscrições do solicitante em monitorias que ele não pode ler, e a
 * antecedência mínima depende do relógio do servidor.
 *
 * O resultado é uma SUGESTÃO do instante da consulta, não uma reserva. O 409 no
 * agendamento continua possível e continua correto.
 */
export function listarHorariosLivres(
  monitoriaId: string,
  filtro: FiltroHorariosLivres,
): Promise<HorariosLivresResposta> {
  return apiCliente.get<HorariosLivresResposta>(
    `/monitorias/${monitoriaId}/atendimentos/horarios-livres`,
    { query: { ...filtro } },
  );
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

/** Campos que todas as sessões da série compartilham — os mesmos do avulso, menos o horário. */
export interface DadosAgendamentoEmLote {
  monitorParticipanteId?: string;
  assunto: string;
  modalidade: ModalidadeAtendimento;
  local?: string;
  vagas?: number;
  /** 1 a 30 ocorrências. ISO 8601 montado no fuso da INSTITUIÇÃO. */
  ocorrencias: Array<{ inicio: string; fim: string }>;
}

/**
 * A2 — série de sessões recorrentes em uma requisição.
 *
 * SUCESSO PARCIAL, e é por isso que devolve 200 e não 201: cada ocorrência roda
 * na própria transação no servidor, então um feriado ou choque pontual recusa
 * apenas aquela data e cria as demais. Quem chama precisa ler `resultados` —
 * tratar como "deu certo" porque não houve exceção esconderia as recusas.
 *
 * Os monitorados recebem UM aviso referente à primeira sessão, mencionando as
 * demais; o backend não emite um evento por ocorrência.
 */
export function agendarAtendimentosEmLote(
  monitoriaId: string,
  dados: DadosAgendamentoEmLote,
): Promise<LoteDeAtendimentos> {
  return apiCliente.post<LoteDeAtendimentos>(
    `/monitorias/${monitoriaId}/atendimentos/lote`,
    dados,
  );
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

/**
 * Campos editaveis de uma sessao AGENDADA (PATCH /atendimentos/:id).
 *
 * Deliberadamente SEM horario, status, modalidade ou monitor: horario muda em
 * `reagendar` (que valida a disponibilidade e a agenda dos inscritos), status
 * em `realizar`/`cancelar`, e modalidade e monitor definem a sessao em si.
 *
 * So vao no corpo os campos que mudaram — omitir significa "nao mexer". `local`
 * vazio ('') LIMPA o local; e o unico jeito, porque o DTO nao aceita null.
 */
export interface DadosEdicaoAtendimento {
  assunto?: string;
  local?: string;
  vagas?: number;
}

export function atualizarAtendimento(
  atendimentoId: string,
  dados: DadosEdicaoAtendimento,
): Promise<Atendimento> {
  return apiCliente.patch<Atendimento>(`/atendimentos/${atendimentoId}`, dados);
}
