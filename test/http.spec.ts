import { afterEach, describe, expect, it, vi } from 'vitest';

import { criarClienteHttp, montarQuery } from '@/lib/api/http';
import type { Mock } from 'vitest';
import { ApiError, ErroDeRede } from '@/lib/api/erros';

/** Extrai os argumentos de uma chamada do mock com tipo — `calls[i]` é
 * `possibly undefined` sob `noUncheckedIndexedAccess`. */
function chamada(espiao: Mock, indice = 0): [string, RequestInit] {
  const args = espiao.mock.calls[indice];
  if (!args) throw new Error(`fetch nao foi chamado ${indice + 1} vez(es)`);
  return args as [string, RequestInit];
}

function cabecalhos(espiao: Mock, indice = 0): Record<string, string> {
  return (chamada(espiao, indice)[1].headers ?? {}) as Record<string, string>;
}

function resposta(corpo: unknown, status = 200) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('montagem de query string', () => {
  it('omite undefined, null e string vazia', () => {
    expect(montarQuery({ a: 1, b: undefined, c: null, d: '' })).toBe('?a=1');
  });

  /**
   * Arrays viram chaves REPETIDAS, que e o formato que o
   * FiltroMinhasMonitoriasDto do backend espera (`?status=A&status=B`).
   * Serializar como "A,B" seria recusado pelo @IsEnum(..., { each: true }).
   */
  it('repete a chave para cada item do array', () => {
    expect(montarQuery({ status: ['ATIVA', 'ENCERRADA'] })).toBe('?status=ATIVA&status=ENCERRADA');
  });

  it('serializa booleano como texto', () => {
    expect(montarQuery({ ativa: false })).toBe('?ativa=false');
  });

  it('devolve string vazia quando nao ha nada a enviar', () => {
    expect(montarQuery(undefined)).toBe('');
    expect(montarQuery({ a: undefined })).toBe('');
  });
});

describe('cliente HTTP', () => {
  const cliente = criarClienteHttp({ baseUrl: '/api/backend' });

  it('devolve o corpo desserializado em caso de sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({ id: 'x' })));

    await expect(cliente.get('/monitorias/x')).resolves.toEqual({ id: 'x' });
  });

  /**
   * O backend responde 204 na troca de senha. Chamar .json() num corpo vazio
   * lança um erro de parse que nao significa nada — o cliente precisa tratar.
   */
  it('trata 204 sem corpo sem quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(cliente.patch('/usuarios/eu/senha')).resolves.toBeUndefined();
  });

  it('converte resposta de erro do backend em ApiError tipado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        resposta(
          {
            statusCode: 409,
            erro: 'Conflict',
            mensagem: 'Voce ja esta inscrito neste atendimento.',
            caminho: '/api/atendimentos/x/inscricao',
            timestamp: '2026-01-01T00:00:00.000Z',
          },
          409,
        ),
      ),
    );

    const falha = (await cliente
      .post('/atendimentos/x/inscricao')
      .catch((e: unknown) => e)) as ApiError;

    expect(falha).toBeInstanceOf(ApiError);
    expect(falha.ehConflito).toBe(true);
    expect(falha.message).toContain('ja esta inscrito');
  });

  it('produz ApiError util mesmo quando a falha nao vem no formato do backend', async () => {
    // Ex.: um gateway devolvendo HTML.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })),
    );

    const falha = (await cliente.get('/x').catch((e: unknown) => e)) as ApiError;

    expect(falha).toBeInstanceOf(ApiError);
    expect(falha.statusCode).toBe(502);
  });

  it('transforma falha de rede em ErroDeRede, nao em excecao crua', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(cliente.get('/x')).rejects.toBeInstanceOf(ErroDeRede);
  });

  it('envia Content-Type apenas quando ha corpo', async () => {
    const espiao = vi.fn().mockResolvedValue(resposta({}));
    vi.stubGlobal('fetch', espiao);

    await cliente.get('/x');
    expect(cabecalhos(espiao)['Content-Type']).toBeUndefined();

    await cliente.post('/x', { a: 1 });
    expect(cabecalhos(espiao, 1)['Content-Type']).toBe('application/json');
  });

  it('anexa a query string ao caminho', async () => {
    const espiao = vi.fn().mockResolvedValue(resposta([]));
    vi.stubGlobal('fetch', espiao);

    await cliente.get('/monitorias', { query: { busca: 'calculo', pagina: 2 } });

    expect(chamada(espiao)[0]).toBe('/api/backend/monitorias?busca=calculo&pagina=2');
  });

  it('aplica os cabecalhos padrao da configuracao (ex.: Authorization)', async () => {
    const espiao = vi.fn().mockResolvedValue(resposta({}));
    vi.stubGlobal('fetch', espiao);

    const autenticado = criarClienteHttp({
      baseUrl: '',
      cabecalhosPadrao: () => ({ Authorization: 'Bearer token-de-teste' }),
    });

    await autenticado.get('/usuarios/eu');

    expect(cabecalhos(espiao).Authorization).toBe('Bearer token-de-teste');
  });
});
