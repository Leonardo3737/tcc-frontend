import { NextRequest, NextResponse } from 'next/server';

import { PREFIXOS_PUBLICOS, PREFIXOS_SO_SEM_SESSAO, rotas } from '@/config/rotas';

/**
 * Guarda de borda: decide, olhando so a presenca do cookie, se a navegacao
 * continua ou é redirecionada.
 *
 * O que ele NAO faz, deliberadamente:
 *  - nao valida o token (nao temos o segredo, e validar exigiria uma chamada de
 *    rede em toda navegacao);
 *  - nao le perfis nem decide autorizacao.
 *
 * Ou seja: presenca de cookie nao e prova de sessao valida. Quem confirma e o
 * layout autenticado, chamando `GET /usuarios/eu`, e em ultima instancia o
 * proprio backend, que responde 401/403. Este middleware existe para UX — evitar
 * que o usuario veja um esqueleto de tela antes do redirecionamento.
 *
 * O nome do cookie e lido de env por `process.env` direto: o middleware roda no
 * runtime Edge, onde o modulo de validacao (que usa Zod sobre todo o env do
 * servidor) nao deve ser carregado.
 */
const NOME_COOKIE = process.env.SESSAO_COOKIE_NOME ?? 'monitoria_sessao';

export function middleware(requisicao: NextRequest): NextResponse {
  const { pathname, search } = requisicao.nextUrl;

  const temSessao = Boolean(requisicao.cookies.get(NOME_COOKIE)?.value);
  const casa = (prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`);
  const ehPublica = PREFIXOS_PUBLICOS.some(casa);

  // Autenticado tentando ver o login: manda para o inicio.
  // Sem isto, o usuario logado que clica em "voltar" cai numa tela de login
  // que nao faz mais sentido para ele.
  if (temSessao && PREFIXOS_SO_SEM_SESSAO.some(casa)) {
    return NextResponse.redirect(new URL(rotas.inicio, requisicao.url));
  }

  if (!temSessao && !ehPublica) {
    const url = new URL(rotas.login, requisicao.url);

    /**
     * Preserva o destino para voltar depois do login. So caminhos internos
     * entram aqui — um destino absoluto viraria open redirect, e o valor e
     * revalidado no login antes de ser usado.
     */
    const destino = `${pathname}${search}`;
    if (pathname !== '/' && !pathname.startsWith('//')) {
      url.searchParams.set('destino', destino);
    }

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * O matcher deixa de fora tudo que nao e navegacao de pagina.
 *
 * `/api` fica de fora porque o proxy e as rotas BFF precisam responder 401 em
 * JSON — redirecionar uma chamada de API para o HTML do login e o classico
 * "por que meu fetch retornou uma pagina inteira?".
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
