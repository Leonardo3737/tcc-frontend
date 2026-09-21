import { apiCliente } from '@/lib/api/cliente';
import type {
  AtividadeMonitor,
  IndicadoresMonitoria,
  IndicadoresPlataforma,
} from '@/types/dominio';

/**
 * Indicadores agregados. Somente leitura.
 *
 * Sao os numeros que o backend calcula ao vivo (sem tabela materializada) — nao
 * ha metrica derivada no cliente alem de formatacao. Inventar um indicador aqui
 * o desconectaria da definicao usada no SQL.
 */

/** Visão da plataforma — restrita a PROFESSOR. */
export function buscarIndicadoresPlataforma(apenasMinhas: boolean): Promise<IndicadoresPlataforma> {
  return apiCliente.get<IndicadoresPlataforma>('/analytics/resumo', { query: { apenasMinhas } });
}

/** Indicadores de uma monitoria — acesso por participação. */
export function buscarIndicadoresMonitoria(monitoriaId: string): Promise<IndicadoresMonitoria> {
  return apiCliente.get<IndicadoresMonitoria>(`/analytics/monitorias/${monitoriaId}`);
}

/** Atividade por monitor — restrito ao professor responsável. */
export function buscarAtividadeMonitores(monitoriaId: string): Promise<AtividadeMonitor[]> {
  return apiCliente.get<AtividadeMonitor[]>(`/analytics/monitorias/${monitoriaId}/monitores`);
}
