import { apiCliente } from '@/lib/api/cliente';
import type { Avaliacao, ResumoAvaliacoes } from '@/types/dominio';

/**
 * Avaliacoes.
 *
 * A avaliacao referencia a INSCRICAO, nao o atendimento — e o que resolve a RN05
 * estruturalmente: so existe avaliacao a partir de uma linha que prova que
 * aquele aluno esteve naquele atendimento.
 *
 * O corpo NAO envia quem avalia nem qual inscricao: os dois saem do token
 * cruzado com o atendimento da rota. Aceitar um `inscricaoId` do cliente
 * permitiria avaliar em nome de outra pessoa.
 *
 * A autoria nunca volta na resposta (D-10): o monitor ve a nota, nao quem deu.
 */

export function avaliarAtendimento(
  atendimentoId: string,
  dados: { nota: number; comentario?: string },
): Promise<Avaliacao> {
  return apiCliente.post<Avaliacao>(`/atendimentos/${atendimentoId}/avaliacao`, dados);
}

export function listarAvaliacoesDoAtendimento(atendimentoId: string): Promise<ResumoAvaliacoes> {
  return apiCliente.get<ResumoAvaliacoes>(`/atendimentos/${atendimentoId}/avaliacoes`);
}

/** Avaliações recebidas por um monitor — `participanteId` é o id do VÍNCULO. */
export function listarAvaliacoesDoMonitor(
  monitoriaId: string,
  participanteId: string,
): Promise<ResumoAvaliacoes> {
  return apiCliente.get<ResumoAvaliacoes>(
    `/monitorias/${monitoriaId}/monitores/${participanteId}/avaliacoes`,
  );
}
