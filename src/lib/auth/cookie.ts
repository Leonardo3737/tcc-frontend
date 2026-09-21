import 'server-only';

import { cookies } from 'next/headers';

import { env } from '@/config/env';

/**
 * Politica do cookie de sessao.
 *
 * O token do backend nunca chega ao JavaScript da pagina. Ele vive aqui:
 *
 *  - httpOnly  -> invisivel para `document.cookie`; um XSS nao consegue le-lo.
 *                 E a razao principal de existir o padrao BFF neste projeto.
 *  - sameSite  -> 'lax': o navegador nao envia o cookie em POST cross-site, o
 *                 que ja neutraliza CSRF nas mutacoes. 'strict' quebraria a
 *                 volta de links externos; 'none' abriria mao da protecao.
 *  - secure    -> obrigatorio fora de desenvolvimento (config por env).
 *  - path '/'  -> vale para o app inteiro, inclusive o proxy.
 *
 * Nao ha CSRF token adicional: com sameSite=lax e sem nenhum endpoint de mutacao
 * aceitando GET, a superficie que um token cobriria ja esta fechada.
 */
export const NOME_COOKIE_SESSAO = env.SESSAO_COOKIE_NOME;

interface OpcoesCookieSessao {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge?: number;
}

function opcoesBase(): OpcoesCookieSessao {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * Grava a sessao.
 *
 * `expiraEmSegundos` vem do backend, derivado do claim `exp` do token realmente
 * assinado. Usar esse valor (e nao uma interpretacao da string "8h") mantem
 * cookie e token expirando juntos — o desencontro entre os dois e o que produz
 * o estado ruim de "parece logado, mas toda requisicao devolve 401".
 */
export async function gravarSessao(token: string, expiraEmSegundos: number): Promise<void> {
  const jarra = await cookies();

  jarra.set(NOME_COOKIE_SESSAO, token, {
    ...opcoesBase(),
    maxAge: Math.max(1, Math.floor(expiraEmSegundos)),
  });
}

export async function limparSessao(): Promise<void> {
  const jarra = await cookies();
  jarra.set(NOME_COOKIE_SESSAO, '', { ...opcoesBase(), maxAge: 0 });
}

export async function lerTokenDaSessao(): Promise<string | null> {
  const jarra = await cookies();
  return jarra.get(NOME_COOKIE_SESSAO)?.value ?? null;
}
