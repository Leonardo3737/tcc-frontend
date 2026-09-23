import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  TOTAL_CORES_DISCIPLINA,
  classesCorDisciplina,
  indiceCorDisciplina,
  siglaDisciplina,
} from '@/lib/cores/disciplina';
import { descreverDataRelativa, distanciaCurta, rotuloDia } from '@/lib/datas/relativa';
import { BarraVagas } from '@/components/comum/barra-vagas';

/**
 * Identidade visual (Bloco A): as partes que sao REGRA, nao estetica.
 *
 * A cor da disciplina so ajuda se for a mesma em toda tela e em toda sessao; a
 * data relativa so ajuda se "hoje" for o hoje da instituicao.
 */

describe('cor estavel por disciplina', () => {
  it('devolve sempre o mesmo indice para o mesmo codigo', () => {
    const primeira = indiceCorDisciplina('MAT101');
    for (let vez = 0; vez < 50; vez += 1) {
      expect(indiceCorDisciplina('MAT101')).toBe(primeira);
    }
  });

  it('ignora caixa e espacos: e a mesma disciplina para quem le', () => {
    expect(indiceCorDisciplina(' mat101 ')).toBe(indiceCorDisciplina('MAT101'));
  });

  it('fica dentro da paleta de 8 cores', () => {
    const codigos = ['MAT101', 'INF201', 'FIS110', 'QUI001', 'BD2026', 'ENG300', 'X', 'LET-45'];
    for (const codigo of codigos) {
      const indice = indiceCorDisciplina(codigo);
      expect(indice).toBeGreaterThanOrEqual(0);
      expect(indice).toBeLessThan(TOTAL_CORES_DISCIPLINA);
    }
  });

  it('valor fixo conhecido: trava o algoritmo contra troca acidental', () => {
    // Se este numero mudar, TODAS as disciplinas trocam de cor para os usuarios.
    expect(indiceCorDisciplina('MAT101')).toBe(7);
    expect(indiceCorDisciplina('INF201')).toBe(1);
    expect(indiceCorDisciplina('BD2026')).toBe(5);
    expect(classesCorDisciplina('MAT101').solido).toBe('bg-disciplina-7');
  });

  it('distribui codigos diferentes por mais de uma cor', () => {
    const indices = new Set(Array.from({ length: 40 }, (_, n) => indiceCorDisciplina(`DISC${n}`)));
    expect(indices.size).toBeGreaterThanOrEqual(6);
  });

  it('codigo ausente cai na primeira cor, sem quebrar', () => {
    expect(indiceCorDisciplina(undefined)).toBe(0);
    expect(indiceCorDisciplina('')).toBe(0);
  });

  it('sigla usa as palavras significativas e preserva numerais', () => {
    expect(siglaDisciplina('Cálculo I')).toBe('CI');
    expect(siglaDisciplina('Banco de Dados')).toBe('BD');
    expect(siglaDisciplina('Cálculo Diferencial e Integral II')).toBe('CDI');
    expect(siglaDisciplina('Estatística')).toBe('ES');
    expect(siglaDisciplina('', 'mat101')).toBe('MAT');
  });
});

describe('data relativa no fuso da instituicao', () => {
  const SP = 'America/Sao_Paulo';
  // Quarta, 23/09/2026, 10:00 em Sao Paulo (13:00Z).
  const agora = new Date('2026-09-23T13:00:00.000Z');

  it('hoje, amanha e ontem pelo calendario local', () => {
    expect(descreverDataRelativa('2026-09-23T17:00:00.000Z', agora, SP)).toBe('hoje, 14:00');
    expect(descreverDataRelativa('2026-09-24T12:30:00.000Z', agora, SP)).toBe('amanhã, 09:30');
    expect(descreverDataRelativa('2026-09-22T19:00:00.000Z', agora, SP)).toBe('ontem, 16:00');
  });

  it('dentro da semana usa o dia abreviado', () => {
    expect(descreverDataRelativa('2026-09-25T17:00:00.000Z', agora, SP)).toBe('sex, 25/09, 14:00');
    expect(descreverDataRelativa('2026-09-26T17:00:00.000Z', agora, SP)).toBe('sáb, 26/09, 14:00');
  });

  it('mais longe mostra so a data; outro ano inclui o ano', () => {
    expect(descreverDataRelativa('2026-10-15T17:00:00.000Z', agora, SP)).toBe('15/10, 14:00');
    expect(descreverDataRelativa('2027-01-10T17:00:00.000Z', agora, SP)).toBe('10/01/2027');
  });

  it('"amanha" e o amanha da instituicao, nao o do UTC', () => {
    // 02:30Z do dia 24 ainda e 23:30 do dia 23 em Sao Paulo.
    expect(descreverDataRelativa('2026-09-24T02:30:00.000Z', agora, SP)).toBe('hoje, 23:30');
  });

  it('sem hora quando pedido', () => {
    expect(descreverDataRelativa('2026-09-24T12:30:00.000Z', agora, SP, { comHora: false })).toBe(
      'amanhã',
    );
  });

  it('distancia curta so ate 12 h', () => {
    expect(distanciaCurta('2026-09-23T15:00:00.000Z', agora)).toBe('em 2 h');
    expect(distanciaCurta('2026-09-23T13:45:00.000Z', agora)).toBe('em 45 min');
    expect(distanciaCurta('2026-09-23T12:40:00.000Z', agora)).toBe('há 20 min');
    expect(distanciaCurta('2026-09-24T13:00:00.000Z', agora)).toBeNull();
  });

  it('cabecalho de dia da agenda', () => {
    expect(rotuloDia('2026-09-23T17:00:00.000Z', agora, SP)).toBe('Hoje');
    expect(rotuloDia('2026-09-24T17:00:00.000Z', agora, SP)).toBe('Amanhã');
    expect(rotuloDia('2026-09-25T17:00:00.000Z', agora, SP)).toBe('Sexta, 25 de setembro');
    expect(rotuloDia('2027-01-04T17:00:00.000Z', agora, SP)).toBe('Segunda, 4 de janeiro de 2027');
  });
});

describe('BarraVagas', () => {
  it('diz quantas vagas estao ocupadas e quantas restam', () => {
    render(<BarraVagas vagas={5} ocupadas={3} aceitaInscricao />);
    expect(screen.getByText('3 de 5 vagas')).toBeInTheDocument();
    expect(screen.getByText('2 livres')).toBeInTheDocument();
  });

  it('marca lotado em texto, nao so na cor da barra', () => {
    render(<BarraVagas vagas={4} ocupadas={4} />);
    expect(screen.getByText('lotado')).toBeInTheDocument();
  });

  it('atendimento individual fala em ocupado/livre', () => {
    render(<BarraVagas vagas={1} ocupadas={0} />);
    expect(screen.getByText('Individual · livre')).toBeInTheDocument();
  });
});
