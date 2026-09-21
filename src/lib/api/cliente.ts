import { criarClienteHttp } from './http';

/**
 * Cliente do NAVEGADOR.
 *
 * Aponta para o proxy interno do Next (`/api/backend/...`), nunca para o NestJS.
 * Duas consequencias, ambas desejadas:
 *
 *  1. o token vive num cookie httpOnly e e injetado no servidor — nenhum script
 *     da pagina consegue le-lo, entao um XSS nao rouba a sessao;
 *  2. a URL do backend nao vai para o bundle, e o CORS deixa de existir para o
 *     navegador (mesma origem).
 *
 * `credentials: 'same-origin'` e o que faz o cookie acompanhar a requisicao.
 */
export const apiCliente = criarClienteHttp({
  baseUrl: '/api/backend',
  credenciais: 'same-origin',
});
