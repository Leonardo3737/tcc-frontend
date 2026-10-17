import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type { Edital, EditalPublico } from '@/types/dominio';

/**
 * Editais de selecao de monitores.
 *
 * Tudo e restrito a PROFESSOR, com UMA excecao: `GET /editais/abertos`, a
 * vitrine do formulario publico. A assimetria e do backend e e deliberada —
 * gerenciar o processo e ato administrativo, mas descobrir que existe um
 * processo aberto nao pode exigir conta, ja que o candidato tipico ainda nao
 * tem uma.
 */

export type DirecaoOrdenacao = 'asc' | 'desc';

export interface FiltroEditais {
  ano?: number;
  semestre?: number;
  /** Omitido traz ativos E excluidos logicamente. */
  ativo?: boolean;
  /** Ordena por `inicioInscricoes`. Nao ha escolha de campo no backend. */
  direcao?: DirecaoOrdenacao;
  pagina?: number;
  limite?: number;
}

/**
 * Vitrine publica: editais aceitando inscricao AGORA.
 *
 * O recorte e do servidor, avaliado no fuso da instituicao — nao ha parametro
 * para ver edital encerrado. Todo item que volta daqui esta aberto, entao o
 * cliente nao precisa (nem deve) reconferir datas.
 *
 * Vem ordenado pelo que FECHA PRIMEIRO. É essa a regra de prioridade quando há
 * mais de um aberto: o destaque e o padrão da tela apontam para o primeiro,
 * que é o mais urgente. Nenhuma ordenação foi inventada aqui.
 */
export function listarEditaisAbertos(
  filtro: { pagina?: number; limite?: number } = {},
): Promise<RespostaPaginada<EditalPublico>> {
  return apiCliente.get<RespostaPaginada<EditalPublico>>('/editais/abertos', {
    query: { ...filtro },
  });
}

export function listarEditais(filtro: FiltroEditais = {}): Promise<RespostaPaginada<Edital>> {
  return apiCliente.get<RespostaPaginada<Edital>>('/editais', { query: { ...filtro } });
}

export function detalharEdital(id: string): Promise<Edital> {
  return apiCliente.get<Edital>(`/editais/${id}`);
}

export interface DadosEdital {
  /** Datas de CALENDARIO, 'AAAA-MM-DD'. O periodo e inclusivo nos dois extremos. */
  inicioInscricoes: string;
  fimInscricoes: string;
  link: string;
  ano: number;
  semestre: number;
}

export function criarEdital(dados: DadosEdital): Promise<Edital> {
  return apiCliente.post<Edital>('/editais', dados);
}

/**
 * Aceita alterar uma data só: o backend valida o periodo RESULTANTE contra o
 * que ja esta gravado. `ativo: true` reativa um edital excluido.
 */
export function atualizarEdital(
  id: string,
  dados: Partial<DadosEdital> & { ativo?: boolean },
): Promise<Edital> {
  return apiCliente.patch<Edital>(`/editais/${id}`, dados);
}

/**
 * Exclusao LOGICA, apesar do verbo: o backend marca `ativo = false` e preserva
 * a linha (RN10). O edital sai da vitrine publica e para de aceitar inscricao,
 * mas continua existindo para as candidaturas que ja recebeu. Responde 204.
 */
export function excluirEdital(id: string): Promise<void> {
  return apiCliente.remover<void>(`/editais/${id}`);
}
