import { ApiError, ErroDeRede } from './erros';
import { montarQuery, type ParametrosQuery } from './http';

/**
 * Download de resposta BINARIA, atraves do proxy.
 *
 * Existe porque `apiCliente` interpreta toda resposta como JSON: passar um
 * .xlsx ou um .docx por ele entregaria um arquivo corrompido. Quando a rota
 * nao tem caminho de erro realista — o boletim e o relatorio —, um `<a href>`
 * simples basta e e o que usamos. Aqui nao basta: a exportacao recusa com 409
 * acima do teto de linhas, e um link levaria o navegador a uma pagina de JSON
 * cru no lugar do arquivo.
 *
 * O nome do arquivo vem do `Content-Disposition` do servidor — ele o monta com
 * o periodo do edital e a data. Inventar um nome aqui criaria uma segunda
 * convencao, que divergiria da do relatorio na primeira mudanca.
 */
export interface ArquivoBaixado {
  nomeDoArquivo: string;
  /** Cabecalhos que o chamador queira ler (ex.: a contagem de linhas). */
  cabecalhos: Headers;
}

/** `attachment; filename="x.xlsx"` -> `x.xlsx`. */
function nomeDoCabecalho(valor: string | null, padrao: string): string {
  const casado = valor?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return casado?.[1] ? decodeURIComponent(casado[1]) : padrao;
}

/**
 * Busca o arquivo e entrega ao navegador.
 *
 * O `ObjectURL` e revogado sempre — sem isso o blob fica retido na memoria da
 * aba ate o recarregamento, e uma planilha de milhares de linhas nao e pequena.
 */
export async function baixarArquivo(
  caminho: string,
  { query, nomePadrao }: { query?: ParametrosQuery; nomePadrao: string },
): Promise<ArquivoBaixado> {
  const url = `/api/backend${caminho}${montarQuery(query)}`;

  let resposta: Response;

  try {
    resposta = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ErroDeRede(`Falha de rede ao baixar ${caminho}.`);
  }

  if (!resposta.ok) {
    /**
     * O erro vem no formato unico da API, em JSON — mesmo numa rota que
     * responde binario no caminho feliz. O fallback cobre o caso de a falha
     * nascer fora do backend (um gateway), em que o corpo nao e o esperado.
     */
    const corpo = await resposta.json().catch(() => undefined);
    const erro = corpo as { statusCode?: number; erro?: string; mensagem?: string } | undefined;

    throw new ApiError({
      statusCode: erro?.statusCode ?? resposta.status,
      erro: erro?.erro ?? 'Error',
      mensagem: erro?.mensagem ?? 'Não foi possível baixar o arquivo.',
      caminho,
      timestamp: new Date().toISOString(),
    });
  }

  const blob = await resposta.blob();
  const nomeDoArquivo = nomeDoCabecalho(resposta.headers.get('content-disposition'), nomePadrao);

  const endereco = URL.createObjectURL(blob);

  try {
    const ancora = document.createElement('a');
    ancora.href = endereco;
    ancora.download = nomeDoArquivo;
    document.body.appendChild(ancora);
    ancora.click();
    ancora.remove();
  } finally {
    URL.revokeObjectURL(endereco);
  }

  return { nomeDoArquivo, cabecalhos: resposta.headers };
}
