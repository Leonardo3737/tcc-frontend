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

const CURSOS = [
  { id: '11111111-1111-4111-8111-111111111111', codigo: 'ENG001', nome: 'Engenharia de Software' },
  { id: '22222222-2222-4222-8222-222222222222', codigo: 'SIS001', nome: 'Sistemas de Informação' },
];

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Roteia por URL: o diálogo faz DUAS requisições — busca os cursos para montar
 * a lista e só então cria a disciplina.
 */
function stubFetch(aoCriar: () => Response) {
  const espiao = vi.fn((url: string) => {
    if (String(url).includes('/cursos')) {
      return Promise.resolve(
        json({
          dados: CURSOS.map((curso) => ({ ...curso, ativo: true })),
          meta: { total: CURSOS.length, pagina: 1, limite: 100, totalPaginas: 1 },
        }),
      );
    }

    return Promise.resolve(aoCriar());
  });

  vi.stubGlobal('fetch', espiao);
  return espiao;
}

/**
 * Criacao de disciplina.
 *
 * O `codigo` e gerado pelo servidor a partir do nome (CAL001), entao o
 * formulario nao o pede. Desde que curso virou entidade, `cursosIds` e
 * OBRIGATORIO: e essa lista que decide quem pode participar das monitorias da
 * disciplina, e o backend nao tem valor padrao de proposito.
 */
describe('criacao de disciplina', () => {
  it('nao pede codigo e envia nome mais os cursos escolhidos', async () => {
    const usuario = userEvent.setup();
    const espiao = stubFetch(() =>
      json(
        {
          id: 'd-nova',
          codigo: 'CAL001',
          nome: 'Cálculo I',
          ativa: true,
          cursos: [CURSOS[0]],
        },
        201,
      ),
    );
    const aoFechar = vi.fn();

    renderizar(<DialogoDisciplina aberto aoFechar={aoFechar} />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
    });

    expect(screen.queryByLabelText(/c[oó]digo/i)).not.toBeInTheDocument();

    // A lista de cursos chega por requisição; sem ela não há o que marcar.
    const curso = await screen.findByRole('checkbox', { name: /Engenharia de Software/i });
    await usuario.click(curso);

    await usuario.type(screen.getByLabelText(/^nome/i), '  Cálculo I ');
    await usuario.click(screen.getByRole('button', { name: /^cadastrar$/i }));

    await waitFor(() => expect(aoFechar).toHaveBeenCalled());

    const criacao = espiao.mock.calls.find(([url]) =>
      String(url).includes('/disciplinas'),
    ) as unknown as [string, RequestInit];

    expect(criacao[0]).toBe('/api/backend/disciplinas');
    expect(JSON.parse(String(criacao[1].body))).toEqual({
      nome: 'Cálculo I',
      cursosIds: [CURSOS[0]!.id],
    });
  });

  /**
   * Sem curso o backend devolveria 400. Barrar antes evita a ida ao servidor
   * para receber de volta algo que a tela já sabia.
   */
  it('nao envia enquanto nenhum curso estiver marcado', async () => {
    const usuario = userEvent.setup();
    const espiao = stubFetch(() => json({}, 201));

    renderizar(<DialogoDisciplina aberto aoFechar={vi.fn()} />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
    });

    await screen.findByRole('checkbox', { name: /Engenharia de Software/i });
    await usuario.type(screen.getByLabelText(/^nome/i), 'Cálculo I');
    await usuario.click(screen.getByRole('button', { name: /^cadastrar$/i }));

    expect(await screen.findByText(/escolha ao menos um curso/i)).toBeInTheDocument();

    const criou = espiao.mock.calls.some(([url]) => String(url).includes('/disciplinas'));
    expect(criou).toBe(false);
  });
});

/**
 * Edicao: `cursosIds` SUBSTITUI o conjunto, nao acrescenta.
 *
 * Por isso os cursos ja vinculados precisam vir marcados ao abrir — se
 * chegassem desmarcados, salvar so o nome desvincularia todos eles sem que
 * ninguem tivesse pedido.
 */
describe('edicao de disciplina', () => {
  it('abre com os cursos ja vinculados marcados', async () => {
    stubFetch(() => json({}, 200));

    renderizar(
      <DialogoDisciplina
        aberto
        aoFechar={vi.fn()}
        disciplina={{
          id: 'd-1',
          codigo: 'CAL001',
          nome: 'Cálculo I',
          ativa: true,
          cursos: [CURSOS[1]!],
        }}
      />,
      { usuario: usuarioTeste([PerfilUsuario.PROFESSOR]) },
    );

    const vinculado = await screen.findByRole('checkbox', { name: /Sistemas de Informação/i });
    const naoVinculado = screen.getByRole('checkbox', { name: /Engenharia de Software/i });

    expect(vinculado).toBeChecked();
    expect(naoVinculado).not.toBeChecked();
  });
});
