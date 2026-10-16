import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DialogoCadastrarUsuario } from '@/features/usuarios/components/dialogo-cadastrar-usuario';
import {
  campoDoConflito,
  esquemaCadastroAluno,
} from '@/features/usuarios/schemas/cadastro-pelo-professor.schema';
import { podeCadastrarUsuarios, podeListarAlunos } from '@/lib/autorizacao/capacidades';
import { itensVisiveis } from '@/config/navegacao';
import { PREFIXOS_PUBLICOS, rotas } from '@/config/rotas';
import { PerfilUsuario } from '@/types/dominio';
import { renderizar, usuarioTeste } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/pessoas',
}));

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

const PROFESSOR = usuarioTeste([PerfilUsuario.PROFESSOR], { id: 'prof-1', nome: 'Joao Ribeiro' });

const CURSO = {
  id: '11111111-1111-4111-8111-111111111111',
  codigo: 'ENG001',
  nome: 'Engenharia de Software',
  ativo: true,
};

const PAGINA_DE_CURSOS = {
  dados: [CURSO],
  meta: { total: 1, pagina: 1, limite: 100, totalPaginas: 1 },
};

/**
 * O dialogo de aluno faz DUAS requisicoes: busca os cursos para montar o campo
 * de escolha e so entao cria a conta. O stub roteia por URL para que o teste
 * continue falando apenas do POST que lhe interessa.
 */
function stubFetch(respostaDoCadastro: Response | (() => Response)) {
  const espiao = vi.fn((url: string) => {
    if (String(url).includes('/cursos')) return Promise.resolve(json(PAGINA_DE_CURSOS));

    return Promise.resolve(
      typeof respostaDoCadastro === 'function' ? respostaDoCadastro() : respostaDoCadastro,
    );
  });

  vi.stubGlobal('fetch', espiao);
  return espiao;
}

/** O POST do cadastro, entre as chamadas do stub. */
function chamadaDeCadastro(espiao: ReturnType<typeof stubFetch>) {
  return espiao.mock.calls.find(([url]) => !String(url).includes('/cursos')) as unknown as [
    string,
    RequestInit,
  ];
}

/**
 * Cadastro de usuarios pelo professor.
 *
 * Regra do backend: nao existe auto-cadastro. POST /alunos e POST /professores
 * sao o unico caminho, ambos @Perfis(PROFESSOR). A tela de login nao oferece
 * mais "criar conta", e a rota publica /cadastro deixou de existir.
 */
describe('quem pode cadastrar', () => {
  it('so PROFESSOR cadastra e lista alunos', () => {
    expect(podeCadastrarUsuarios(PROFESSOR)).toBe(true);
    expect(podeListarAlunos(PROFESSOR)).toBe(true);

    const aluno = usuarioTeste([PerfilUsuario.ALUNO]);
    expect(podeCadastrarUsuarios(aluno)).toBe(false);
    expect(podeListarAlunos(aluno)).toBe(false);
    expect(podeCadastrarUsuarios(null)).toBe(false);
  });

  it('quem acumula ALUNO e PROFESSOR tambem cadastra', () => {
    expect(
      podeCadastrarUsuarios(usuarioTeste([PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR])),
    ).toBe(true);
  });

  it('"Pessoas" aparece no menu so para professor', () => {
    const rotulos = (perfis: PerfilUsuario[]) => itensVisiveis(perfis).map((item) => item.rotulo);
    expect(rotulos([PerfilUsuario.PROFESSOR])).toContain('Pessoas');
    expect(rotulos([PerfilUsuario.ALUNO])).not.toContain('Pessoas');
  });

  it('nao ha rota de cadastro aberta: so login e recuperacao de senha sao publicos', () => {
    expect([...PREFIXOS_PUBLICOS].sort()).toEqual([rotas.login, rotas.recuperarSenha].sort());
  });
});

describe('schema', () => {
  it('espelha o DTO: matricula com o mesmo regex e senha de 8 a 128', () => {
    const base = {
      nome: 'Bruno Costa',
      email: 'bruno@ufx.edu.br',
      matricula: '2022.004-567',
      cursoId: CURSO.id,
    };
    expect(esquemaCadastroAluno.safeParse(base).success).toBe(true);
    expect(esquemaCadastroAluno.safeParse({ ...base, matricula: 'ab' }).success).toBe(false);
    expect(esquemaCadastroAluno.safeParse({ ...base, matricula: 'com espaço' }).success).toBe(
      false,
    );
  });

  /**
   * `curso` era texto livre e virou relacao. O campo e obrigatorio: e ele que
   * decide de quais monitorias o aluno podera participar, e a coluna do backend
   * nao aceita nulo.
   */
  it('exige cursoId, e um UUID — nao mais o nome do curso digitado', () => {
    const base = { nome: 'Bruno Costa', email: 'bruno@ufx.edu.br', matricula: '2022004567' };

    expect(esquemaCadastroAluno.safeParse(base).success).toBe(false);
    expect(
      esquemaCadastroAluno.safeParse({ ...base, cursoId: 'Engenharia de Software' }).success,
    ).toBe(false);
    expect(esquemaCadastroAluno.safeParse({ ...base, cursoId: CURSO.id }).success).toBe(true);
    expect(Object.keys(esquemaCadastroAluno.shape)).not.toContain('curso');
  });

  it('nao tem campo de senha: o servidor gera e envia por e-mail', () => {
    expect(Object.keys(esquemaCadastroAluno.shape)).not.toContain('senhaProvisoria');
  });

  it('identifica o campo do 409 pela mensagem do backend', () => {
    expect(campoDoConflito('Ja existe um usuario cadastrado com este e-mail.')).toBe('email');
    expect(campoDoConflito('Ja existe um aluno cadastrado com esta matricula.')).toBe('matricula');
    expect(
      campoDoConflito('Ja existe um professor cadastrado com esta identificacao funcional.'),
    ).toBe('identificacaoFuncional');
    expect(campoDoConflito('Outro conflito qualquer.')).toBeNull();
  });
});

