import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import { criarClienteHttp } from '@/lib/api/http';
import {
  ApiError,
  CODIGO_SERVIDOR_INDISPONIVEL,
  ErroServidorIndisponivel,
  MENSAGEM_SERVIDOR_INDISPONIVEL,
  ehServidorIndisponivel,
  mensagemDeErro,
} from '@/lib/api/erros';
import {
  SEGUNDOS_ATE_RECARREGAR,
  TelaServidorIndisponivel,
} from '@/components/comum/servidor-indisponivel';

/**
 * API desligada por inatividade.
 *
 * A hospedagem desliga o servidor da API quando ninguem usa o sistema e o
 * religa no acesso seguinte (~1 min). O frontend precisa (1) reconhecer o caso
 * sem confundi-lo com um 503 de dominio do backend e (2) explicar e se
 * recuperar sozinho.
 */

function resposta(status: number, corpo?: unknown, tipo = 'application/json') {
  return new Response(corpo === undefined ? 'Service Unavailable' : JSON.stringify(corpo), {
    status,
    headers: { 'content-type': corpo === undefined ? 'text/html' : tipo },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('reconhecer a API desligada', () => {
  const cliente = criarClienteHttp({ baseUrl: 'http://api.teste/api' });

  it('502/503/504 da HOSPEDAGEM (fora do formato do backend) vira servidor indisponivel', async () => {
    for (const status of [502, 503, 504]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(status)));
      const erro = await cliente.get('/usuarios/eu').catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ErroServidorIndisponivel);
      // O digest e o que sobrevive ate o navegador em producao.
      expect((erro as ErroServidorIndisponivel).digest).toBe(CODIGO_SERVIDOR_INDISPONIVEL);
      expect(ehServidorIndisponivel(erro)).toBe(true);
    }
  });

  it('503 escrito PELO backend continua erro de dominio, com a mensagem dele', async () => {
    const mensagem = 'Nao foi possivel enviar a senha para o e-mail informado.';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          resposta(503, {
            statusCode: 503,
            erro: 'Service Unavailable',
            mensagem,
            caminho: '/api/alunos',
          }),
        ),
    );

    const erro = await cliente.post('/alunos', {}).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect(ehServidorIndisponivel(erro)).toBe(false);
  });

  it('no SERVIDOR do Next, conexao recusada tambem e servidor indisponivel', async () => {
    // jsdom define `window`; o servidor do Next nao. Simula o servidor.
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const erro = await cliente.get('/usuarios/eu').catch((e: unknown) => e);
    expect(ehServidorIndisponivel(erro)).toBe(true);
  });

  it('reconhece a resposta marcada do proxy/BFF e o digest da fronteira de erro', () => {
    const doProxy = new ApiError({
      statusCode: 503,
      erro: CODIGO_SERVIDOR_INDISPONIVEL,
      mensagem: MENSAGEM_SERVIDOR_INDISPONIVEL,
      caminho: '/api/backend/monitorias',
      timestamp: '2026-10-14T12:00:00.000Z',
    });
    expect(ehServidorIndisponivel(doProxy)).toBe(true);
    expect(mensagemDeErro(doProxy)).toBe(MENSAGEM_SERVIDOR_INDISPONIVEL);

    const doNext = Object.assign(new Error(''), { digest: CODIGO_SERVIDOR_INDISPONIVEL });
    expect(ehServidorIndisponivel(doNext)).toBe(true);
    expect(ehServidorIndisponivel(Object.assign(new Error(''), { digest: '123' }))).toBe(false);
  });
});

describe('tela de servidor ligando', () => {
  let recarregar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    recarregar = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: recarregar });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('explica em linguagem simples e conta 1 minuto', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    render(<TelaServidorIndisponivel />);

    expect(
      screen.getByRole('heading', { name: 'O sistema está sendo ligado' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nenhum dado foi perdido/i)).toBeInTheDocument();
    expect(screen.getByText('0:60')).toBeInTheDocument();
  });

  it('recarrega sozinha ao fim de 1 minuto se a API nao voltar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    render(<TelaServidorIndisponivel />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync((SEGUNDOS_ATE_RECARREGAR - 1) * 1000);
    });
    expect(recarregar).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('recarrega antes, assim que a API responder', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(resposta(200, { fusoHorario: 'America/Sao_Paulo', agendamento: {} })),
    );
    render(<TelaServidorIndisponivel />);

    // Primeira verificacao aos 10 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole('heading', { name: 'Pronto, o sistema voltou' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('depois de varias recargas seguidas, admite que pode ser outro problema', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    sessionStorage.setItem(
      'monitoria:tentativas-servidor',
      JSON.stringify({ n: 2, em: Date.now() - 30_000 }),
    );

    render(<TelaServidorIndisponivel />);
    expect(screen.getByText(/3ª tentativa seguida/i)).toBeInTheDocument();
  });
});
