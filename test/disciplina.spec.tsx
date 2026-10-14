import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DialogoDisciplina } from '@/features/disciplinas/components/dialogo-disciplina';
import { PerfilUsuario } from '@/types/dominio';
import { renderizar, usuarioTeste } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/disciplinas',
}));

afterEach(() => vi.unstubAllGlobals());

/**
 * Criacao de disciplina: o `codigo` e gerado pelo servidor a partir do nome
 * (CAL001). O formulario pede so o nome, e mandar `codigo` hoje daria 400
 * (`forbidNonWhitelisted`).
 */
describe('criacao de disciplina', () => {
  it('nao pede codigo e envia apenas o nome', async () => {
    const usuario = userEvent.setup();
    const espiao = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'd-nova', codigo: 'CAL001', nome: 'Cálculo I', ativa: true }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', espiao);
    const aoFechar = vi.fn();

    renderizar(<DialogoDisciplina aberto aoFechar={aoFechar} />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
    });

    expect(screen.queryByLabelText(/c[oó]digo/i)).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/^nome/i), '  Cálculo I ');
    await usuario.click(screen.getByRole('button', { name: /^cadastrar$/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    const [url, init] = espiao.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/backend/disciplinas');
    expect(JSON.parse(String(init.body))).toEqual({ nome: 'Cálculo I' });
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
  });
});
