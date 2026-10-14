import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type { Usuario } from '@/types/dominio';
import type { DadosCadastroProfessor } from '../schemas/cadastro-pelo-professor.schema';

/**
 * Professores.
 *
 * A listagem e aberta a qualquer autenticado (nome e departamento de docente
 * sao informacao publica na instituicao) e so pagina — o backend nao oferece
 * busca aqui, entao a tela nao finge que oferece.
 */
export interface FiltroProfessores {
  pagina?: number;
  limite?: number;
}

export function listarProfessores(filtro: FiltroProfessores): Promise<RespostaPaginada<Usuario>> {
  return apiCliente.get<RespostaPaginada<Usuario>>('/professores', { query: { ...filtro } });
}

/**
 * Cadastro de professor por outro professor (unico caminho pela API). Como no
 * aluno, a senha e gerada pelo servidor e enviada ao e-mail; falha no envio
 * desfaz a criacao (503).
 *
 * Campos opcionais vazios ficam fora do corpo: o DTO valida o formato de
 * `identificacaoFuncional` mesmo quando vem vazio, e o `forbidNonWhitelisted`
 * recusaria qualquer campo que ele nao declare.
 */
export function cadastrarProfessor(dados: DadosCadastroProfessor): Promise<Usuario> {
  return apiCliente.post<Usuario>('/professores', {
    nome: dados.nome,
    email: dados.email,
    ...(dados.identificacaoFuncional
      ? { identificacaoFuncional: dados.identificacaoFuncional }
      : {}),
    ...(dados.departamento ? { departamento: dados.departamento } : {}),
  });
}
