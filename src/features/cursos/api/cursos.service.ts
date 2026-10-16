import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type { Curso } from '@/types/dominio';

/**
 * Catalogo de cursos.
 *
 * Leitura liberada a qualquer autenticado (o aluno precisa navegar o catalogo);
 * escrita restrita a PROFESSOR (`@Perfis(PROFESSOR)` em POST e PATCH).
 *
 * NAO HA DELETE, como no resto desta API (RN10): o curso e referenciado por
 * alunos e por disciplinas, e apagar a linha deixaria os dois orfaos. Tirar de
 * circulacao e `ativo: false`.
 */

export interface FiltroCursos {
  busca?: string;
  ativo?: boolean;
  pagina?: number;
  limite?: number;
}

export function listarCursos(filtro: FiltroCursos = {}): Promise<RespostaPaginada<Curso>> {
  return apiCliente.get<RespostaPaginada<Curso>>('/cursos', { query: { ...filtro } });
}

export function detalharCurso(id: string): Promise<Curso> {
  return apiCliente.get<Curso>(`/cursos/${id}`);
}

/**
 * So o nome vai no corpo: o backend gera o `codigo` a partir dele
 * (ex.: "Engenharia de Software" -> ENG001) e o devolve na resposta. Enviar
 * `codigo` devolveria 400 pelo `forbidNonWhitelisted`.
 */
export function criarCurso(dados: { nome: string }): Promise<Curso> {
  return apiCliente.post<Curso>('/cursos', { nome: dados.nome });
}

/**
 * `codigo` nao entra: alunos e disciplinas ja o referenciam como identidade
 * estavel. Renomear e permitido; reidentificar nao.
 */
export function atualizarCurso(
  id: string,
  dados: { nome?: string; ativo?: boolean },
): Promise<Curso> {
  return apiCliente.patch<Curso>(`/cursos/${id}`, dados);
}
