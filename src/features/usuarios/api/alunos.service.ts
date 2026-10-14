import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type { Usuario } from '@/types/dominio';
import type { DadosCadastroAluno } from '../schemas/cadastro-pelo-professor.schema';

/**
 * Busca de alunos — restrita a PROFESSOR.
 *
 * Existe para o fluxo da RN01: o professor precisa LOCALIZAR alguem para
 * habilitar como monitor. `semVinculoAtivoNaMonitoria` remove da lista quem ja
 * participa, evitando um 409 de RN09 que era previsivel.
 */
export interface FiltroAlunos {
  busca?: string;
  semVinculoAtivoNaMonitoria?: string;
  pagina?: number;
  limite?: number;
}

export function listarAlunos(filtro: FiltroAlunos): Promise<RespostaPaginada<Usuario>> {
  return apiCliente.get<RespostaPaginada<Usuario>>('/alunos', { query: { ...filtro } });
}

/**
 * Cadastro de aluno por um professor — o UNICO caminho de criacao de aluno
 * (POST /auth/registro/aluno foi removida). A autoria vem do token no backend,
 * nunca do corpo. Sem senha no corpo: o servidor gera uma e a envia ao e-mail
 * do aluno; se o envio falhar, a conta nao e criada (503).
 */
export function cadastrarAluno(dados: DadosCadastroAluno): Promise<Usuario> {
  return apiCliente.post<Usuario>('/alunos', {
    nome: dados.nome,
    email: dados.email,
    matricula: dados.matricula,
    ...(dados.curso ? { curso: dados.curso } : {}),
  });
}
