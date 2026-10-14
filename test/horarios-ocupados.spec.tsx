import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HorariosOcupados } from '@/features/atendimentos/components/horarios-ocupados';
import { renderizar } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/monitorias/m1/atendimentos/agendar',
}));

function atendimento(
  id: string,
  inicio: string,
  fim: string,
  extras: Record<string, unknown> = {},
) {
  return {
    id,
    monitoriaId: 'm1',
    monitorParticipanteId: 'v-monitor',
    inicio,
    fim,
    vagas: 1,
    vagasOcupadas: 1,
    modalidade: 'PRESENCIAL',
    local: 'Sala B12',
    assunto: 'Qualquer',
    status: 'AGENDADO',
    origem: 'OFERTA_MONITOR',
    motivoCancelamento: null,
    aceitaInscricao: false,
    ...extras,
  };
}

function resposta(dados: unknown[]) {
  return new Response(
    JSON.stringify({
      dados,
      meta: { total: dados.length, pagina: 1, limite: 100, totalPaginas: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Quarta, 23/09/2026, 10:00 em Sao Paulo.
  vi.setSystemTime(new Date('2026-09-23T13:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('horarios ja ocupados do monitor', () => {
  it('nao busca nada enquanto esta recolhido', () => {
    const espiao = vi.fn();
    vi.stubGlobal('fetch', espiao);

    renderizar(
      <HorariosOcupados monitoriaId="m1" monitorParticipanteId="v-monitor" oferecerEntrar />,
    );

    expect(screen.getByRole('button', { name: /hor[aá]rios j[aá] ocupados/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(espiao).not.toHaveBeenCalled();
  });

  it('ao abrir, pede so os AGENDADOS daquele monitor nos proximos 14 dias e agrupa por dia', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const espiao = vi.fn().mockResolvedValue(
      resposta([
        atendimento('a1', '2026-09-24T17:00:00.000Z', '2026-09-24T18:00:00.000Z'),
        atendimento('a2', '2026-09-24T19:00:00.000Z', '2026-09-24T20:30:00.000Z', {
          vagas: 5,
          vagasOcupadas: 2,
          aceitaInscricao: true,
        }),
      ]),
    );
    vi.stubGlobal('fetch', espiao);

    renderizar(
      <HorariosOcupados monitoriaId="m1" monitorParticipanteId="v-monitor" oferecerEntrar />,
    );
    await usuario.click(screen.getByRole('button', { name: /hor[aá]rios j[aá] ocupados/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalledTimes(1));
    const url = new URL(String((espiao.mock.calls[0] as [string])[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/backend/monitorias/m1/atendimentos');
    expect(url.searchParams.get('status')).toBe('AGENDADO');
    expect(url.searchParams.get('monitorParticipanteId')).toBe('v-monitor');
    expect(url.searchParams.get('de')).toBe('2026-09-23T13:00:00.000Z');
    expect(url.searchParams.get('ate')).toBe('2026-10-07T13:00:00.000Z');
    expect(url.searchParams.get('ordenarPor')).toBe('inicio');
    expect(url.searchParams.get('direcao')).toBe('asc');

    expect(await screen.findByText('Amanhã')).toBeInTheDocument();
    expect(screen.getByText('14:00 – 15:00')).toBeInTheDocument();
    expect(screen.getByText('16:00 – 17:30')).toBeInTheDocument();
    // Sessao em grupo com vaga vira atalho para entrar nela.
    expect(screen.getByRole('link', { name: /3 vagas — entrar/i })).toHaveAttribute(
      'href',
      '/atendimentos/a2',
    );
  });

  it('o monitor vendo a propria agenda nao recebe o atalho de entrar', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        resposta([
          atendimento('a2', '2026-09-24T19:00:00.000Z', '2026-09-24T20:30:00.000Z', {
            vagas: 5,
            vagasOcupadas: 2,
            aceitaInscricao: true,
          }),
        ]),
      ),
    );

    renderizar(
      <HorariosOcupados
        monitoriaId="m1"
        monitorParticipanteId="v-monitor"
        oferecerEntrar={false}
      />,
    );
    await usuario.click(screen.getByRole('button', { name: /hor[aá]rios j[aá] ocupados/i }));

    expect(await screen.findByText('16:00 – 17:30')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /entrar/i })).not.toBeInTheDocument();
  });

  it('agenda vazia diz que as faixas estao livres; "ver mais" amplia a janela', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const espiao = vi.fn().mockImplementation(() => Promise.resolve(resposta([])));
    vi.stubGlobal('fetch', espiao);

    renderizar(
      <HorariosOcupados monitoriaId="m1" monitorParticipanteId="v-monitor" oferecerEntrar />,
    );
    await usuario.click(screen.getByRole('button', { name: /hor[aá]rios j[aá] ocupados/i }));

    expect(
      await screen.findByText(/nenhum atendimento agendado nos pr[oó]ximos 14 dias/i),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /ver mais 14 dias/i }));
    await waitFor(() => expect(espiao).toHaveBeenCalledTimes(2));
    const url = new URL(String((espiao.mock.calls[1] as [string])[0]), 'http://localhost');
    expect(url.searchParams.get('ate')).toBe('2026-10-21T13:00:00.000Z');
  });
});
