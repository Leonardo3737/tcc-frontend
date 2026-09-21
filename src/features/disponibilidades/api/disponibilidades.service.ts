import { apiCliente } from '@/lib/api/cliente';
import type { Disponibilidade, DiaSemana } from '@/types/dominio';

/**
 * Disponibilidade = RECORRENCIA SEMANAL declarada pelo monitor
 * ("terça, 14h às 16h"), nao slots datados.
 *
 * Ela cumpre dois papeis: vitrine (o monitorado ve quando o monitor costuma
 * atender) e validacao (agendamento fora da faixa e recusado). As ocorrencias
 * concretas sao sempre ATENDIMENTOS.
 *
 * A leitura e aberta a qualquer autenticado — o aluno precisa conseguir avaliar
 * os horarios ANTES de decidir participar da monitoria.
 */

export interface FiltroDisponibilidades {
  /** Filtra pelo VINCULO do monitor, não pelo usuário. */
  participanteId?: string;
  ativa?: boolean;
}

export function listarDisponibilidades(
  monitoriaId: string,
  filtro: FiltroDisponibilidades = {},
): Promise<Disponibilidade[]> {
  // Resposta em array cru, sem envelope de paginação: são poucas faixas por
  // monitoria e o backend não pagina esta rota.
  return apiCliente.get<Disponibilidade[]>(`/monitorias/${monitoriaId}/disponibilidades`, {
    query: { ...filtro },
  });
}

export interface DadosDisponibilidade {
  diaSemana: DiaSemana;
  /** "HH:MM" — o backend normaliza para "HH:MM:SS". */
  horaInicio: string;
  horaFim: string;
}

export function criarDisponibilidade(
  monitoriaId: string,
  dados: DadosDisponibilidade,
): Promise<Disponibilidade> {
  return apiCliente.post<Disponibilidade>(`/monitorias/${monitoriaId}/disponibilidades`, dados);
}

/**
 * Desativa a faixa — não existe DELETE (RN10).
 *
 * Atendimentos já agendados foram validados contra ela; apagar a linha
 * destruiria a justificativa histórica daqueles agendamentos.
 */
export function desativarDisponibilidade(
  monitoriaId: string,
  disponibilidadeId: string,
): Promise<Disponibilidade> {
  return apiCliente.post<Disponibilidade>(
    `/monitorias/${monitoriaId}/disponibilidades/${disponibilidadeId}/desativar`,
  );
}
