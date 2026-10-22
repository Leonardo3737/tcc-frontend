import { NextRequest, NextResponse } from 'next/server';

import { CODIGO_SERVIDOR_INDISPONIVEL, MENSAGEM_SERVIDOR_INDISPONIVEL } from '@/lib/api/erros';

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

  /**
   * O corpo e repassado como BYTES, nao como texto.
   *
   * `await requisicao.text()` decodifica como UTF-8, e isso destroi qualquer
   * corpo binario: o PDF do boletim (`multipart/form-data` em
   * POST /editais/:id/inscricoes) chegaria ao backend corrompido, e a validacao
   * de assinatura de arquivo o recusaria sem que a causa ficasse visivel em
   * lugar nenhum. JSON passa igual pelos dois caminhos, entao ler como
   * ArrayBuffer nao custa nada ao resto da API.
   *
   * `content-length` ja esta entre os CABECALHOS_BLOQUEADOS e e recalculado
   * pelo fetch; o `content-type` com o boundary do multipart e preservado,
   * porque sem ele o backend nao consegue separar as partes.
   */
  try {
    const resposta = await fetch(destino, {
      method: requisicao.method,
      headers: cabecalhos,
      body: temCorpo ? await requisicao.arrayBuffer() : undefined,
      // O proxy nunca cacheia: as respostas sao especificas da sessao, e uma
      // resposta cacheada aqui poderia ser servida ao usuario errado.
      cache: 'no-store',
      redirect: 'manual',
    });

    /**
     * A resposta tambem volta como BYTES.
     *
     * `await resposta.text()` decodificaria como UTF-8, e um PDF de verdade
     * tem bytes que nao formam UTF-8 valido: eles virariam U+FFFD e o arquivo
     * baixado chegaria corrompido. O download do boletim
     * (`GET /inscricoes/:id/boletim`) e a unica rota binaria da API hoje, e e
     * suficiente para que a regra valha para todas.
     */
    const corpo = await resposta.arrayBuffer();

    const resultado = new NextResponse(corpo.byteLength > 0 ? corpo : null, {
      status: resposta.status,
      statusText: resposta.statusText,
    });

    /**
     * Cabecalhos repassados, por LISTA FECHADA.
     *
     * `content-disposition` nao e detalhe: o backend o define como
     * `attachment` de proposito, para o navegador SALVAR o PDF do candidato em
     * vez de renderiza-lo a partir do nosso dominio — PDF exibido inline e
     * superficie de execucao de conteudo de terceiro. Descarta-lo aqui
     * desfazia essa decisao em silencio.
     *
     * `x-total-inscricoes` acompanha a exportacao: o corpo e binario, entao e
     * a unica forma de a tela dizer quantas linhas vieram sem abrir o arquivo.
     *
     * A lista e fechada e nao uma copia de tudo: repassar cabecalhos do
     * backend as cegas (ex.: `set-cookie`) daria a ele poder sobre a sessao
     * que esta camada existe justamente para controlar.
     */
    for (const cabecalho of ['content-type', 'content-disposition', 'x-total-inscricoes']) {
      const valor = resposta.headers.get(cabecalho);
      if (valor) resultado.headers.set(cabecalho, valor);
    }

    resultado.headers.set('cache-control', 'no-store');
    return resultado;
  } catch {
    /**
     * O backend fora do ar nao pode virar uma excecao nao tratada no cliente:
     * devolvemos o mesmo formato de erro que o resto da API usa, MARCADO como
     * servidor indisponivel. Na hospedagem atual, "nao respondeu" quase sempre e
     * a API desligada por inatividade, ainda acordando.
     */
    return NextResponse.json(
      {
        statusCode: 503,
        erro: CODIGO_SERVIDOR_INDISPONIVEL,
        mensagem: MENSAGEM_SERVIDOR_INDISPONIVEL,
        caminho: requisicao.nextUrl.pathname,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
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
