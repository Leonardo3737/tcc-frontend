import { apiCliente } from '@/lib/api/cliente';
import type { DadosCadastroAluno, DadosCadastroProfessor } from '../schemas/cadastro.schema';
import type { Usuario } from '@/types/dominio';

/**
 * Cadastro.
 *
 * Vai pelo proxy `/api/backend` como qualquer outra chamada: as rotas de
 * registro sao publicas no backend (@Publico), e o proxy simplesmente nao anexa
 * Authorization quando nao ha sessao. Nao ha motivo para uma rota BFF propria —
 * o registro nao devolve token e nao cria sessao.
 *
 * `confirmacaoSenha` fica de fora do corpo de proposito: o `forbidNonWhitelisted`
 * do backend rejeita com 400 qualquer campo nao declarado no DTO.
 */
export function registrarAluno(dados: DadosCadastroAluno): Promise<Usuario> {
  return apiCliente.post<Usuario>('/auth/registro/aluno', {
    nome: dados.nome,
    email: dados.email,
    senha: dados.senha,
    matricula: dados.matricula,
    ...(dados.curso ? { curso: dados.curso } : {}),
  });
}

export function registrarProfessor(dados: DadosCadastroProfessor): Promise<Usuario> {
  return apiCliente.post<Usuario>('/auth/registro/professor', {
    nome: dados.nome,
    email: dados.email,
    senha: dados.senha,
    ...(dados.identificacaoFuncional
      ? { identificacaoFuncional: dados.identificacaoFuncional }
      : {}),
    ...(dados.departamento ? { departamento: dados.departamento } : {}),
    ...(dados.codigoCadastro ? { codigoCadastro: dados.codigoCadastro } : {}),
  });
}
