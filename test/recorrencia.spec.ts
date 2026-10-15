import { describe, expect, it } from 'vitest';

import { ocorrenciasSemanais } from '@/lib/datas/recorrencia';
import { duracoesDisponiveis } from '@/features/atendimentos/components/seletor-de-horario';
import { formatarHora, instanteDeDataHoraLocal, noFuso } from '@/lib/datas/fuso';

/**
 * Serie recorrente (A2).
 *
 * O ponto destes testes e UM: a semana seguinte precisa cair no MESMO HORARIO
 * LOCAL da instituicao, nao no mesmo instante absoluto mais 7 x 86.400.000 ms.
 * A disponibilidade do monitor e declarada em hora local ("terca, 14h") e o
 * backend valida com AT TIME ZONE — se uma virada de horario de verao deslocar
 * a sessao em uma hora, ela sai da faixa e o backend recusa com "fora da
 * disponibilidade", sem que ninguem entenda o motivo.
 */

const SAO_PAULO = 'America/Sao_Paulo';
/** Fuso que AINDA usa horario de verao, para exercitar a virada. */
const LISBOA = 'Europe/Lisbon';

describe('ocorrenciasSemanais', () => {
  it('conta a sessao original: 1 repeticao devolve apenas ela', () => {
    const inicio = instanteDeDataHoraLocal('2026-10-20', '14:00', SAO_PAULO)!;
    const fim = instanteDeDataHoraLocal('2026-10-20', '15:00', SAO_PAULO)!;

    const ocorrencias = ocorrenciasSemanais(inicio, fim, 1, SAO_PAULO);

    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0]!.inicio).toBe(inicio);
    expect(ocorrencias[0]!.fim).toBe(fim);
  });

  it('avanca de 7 em 7 dias de calendario', () => {
    const inicio = instanteDeDataHoraLocal('2026-10-20', '14:00', SAO_PAULO)!;
    const fim = instanteDeDataHoraLocal('2026-10-20', '16:00', SAO_PAULO)!;

    const ocorrencias = ocorrenciasSemanais(inicio, fim, 4, SAO_PAULO);
    const datas = ocorrencias.map((o) =>
      noFuso(o.inicio, SAO_PAULO).toISOString().slice(0, 10),
    );

    expect(ocorrencias).toHaveLength(4);
    expect(datas).toEqual(['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10']);
  });

  it('atravessa a virada de mes e de ano sem perder o horario', () => {
    const inicio = instanteDeDataHoraLocal('2026-12-22', '09:30', SAO_PAULO)!;
    const fim = instanteDeDataHoraLocal('2026-12-22', '10:30', SAO_PAULO)!;

    const ocorrencias = ocorrenciasSemanais(inicio, fim, 3, SAO_PAULO);

    for (const ocorrencia of ocorrencias) {
      expect(formatarHora(ocorrencia.inicio, SAO_PAULO)).toBe('09:30');
      expect(formatarHora(ocorrencia.fim, SAO_PAULO)).toBe('10:30');
    }

    expect(formatarHora(ocorrencias[2]!.inicio, SAO_PAULO)).toBe('09:30');
  });

  /**
   * O teste que justifica a funcao existir.
   *
   * Portugal entra no horario de verao em 29/03/2026. Somar 7 x 86.400.000 ms a
   * uma sessao de 22/03 produziria 13:00 em vez de 14:00 — fora de uma faixa
   * declarada como "14h as 16h".
   */
  it('mantem a hora LOCAL ao atravessar o horario de verao', () => {
    const inicio = instanteDeDataHoraLocal('2026-03-22', '14:00', LISBOA)!;
    const fim = instanteDeDataHoraLocal('2026-03-22', '16:00', LISBOA)!;

    const ocorrencias = ocorrenciasSemanais(inicio, fim, 2, LISBOA);
    const seguinte = ocorrencias[1]!;

    expect(formatarHora(seguinte.inicio, LISBOA)).toBe('14:00');
    expect(formatarHora(seguinte.fim, LISBOA)).toBe('16:00');

    // E a prova de que a soma ingenua teria errado:
    const somaIngenua = new Date(new Date(inicio).getTime() + 7 * 86_400_000).toISOString();
    expect(formatarHora(somaIngenua, LISBOA)).not.toBe('14:00');
  });
});

describe('duracoesDisponiveis', () => {
  it('descarta as sugestoes fora dos limites da instituicao', () => {
    const opcoes = duracoesDisponiveis({
      duracaoMinimaMinutos: 45,
      duracaoPadraoMinutos: 60,
      duracaoMaximaMinutos: 90,
    });

    expect(opcoes).toEqual([45, 60, 90]);
  });

  it('inclui a duracao padrao mesmo quando nao e uma das sugestoes', () => {
    const opcoes = duracoesDisponiveis({
      duracaoMinimaMinutos: 15,
      duracaoPadraoMinutos: 50,
      duracaoMaximaMinutos: 240,
    });

    expect(opcoes).toContain(50);
    expect(opcoes).toEqual([...opcoes].sort((a, b) => a - b));
  });

  it('nunca devolve lista vazia: com limites estreitos, resta a padrao', () => {
    const opcoes = duracoesDisponiveis({
      duracaoMinimaMinutos: 20,
      duracaoPadraoMinutos: 20,
      duracaoMaximaMinutos: 25,
    });

    expect(opcoes).toEqual([20]);
  });
});
