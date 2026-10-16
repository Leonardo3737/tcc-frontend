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

/**
 * Troca de curso do proprio aluno.
 *
 * So e aceita enquanto o aluno NAO tiver participacao registrada em monitoria:
 * as FKs compostas exigem que o curso do vinculo seja ao mesmo tempo o do aluno
 * e o da monitoria, e a RN10 preserva vinculos encerrados para sempre. Mudar o
 * curso depois reescreveria o passado. O backend recusa com 409, e a mensagem
 * dele ja esta pronta para exibir.
 */
export function atualizarDadosAluno(cursoId: string): Promise<Usuario> {
  return apiCliente.patch<Usuario>('/alunos/eu', { cursoId });
}

export function atualizarDadosProfessor(departamento: string | null): Promise<Usuario> {
  return apiCliente.patch<Usuario>('/professores/eu', { departamento });
}
