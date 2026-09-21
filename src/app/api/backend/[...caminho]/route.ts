import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { lerTokenDaSessao } from '@/lib/auth/cookie';

/**
 * Proxy autenticado: a unica porta entre o navegador e o NestJS.
 *
 * O navegador chama `/api/backend/monitorias/minhas`; esta rota le o cookie
 * httpOnly, injeta `Authorization: Bearer` e repassa. O token nunca entra no
 * bundle nem fica acessivel a nenhum script da pagina.
 *
 * Ganhos colaterais: a URL interna do backend nao e exposta, e o CORS deixa de
 * existir para o navegador, porque tudo passa a ser mesma origem.
 */

const METODOS_PERMITIDOS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Cabecalhos que o cliente NAO pode ditar.
 *
 * `authorization` e o critico: sem esta lista, um script da pagina poderia
 * mandar o proprio Bearer e o proxy o repassaria, contornando a sessao. `cookie`
 * e `host` sao removidos por higiene — quem os define e este servidor.
 */
const CABECALHOS_BLOQUEADOS = new Set([
  'authorization',
  'cookie',
  'host',
  'connection',
  'content-length',
]);

async function encaminhar(requisicao: NextRequest, caminho: string[]): Promise<NextResponse> {
  if (!METODOS_PERMITIDOS.has(requisicao.method)) {
    return NextResponse.json(
      {
        statusCode: 405,
        erro: 'Method Not Allowed',
        mensagem: 'Método não suportado.',
        caminho: requisicao.nextUrl.pathname,
        timestamp: new Date().toISOString(),
      },
      { status: 405 },
    );
  }

  const token = await lerTokenDaSessao();
  const destino = `${env.API_URL}/${caminho.join('/')}${requisicao.nextUrl.search}`;

  const cabecalhos = new Headers();
  requisicao.headers.forEach((valor, chave) => {
    if (!CABECALHOS_BLOQUEADOS.has(chave.toLowerCase())) {
      cabecalhos.set(chave, valor);
    }
  });

  if (token) {
    cabecalhos.set('Authorization', `Bearer ${token}`);
  }

  const temCorpo = requisicao.method !== 'GET' && requisicao.method !== 'DELETE';

  try {
    const resposta = await fetch(destino, {
      method: requisicao.method,
      headers: cabecalhos,
      body: temCorpo ? await requisicao.text() : undefined,
      // O proxy nunca cacheia: as respostas sao especificas da sessao, e uma
      // resposta cacheada aqui poderia ser servida ao usuario errado.
      cache: 'no-store',
      redirect: 'manual',
    });

    const corpo = await resposta.text();

    const resultado = new NextResponse(corpo || null, {
      status: resposta.status,
      statusText: resposta.statusText,
    });

    const tipoConteudo = resposta.headers.get('content-type');
    if (tipoConteudo) {
      resultado.headers.set('content-type', tipoConteudo);
    }

    resultado.headers.set('cache-control', 'no-store');
    return resultado;
  } catch {
    // O backend fora do ar nao pode virar uma excecao nao tratada no cliente:
    // devolvemos o mesmo formato de erro que o resto da API usa.
    return NextResponse.json(
      {
        statusCode: 502,
        erro: 'Bad Gateway',
        mensagem: 'Não foi possível falar com o servidor da aplicação.',
        caminho: requisicao.nextUrl.pathname,
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}

type Contexto = { params: Promise<{ caminho: string[] }> };

export async function GET(requisicao: NextRequest, { params }: Contexto) {
  return encaminhar(requisicao, (await params).caminho);
}

export async function POST(requisicao: NextRequest, { params }: Contexto) {
  return encaminhar(requisicao, (await params).caminho);
}

export async function PATCH(requisicao: NextRequest, { params }: Contexto) {
  return encaminhar(requisicao, (await params).caminho);
}

export async function PUT(requisicao: NextRequest, { params }: Contexto) {
  return encaminhar(requisicao, (await params).caminho);
}

export async function DELETE(requisicao: NextRequest, { params }: Contexto) {
  return encaminhar(requisicao, (await params).caminho);
}
