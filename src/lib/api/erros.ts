import type { RespostaErro } from '@/types/api';

/**
 * Erro tipado da API.
 *
 * Toda resposta nao-ok vira uma instancia disto, para que nenhum componente
 * precise inspecionar `response.status` na mao. O backend garante um formato
 * unico de erro, entao esta classe consegue ser a unica traducao necessaria.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly erro: string;
  readonly detalhes: string[];
  readonly caminho: string;

  constructor(corpo: RespostaErro) {
    super(corpo.mensagem);
    this.name = 'ApiError';
    this.statusCode = corpo.statusCode;
    this.erro = corpo.erro;
    this.detalhes = corpo.detalhes ?? [];
    this.caminho = corpo.caminho;
  }

  /** Sessao ausente, expirada ou usuario desativado. */
  get ehNaoAutenticado(): boolean {
    return this.statusCode === 401;
  }

  /** Perfil, participacao ou propriedade insuficiente. */
  get ehProibido(): boolean {
    return this.statusCode === 403;
  }

  get ehNaoEncontrado(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Conflito de dominio: RN03 (choque de horario), RN09 (acumulo de papeis),
   * transicao de status invalida, sem vagas, ja avaliado...
   *
   * Nesta aplicacao 409 nao e caso de borda — e como as regras mais importantes
   * do sistema se manifestam, porque varias so podem ser verificadas no momento
   * da escrita, sob constraint do banco.
   */
  get ehConflito(): boolean {
    return this.statusCode === 409;
  }

  get ehValidacao(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }

  /** Rate limit. O login do backend permite apenas 5 tentativas por minuto. */
  get ehExcessoDeRequisicoes(): boolean {
    return this.statusCode === 429;
  }

  get ehFalhaDoServidor(): boolean {
    return this.statusCode >= 500;
  }
}

/** Falha de rede, DNS ou timeout: a requisicao nem chegou a ter resposta. */
export class ErroDeRede extends Error {
  readonly causaOriginal: unknown;

  constructor(mensagem: string, causaOriginal?: unknown) {
    super(mensagem);
    this.name = 'ErroDeRede';
    this.causaOriginal = causaOriginal;
  }
}

/**
 * Mensagem pronta para exibicao, qualquer que seja a falha.
 *
 * Para ApiError devolve a mensagem do backend, que ja e escrita para o usuario
 * final. Os unicos casos reescritos aqui sao aqueles em que a mensagem do
 * servidor nao ajudaria: 429 (o texto padrao do throttler e tecnico) e 5xx
 * (detalhe interno nunca deve vazar).
 */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.ehExcessoDeRequisicoes) {
      return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.';
    }

    if (erro.ehFalhaDoServidor) {
      return 'O servidor encontrou um erro. Tente novamente em instantes.';
    }

    return erro.message;
  }

  if (erro instanceof ErroDeRede) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão.';
  }

  return 'Ocorreu um erro inesperado.';
}

/**
 * Quebra `detalhes[]` do ValidationPipe em erros por campo.
 *
 * O class-validator devolve mensagens como
 * "email deve ser um endereco de e-mail valido" — o nome do campo e sempre a
 * primeira palavra, porque as mensagens do backend foram escritas assim.
 * O que nao casar com um campo conhecido volta em `gerais`, para nao sumir.
 */
export function separarErrosPorCampo(
  detalhes: string[],
  camposConhecidos: readonly string[],
): { porCampo: Record<string, string>; gerais: string[] } {
  const porCampo: Record<string, string> = {};
  const gerais: string[] = [];

  for (const detalhe of detalhes) {
    const primeiraPalavra = detalhe.trim().split(/\s+/)[0] ?? '';
    const campo = camposConhecidos.find((conhecido) => conhecido === primeiraPalavra);

    if (campo && !porCampo[campo]) {
      porCampo[campo] = detalhe;
    } else {
      gerais.push(detalhe);
    }
  }

  return { porCampo, gerais };
}
