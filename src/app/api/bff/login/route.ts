import { NextRequest, NextResponse } from 'next/server';

import { apiPublica } from '@/lib/api/servidor';
import { ApiError, ErroDeRede } from '@/lib/api/erros';
import { gravarSessao } from '@/lib/auth/cookie';
import type { RespostaLogin, Usuario } from '@/types/dominio';

/**
 * Troca credenciais por uma sessao em cookie httpOnly.
 *
 * Este e o unico ponto do sistema que toca no token: ele entra pela resposta do
 * backend e sai gravado no cookie, sem nunca passar pelo corpo devolvido ao
 * navegador. O cliente recebe apenas o usuario — o suficiente para renderizar,
 * insuficiente para autenticar em nome de alguem.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  let credenciais: { email?: unknown; senha?: unknown };

  try {
    credenciais = await requisicao.json();
  } catch {
    return NextResponse.json(
      {
        statusCode: 400,
        erro: 'Bad Request',
        mensagem: 'Corpo da requisição inválido.',
        caminho: '/api/bff/login',
        timestamp: new Date().toISOString(),
      },
      { status: 400 },
    );
  }

  try {
    const resposta = await apiPublica.post<RespostaLogin>('/auth/login', {
      email: credenciais.email,
      senha: credenciais.senha,
    });

    await gravarSessao(resposta.tokenDeAcesso, resposta.expiraEmSegundos);

    // Devolve so o usuario: o token fica no cookie httpOnly.
    return NextResponse.json<{ usuario: Usuario; expiraEmIso: string }>(
      { usuario: resposta.usuario, expiraEmIso: resposta.expiraEmIso },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  } catch (erro) {
    if (erro instanceof ApiError) {
      return NextResponse.json(
        {
          statusCode: erro.statusCode,
          erro: erro.erro,
          mensagem: erro.message,
          ...(erro.detalhes.length ? { detalhes: erro.detalhes } : {}),
          caminho: '/api/bff/login',
          timestamp: new Date().toISOString(),
        },
        { status: erro.statusCode },
      );
    }

    const ehRede = erro instanceof ErroDeRede;

    return NextResponse.json(
      {
        statusCode: ehRede ? 502 : 500,
        erro: ehRede ? 'Bad Gateway' : 'Internal Server Error',
        mensagem: ehRede
          ? 'Nao foi possivel falar com o servidor da aplicacao.'
          : 'Erro inesperado ao autenticar.',
        caminho: '/api/bff/login',
        timestamp: new Date().toISOString(),
      },
      { status: ehRede ? 502 : 500 },
    );
  }
}
