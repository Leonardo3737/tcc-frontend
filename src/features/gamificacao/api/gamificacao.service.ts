import { apiCliente } from '@/lib/api/cliente';
import type { PosicaoRanking, ResumoPontuacao } from '@/types/dominio';

/**
 * Gamificacao: pontuacao e ranking.
 *
 * O backend implementa um LIVRO-RAZAO de eventos de pontuacao — nao ha badges,
 * niveis nem recompensas, e a UI nao os inventa. Os tipos de evento sao apenas
 * tres: atendimento realizado (monitor), participacao (monitorado presente) e
 * avaliacao recebida (monitor, pontos iguais a nota).
 *
 * O ranking expoe so nome e total; o extrato detalhado e privado.
 */

export function buscarRanking(filtro: {
  monitoriaId?: string;
  limite?: number;
}): Promise<PosicaoRanking[]> {
  // Array cru: é um top N, não uma listagem paginada.
  return apiCliente.get<PosicaoRanking[]>('/gamificacao/ranking', { query: { ...filtro } });
}

export function buscarMeusPontos(filtro: { monitoriaId?: string } = {}): Promise<ResumoPontuacao> {
  return apiCliente.get<ResumoPontuacao>('/gamificacao/meus-pontos', { query: { ...filtro } });
}
