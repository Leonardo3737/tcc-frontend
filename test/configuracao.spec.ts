import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guarda-corpos de producao.
 *
 * Estes testes existem porque as duas falhas cobertas aqui sao SILENCIOSAS: a
 * aplicacao sobe e funciona normalmente com cookie inseguro ou apontando para
 * localhost. Sem falhar no boot, o defeito so apareceria numa auditoria.
 */
const ambienteOriginal = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ambienteOriginal };
});

async function carregarEnv() {
  return import('@/config/env');
}

describe('validacao das variaveis de ambiente', () => {
  it('aceita configuracao valida de desenvolvimento', async () => {
    process.env = {
      ...ambienteOriginal,
      NODE_ENV: 'development',
      API_URL: 'http://localhost:3000/api',
      COOKIE_SECURE: 'false',
    };

    const { env } = await carregarEnv();
    expect(env.API_URL).toBe('http://localhost:3000/api');
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('remove a barra final da API_URL, evitando caminho com barra dupla', async () => {
    process.env = { ...ambienteOriginal, API_URL: 'http://localhost:3000/api/' };

    const { env } = await carregarEnv();
    expect(env.API_URL).toBe('http://localhost:3000/api');
  });

  it('falha quando API_URL nao e uma URL', async () => {
    process.env = { ...ambienteOriginal, API_URL: 'nao-e-url' };

    await expect(carregarEnv()).rejects.toThrow(/API_URL/);
  });

  it('nao quebra o BUILD: a politica de producao nao roda no carregamento', async () => {
    // `next build` roda com NODE_ENV=production na maquina de quem compila, que
    // costuma ter configuracao de desenvolvimento. Validar a politica aqui
    // quebraria o build sem haver problema no ambiente real.
    process.env = {
      ...ambienteOriginal,
      NODE_ENV: 'production',
      API_URL: 'http://localhost:3000/api',
      COOKIE_SECURE: 'false',
    };

    await expect(carregarEnv()).resolves.toBeDefined();
  });
});

describe('politica de producao (verificada no boot)', () => {
  it('acusa cookie sem Secure', async () => {
    process.env = {
      ...ambienteOriginal,
      NODE_ENV: 'production',
      API_URL: 'https://api.instituicao.edu.br/api',
      COOKIE_SECURE: 'false',
    };

    const { problemasDePoliticaDeProducao } = await carregarEnv();
    expect(problemasDePoliticaDeProducao().join(' ')).toMatch(/COOKIE_SECURE/);
  });

  it('acusa API apontando para localhost', async () => {
    process.env = {
      ...ambienteOriginal,
      NODE_ENV: 'production',
      API_URL: 'http://localhost:3000/api',
      COOKIE_SECURE: 'true',
    };

    const { problemasDePoliticaDeProducao } = await carregarEnv();
    expect(problemasDePoliticaDeProducao().join(' ')).toMatch(/localhost/);
  });

  it('nao reclama de producao corretamente configurada', async () => {
    process.env = {
      ...ambienteOriginal,
      NODE_ENV: 'production',
      API_URL: 'https://api.instituicao.edu.br/api',
      COOKIE_SECURE: 'true',
    };

    const { problemasDePoliticaDeProducao, ehProducao } = await carregarEnv();
    expect(ehProducao).toBe(true);
    expect(problemasDePoliticaDeProducao()).toEqual([]);
  });

  it('nao aplica a politica fora de producao', async () => {
    process.env = {
      ...ambienteOriginal,
      NODE_ENV: 'development',
      API_URL: 'http://localhost:3000/api',
      COOKIE_SECURE: 'false',
    };

    const { problemasDePoliticaDeProducao } = await carregarEnv();
    expect(problemasDePoliticaDeProducao()).toEqual([]);
  });

  /**
   * Nenhuma variavel tem prefixo NEXT_PUBLIC_: o navegador nunca fala com o
   * backend diretamente, entao a URL interna nao precisa (e nao deve) entrar no
   * bundle do cliente.
   */
  it('nenhuma variavel do servidor vaza para o cliente via NEXT_PUBLIC_', async () => {
    process.env = { ...ambienteOriginal, API_URL: 'http://localhost:3000/api' };

    const modulo = await carregarEnv();
    const chaves = Object.keys(modulo.env);

    expect(chaves.some((chave) => chave.startsWith('NEXT_PUBLIC_'))).toBe(false);
  });
});
