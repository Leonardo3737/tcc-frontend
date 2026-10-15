import { apiCliente } from '@/lib/api/cliente';
import type { PosicaoRanking, RegrasDePontuacao, ResumoPontuacao } from '@/types/dominio';

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

/**
 * B2 — quanto vale cada tipo de evento.
 *
 * Antes deste endpoint a tabela era uma constante privada do backend, e a tela
 * explicava que existem pontos sem poder dizer quanto cada coisa vale. Escrever
 * os números aqui criaria uma segunda fonte de verdade que passaria a mentir no
 * primeiro rebalanceamento — por isso eles vêm do servidor.
 */
export function buscarRegrasDePontuacao(): Promise<RegrasDePontuacao> {
  return apiCliente.get<RegrasDePontuacao>('/gamificacao/regras');
}
