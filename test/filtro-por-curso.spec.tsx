import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DialogoAdicionarParticipante } from '@/features/monitorias/components/dialogo-adicionar-participante';
import { PainelDisciplinas } from '@/features/disciplinas/components/painel-disciplinas';
import { PerfilUsuario } from '@/types/dominio';
import { monitoriaTeste, renderizar, usuarioTeste } from './utilitarios';

const definir = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/disciplinas',
}));

vi.mock('@/hooks/use-filtros-url', () => ({
  useFiltrosUrl: () => ({
    obter: (_chave: string, padrao = '') => padrao,
    obterNumero: (_chave: string, padrao = 1) => padrao,
    definir,
    pendente: false,
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  definir.mockClear();
});

const PROFESSOR = usuarioTeste([PerfilUsuario.PROFESSOR], { id: 'prof-1' });

const ENG = { id: '11111111-1111-4111-8111-111111111111', codigo: 'ENG001', nome: 'Engenharia' };
const SIS = { id: '22222222-2222-4222-8222-222222222222', codigo: 'SIS001', nome: 'Sistemas' };

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pagina(dados: unknown[]) {
  return json({ dados, meta: { total: dados.length, pagina: 1, limite: 100, totalPaginas: 1 } });
}

/** Guarda as URLs chamadas, para afirmar o que foi parar na query string. */
function stubFetch(rotas: Record<string, () => Response>) {
  const chamadas: string[] = [];

  const espiao = vi.fn((url: string) => {
    chamadas.push(String(url));

    for (const [trecho, resposta] of Object.entries(rotas)) {
      if (String(url).includes(trecho)) return Promise.resolve(resposta());
    }

    return Promise.resolve(pagina([]));
  });

  vi.stubGlobal('fetch', espiao);
  return chamadas;
}

/**
 * Filtro por curso nas listagens.
 *
 * O backend ganhou `cursoId` em `GET /disciplinas` e `GET /alunos`. Na listagem
 * e conveniencia; no fluxo da RN01 e correcao, porque um aluno so participa de
 * monitoria de disciplina do proprio curso e o backend recusa o resto com 409.
 */
describe('catalogo de disciplinas', () => {
  it('oferece o filtro de curso e reinicia a pagina ao trocar', async () => {
    const usuario = userEvent.setup();
    stubFetch({
      '/cursos': () => pagina([{ ...ENG, ativo: true }, { ...SIS, ativo: true }]),
      '/disciplinas': () => pagina([]),
    });

    renderizar(<PainelDisciplinas />, { usuario: PROFESSOR });

    const filtro = await screen.findByLabelText(/^curso$/i);
    await usuario.selectOptions(filtro, ENG.id);

    // Página some junto: a página 3 do recorte anterior quase nunca existe no novo.
    expect(definir).toHaveBeenCalledWith({ curso: ENG.id, pagina: undefined });
  });

  it('o filtro inclui cursos inativos — eles ainda tem disciplinas', async () => {
    stubFetch({
      '/cursos': () => pagina([{ ...ENG, ativo: true }, { ...SIS, ativo: false }]),
      '/disciplinas': () => pagina([]),
    });

    renderizar(<PainelDisciplinas />, { usuario: PROFESSOR });

    const filtro = await screen.findByLabelText(/^curso$/i);
    const rotulos = [...filtro.querySelectorAll('option')].map((o) => o.textContent);

    expect(rotulos).toContain('Todos os cursos');
    expect(rotulos.join(' ')).toContain('Sistemas (inativo)');
  });
});

/**
 * Adicionar participante: o recorte por curso NAO e conveniencia.
 *
 * `exigirCursoCompativel` recusa com 409 um aluno cujo curso nao oferece a
 * disciplina. Sem restringir a busca, o professor acharia o nome, clicaria e so
 * entao descobriria que aquela pessoa nunca poderia ser adicionada.
 */
describe('adicionar participante', () => {
  const MONITORIA = monitoriaTeste({ disciplina: { id: 'd1', codigo: 'BD1', nome: 'Banco' } });

  it('restringe os candidatos ao curso da disciplina', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubFetch({
      '/disciplinas/d1': () =>
        json({ id: 'd1', codigo: 'BD1', nome: 'Banco', ativa: true, cursos: [ENG] }),
      '/alunos': () => pagina([]),
    });

    renderizar(
      <DialogoAdicionarParticipante aberto aoFechar={vi.fn()} monitoriaId={MONITORIA.id} />,
      { usuario: PROFESSOR, monitoria: MONITORIA },
    );

    // Com um curso só, não há escolha a fazer — a tela apenas informa o recorte.
    expect(await screen.findByText(/único curso que oferece esta disciplina/i)).toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/buscar aluno/i), 'ana');

    await waitFor(() => expect(chamadas.some((url) => url.includes('/alunos'))).toBe(true));
    const busca = chamadas.find((url) => url.includes('/alunos'))!;

    expect(busca).toContain(`cursoId=${ENG.id}`);
    expect(busca).toContain(`semVinculoAtivoNaMonitoria=${MONITORIA.id}`);
  });

  it('com varios cursos, deixa a escolha explicita em vez de misturar', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubFetch({
      '/disciplinas/d1': () =>
        json({ id: 'd1', codigo: 'BD1', nome: 'Banco', ativa: true, cursos: [ENG, SIS] }),
      '/alunos': () => pagina([]),
    });

    renderizar(
      <DialogoAdicionarParticipante aberto aoFechar={vi.fn()} monitoriaId={MONITORIA.id} />,
      { usuario: PROFESSOR, monitoria: MONITORIA },
    );

    // O primeiro curso entra por padrão: toda pessoa listada é elegível.
    const seletor = await screen.findByLabelText(/^curso$/i);
    expect(seletor).toHaveValue(ENG.id);

    await usuario.selectOptions(seletor, SIS.id);
    await usuario.type(screen.getByLabelText(/buscar aluno/i), 'ana');

    await waitFor(() =>
      expect(chamadas.some((url) => url.includes(`cursoId=${SIS.id}`))).toBe(true),
    );
  });

  it('nao busca candidatos antes de saber os cursos da disciplina', async () => {
    const usuario = userEvent.setup();
    let liberar: (() => void) | null = null;
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });

    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        chamadas.push(String(url));

        if (String(url).includes('/disciplinas/d1')) {
          await espera;
          return json({ id: 'd1', codigo: 'BD1', nome: 'Banco', ativa: true, cursos: [ENG] });
        }

        return pagina([]);
      }),
    );

    renderizar(
      <DialogoAdicionarParticipante aberto aoFechar={vi.fn()} monitoriaId={MONITORIA.id} />,
      { usuario: PROFESSOR, monitoria: MONITORIA },
    );

    await usuario.type(screen.getByLabelText(/buscar aluno/i), 'ana');

    // Enquanto a disciplina não respondeu, buscar alunos traria gente de
    // qualquer curso — justamente o que o recorte existe para evitar.
    expect(chamadas.some((url) => url.includes('/alunos'))).toBe(false);

    liberar!();
    await waitFor(() => expect(chamadas.some((url) => url.includes('/alunos'))).toBe(true));
  });
});
