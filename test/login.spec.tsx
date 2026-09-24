import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FormularioLogin } from '@/features/auth/components/formulario-login';
import { renderizar } from './utilitarios';

const navegacao = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  parametros: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: navegacao.replace,
    refresh: navegacao.refresh,
    push: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => navegacao.parametros,
  usePathname: () => '/login',
}));

/**
 * Login — o fluxo mais critico da aplicacao.
 *
 * O ponto de atencao aqui NAO e "o formulario envia": e que o token nunca
 * apareça no cliente e que a mensagem de credencial invalida nao denuncie se o
 * e-mail existe. A rota BFF e mockada porque o alvo do teste e o comportamento
 * do componente, nao o transporte.
 */
function mockarBff(resposta: Response) {
  const espiao = vi.fn().mockResolvedValue(resposta);
  vi.stubGlobal('fetch', espiao);
  return espiao;
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  navegacao.parametros = new URLSearchParams();
});

afterEach(() => vi.unstubAllGlobals());

describe('formulario de login', () => {
  it('valida no cliente antes de chamar a API', async () => {
    const usuario = userEvent.setup();
    const espiao = mockarBff(json({}));

    renderizar(<FormularioLogin />);

    await usuario.type(screen.getByLabelText(/e-mail/i), 'nao-e-email');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/e-mail válido/i)).toBeInTheDocument();
    // Nada foi enviado: o rate limit do backend é de 5 tentativas por minuto,
    // e gastá-lo com entrada obviamente inválida é desperdício.
    expect(espiao).not.toHaveBeenCalled();
  });

  it('envia credenciais para a rota BFF, nunca direto para o backend', async () => {
    const usuario = userEvent.setup();
    const espiao = mockarBff(json({ usuario: { id: 'u1' }, expiraEmIso: 'x' }));

    renderizar(<FormularioLogin />);

    await usuario.type(screen.getByLabelText(/e-mail/i), 'ana@ufx.edu.br');
    await usuario.type(screen.getByLabelText(/senha/i), 'senhaSegura123');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    const chamada = espiao.mock.calls[0] as [string, RequestInit];
    expect(chamada[0]).toBe('/api/bff/login');
  });

  it('redireciona para o destino apenas quando ele e interno (sem open redirect)', async () => {
    const usuario = userEvent.setup();
    navegacao.parametros = new URLSearchParams({ destino: 'https://site-malicioso.test/phishing' });
    mockarBff(json({ usuario: { id: 'u1' }, expiraEmIso: 'x' }));

    renderizar(<FormularioLogin />);

    await usuario.type(screen.getByLabelText(/e-mail/i), 'ana@ufx.edu.br');
    await usuario.type(screen.getByLabelText(/senha/i), 'senhaSegura123');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(navegacao.replace).toHaveBeenCalled());
    // Cai no padrão seguro em vez de seguir o destino externo.
    expect(navegacao.replace).toHaveBeenCalledWith('/inicio');
  });

  it('preserva destino interno', async () => {
    const usuario = userEvent.setup();
    navegacao.parametros = new URLSearchParams({ destino: '/monitorias/abc/participantes' });
    mockarBff(json({ usuario: { id: 'u1' }, expiraEmIso: 'x' }));

    renderizar(<FormularioLogin />);

    await usuario.type(screen.getByLabelText(/e-mail/i), 'ana@ufx.edu.br');
    await usuario.type(screen.getByLabelText(/senha/i), 'senhaSegura123');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() =>
      expect(navegacao.replace).toHaveBeenCalledWith('/monitorias/abc/participantes'),
    );
  });

  /**
   * O backend responde "Credenciais invalidas" sem dizer se o erro foi no
   * e-mail ou na senha — e proposital, para nao permitir enumeracao de contas.
   * A UI nao pode desfazer essa protecao marcando um campo especifico.
   */
  it('exibe 401 como erro geral, sem apontar qual campo estava errado', async () => {
    const usuario = userEvent.setup();
    mockarBff(
      json(
        {
          statusCode: 401,
          erro: 'Unauthorized',
          mensagem: 'Credenciais invalidas.',
          caminho: '/api/bff/login',
          timestamp: 'x',
        },
        401,
      ),
    );

    renderizar(<FormularioLogin />);

    await usuario.type(screen.getByLabelText(/e-mail/i), 'ana@ufx.edu.br');
    await usuario.type(screen.getByLabelText(/senha/i), 'senha-errada');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/credenciais inv/i);

    const email = screen.getByLabelText(/e-mail/i);
    const senha = screen.getByLabelText(/senha/i);
    expect(email).not.toHaveAttribute('aria-invalid', 'true');
    expect(senha).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('traduz 429 em orientacao, sem o texto tecnico do throttler', async () => {
    const usuario = userEvent.setup();
    mockarBff(
      json(
        {
          statusCode: 429,
          erro: 'ThrottlerException',
          mensagem: 'ThrottlerException: Too Many Requests',
          caminho: '/api/bff/login',
          timestamp: 'x',
        },
        429,
      ),
    );

    renderizar(<FormularioLogin />);

    await usuario.type(screen.getByLabelText(/e-mail/i), 'ana@ufx.edu.br');
    await usuario.type(screen.getByLabelText(/senha/i), 'x');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/muitas tentativas/i);
    expect(alerta).not.toHaveTextContent(/ThrottlerException/);
  });

  it('avisa quando a sessao expirou', () => {
    navegacao.parametros = new URLSearchParams({ expirou: '1' });

    renderizar(<FormularioLogin />);

    expect(screen.getByRole('alert')).toHaveTextContent(/sessão expirou/i);
  });

  it('desabilita o botao durante o envio, impedindo duplo clique', async () => {
    const usuario = userEvent.setup();
    // Promessa pendente: mantém o estado de envio.
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    renderizar(<FormularioLogin />);

    await usuario.type(screen.getByLabelText(/e-mail/i), 'ana@ufx.edu.br');
    await usuario.type(screen.getByLabelText(/senha/i), 'senhaSegura123');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled());
  });
});

