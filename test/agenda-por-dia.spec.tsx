import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';

import { AgendaPorDia } from '@/features/atendimentos/components/agenda-por-dia';
import { agruparPorDia } from '@/lib/datas/relativa';
import {
  ModalidadeAtendimento,
  OrigemAtendimento,
  StatusAtendimento,
  type Atendimento,
} from '@/types/dominio';
import { renderizar } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/atendimentos',
}));

const SP = 'America/Sao_Paulo';

function atendimento(id: string, inicio: string, assunto = `Assunto ${id}`): Atendimento {
  const fim = new Date(new Date(inicio).getTime() + 3_600_000).toISOString();
  return {
    id,
    monitoriaId: 'm1',
    monitoria: {
      id: 'm1',
      periodo: '2026/2',
      codigoDisciplina: 'CAL001',
      nomeDisciplina: 'Cálculo I',
    },
    monitorParticipanteId: 'v1',
    nomeMonitor: 'Ana',
    inicio,
    fim,
    vagas: 1,
    vagasOcupadas: 0,
    modalidade: ModalidadeAtendimento.PRESENCIAL,
    local: 'Sala B12',
    assunto,
    status: StatusAtendimento.AGENDADO,
    origem: OrigemAtendimento.OFERTA_MONITOR,
    motivoCancelamento: null,
    aceitaInscricao: true,
  };
}

describe('agrupar por dia', () => {
  it('usa o dia de calendario da instituicao, nao o UTC', () => {
    // 01:30Z do dia 16 ainda e 22:30 do dia 15 em Sao Paulo.
    const grupos = agruparPorDia(
      [atendimento('a', '2026-10-15T17:00:00.000Z'), atendimento('b', '2026-10-16T01:30:00.000Z')],
      SP,
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.chave).toBe('2026-10-15');
    expect(grupos[0]!.itens.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('preserva a ordem do servidor entre dias e dentro do dia (asc ou desc)', () => {
    const desc = [
      atendimento('c', '2026-10-17T19:00:00.000Z'),
      atendimento('b', '2026-10-17T13:00:00.000Z'),
      atendimento('a', '2026-10-15T13:00:00.000Z'),
    ];
    const grupos = agruparPorDia(desc, SP);
    expect(grupos.map((grupo) => grupo.chave)).toEqual(['2026-10-17', '2026-10-15']);
    expect(grupos[0]!.itens.map((item) => item.id)).toEqual(['c', 'b']);
  });
});

describe('agenda por dia', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Quinta, 15/10/2026, 10:00 em Sao Paulo.
    vi.setSystemTime(new Date('2026-10-15T13:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('cria uma secao por dia, com rotulo, data e contagem', () => {
    renderizar(
      <AgendaPorDia
        fuso={SP}
        atendimentos={[
          atendimento('a1', '2026-10-15T17:00:00.000Z', 'Limites'),
          atendimento('a2', '2026-10-15T19:00:00.000Z', 'Derivadas'),
          atendimento('a3', '2026-10-16T17:00:00.000Z', 'Integrais'),
          atendimento('a4', '2026-10-20T17:00:00.000Z', 'Séries'),
        ]}
      />,
    );

    const hoje = screen.getByRole('region', { name: 'Hoje' });
    expect(within(hoje).getByText('qui, 15/10')).toBeInTheDocument();
    expect(within(hoje).getByText('2 atendimentos')).toBeInTheDocument();
    expect(within(hoje).getByText('Limites')).toBeInTheDocument();
    expect(within(hoje).getByText('Derivadas')).toBeInTheDocument();

    const amanha = screen.getByRole('region', { name: 'Amanhã' });
    expect(within(amanha).getByText('1 atendimento')).toBeInTheDocument();
    expect(within(amanha).getByText('Integrais')).toBeInTheDocument();

    // Dia mais distante: o rotulo ja traz a data por extenso.
    const terca = screen.getByRole('region', { name: 'Terça, 20 de outubro' });
    expect(within(terca).getByText('Séries')).toBeInTheDocument();
  });
});
