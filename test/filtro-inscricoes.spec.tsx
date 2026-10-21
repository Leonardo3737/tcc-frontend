import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ListaInscricoes } from '@/features/editais/components/lista-inscricoes';
import { PerfilUsuario, type Edital } from '@/types/dominio';
import { renderizar, usuarioTeste } from './utilitarios';

const definir = vi.fn();
/** Filtros lidos da URL. Cada teste ajusta o que precisa. */
let urlAtual: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/editais',
}));

vi.mock('@/hooks/use-filtros-url', () => ({
  useFiltrosUrl: () => ({
    obter: (chave: string, padrao = '') => urlAtual[chave] ?? padrao,
    obterNumero: (_chave: string, padrao = 1) => padrao,
    definir,
    pendente: false,
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  definir.mockClear();
  urlAtual = {};
});

const PROFESSOR = usuarioTeste([PerfilUsuario.PROFESSOR], { id: 'prof-1' });

const BANCO = { id: 'd-banco', codigo: 'BAN001', nome: 'Banco de Dados' };
const CALCULO = { id: 'd-calculo', codigo: 'CAL001', nome: 'Cálculo I' };

const RESUMO = [
  { disciplina: BANCO, totalInscricoes: 7, comMedia: 5, semMedia: 2, melhorMedia: 8.85 },
  { disciplina: CALCULO, totalInscricoes: 3, comMedia: 0, semMedia: 3, melhorMedia: null },
];

const EDITAL: Edital = {
  id: 'ed-1',
  inicioInscricoes: '2026-10-01',
  fimInscricoes: '2026-10-30',
  link: 'https://ufx.edu.br/e.pdf',
  ano: 2026,
  semestre: 2,
  ativo: true,
  aceitandoInscricoes: true,
  criadoEm: '2026-09-01T00:00:00.000Z',
};

function json(corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function pagina(dados: unknown[]) {
  return json({ dados, meta: { total: dados.length, pagina: 1, limite: 20, totalPaginas: 1 } });
}

/** Guarda as URLs chamadas, para afirmar o que foi parar na query string. */
function stubFetch(resumo: unknown[] = RESUMO, inscricoes: unknown[] = []) {
  const chamadas: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      chamadas.push(String(url));

      if (String(url).includes('/inscricoes/resumo')) return Promise.resolve(json(resumo));
      if (String(url).includes('/inscricoes')) return Promise.resolve(pagina(inscricoes));
      if (String(url).includes('/cursos')) return Promise.resolve(pagina([]));

      return Promise.resolve(pagina([]));
    }),
  );

  return chamadas;
}

/**
 * Faixa de disciplinas.
 *
 * A selecao de monitor acontece POR DISCIPLINA, entao ela e o eixo principal
 * da tela — nao mais um filtro entre outros. Os cartoes mostram o panorama e
 * servem de seletor ao mesmo tempo.
 */
describe('faixa de disciplinas', () => {
  it('mostra um cartao por disciplina, mais "Todas"', async () => {
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    expect(await screen.findByRole('radio', { name: /BAN001/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /CAL001/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Todas/ })).toBeInTheDocument();
    // "Todas" vem marcada quando não há recorte.
    expect(screen.getByRole('radio', { name: /Todas/ })).toBeChecked();
  });

  it('clicar num cartao filtra por aquela disciplina e reinicia a pagina', async () => {
    const usuario = userEvent.setup();
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    await usuario.click(await screen.findByRole('radio', { name: /BAN001/ }));

    expect(definir).toHaveBeenCalledWith({ disciplina: BANCO.id, pagina: undefined });
  });

  it('"Todas" limpa o recorte', async () => {
    const usuario = userEvent.setup();
    urlAtual = { disciplina: BANCO.id };
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    expect(await screen.findByRole('radio', { name: /BAN001/ })).toBeChecked();

    await usuario.click(screen.getByRole('radio', { name: /Todas/ }));
    expect(definir).toHaveBeenCalledWith({ disciplina: '', pagina: undefined });
  });

  it('a disciplina escolhida chega a consulta de candidaturas', async () => {
    urlAtual = { disciplina: BANCO.id };
    const chamadas = stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    await waitFor(() =>
      expect(
        chamadas.some(
          (url) =>
            url.includes('/inscricoes?') && url.includes(`disciplinaId=${BANCO.id}`),
        ),
      ).toBe(true),
    );
  });

  /**
   * O resumo recebe os mesmos recortes da lista. Sem isso o numero do cartao
   * nao bateria com o conteudo logo abaixo dele.
   */
  it('o resumo acompanha busca, curso e turno — mas nao a disciplina', async () => {
    urlAtual = { busca: 'ana', turno: 'MATUTINO', disciplina: BANCO.id };
    const chamadas = stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    await waitFor(() =>
      expect(chamadas.some((url) => url.includes('/inscricoes/resumo'))).toBe(true),
    );

    const url = chamadas.find((c) => c.includes('/inscricoes/resumo'))!;

    expect(url).toContain('busca=ana');
    expect(url).toContain('turno=MATUTINO');
    // A disciplina fica DE FORA: recortar o resumo por ela deixaria um cartão só.
    expect(url).not.toContain('disciplinaId');
  });

  it('distingue "sem media calculada" de media zero', async () => {
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    const calculo = await screen.findByRole('radio', { name: /CAL001/ });

    // Ninguém tem média em Cálculo: não há "melhor 0,00".
    expect(calculo).toHaveTextContent(/nenhuma média calculada/i);
    expect(calculo).not.toHaveTextContent('0,00');

    // E quem tem nota ausente é contado à parte.
    expect(calculo).toHaveTextContent(/3 sem nota/i);
    expect(screen.getByRole('radio', { name: /BAN001/ })).toHaveTextContent(/melhor 8,85/i);
  });

  it('declara que so lista disciplinas que receberam candidatura', async () => {
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    expect(
      await screen.findByText(/apenas disciplinas que receberam candidatura/i),
    ).toBeInTheDocument();
  });

  it('sem resumo, a tela continua inteira: a faixa apenas some', async () => {
    stubFetch([]);

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    await waitFor(() => expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument());
    expect(screen.getByRole('searchbox', { name: /buscar candidatos/i })).toBeInTheDocument();
  });
});

/**
 * Primeiro colocado, POR DISCIPLINA.
 *
 * Um edital com varias disciplinas tem um aprovado em cada uma. A regra
 * anterior marcava a maior media do edital inteiro e deixava os demais sem
 * destaque nenhum.
 */
describe('primeiro colocado', () => {
  function inscricao(id: string, disciplina: typeof BANCO, media: number | null) {
    return {
      id,
      nomeCompleto: `Candidato ${id}`,
      matricula: `M${id}`,
      email: `${id}@ufx.edu.br`,
      turno: 'MATUTINO',
      n1: media,
      n2: media,
      media,
      edital: { id: EDITAL.id, ano: 2026, semestre: 2 },
      curso: { id: 'c-1', codigo: 'ENG001', nome: 'Engenharia' },
      disciplina,
      professor: { usuarioId: 'p-1', nome: 'Prof' },
      boletim: null,
      alunoCadastrado: null,
      criadoEm: '2026-10-10T12:00:00.000Z',
    };
  }

  const CANDIDATOS = [
    inscricao('a', BANCO, 8.85),
    inscricao('b', BANCO, 7.0),
    inscricao('c', CALCULO, 6.0),
    inscricao('d', CALCULO, null),
  ];

  it('marca o melhor de CADA disciplina, nao so o do edital', async () => {
    stubFetch(
      [
        { disciplina: BANCO, totalInscricoes: 2, comMedia: 2, semMedia: 0, melhorMedia: 8.85 },
        { disciplina: CALCULO, totalInscricoes: 2, comMedia: 1, semMedia: 1, melhorMedia: 6.0 },
      ],
      CANDIDATOS,
    );

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });

    await screen.findAllByText('Candidato a');

    // Só a tabela: no jsdom os cartões de mobile também renderizam, e cada
    // candidato apareceria duas vezes.
    const tabela = within(screen.getByRole('table'));
    const marcados = tabela.getAllByLabelText(/maior média da disciplina/i);

    // Um por disciplina: 8,85 em Banco e 6,00 em Cálculo — não apenas o 8,85.
    expect(marcados).toHaveLength(2);
  });

  it('empate na maior media marca todos os empatados', async () => {
    stubFetch(
      [{ disciplina: BANCO, totalInscricoes: 2, comMedia: 2, semMedia: 0, melhorMedia: 9 }],
      [inscricao('a', BANCO, 9), inscricao('b', BANCO, 9)],
    );

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });

    await screen.findAllByText('Candidato a');
    expect(
      within(screen.getByRole('table')).getAllByLabelText(/maior média da disciplina/i),
    ).toHaveLength(2);
  });

  it('candidato sem media nunca e primeiro colocado', async () => {
    stubFetch(
      [{ disciplina: CALCULO, totalInscricoes: 1, comMedia: 0, semMedia: 1, melhorMedia: null }],
      [inscricao('d', CALCULO, null)],
    );

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });

    await screen.findAllByText('Candidato d');
    expect(screen.queryByLabelText(/maior média da disciplina/i)).not.toBeInTheDocument();
  });

  it('com o edital aberto nao ha primeiro colocado', async () => {
    stubFetch(
      [{ disciplina: BANCO, totalInscricoes: 1, comMedia: 1, semMedia: 0, melhorMedia: 8.85 }],
      [inscricao('a', BANCO, 8.85)],
    );

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });

    await screen.findAllByText('Candidato a');
    expect(screen.queryByLabelText(/maior média da disciplina/i)).not.toBeInTheDocument();
  });
});
