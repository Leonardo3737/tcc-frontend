import { NextResponse } from 'next/server';

import { limparSessao } from '@/lib/auth/cookie';

/**
 * Encerra a sessao apagando o cookie.
 *
 * O backend e stateless e nao tem revogacao de token: o logout e, por
 * construcao, um ato do cliente. E justamente por isso que o TTL de 8h importa —
 * um token que vazasse continuaria valido ate expirar, independentemente deste
 * endpoint. A mitigacao real e o cookie httpOnly, que impede o vazamento por XSS,
 * somada ao fato de o backend recarregar o usuario a cada requisicao (desativar
 * a conta corta o acesso na hora).
 *
 * Apenas POST: um logout em GET seria disparavel por `<img src>` de terceiro.
 */
export async function POST(): Promise<NextResponse> {
  await limparSessao();

  return NextResponse.json({ ok: true }, { status: 200, headers: { 'cache-control': 'no-store' } });
}
