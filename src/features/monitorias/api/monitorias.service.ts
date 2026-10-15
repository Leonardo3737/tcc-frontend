import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type {
  Monitoria,
  Participante,
  PapelMonitoria,
  StatusMonitoria,
  StatusParticipacao,
} from '@/types/dominio';

/**
 * Monitorias e participantes.
 *
 * Ficam no mesmo servico porque o backend faz a mesma escolha: o participante e
 * um SUB-RECURSO da monitoria (`/monitorias/:id/participantes`), e seu ciclo de
 * vida e inseparavel dela.
 *
 * ATENCAO aos dois identificadores:
 *  - `alunoId` = id do USUARIO (as tabelas alunos/professores tem usuario_id como PK);
 *  - `participanteId` = id do VINCULO em monitoria_participantes.
 */

export interface FiltroMonitorias {
  busca?: string;
  disciplinaId?: string;
  professorId?: string;
  ano?: number;
  semestre?: number;
  status?: StatusMonitoria;
  pagina?: number;
  limite?: number;
}

export function listarMonitorias(filtro: FiltroMonitorias): Promise<RespostaPaginada<Monitoria>> {
  return apiCliente.get<RespostaPaginada<Monitoria>>('/monitorias', { query: { ...filtro } });
}

export interface FiltroMinhasMonitorias {
  /** Repetido na query (`?status=ATIVA&status=ENCERRADA`), como o backend espera. */
  status?: StatusMonitoria[];
  ano?: number;
  semestre?: number;
  pagina?: number;
  limite?: number;
}

/**
 * Monitorias do usuario, com o papel dele em cada uma.
 *
 * O backend filtra PLANEJADA + ATIVA por padrao (visao de dashboard). Para ver o
 * historico e preciso pedir os status terminais explicitamente.
 */
export function listarMinhasMonitorias(
  filtro: FiltroMinhasMonitorias = {},
): Promise<RespostaPaginada<Monitoria>> {
  return apiCliente.get<RespostaPaginada<Monitoria>>('/monitorias/minhas', {
    query: { ...filtro },
  });
}

export function detalharMonitoria(monitoriaId: string): Promise<Monitoria> {
  return apiCliente.get<Monitoria>(`/monitorias/${monitoriaId}`);
}

export interface DadosCriarMonitoria {
  disciplinaId: string;
  ano: number;
  semestre: number;
  descricao?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function criarMonitoria(dados: DadosCriarMonitoria): Promise<Monitoria> {
  return apiCliente.post<Monitoria>('/monitorias', dados);
}

/**
 * Nao aceita `status`, `disciplinaId`, `ano` nem `semestre` — o backend recusa.
 * Status muda por operacao de dominio; disciplina e periodo sao a IDENTIDADE da
 * oferta, e alterá-los transformaria a monitoria em outra.
 */
export function atualizarMonitoria(
  monitoriaId: string,
  dados: { descricao?: string; dataInicio?: string; dataFim?: string },
): Promise<Monitoria> {
  return apiCliente.patch<Monitoria>(`/monitorias/${monitoriaId}`, dados);
}

// --- Transicoes de estado (operacoes de dominio, nao PATCH em `status`) ------

export function ativarMonitoria(monitoriaId: string): Promise<Monitoria> {
  return apiCliente.post<Monitoria>(`/monitorias/${monitoriaId}/ativar`);
}

/** 409 se houver atendimentos AGENDADOS — o backend nao cascateia. */
export function encerrarMonitoria(monitoriaId: string): Promise<Monitoria> {
  return apiCliente.post<Monitoria>(`/monitorias/${monitoriaId}/encerrar`);
}

export function cancelarMonitoria(monitoriaId: string, motivo: string): Promise<Monitoria> {
  return apiCliente.post<Monitoria>(`/monitorias/${monitoriaId}/cancelar`, { motivo });
}

// --- Participantes ----------------------------------------------------------

export interface FiltroParticipantes {
  papel?: PapelMonitoria;
  /** Padrao do backend: ATIVO. Use ENCERRADO para o histórico (RN10). */
  status?: StatusParticipacao;
  pagina?: number;
  limite?: number;
}

export function listarParticipantes(
  monitoriaId: string,
  filtro: FiltroParticipantes = {},
): Promise<RespostaPaginada<Participante>> {
  return apiCliente.get<RespostaPaginada<Participante>>(
    `/monitorias/${monitoriaId}/participantes`,
    { query: { ...filtro } },
  );
}

/**
 * RN01 — habilitar um aluno como MONITOR. Só o professor responsável.
 *
 * O papel vem da ROTA, nunca do corpo: não existe endpoint genérico "criar
 * participante com papel X". `alunoId` é o id do USUÁRIO do aluno.
 */
export function habilitarMonitor(monitoriaId: string, alunoId: string): Promise<Participante> {
  return apiCliente.post<Participante>(`/monitorias/${monitoriaId}/monitores`, { alunoId });
}

export function inscreverMonitorado(monitoriaId: string, alunoId: string): Promise<Participante> {
  return apiCliente.post<Participante>(`/monitorias/${monitoriaId}/monitorados`, { alunoId });
}

/** Auto-inscrição do aluno autenticado como MONITORADO (RN04). */
export function participarDaMonitoria(monitoriaId: string): Promise<Participante> {
  return apiCliente.post<Participante>(`/monitorias/${monitoriaId}/inscricao`);
}

/**
 * Encerra o vínculo — nunca apaga (RN10). Professor responsável ou o próprio aluno.
 * 409 se o participante tiver atendimentos ou inscrições ativas.
 */
export function encerrarParticipacao(
  monitoriaId: string,
  participanteId: string,
): Promise<Participante> {
  return apiCliente.post<Participante>(
    `/monitorias/${monitoriaId}/participantes/${participanteId}/encerrar`,
  );
}

/**
 * A3 — MONITORADO vira MONITOR em uma única operação atômica.
 *
 * Substitui a sequência `encerrarParticipacao` + `habilitarMonitor`, que não
 * era atômica: falhando o segundo passo, o aluno ficava sem vínculo nenhum na
 * monitoria — perdia o que tinha sem ganhar o novo.
 *
 * As inscrições ativas dele em atendimentos desta monitoria são CANCELADAS pelo
 * servidor, e ele é avisado disso no mesmo e-mail da promoção. Quem chama
 * precisa dizer isso ao professor ANTES de confirmar.
 *
 * `participanteId` é o id do VÍNCULO, não o do usuário.
 */
export function promoverAMonitor(
  monitoriaId: string,
  participanteId: string,
): Promise<Participante> {
  return apiCliente.post<Participante>(
    `/monitorias/${monitoriaId}/participantes/${participanteId}/promover-a-monitor`,
  );
}
