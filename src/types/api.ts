/**
 * Envelopes de transporte da API. Espelham
 * backend/src/common/dto/{resposta-paginada,resposta-erro}.dto.ts
 */

export interface MetaPaginacao {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface RespostaPaginada<T> {
  dados: T[];
  meta: MetaPaginacao;
}

/**
 * Formato UNICO de erro da API — vale para 100% das respostas de falha,
 * inclusive as levantadas dentro de guards e pipes.
 *
 * `mensagem` ja e redigida para o usuario final: exiba-a, nao a reescreva.
 * `detalhes` so aparece em erro de validacao (400).
 */
export interface RespostaErro {
  statusCode: number;
  erro: string;
  mensagem: string;
  detalhes?: string[];
  caminho: string;
  timestamp: string;
}

/** Parametros de paginacao aceitos pelo backend (limite: 1..100). */
export interface ParametrosPaginacao {
  pagina?: number;
  limite?: number;
}
