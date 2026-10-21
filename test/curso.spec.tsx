import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DialogoCurso } from '@/features/cursos/components/dialogo-curso';
import { SeletorDeCurso } from '@/features/cursos/components/seletor-de-cursos';
import { itensVisiveis } from '@/config/navegacao';
import { rotas } from '@/config/rotas';
import { PerfilUsuario } from '@/types/dominio';
import { abrirCombo, opcoesDoCombo, renderizar, usuarioTeste } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cursos',
}));

afterEach(() => vi.unstubAllGlobals());

const PROFESSOR = usuarioTeste([PerfilUsuario.PROFESSOR], { id: 'prof-1' });

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Catalogo de cursos.
 *
 * Curso se relaciona N:N com disciplina e 1:N com aluno, e nao ha DELETE
 * (RN10): sair de circulacao e `ativo: false`, para nao invalidar quem ja o
 * referencia.
 */
describe('acesso ao catalogo de cursos', () => {
  it('"Cursos" aparece no menu so para professor', () => {
    const rotulos = (perfis: PerfilUsuario[]) => itensVisiveis(perfis).map((item) => item.rotulo);

    expect(rotulos([PerfilUsuario.PROFESSOR])).toContain('Cursos');
    expect(rotulos([PerfilUsuario.ALUNO])).not.toContain('Cursos');
    // Quem acumula os dois perfis vê a união das seções.
    expect(rotulos([PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR])).toContain('Cursos');
  });

  it('a rota de cursos nao e publica', () => {
    expect(rotas.cursos).toBe('/cursos');
  });
});

describe('criacao de curso', () => {
  it('nao pede codigo e envia apenas o nome', async () => {
    const usuario = userEvent.setup();
    const espiao = vi
      .fn()
      .mockResolvedValue(
        json(
          { id: 'c-novo', codigo: 'ENG001', nome: 'Engenharia de Software', ativo: true },
          201,
        ),
      );
    vi.stubGlobal('fetch', espiao);
    const aoFechar = vi.fn();

    renderizar(<DialogoCurso aberto aoFechar={aoFechar} />, { usuario: PROFESSOR });

    // O código é gerado pelo servidor; mandá-lo daria 400 (forbidNonWhitelisted).
    expect(screen.queryByLabelText(/c[oó]digo/i)).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/^nome/i), '  Engenharia de Software ');
    await usuario.click(screen.getByRole('button', { name: /^cadastrar$/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    const [url, init] = espiao.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('/api/backend/cursos');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ nome: 'Engenharia de Software' });
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
  });

  it('recusa nome curto demais antes de ir ao servidor', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn();
    vi.stubGlobal('fetch', espiao);

    renderizar(<DialogoCurso aberto aoFechar={vi.fn()} />, { usuario: PROFESSOR });

    await usuario.type(screen.getByLabelText(/^nome/i), 'A');
    await usuario.click(screen.getByRole('button', { name: /^cadastrar$/i }));

    expect(await screen.findByText(/ao menos 2 caracteres/i)).toBeInTheDocument();
    expect(espiao).not.toHaveBeenCalled();
  });
});

describe('edicao de curso', () => {
  const CURSO = {
    id: 'c-1',
    codigo: 'ENG001',
    nome: 'Engenharia de Software',
    ativo: true,
  };

  it('mostra o codigo como leitura e envia nome e ativo', async () => {
    const usuario = userEvent.setup();
    const espiao = vi.fn().mockResolvedValue(json({ ...CURSO, ativo: false }));
    vi.stubGlobal('fetch', espiao);

    renderizar(<DialogoCurso aberto aoFechar={vi.fn()} curso={CURSO} />, { usuario: PROFESSOR });

    // Identidade estável: alunos e disciplinas já referenciam o código.
    const campoCodigo = screen.getByLabelText(/c[oó]digo/i);
    expect(campoCodigo).toHaveValue('ENG001');
    expect(campoCodigo).toBeDisabled();

    await usuario.click(screen.getByRole('checkbox', { name: /curso ativo/i }));
    await usuario.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() => expect(espiao).toHaveBeenCalled());
    const [url, init] = espiao.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('/api/backend/cursos/c-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      nome: 'Engenharia de Software',
      ativo: false,
    });
  });

  it('nao oferece exclusao: desativar e o caminho (RN10)', () => {
    vi.stubGlobal('fetch', vi.fn());

    renderizar(<DialogoCurso aberto aoFechar={vi.fn()} curso={CURSO} />, { usuario: PROFESSOR });

    expect(screen.queryByRole('button', { name: /excluir|apagar|remover/i })).not.toBeInTheDocument();
  });
});

/**
 * O seletor so oferece cursos ATIVOS — mas precisa continuar mostrando o curso
 * ja vinculado mesmo depois de ele ser desativado. Sem isso, editar o perfil de
 * um aluno cujo curso saiu de circulacao mostraria o campo vazio, como se ele
 * nao tivesse curso.
 */
describe('seletor de curso', () => {
  it('mantem o curso atual na lista mesmo quando ele nao vem entre os ativos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          dados: [{ id: 'c-ativo', codigo: 'SIS001', nome: 'Sistemas de Informação', ativo: true }],
          meta: { total: 1, pagina: 1, limite: 100, totalPaginas: 1 },
        }),
      ),
    );

    renderizar(
      <SeletorDeCurso
        valor="c-extinto"
        aoMudar={vi.fn()}
        cursoAtual={{ id: 'c-extinto', codigo: 'ANT001', nome: 'Curso Descontinuado' }}
      />,
      { usuario: usuarioTeste([PerfilUsuario.ALUNO]) },
    );

    const usuario = userEvent.setup();
    const gatilho = await abrirCombo(usuario, /^curso$/i);

    // O gatilho mostra o curso atual mesmo sem ele estar entre os ativos.
    expect(gatilho).toHaveTextContent('Curso Descontinuado');

    await screen.findByRole('option', { name: /Sistemas de Informação/i });
    const rotulos = opcoesDoCombo().join(' ');

    expect(rotulos).toContain('Curso Descontinuado');
    expect(rotulos).toContain('Sistemas de Informação');
  });

  it('avisa quando nao ha curso cadastrado em vez de mostrar um campo vazio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({ dados: [], meta: { total: 0, pagina: 1, limite: 100, totalPaginas: 0 } }),
      ),
    );

    renderizar(<SeletorDeCurso valor="" aoMudar={vi.fn()} />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
    });

    expect(await screen.findByText(/nenhum curso cadastrado/i)).toBeInTheDocument();
  });
});
