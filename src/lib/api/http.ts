import { ApiError, ErroDeRede } from './erros';
import type { RespostaErro } from '@/types/api';

/**
 * Cliente HTTP unico da aplicacao.
 *
 * Todas as chamadas — do servidor ou do navegador — passam por aqui. Nenhum
 * componente deve usar `fetch` diretamente: e o que garante que timeout,
 * traducao de erro, serializacao e cabecalhos existam em UM lugar so.
 *
 * A camada fica:
 *   UI -> feature (hook) -> service -> cliente HTTP -> backend
 */

const TIMEOUT_PADRAO_MS = 15_000;

/** Valores aceitos em query string. `undefined` e `null` sao omitidos. */
export type ValorQuery = string | number | boolean | undefined | null;
export type ParametrosQuery = Record<string, ValorQuery | ValorQuery[]>;

export interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: ParametrosQuery;
  corpo?: unknown;
  cabecalhos?: Record<string, string>;
  timeoutMs?: number;
  /** Repassado ao fetch do Next (cache / revalidate / tags). */
  next?: RequestInit['next'];
  cache?: RequestInit['cache'];
  sinal?: AbortSignal;
}

export interface ConfiguracaoCliente {
  /** Base COM prefixo, ex.: "http://localhost:3000/api" ou "/api/backend". */
  baseUrl: string;
  /** Cabecalhos aplicados a toda requisicao (ex.: Authorization no servidor). */
  cabecalhosPadrao?: () => Promise<Record<string, string>> | Record<string, string>;
  /** Enviar cookies do navegador (usado apenas pelo cliente do browser). */
  credenciais?: RequestCredentials;
}

/**
 * Monta a query string.
 *
 * Arrays viram chaves repetidas (`?status=ATIVA&status=PLANEJADA`) porque e
 * exatamente o formato que o `FiltroMinhasMonitoriasDto` do backend espera.
 */
export function montarQuery(parametros?: ParametrosQuery): string {
  if (!parametros) return '';

  const busca = new URLSearchParams();

  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === '') continue;

    if (Array.isArray(valor)) {
      for (const item of valor) {
        if (item === undefined || item === null || item === '') continue;
        busca.append(chave, String(item));
      }
      continue;
    }

    busca.append(chave, String(valor));
  }

  const texto = busca.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Interpreta a resposta.
 *
 * 204 e corpo vazio viram `undefined` — o backend usa 204 na troca de senha, e
 * tentar `.json()` ali lanca um erro de parse que nao significa nada.
 */
async function interpretarResposta<T>(resposta: Response, caminho: string): Promise<T> {
  const semConteudo = resposta.status === 204 || resposta.headers.get('content-length') === '0';
  const ehJson = resposta.headers.get('content-type')?.includes('application/json') ?? false;

  const corpo: unknown = semConteudo || !ehJson ? undefined : await resposta.json().catch(() => undefined);

  if (resposta.ok) {
    return corpo as T;
  }

  // O backend garante o formato unico de erro. O fallback cobre o caso em que a
  // falha nasce fora dele (um proxy, um gateway) e o corpo nao e o esperado.
  const corpoErro = corpo as Partial<RespostaErro> | undefined;

  throw new ApiError({
    statusCode: corpoErro?.statusCode ?? resposta.status,
    erro: corpoErro?.erro ?? resposta.statusText ?? 'Error',
    mensagem: corpoErro?.mensagem ?? 'Nao foi possivel completar a requisicao.',
    detalhes: corpoErro?.detalhes,
    caminho: corpoErro?.caminho ?? caminho,
    timestamp: corpoErro?.timestamp ?? new Date().toISOString(),
  });
}

export function criarClienteHttp(config: ConfiguracaoCliente) {
  async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
    const {
      metodo = 'GET',
      query,
      corpo,
      cabecalhos = {},
      timeoutMs = TIMEOUT_PADRAO_MS,
      next,
      cache,
      sinal,
    } = opcoes;

    const url = `${config.baseUrl}${caminho}${montarQuery(query)}`;

    const cabecalhosPadrao = config.cabecalhosPadrao ? await config.cabecalhosPadrao() : {};

    const cabecalhosFinais: Record<string, string> = {
      Accept: 'application/json',
      ...cabecalhosPadrao,
      ...cabecalhos,
    };

    if (corpo !== undefined) {
      cabecalhosFinais['Content-Type'] = 'application/json';
    }

    /**
     * Timeout proprio: `fetch` sozinho espera indefinidamente, e uma tela
     * travada sem explicacao e pior do que um erro claro. O sinal externo
     * (cancelamento do TanStack Query) e encadeado para nao ser perdido.
     */
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
    sinal?.addEventListener('abort', () => controlador.abort(), { once: true });

    try {
      const resposta = await fetch(url, {
        method: metodo,
        headers: cabecalhosFinais,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: controlador.signal,
        credentials: config.credenciais,
        ...(next ? { next } : {}),
        ...(cache ? { cache } : {}),
      });

      return await interpretarResposta<T>(resposta, caminho);
    } catch (erro) {
      if (erro instanceof ApiError) throw erro;

      if (erro instanceof DOMException && erro.name === 'AbortError') {
        // Cancelamento pedido pelo chamador nao e falha: deixa propagar como tal.
        if (sinal?.aborted) throw erro;
        throw new ErroDeRede(`A requisicao para ${caminho} excedeu ${timeoutMs}ms.`, erro);
      }

      throw new ErroDeRede(`Falha de rede ao chamar ${caminho}.`, erro);
    } finally {
      clearTimeout(temporizador);
    }
  }

  return {
    requisitar,
    get: <T>(caminho: string, opcoes?: Omit<OpcoesRequisicao, 'metodo' | 'corpo'>) =>
      requisitar<T>(caminho, { ...opcoes, metodo: 'GET' }),
    post: <T>(caminho: string, corpo?: unknown, opcoes?: Omit<OpcoesRequisicao, 'metodo'>) =>
      requisitar<T>(caminho, { ...opcoes, metodo: 'POST', corpo }),
    patch: <T>(caminho: string, corpo?: unknown, opcoes?: Omit<OpcoesRequisicao, 'metodo'>) =>
      requisitar<T>(caminho, { ...opcoes, metodo: 'PATCH', corpo }),
  };
}

export type ClienteHttp = ReturnType<typeof criarClienteHttp>;
