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
 * So o nome vai no corpo: o backend gera o `codigo` (prefixo do nome +
 * sequencial, ex.: CAL001) e o devolve na resposta.
 */
export function criarDisciplina(dados: { nome: string }): Promise<Disciplina> {
  return apiCliente.post<Disciplina>('/disciplinas', { nome: dados.nome });
}

/**
 * `codigo` nao entra: o backend nao o aceita no PATCH. Monitorias e materiais ja
 * publicados referenciam a disciplina por ele — renomear e permitido,
 * reidentificar nao.
 */
export function atualizarDisciplina(
  id: string,
  dados: { nome?: string; ativa?: boolean },
): Promise<Disciplina> {
  return apiCliente.patch<Disciplina>(`/disciplinas/${id}`, dados);
}