describe('acessibilidade do login', () => {
  it('associa rotulo a cada campo e marca os obrigatorios', () => {
    renderizar(<FormularioLogin />);

    expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/senha/i)).toHaveAttribute('type', 'password');
  });

  it('marca aria-invalid e liga a mensagem ao campo com erro', async () => {
    const usuario = userEvent.setup();
    renderizar(<FormularioLogin />);

    const email = screen.getByLabelText(/e-mail/i);
    await usuario.type(email, 'invalido');
    await usuario.tab();

    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));

    const idDescricao = email.getAttribute('aria-describedby');
    expect(idDescricao).toBeTruthy();
    expect(document.getElementById(idDescricao!)).toHaveTextContent(/e-mail válido/i);
  });
});

/**
 * Affordances do campo de senha.
 *
 * Nenhuma delas muda o que e enviado: `name`, valor e validacao seguem iguais.
 * Sao ajudas visuais — e por isso os testes olham para tipo do input, rotulo do
 * botao e ordem de foco, nunca para o corpo da requisicao.
 */
describe('campo de senha', () => {
  it('alterna a exibicao sem alterar o campo enviado', async () => {
    const usuario = userEvent.setup();
    renderizar(<FormularioLogin />);

    const senha = screen.getByLabelText(/^senha/i);
    await usuario.type(senha, 'minhaSenha123');

    expect(senha).toHaveAttribute('type', 'password');
    expect(senha).toHaveAttribute('name', 'senha');

    await usuario.click(screen.getByRole('button', { name: /mostrar caracteres/i }));
    expect(senha).toHaveAttribute('type', 'text');
    expect(senha).toHaveValue('minhaSenha123');

    await usuario.click(screen.getByRole('button', { name: /ocultar caracteres/i }));
    expect(senha).toHaveAttribute('type', 'password');
    // O `name` é o que o formulário envia — ele não pode mudar nunca.
    expect(senha).toHaveAttribute('name', 'senha');
  });

  it('o botao de exibicao fica fora da ordem de tabulacao', async () => {
    const usuario = userEvent.setup();
    renderizar(<FormularioLogin />);

    screen.getByLabelText(/^senha/i).focus();
    await usuario.tab();

    // Tab a partir da senha deve chegar ao Entrar, não ao olho.
    expect(screen.getByRole('button', { name: /entrar/i })).toHaveFocus();
  });

  it('avisa sobre Caps Lock e liga o aviso ao campo', async () => {
    const usuario = userEvent.setup();
    renderizar(<FormularioLogin />);

    const senha = screen.getByLabelText(/^senha/i);
    senha.focus();
    await usuario.keyboard('{CapsLock}a');

    const aviso = await screen.findByText(/caps lock/i);
    expect(aviso).toHaveAttribute('aria-live', 'polite');
    expect(senha.getAttribute('aria-describedby')).toContain(aviso.id);

    await usuario.keyboard('{CapsLock}');
  });
});
