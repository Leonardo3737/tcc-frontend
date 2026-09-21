import 'server-only';

import { env } from '@/config/env';
import { lerTokenDaSessao } from '@/lib/auth/cookie';
import { criarClienteHttp } from './http';

/**
 * Cliente do SERVIDOR: Server Components, Server Actions e Route Handlers.
 *
 * Fala com o NestJS diretamente e injeta o Bearer a partir do cookie httpOnly.
 * O import de `server-only` transforma em erro de build qualquer tentativa de
 * arrastar este modulo para o bundle do cliente — que exporia a URL interna do
 * backend e, pior, criaria um caminho onde o token poderia vazar.
 */
export const apiServidor = criarClienteHttp({
  baseUrl: env.API_URL,
  cabecalhosPadrao: async (): Promise<Record<string, string>> => {
    const token = await lerTokenDaSessao();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

/**
 * Cliente sem sessao, para as rotas publicas do backend
 * (`/auth/login`, `/auth/registro/*`, `/configuracao`).
 *
 * Separado de proposito: mandar Authorization em uma rota publica nao quebra
 * nada hoje, mas apaga a distincao entre "chamada autenticada" e "chamada
 * anonima" — e essa distincao e o que torna o fluxo de login auditavel.
 */
export const apiPublica = criarClienteHttp({
  baseUrl: env.API_URL,
});
