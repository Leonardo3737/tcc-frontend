import { describe, expect, it } from 'vitest';

import {
  formatarDataHora,
  formatarHora,
  formatarHoraSimples,
  formatarIntervalo,
  instanteDeDataHoraLocal,
  nomeDoDiaSemana,
} from '@/lib/datas/fuso';

/**
 * A ARMADILHA DE INTEGRACAO DESTE PROJETO.
 *
 * O backend guarda atendimentos em TIMESTAMPTZ, mas valida a janela contra a
 * disponibilidade semanal usando `AT TIME ZONE <fuso da instituicao>`. Se o
 * frontend montar o instante com o fuso do NAVEGADOR, o agendamento e recusado
 * com "horario fora da disponibilidade" sem que o usuario entenda por que.
 *
 * Isto aconteceu de verdade durante a verificacao ponta a ponta — a maquina de
 * teste estava em UTC-4 e a instituicao em UTC-3. Estes testes existem para que
 * nao volte a acontecer.
 */

const SAO_PAULO = 'America/Sao_Paulo';

describe('instante a partir de data e hora locais da instituicao', () => {
  it('converte 14:00 de Sao Paulo para 17:00Z', () => {
    expect(instanteDeDataHoraLocal('2026-09-15', '14:00', SAO_PAULO)).toBe(
      '2026-09-15T17:00:00.000Z',
    );
  });

  it('NAO depende do fuso do processo — outro fuso produz outro instante', () => {
    const emSaoPaulo = instanteDeDataHoraLocal('2026-09-15', '14:00', SAO_PAULO);
    const emLisboa = instanteDeDataHoraLocal('2026-09-15', '14:00', 'Europe/Lisbon');

    expect(emSaoPaulo).not.toBe(emLisboa);
  });

  it('atravessa a meia-noite corretamente', () => {
    // 23:00 em São Paulo é 02:00Z do dia seguinte.
    expect(instanteDeDataHoraLocal('2026-09-15', '23:00', SAO_PAULO)).toBe(
      '2026-09-16T02:00:00.000Z',
    );
  });

  it('devolve null para entrada invalida em vez de uma data absurda', () => {
    expect(instanteDeDataHoraLocal('', '14:00', SAO_PAULO)).toBeNull();
    expect(instanteDeDataHoraLocal('2026-09-15', '', SAO_PAULO)).toBeNull();
    expect(instanteDeDataHoraLocal('nao-e-data', 'nem-hora', SAO_PAULO)).toBeNull();
  });

  it('faz a viagem de ida e volta: montar e formatar devolve a hora original', () => {
    const instante = instanteDeDataHoraLocal('2026-09-15', '09:30', SAO_PAULO)!;

    expect(formatarHora(instante, SAO_PAULO)).toBe('09:30');
  });
});

describe('formatacao para exibicao', () => {
  const instante = '2026-09-15T17:00:00.000Z'; // 14:00 em São Paulo

  it('exibe no fuso da instituicao, nao em UTC', () => {
    expect(formatarHora(instante, SAO_PAULO)).toBe('14:00');
    expect(formatarDataHora(instante, SAO_PAULO)).toBe('15/09/2026 às 14:00');
  });

  it('o mesmo instante aparece diferente em outro fuso', () => {
    expect(formatarHora(instante, 'Europe/Lisbon')).not.toBe('14:00');
  });

  it('monta o intervalo do atendimento', () => {
    expect(formatarIntervalo(instante, '2026-09-15T18:00:00.000Z', SAO_PAULO)).toBe(
      '14:00 – 15:00',
    );
  });

  it('corta os segundos que o backend devolve nas disponibilidades', () => {
    // O backend normaliza "14:00" para "14:00:00" ao gravar.
    expect(formatarHoraSimples('14:00:00')).toBe('14:00');
  });
});

describe('dia da semana', () => {
  /**
   * O backend usa 0 = domingo (compatível com Date.getDay() e EXTRACT(DOW)),
   * e não a convenção do ISO-8601 (1 = segunda).
   */
  it('0 e domingo e 6 e sabado', () => {
    expect(nomeDoDiaSemana(0)).toBe('domingo');
    expect(nomeDoDiaSemana(6)).toBe('sábado');
  });

  it('devolve string vazia para indice fora da faixa', () => {
    expect(nomeDoDiaSemana(7)).toBe('');
    expect(nomeDoDiaSemana(-1)).toBe('');
  });
});
