import { apiCliente } from '@/lib/api/cliente';
import type { Usuario } from '@/types/dominio';

/**
 * Recursos do PROPRIO usuario.
 *
 * Todas as rotas usam o identificador `eu`, e nao um `:id` — decisao do backend
 * que elimina por construcao a falha "trocar o ID na URL e ler dados de outra
 * pessoa". O frontend nao tem como pedir os dados de outro usuario por aqui,
 * nem por engano.
 */

export function atualizarNome(nome: string): Promise<Usuario> {
  return apiCliente.patch<Usuario>('/usuarios/eu', { nome });
}

/**
 * Troca de senha. Responde 204 (sem corpo).
 *
 * A senha atual e exigida mesmo com o usuario ja autenticado: se um token for
 * roubado, isso impede que o atacante tome a conta em definitivo.
 */
export function alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
  return apiCliente.patch<void>('/usuarios/eu/senha', { senhaAtual, novaSenha });
}

export function atualizarDadosAluno(curso: string | null): Promise<Usuario> {
  return apiCliente.patch<Usuario>('/alunos/eu', { curso });
}

export function atualizarDadosProfessor(departamento: string | null): Promise<Usuario> {
  return apiCliente.patch<Usuario>('/professores/eu', { departamento });
}