describe('dialogo de cadastro de aluno', () => {
  async function preencher(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.type(screen.getByLabelText(/nome completo/i), 'Bruno Costa');
    await usuario.type(screen.getByLabelText(/e-mail/i), 'Bruno.Costa@ufx.edu.br');
    await usuario.type(screen.getByLabelText(/matr[ií]cula/i), '2022004567');

    // A lista chega por requisicao; o campo so existe depois dela.
    await usuario.selectOptions(await screen.findByLabelText(/^curso/i), CURSO.id);
  }

  it('envia so os campos do DTO e mostra os dados de acesso com a orientacao', async () => {
    const usuario = userEvent.setup();
    const espiao = stubFetch(() =>
      json(
        {
          id: 'u-novo',
          nome: 'Bruno Costa',
          email: 'bruno.costa@ufx.edu.br',
          ativo: true,
          perfis: ['ALUNO'],
          criadoEm: '2026-10-13T12:00:00.000Z',
          criadoPorUsuarioId: 'prof-1',
        },
        201,
      ),
    );
    const aoCadastrar = vi.fn();

    renderizar(
      <DialogoCadastrarUsuario tipo="aluno" aberto aoFechar={vi.fn()} aoCadastrar={aoCadastrar} />,
      { usuario: PROFESSOR },
    );

    await preencher(usuario);
    await usuario.click(screen.getByRole('button', { name: /^cadastrar aluno$/i }));

    await waitFor(() => expect(chamadaDeCadastro(espiao)).toBeDefined());
    const [url, init] = chamadaDeCadastro(espiao);
    expect(url).toBe('/api/backend/alunos');
    expect(init.method).toBe('POST');

    // `cursoId`, nao `curso`: o antigo texto livre hoje daria 400
    // (forbidNonWhitelisted). O e-mail vai normalizado.
    expect(JSON.parse(String(init.body))).toEqual({
      nome: 'Bruno Costa',
      email: 'bruno.costa@ufx.edu.br',
      matricula: '2022004567',
      cursoId: CURSO.id,
    });

    expect(await screen.findByText('Conta criada')).toBeInTheDocument();
    expect(screen.getByText('bruno.costa@ufx.edu.br')).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
    expect(aoCadastrar).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-novo' }));
  });

  it('503 (e-mail nao entregue) aparece no campo de e-mail, sem confirmar a conta', async () => {
    const usuario = userEvent.setup();
    const mensagem =
      'Nao foi possivel enviar a senha para o e-mail informado. A conta NAO foi criada; confira o endereco e tente novamente.';
    stubFetch(() =>
      json(
        {
          statusCode: 503,
          erro: 'Service Unavailable',
          mensagem,
          caminho: '/api/alunos',
          timestamp: '2026-10-13T12:00:00.000Z',
        },
        503,
      ),
    );

    renderizar(<DialogoCadastrarUsuario tipo="aluno" aberto aoFechar={vi.fn()} />, {
      usuario: PROFESSOR,
    });

    await preencher(usuario);
    await usuario.click(screen.getByRole('button', { name: /^cadastrar aluno$/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByText(mensagem)).toBeInTheDocument();
    expect(screen.queryByText('Conta criada')).not.toBeInTheDocument();
  });

  it('409 de matricula repetida aparece no campo de matricula', async () => {
    const usuario = userEvent.setup();
    stubFetch(() =>
      json(
        {
          statusCode: 409,
          erro: 'Conflict',
          mensagem: 'Ja existe um aluno cadastrado com esta matricula.',
          caminho: '/api/alunos',
          timestamp: '2026-10-13T12:00:00.000Z',
        },
        409,
      ),
    );

    renderizar(<DialogoCadastrarUsuario tipo="aluno" aberto aoFechar={vi.fn()} />, {
      usuario: PROFESSOR,
    });

    await preencher(usuario);
    await usuario.click(screen.getByRole('button', { name: /^cadastrar aluno$/i }));

    const campo = screen.getByLabelText(/matr[ií]cula/i);
    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('Ja existe um aluno cadastrado com esta matricula.'),
    ).toBeInTheDocument();
    // Continua no formulario: nada de confirmacao com dados de uma conta que nao existe.
    expect(screen.queryByText('Conta criada')).not.toBeInTheDocument();
  });
});
