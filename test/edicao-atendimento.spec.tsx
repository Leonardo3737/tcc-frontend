import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DialogoEditarAtendimento } from '@/features/atendimentos/components/dialogo-editar-atendimento';
import { contextoDaMonitoria, podeEditarAtendimento } from '@/lib/autorizacao/capacidades';
import {
  ModalidadeAtendimento,
  OrigemAtendimento,
  PapelMonitoria,
  StatusAtendimento,
  StatusMonitoria,
  type Atendimento,
} from '@/types/dominio';
import { renderizar } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/atendimentos/a1',
}));

afterEach(() => vi.unstubAllGlobals());

function atendimento(extras: Partial<Atendimento> = {}): Atendimento {
  return {
    id: 'a1',
    monitoriaId: 'm1',
    monitorParticipanteId: 'v-monitor',
    inicio: '2026-10-20T17:00:00.000Z',
    fim: '2026-10-20T18:00:00.000Z',
    vagas: 5,
    vagasOcupadas: 3,
    modalidade: ModalidadeAtendimento.PRESENCIAL,
    local: 'Sala B12',
    assunto: 'Limites',
    status: StatusAtendimento.AGENDADO,
    origem: OrigemAtendimento.OFERTA_MONITOR,
    motivoCancelamento: null,
    aceitaInscricao: true,
    ...extras,
  };
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const contexto = (extras: Record<string, unknown>) =>
  contextoDaMonitoria({
    id: 'm1',
    ano: 2026,
    semestre: 2,
    periodo: '2026/2',
    descricao: null,
    status: StatusMonitoria.ATIVA,
    dataInicio: null,
    dataFim: null,
    ...extras,
  });

/**
 * PATCH /atendimentos/:id — assunto, local e vagas de uma sessao AGENDADA,
 * pelo monitor DAQUELA sessao ou pelo professor responsavel.
 */
describe('quem edita', () => {
  it('monitor da sessao e professor responsavel; monitorado e outro monitor nao', () => {
    expect(
      podeEditarAtendimento(
        atendimento(),
        contexto({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-monitor' }),
      ),
    ).toBe(true);
    expect(podeEditarAtendimento(atendimento(), contexto({ souResponsavel: true }))).toBe(true);
    expect(
      podeEditarAtendimento(
        atendimento(),
        contexto({ meuPapel: PapelMonitoria.MONITORADO, meuParticipanteId: 'v-aluno' }),
      ),
    ).toBe(false);
    expect(
      podeEditarAtendimento(
        atendimento(),
        contexto({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-outro' }),
      ),
    ).toBe(false);
  });

  it('realizado ou cancelado nao se edita', () => {
    const responsavel = contexto({ souResponsavel: true });
    expect(
      podeEditarAtendimento(atendimento({ status: StatusAtendimento.REALIZADO }), responsavel),
    ).toBe(false);
    expect(
      podeEditarAtendimento(atendimento({ status: StatusAtendimento.CANCELADO }), responsavel),
    ).toBe(false);
  });
});

describe('dialogo de edicao', () => {
  function abrir(extras: Partial<Atendimento> = {}) {
    const aoConcluir = vi.fn();
    renderizar(
      <DialogoEditarAtendimento
        aberto
        aoFechar={vi.fn()}
        aoConcluir={aoConcluir}
        atendimento={atendimento(extras)}
      />,
    );
    return { aoConcluir };
  }

  it('nao oferece horario nem modalidade, e so habilita salvar depois de mudar algo', () => {
    abrir();
    expect(
      screen.queryByLabelText(/data|in[ií]cio|t[eé]rmino|hor[aá]rio/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /modalidade/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar altera/i })).toBeDisabled();
  });

  it('envia so os campos alterados', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn().mockResolvedValue(json(atendimento({ assunto: 'Limites laterais' })));
    vi.stubGlobal('fetch', espiao);
    const { aoConcluir } = abrir();

    const assunto = screen.getByLabelText(/assunto/i);
    await usuario.clear(assunto);
    await usuario.type(assunto, 'Limites laterais');
    await usuario.click(screen.getByRole('button', { name: /salvar altera/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    const [url, init] = espiao.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/backend/atendimentos/a1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ assunto: 'Limites laterais' });
    await waitFor(() => expect(aoConcluir).toHaveBeenCalled());
  });

  it('local vazio vai como "" — e assim que o backend remove o local', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn().mockResolvedValue(json(atendimento({ local: null })));
    vi.stubGlobal('fetch', espiao);
    abrir();

    await usuario.clear(screen.getByLabelText(/^local/i));
    await usuario.click(screen.getByRole('button', { name: /salvar altera/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    expect(JSON.parse(String((espiao.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      local: '',
    });
  });

  it('vagas abaixo dos inscritos e barrado antes de ir ao servidor', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn();
    vi.stubGlobal('fetch', espiao);
    abrir({ vagasOcupadas: 3 });

    const vagas = screen.getByLabelText(/vagas/i);
    await usuario.clear(vagas);
    await usuario.type(vagas, '2');
    await usuario.click(screen.getByRole('button', { name: /salvar altera/i }));

    expect(
      await screen.findByText('Já há 3 inscritos: as vagas não podem ficar abaixo disso'),
    ).toBeInTheDocument();
    expect(espiao).not.toHaveBeenCalled();
  });

  it('409 do backend fica na tela', async () => {
    const usuario = userEvent.setup();
    const mensagem = 'Este atendimento ja foi realizado e nao pode mais ser alterado.';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json(
            { statusCode: 409, erro: 'Conflict', mensagem, caminho: '/api/atendimentos/a1' },
            409,
          ),
        ),
    );
    abrir();

    const assunto = screen.getByLabelText(/assunto/i);
    await usuario.type(assunto, ' extra');
    await usuario.click(screen.getByRole('button', { name: /salvar altera/i }));

    expect(await screen.findByText(mensagem)).toBeInTheDocument();
  });

  it('em sessao remota o campo vira "Link da sala virtual"', () => {
    abrir({ modalidade: ModalidadeAtendimento.REMOTO, local: 'https://meet.exemplo/abc' });
    expect(screen.getByLabelText(/link da sala virtual/i)).toHaveValue('https://meet.exemplo/abc');
  });
});
