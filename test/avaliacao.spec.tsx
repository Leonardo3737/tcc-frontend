import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DialogoAvaliacao } from '@/features/avaliacoes/components/dialogo-avaliacao';
import { renderizar } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

/**
 * Avaliacao — RN05 e RN06.
 *
 * O corpo enviado ao backend NAO carrega quem avalia nem qual inscricao: os dois
 * saem do token cruzado com o atendimento da rota. Um teste que aceitasse
 * `inscricaoId` no corpo estaria validando uma brecha (avaliar em nome de outro).
 */
describe('dialogo de avaliacao', () => {
  it('exige nota antes de habilitar o envio', () => {
    renderizar(<DialogoAvaliacao aberto aoFechar={vi.fn()} atendimentoId="a1" nomeMonitor="Ana" />);

    expect(screen.getByRole('button', { name: /enviar avalia/i })).toBeDisabled();
  });

  it('envia nota e comentario para a rota do atendimento', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn().mockResolvedValue(json({ id: 'av1', nota: 5 }, 201));
    vi.stubGlobal('fetch', espiao);

    renderizar(<DialogoAvaliacao aberto aoFechar={vi.fn()} atendimentoId="a1" />);

    await usuario.click(screen.getByRole('radio', { name: /^5 —/ }));
    await usuario.type(screen.getByLabelText(/coment/i), 'Explicou com clareza.');
    await usuario.click(screen.getByRole('button', { name: /enviar avalia/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());

    const chamada = espiao.mock.calls[0] as [string, RequestInit];
    expect(chamada[0]).toBe('/api/backend/atendimentos/a1/avaliacao');

    const corpo = JSON.parse(String(chamada[1].body));
    expect(corpo).toEqual({ nota: 5, comentario: 'Explicou com clareza.' });
    // Nem autor nem inscrição vão no corpo — o backend os deriva do token.
    expect(corpo).not.toHaveProperty('inscricaoId');
    expect(corpo).not.toHaveProperty('usuarioId');
  });

  it('omite o comentario quando vazio, em vez de enviar string vazia', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn().mockResolvedValue(json({ id: 'av1' }, 201));
    vi.stubGlobal('fetch', espiao);

    renderizar(<DialogoAvaliacao aberto aoFechar={vi.fn()} atendimentoId="a1" />);

    await usuario.click(screen.getByRole('radio', { name: /^4 —/ }));
    await usuario.click(screen.getByRole('button', { name: /enviar avalia/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    // `forbidNonWhitelisted` está ligado, e comentário vazio falharia o @Length(1, 2000).
    const enviada = espiao.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(enviada[1].body))).toEqual({ nota: 4 });
  });

  /**
   * 409 aqui pode ser: atendimento nao realizado, cancelado, sem presenca
   * registrada, ou ja avaliado. Todos com mensagem de dominio pronta — a UI
   * exibe como veio, sem reescrever.
   */
  it('mostra o conflito do backend sem reescrever a mensagem', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(
          {
            statusCode: 409,
            erro: 'Conflict',
            mensagem: 'Somente quem teve presenca registrada neste atendimento pode avalia-lo.',
            caminho: '/api/atendimentos/a1/avaliacao',
            timestamp: 'x',
          },
          409,
        ),
      ),
    );

    renderizar(<DialogoAvaliacao aberto aoFechar={vi.fn()} atendimentoId="a1" />);

    await usuario.click(screen.getByRole('radio', { name: /^3 —/ }));
    await usuario.click(screen.getByRole('button', { name: /enviar avalia/i }));

    expect(await screen.findByText(/presenca registrada/i)).toBeInTheDocument();
  });

  it('avisa que a avaliacao e imutavel e anonima ANTES do envio', () => {
    renderizar(<DialogoAvaliacao aberto aoFechar={vi.fn()} atendimentoId="a1" />);

    const aviso = screen.getByText(/imutável/i);
    expect(aviso).toBeInTheDocument();
    expect(aviso.closest('[role="alert"]')).toHaveTextContent(/sem saber quem a deu/i);
  });
});

describe('acessibilidade da avaliacao por estrelas', () => {
  /**
   * Estrela sozinha nao comunica nada para leitor de tela. Cada uma e um radio
   * com rotulo textual, dentro de um radiogroup.
   */
  it('expoe as notas como radiogroup com rotulos descritivos', () => {
    renderizar(<DialogoAvaliacao aberto aoFechar={vi.fn()} atendimentoId="a1" />);

    expect(screen.getByRole('radiogroup', { name: /nota/i })).toBeInTheDocument();

    const opcoes = screen.getAllByRole('radio');
    expect(opcoes).toHaveLength(5);
    expect(opcoes[4]!).toHaveAccessibleName(/5 — Excelente/);
  });

  it('marca aria-checked apenas na nota selecionada', async () => {
    const usuario = userEvent.setup();
    renderizar(<DialogoAvaliacao aberto aoFechar={vi.fn()} atendimentoId="a1" />);

    await usuario.click(screen.getByRole('radio', { name: /^4 —/ }));

    expect(screen.getByRole('radio', { name: /^4 —/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /^5 —/ })).toHaveAttribute('aria-checked', 'false');
  });
});
