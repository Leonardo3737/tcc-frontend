import { FUSO_PADRAO } from '@/lib/datas/fuso';
import type { ConfiguracaoInstituicao, LimitesAgendamento } from '@/types/dominio';

/**
 * Saneamento de GET /configuracao.
 *
 * Fica FORA do service de propósito: o service é `server-only` (faz a
 * requisição), enquanto isto é função pura e precisa ser testável sem o runtime
 * do Next.
 */

/** Defaults do backend (TIMEZONE_INSTITUICAO e as constantes de D-15). */
export const CONFIGURACAO_PADRAO: ConfiguracaoInstituicao = {
  fusoHorario: FUSO_PADRAO,
  agendamento: {
    duracaoMinimaMinutos: 15,
    duracaoPadraoMinutos: 60,
    duracaoMaximaMinutos: 240,
    antecedenciaMinimaMinutos: 0,
    cancelamentoAntecedenciaMinutos: 0,
  },
};

/**
 * Um número ausente, nulo, em texto ou não finito vira o default.
 *
 * O TypeScript afirma que esses campos são `number`, mas eles atravessam a
 * rede: ali o tipo é suposição, não garantia. Aconteceu de verdade —
 * `duracaoPadraoMinutos` foi acrescentado ao backend depois de a aplicação já
 * estar no ar, e bastou uma resposta anterior ainda no cache de fetch do Next
 * (`revalidate: 3600`) para o campo chegar `undefined`. O efeito era absurdo e
 * difícil de ligar à causa: um botão de duração escrito "NaN h NaN", porque
 * `Math.floor(undefined / 60)` não estoura — propaga NaN em silêncio.
 *
 * A alternativa, deixar passar e defender em cada ponto de uso, espalharia a
 * guarda por toda tela que lê um limite, e a próxima esqueceria dela.
 */
function numeroOu(valor: unknown, padrao: number): number {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  return typeof numero === 'number' && Number.isFinite(numero) ? numero : padrao;
}

export function normalizarConfiguracao(bruta: unknown): ConfiguracaoInstituicao {
  const objeto = (bruta ?? {}) as Partial<ConfiguracaoInstituicao>;
  const limites = (objeto.agendamento ?? {}) as Partial<LimitesAgendamento>;
  const padrao = CONFIGURACAO_PADRAO.agendamento;

  const duracaoMinimaMinutos = numeroOu(limites.duracaoMinimaMinutos, padrao.duracaoMinimaMinutos);
  const duracaoMaximaMinutos = numeroOu(limites.duracaoMaximaMinutos, padrao.duracaoMaximaMinutos);

  /**
   * A duração padrão é presa ao intervalo: um valor fora dele faria o seletor
   * sugerir um tamanho de slot que o próprio backend recusaria no agendamento.
   */
  const duracaoPadraoMinutos = Math.min(
    Math.max(
      numeroOu(limites.duracaoPadraoMinutos, padrao.duracaoPadraoMinutos),
      duracaoMinimaMinutos,
    ),
    duracaoMaximaMinutos,
  );

  return {
    fusoHorario:
      typeof objeto.fusoHorario === 'string' && objeto.fusoHorario.trim().length > 0
        ? objeto.fusoHorario
        : CONFIGURACAO_PADRAO.fusoHorario,
    agendamento: {
      duracaoMinimaMinutos,
      duracaoPadraoMinutos,
      duracaoMaximaMinutos,
      antecedenciaMinimaMinutos: numeroOu(
        limites.antecedenciaMinimaMinutos,
        padrao.antecedenciaMinimaMinutos,
      ),
      cancelamentoAntecedenciaMinutos: numeroOu(
        limites.cancelamentoAntecedenciaMinutos,
        padrao.cancelamentoAntecedenciaMinutos,
      ),
    },
  };
}
