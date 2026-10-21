import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FiltroDeCurso } from '@/features/cursos/components/seletor-de-cursos';
import { PerfilUsuario } from '@/types/dominio';
import { abrirCombo, opcoesDoCombo, renderizar, usuarioTeste } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/disciplinas',
}));

afterEach(() => vi.unstubAllGlobals());

const PROFESSOR = usuarioTeste([PerfilUsuario.PROFESSOR], { id: 'prof-1' });

function curso(indice: number) {
  return {
    id: `c-${indice}`,
    codigo: `CUR${String(indice).padStart(3, '0')}`,
    nome: `Curso ${indice}`,
    ativo: true,
  };
}

function json(corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Responde paginado de verdade, lendo `pagina`, `limite` e `busca` da URL —
 * como o backend faz. Um stub que devolve sempre a mesma coisa nao provaria
 * nem a busca nem a paginacao.
 */
function stubCatalogo(totalDeCursos: number) {
  const todos = Array.from({ length: totalDeCursos }, (_, i) => curso(i + 1));
  const chamadas: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      chamadas.push(String(url));
      const parametros = new URL(String(url), 'http://teste').searchParams;

      const busca = parametros.get('busca')?.toLowerCase() ?? '';
      const pagina = Number(parametros.get('pagina') ?? 1);
      const limite = Number(parametros.get('limite') ?? 50);

      const filtrados = busca
        ? todos.filter((c) => c.nome.toLowerCase().includes(busca))
        : todos;

      const inicio = (pagina - 1) * limite;

      return Promise.resolve(
        json({
          dados: filtrados.slice(inicio, inicio + limite),
          meta: {
            total: filtrados.length,
            pagina,
            limite,
            totalPaginas: Math.max(1, Math.ceil(filtrados.length / limite)),
          },
        }),
      );
    }),
  );

  return chamadas;
}

/**
 * Combobox de catalogo.
 *
 * Catalogos crescem sem teto. Um `<select>` com todos os registros deixa de ser
 * utilizavel muito antes de deixar de caber na memoria — daqui vem a busca e o
 * carregamento por pagina.
 */
describe('combobox de catalogo', () => {
  it('abre com a primeira pagina e nao baixa o catalogo inteiro', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubCatalogo(180);

    renderizar(<FiltroDeCurso valor="" aoMudar={vi.fn()} />, { usuario: PROFESSOR });

    await abrirCombo(usuario, /^curso$/i);
    await screen.findByRole('option', { name: /CUR001/ });

    // 50 por página + a opção "Todos os cursos".
    expect(opcoesDoCombo()).toHaveLength(51);
    expect(chamadas.every((url) => url.includes('limite=50'))).toBe(true);
  });

  /**
   * A busca vai ao SERVIDOR porque `GET /cursos` aceita `busca`. Filtrar so a
   * pagina carregada faria o usuario concluir que um curso nao existe quando
   * ele apenas esta na pagina 3.
   */
  it('busca no servidor, com debounce', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubCatalogo(180);

    renderizar(<FiltroDeCurso valor="" aoMudar={vi.fn()} />, { usuario: PROFESSOR });

    await abrirCombo(usuario, /^curso$/i);
    await screen.findByRole('option', { name: /CUR001/ });

    await usuario.type(screen.getByRole('textbox', { name: /buscar em/i }), 'Curso 177');

    await waitFor(
      () => expect(chamadas.some((url) => url.includes('busca=Curso+177'))).toBe(true),
      { timeout: 3000 },
    );

    // Debounce: 9 teclas não podem virar 9 requisições.
    const buscas = chamadas.filter((url) => url.includes('busca='));
    expect(buscas.length).toBeLessThan(4);

    expect(await screen.findByRole('option', { name: /CUR177/ })).toBeInTheDocument();
  });

  it('carrega a proxima pagina sem perder a anterior', async () => {
    const usuario = userEvent.setup();
    stubCatalogo(120);

    renderizar(<FiltroDeCurso valor="" aoMudar={vi.fn()} />, { usuario: PROFESSOR });

    await abrirCombo(usuario, /^curso$/i);
    await screen.findByRole('option', { name: /CUR001/ });

    // O total informado pela API aparece no botão, para dar noção do tamanho.
    await usuario.click(await screen.findByRole('button', { name: /carregar mais \(120/i }));

    await waitFor(() => expect(screen.getByRole('option', { name: /CUR051/ })).toBeInTheDocument());
    // Acumula: a primeira página continua lá.
    expect(screen.getByRole('option', { name: /CUR001/ })).toBeInTheDocument();
  });

  it('nao oferece "carregar mais" quando tudo coube em uma pagina', async () => {
    const usuario = userEvent.setup();
    stubCatalogo(3);

    renderizar(<FiltroDeCurso valor="" aoMudar={vi.fn()} />, { usuario: PROFESSOR });

    await abrirCombo(usuario, /^curso$/i);
    await screen.findByRole('option', { name: /CUR001/ });

    expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument();
  });

  it('escolhe pelo teclado: setas e Enter', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    stubCatalogo(10);

    renderizar(<FiltroDeCurso valor="" aoMudar={aoMudar} />, { usuario: PROFESSOR });

    await abrirCombo(usuario, /^curso$/i);
    await screen.findByRole('option', { name: /CUR001/ });

    // Índice 0 é "Todos os cursos"; uma seta abaixo chega ao primeiro curso.
    await usuario.keyboard('{ArrowDown}{Enter}');

    expect(aoMudar).toHaveBeenCalledWith('c-1');
  });

  it('Escape fecha e devolve o foco ao gatilho', async () => {
    const usuario = userEvent.setup();
    stubCatalogo(10);

    renderizar(<FiltroDeCurso valor="" aoMudar={vi.fn()} />, { usuario: PROFESSOR });

    const gatilho = await abrirCombo(usuario, /^curso$/i);
    await screen.findByRole('option', { name: /CUR001/ });

    await usuario.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
  });

  /**
   * O selecionado pode estar em uma pagina que nunca foi carregada — e o caso
   * de um filtro restaurado da URL. O gatilho nao pode ficar vazio enquanto o
   * filtro esta ativo.
   */
  it('mostra o rotulo do selecionado mesmo fora da pagina carregada', async () => {
    const chamadas: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        chamadas.push(String(url));

        if (String(url).includes('/cursos/c-999')) {
          return Promise.resolve(json({ ...curso(999), nome: 'Curso Distante' }));
        }

        return Promise.resolve(
          json({
            dados: [curso(1)],
            meta: { total: 300, pagina: 1, limite: 50, totalPaginas: 6 },
          }),
        );
      }),
    );

    renderizar(<FiltroDeCurso valor="c-999" aoMudar={vi.fn()} />, { usuario: PROFESSOR });

    const gatilho = await screen.findByRole('combobox', { name: /^curso$/i });

    // Enquanto o rótulo não chega, o gatilho diz que está carregando — nunca
    // "Todos os cursos", que afirmaria não haver filtro ativo.
    expect(gatilho).toHaveTextContent(/carregando/i);

    await waitFor(() => expect(gatilho).toHaveTextContent('Curso Distante'));

    expect(chamadas.some((url) => url.includes('/cursos/c-999'))).toBe(true);
  });
});
