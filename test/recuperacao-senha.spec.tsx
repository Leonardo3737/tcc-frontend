import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';

import { FluxoRecuperacaoSenha } from '@/features/auth/components/fluxo-recuperacao-senha';
import { PREFIXOS_PUBLICOS, PREFIXOS_SO_SEM_SESSAO, rotas } from '@/config/rotas';
import { criarQueryClientDeTeste } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/recuperar-senha',
}));

function resposta(status: number, corpo?: unknown) {
  return corpo === undefined
    ? new Response(null, { status })
    : new Response(JSON.stringify(corpo), {
        status,
        headers: { 'content-type': 'application/json' },
      });
}

/** A tela e publica: renderiza sem SessaoProvider, como no navegador sem login. */
function renderizarFluxo() {
  return render(
    <QueryClientProvider client={criarQueryClientDeTeste()}>
      <FluxoRecuperacaoSenha />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

/**
 * Recuperacao de senha por codigo no e-mail.
 *
 * Duas propriedades do backend que a tela precisa preservar:
 *  - `solicitar` responde 202 exista ou nao a conta: a tela fala no
 *    condicional e nunca diz "e-mail nao encontrado";
 *  - nao ha rota que so valida o codigo: codigo e nova senha vao juntos.
 */
describe('fluxo de recuperacao de senha', () => {
  async function pedirCodigo(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.type(screen.getByLabelText(/e-mail/i), ' Ana.Martins@ufx.edu.br ');
    await usuario.click(screen.getByRole('button', { name: /enviar c[oó]digo/i }));
  }

  it('pede o codigo e fala no condicional, sem confirmar que a conta existe', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn().mockResolvedValue(resposta(202));
    vi.stubGlobal('fetch', espiao);

    renderizarFluxo();
    await pedirCodigo(usuario);

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    const [url, init] = espiao.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/backend/auth/recuperacao/solicitar');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'ana.martins@ufx.edu.br' });

    expect(await screen.findByText(/se houver uma conta com/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/c[oó]digo recebido/i)).toBeInTheDocument();
  });

  it('envia codigo e nova senha juntos, sem a confirmacao, e conclui', async () => {
    const usuario = userEvent.setup();
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(resposta(202))
      .mockResolvedValueOnce(resposta(204));
    vi.stubGlobal('fetch', espiao);

    renderizarFluxo();
    await pedirCodigo(usuario);

    // Colado do e-mail com espaco no meio: o que vai ao backend sao 6 digitos.
    await usuario.type(await screen.findByLabelText(/c[oó]digo recebido/i), '483 920');
    await usuario.type(screen.getByLabelText(/^nova senha/i), 'senhaNova456');
    await usuario.type(screen.getByLabelText(/confirmar nova senha/i), 'senhaNova456');
    await usuario.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalledTimes(2));
    const [url, init] = espiao.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/backend/auth/recuperacao/confirmar');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'ana.martins@ufx.edu.br',
      codigo: '483920',
      novaSenha: 'senhaNova456',
    });

    expect(await screen.findByText('Senha redefinida')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir para o login/i })).toHaveAttribute(
      'href',
      rotas.login,
    );
  });

  it('valida no cliente: 6 digitos e confirmacao igual', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn().mockResolvedValue(resposta(202));
    vi.stubGlobal('fetch', espiao);

    renderizarFluxo();
    await pedirCodigo(usuario);

    await usuario.type(await screen.findByLabelText(/c[oó]digo recebido/i), '1234');
    await usuario.type(screen.getByLabelText(/^nova senha/i), 'senhaNova456');
    await usuario.type(screen.getByLabelText(/confirmar nova senha/i), 'outraSenha1');
    await usuario.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(await screen.findByText('O código tem exatamente 6 dígitos')).toBeInTheDocument();
    expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument();
    // So a solicitacao saiu; a confirmacao invalida nem chegou ao backend.
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it('codigo recusado: mostra a mensagem do backend, o proximo passo e limpa o campo', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(resposta(202))
        .mockResolvedValueOnce(
          resposta(400, {
            statusCode: 400,
            erro: 'Bad Request',
            mensagem: 'Codigo invalido ou expirado. Solicite um novo codigo.',
            caminho: '/api/auth/recuperacao/confirmar',
            timestamp: '2026-10-13T12:00:00.000Z',
          }),
        ),
    );

    renderizarFluxo();
    await pedirCodigo(usuario);

    const campoCodigo = await screen.findByLabelText(/c[oó]digo recebido/i);
    await usuario.type(campoCodigo, '000000');
    await usuario.type(screen.getByLabelText(/^nova senha/i), 'senhaNova456');
    await usuario.type(screen.getByLabelText(/confirmar nova senha/i), 'senhaNova456');
    await usuario.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(
      await screen.findByText('Codigo invalido ou expirado. Solicite um novo codigo.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/tentativas erradas o c[oó]digo deixa de valer/i)).toBeInTheDocument();
    expect(campoCodigo).toHaveValue('');
    expect(screen.getByRole('button', { name: /enviar outro c[oó]digo/i })).toBeInTheDocument();
  });

  it('"Usar outro e-mail" volta para a primeira etapa', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(202)));

    renderizarFluxo();
    await pedirCodigo(usuario);
    await usuario.click(await screen.findByRole('button', { name: /usar outro e-mail/i }));

    expect(screen.getByRole('button', { name: /enviar c[oó]digo/i })).toBeInTheDocument();
  });
});

describe('acesso a tela', () => {
  it('e publica, e quem ja entrou tambem pode abri-la (Minha conta aponta para ela)', () => {
    expect(PREFIXOS_PUBLICOS).toContain(rotas.recuperarSenha);
    expect(PREFIXOS_SO_SEM_SESSAO).not.toContain(rotas.recuperarSenha);
    expect(PREFIXOS_SO_SEM_SESSAO).toContain(rotas.login);
  });
});
