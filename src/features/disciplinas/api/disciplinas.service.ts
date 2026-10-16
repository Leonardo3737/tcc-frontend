import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type { Disciplina } from '@/types/dominio';

/**
 * Catalogo de disciplinas.
 *
 * Leitura liberada a qualquer autenticado (o aluno precisa navegar o catalogo);
 * escrita restrita a PROFESSOR (`@Perfis(PROFESSOR)` em POST e PATCH).
 */

export interface FiltroDisciplinas {
  busca?: string;
  ativa?: boolean;
  /**
   * Apenas disciplinas oferecidas neste curso.
   *
   * Filtro de PERTINENCIA, porque a relacao e N:N: a disciplina aparece se o
   * curso estiver entre os dela. A resposta continua trazendo TODOS os cursos
   * de cada disciplina — recortar a lista nao recorta o conteudo de cada item.
   */
  cursoId?: string;
  pagina?: number;
  limite?: number;
}

export function listarDisciplinas(
  filtro: FiltroDisciplinas,
): Promise<RespostaPaginada<Disciplina>> {
  return apiCliente.get<RespostaPaginada<Disciplina>>('/disciplinas', { query: { ...filtro } });
}

export function detalharDisciplina(id: string): Promise<Disciplina> {
  return apiCliente.get<Disciplina>(`/disciplinas/${id}`);
}

/**
 * Nome e cursos. O backend gera o `codigo` (prefixo do nome + sequencial,
 * ex.: CAL001) e o devolve na resposta.
 *
 * `cursosIds` e OBRIGATORIO e precisa ter ao menos um item: e essa lista que
 * decide quem pode participar das monitorias da disciplina. O backend nao tem
 * valor padrao de proposito — uma disciplina sem curso liberaria ou bloquearia
 * todo mundo, e as duas respostas estariam erradas.
 */
export function criarDisciplina(dados: {
  nome: string;
  cursosIds: string[];
}): Promise<Disciplina> {
  return apiCliente.post<Disciplina>('/disciplinas', {
    nome: dados.nome,
    cursosIds: dados.cursosIds,
  });
}

/**
 * `codigo` nao entra: o backend nao o aceita no PATCH. Monitorias e materiais ja
 * publicados referenciam a disciplina por ele — renomear e permitido,
 * reidentificar nao.
 *
 * `cursosIds` SUBSTITUI o conjunto, nao acrescenta. Omitir o campo nao mexe nos
 * cursos; enviar uma lista menor desvincula o que ficou de fora — e o banco
 * recusa com 409 se ainda houver participante daquele curso na disciplina.
 */
export function atualizarDisciplina(
  id: string,
  dados: { nome?: string; ativa?: boolean; cursosIds?: string[] },
): Promise<Disciplina> {
  return apiCliente.patch<Disciplina>(`/disciplinas/${id}`, dados);
}
