import { apiCliente } from '@/lib/api/cliente';
import { criarClienteHttp } from '@/lib/api/http';
import { rotas } from '@/config/rotas';
import type { DadosLogin } from '../schemas/login.schema';
import type { Usuario } from '@/types/dominio';

/**
 * Servico de autenticacao do NAVEGADOR.
 *
 * Login e logout NAO passam pelo proxy `/api/backend`: eles falam com as rotas
 * BFF do proprio Next, que sao as unicas autorizadas a escrever e apagar o
 * cookie de sessao. O token nunca transita pelo JavaScript da pagina.
 */
const bff = criarClienteHttp({ baseUrl: '', credenciais: 'same-origin' });

export interface RespostaLoginBff {
  usuario: Usuario;
  expiraEmIso: string;
}

export function entrar(credenciais: DadosLogin): Promise<RespostaLoginBff> {
  return bff.post<RespostaLoginBff>(rotas.bffLogin, credenciais);
}

export function sair(): Promise<{ ok: boolean }> {
  return bff.post<{ ok: boolean }>(rotas.bffLogout);
}

/**
 * Recarrega o usuario autenticado a partir do backend.
 *
 * Usado quando o cliente precisa reconferir a sessao (por exemplo, depois de
 * alterar o proprio perfil). No carregamento inicial, quem resolve a sessao e o
 * layout do servidor — nao ha motivo para refazer a chamada no navegador.
 */
export function buscarUsuarioAtual(): Promise<Usuario> {
  return apiCliente.get<Usuario>('/usuarios/eu');
}
