import { describe, expect, it, vi } from 'vitest';

import { ApiError, ErroDeRede, mensagemDeErro, separarErrosPorCampo } from '@/lib/api/erros';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';

function erro(statusCode: number, mensagem: string, detalhes?: string[]) {
  return new ApiError({
    statusCode,
    erro: 'Erro',
    mensagem,
    detalhes,
    caminho: '/api/teste',
    timestamp: '2026-01-01T00:00:00.000Z',
  });
}

describe('classificacao de erro', () => {
  it.each([
    [401, 'ehNaoAutenticado'],
    [403, 'ehProibido'],
    [404, 'ehNaoEncontrado'],
    [409, 'ehConflito'],
    [429, 'ehExcessoDeRequisicoes'],
    [500, 'ehFalhaDoServidor'],
  ] as const)('%i e reconhecido como %s', (status, propriedade) => {
    expect(erro(status, 'x')[propriedade]).toBe(true);
  });

  it('trata 400 e 422 como validacao', () => {
    expect(erro(400, 'x').ehValidacao).toBe(true);
    expect(erro(422, 'x').ehValidacao).toBe(true);
  });
});

describe('mensagem exibida ao usuario', () => {
  /**
   * A regra: repassar a mensagem do backend, que ja e escrita para o usuario
   * final. Os unicos casos reescritos sao aqueles em que ela nao ajudaria.
   */
  it('repassa a mensagem de dominio do backend em 409', () => {
    const conflito = erro(
      409,
      'Este monitor ja possui outro atendimento que se sobrepoe a este horario (RN03).',
    );

    expect(mensagemDeErro(conflito)).toContain('RN03');
  });

  it('substitui o texto tecnico do throttler em 429', () => {
    const limite = erro(429, 'ThrottlerException: Too Many Requests');

    expect(mensagemDeErro(limite)).not.toContain('ThrottlerException');
    expect(mensagemDeErro(limite)).toContain('Aguarde');
  });

  it('nunca vaza detalhe interno em 5xx', () => {
    const interno = erro(500, 'QueryFailedError: relation "usuarios" does not exist at line 42');

    const texto = mensagemDeErro(interno);
    expect(texto).not.toContain('QueryFailedError');
    expect(texto).not.toContain('usuarios');
  });

  it('explica falha de rede sem jargao', () => {
    expect(mensagemDeErro(new ErroDeRede('timeout'))).toContain('conexão');
  });

  it('tem mensagem para erro totalmente desconhecido', () => {
    expect(mensagemDeErro(new Error('boom'))).toBe('Ocorreu um erro inesperado.');
    expect(mensagemDeErro(undefined)).toBe('Ocorreu um erro inesperado.');
  });
});

describe('separacao de erros por campo', () => {
  it('devolve cada mensagem do ValidationPipe ao seu campo', () => {
    const { porCampo, gerais } = separarErrosPorCampo(
      ['email deve ser um endereco de e-mail valido', 'senha nao pode ser vazia'],
      ['email', 'senha'],
    );

    expect(porCampo.email).toContain('e-mail valido');
    expect(porCampo.senha).toContain('vazia');
    expect(gerais).toHaveLength(0);
  });

  it('nao perde mensagem que nao casa com campo conhecido', () => {
    const { porCampo, gerais } = separarErrosPorCampo(
      ['campoDesconhecido invalido', 'email invalido'],
      ['email'],
    );

    expect(porCampo.email).toBeDefined();
    expect(gerais).toEqual(['campoDesconhecido invalido']);
  });

  it('mantem apenas a primeira mensagem por campo', () => {
    const { porCampo, gerais } = separarErrosPorCampo(
      ['senha deve ter 8 caracteres', 'senha deve conter numero'],
      ['senha'],
    );

    expect(porCampo.senha).toContain('8 caracteres');
    expect(gerais).toHaveLength(1);
  });
});

describe('erro da API aplicado ao formulario', () => {
  it('400 com detalhes vai para os campos', () => {
    const setError = vi.fn();

    aplicarErroDeFormulario(
      erro(400, 'Dados invalidos na requisicao.', ['email deve ser um endereco de e-mail valido']),
      setError,
      ['email', 'senha'],
    );

    expect(setError).toHaveBeenCalledWith('email', expect.objectContaining({ type: 'server' }));
  });

  /**
   * 409 nao pertence a um campo: e regra de negocio. Vai para `root`, onde o
   * <Alert> inline o mantem visivel enquanto o usuario ajusta o formulario.
   */
  it('409 vai para root, nao para um campo', () => {
    const setError = vi.fn();

    aplicarErroDeFormulario(erro(409, 'Voce ja participa desta monitoria.'), setError, ['alunoId']);

    expect(setError).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({ message: 'Voce ja participa desta monitoria.' }),
    );
  });

  it('respeita o mapeamento especial de status para campo', () => {
    const setError = vi.fn();

    // O 403 do cadastro de professor significa sempre "código de cadastro errado".
    aplicarErroDeFormulario(erro(403, 'Codigo invalido.'), setError, ['codigoCadastro'], {
      403: 'codigoCadastro',
    });

    expect(setError).toHaveBeenCalledWith('codigoCadastro', expect.anything());
  });

  it('erro que nao e ApiError ainda produz mensagem tratada', () => {
    const setError = vi.fn();

    aplicarErroDeFormulario(new ErroDeRede('sem rede'), setError, ['email']);

    expect(setError).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({ message: expect.stringContaining('conexão') }),
    );
  });
});
