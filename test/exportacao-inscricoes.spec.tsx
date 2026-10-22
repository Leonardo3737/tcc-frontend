import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ListaInscricoes } from '@/features/editais/components/lista-inscricoes';
import { PerfilUsuario, type Edital } from '@/types/dominio';
import { renderizar, usuarioTeste } from './utilitarios';

/**
 * Exportacao das inscricoes em planilha.
 *
 * O que esta suite protege nao e o botao: e a correspondencia entre a planilha
 * e a TELA. A banca confere a lista filtrada e depois exporta; se o arquivo
 * trouxer um recorte diferente, a divergencia so aparece na reuniao.
 */

const { sucesso } = vi.hoisted(() => ({ sucesso: vi.fn() }));

/** Filtros ativos simulados — cada teste escreve neste objeto. */
const { filtros } = vi.hoisted(() => ({ filtros: {} as Record<string, string> }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/editais',
}));

vi.mock('@/hooks/use-filtros-url', () => ({
  useFiltrosUrl: () => ({
    obter: (chave: string, padrao = '') => filtros[chave] ?? padrao,
    obterNumero: (_chave: string, padrao = 1) => padrao,
    definir: vi.fn(),
    pendente: false,
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  toast: { sucesso, erro: vi.fn(), info: vi.fn() },
}));

const PROFESSOR = usuarioTeste([PerfilUsuario.PROFESSOR], { id: 'prof-1' });
const BANCO = { id: 'd-banco', codigo: 'BAN001', nome: 'Banco de Dados' };

const EDITAL: Edital = {
  id: 'ed-1',
  inicioInscricoes: '2026-10-01',
  fimInscricoes: '2026-10-30',
  link: 'https://ufx.edu.br/e.pdf',
  ano: 2026,
  semestre: 2,
  ativo: true,
  aceitandoInscricoes: false,
  criadoEm: '2026-09-01T00:00:00.000Z',
};

const CANDIDATO = {
  id: 'insc-1',
  nomeCompleto: 'Maria Oliveira',
  matricula: '2021001234',
  email: 'maria@ufx.edu.br',
  turno: 'MATUTINO',
  n1: 9,
  n2: 8.7,
  media: 8.85,
  edital: { id: EDITAL.id, ano: 2026, semestre: 2 },
  curso: { id: 'c-1', codigo: 'ENG001', nome: 'Engenharia' },
  disciplina: BANCO,
  professor: { usuarioId: 'p-2', nome: 'Prof. Carlos' },
  boletim: null,
  alunoCadastrado: null,
  criadoEm: '2026-10-10T12:00:00.000Z',
};

const RESUMO = [
  {
    disciplina: BANCO,
    totalInscricoes: 1,
    comMedia: 1,
    semMedia: 0,
    melhorMedia: 8.85,
    monitoriaCadastrada: false,
    monitoriaId: null,
    monitoresHabilitados: 0,
  },
];

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pagina(dados: unknown[]) {
  return json({ dados, meta: { total: dados.length, pagina: 1, limite: 20, totalPaginas: 1 } });
}

/** Resposta binaria, como a rota responde no caminho feliz. */
function planilha(total: string | null) {
  const cabecalhos = new Headers({
    'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'content-disposition': 'attachment; filename="inscricoes-2026-2.xlsx"',
  });
  if (total !== null) cabecalhos.set('x-total-inscricoes', total);

  return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
    status: 200,
    headers: cabecalhos,
  });
}

function stubFetch({
  inscricoes = [CANDIDATO],
  exportacao = () => planilha('1'),
}: { inscricoes?: unknown[]; exportacao?: () => Response } = {}) {
  const urls: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(String(url));

      // Antes de `/inscricoes`: a rota de exportacao tambem contem esse trecho.
      if (String(url).includes('/inscricoes/exportar')) return Promise.resolve(exportacao());
      if (String(url).includes('/inscricoes/resumo')) return Promise.resolve(json(RESUMO));
      if (String(url).includes('/inscricoes')) return Promise.resolve(pagina(inscricoes));

      return Promise.resolve(pagina([]));
    }),
  );

  return urls;
}

/**
 * O jsdom nao implementa `createObjectURL` nem a navegacao do `<a download>`.
 * Os dois sao substituidos para que o teste observe a INTENCAO (o blob virou
 * um download) sem depender do que o navegador faria em seguida.
 */
let revogados: string[] = [];
let cliques = 0;

beforeEach(() => {
  revogados = [];
  cliques = 0;

  URL.createObjectURL = (() => 'blob:planilha') as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((endereco: string) => {
    revogados.push(endereco);
  }) as typeof URL.revokeObjectURL;

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    cliques += 1;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sucesso.mockClear();
  for (const chave of Object.keys(filtros)) delete filtros[chave];
});

function render() {
  return renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, {
    usuario: PROFESSOR,
  });
}

function botaoExportar() {
  return screen.getByRole('button', { name: /exportar/i });
}

async function exportar(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(await screen.findByRole('button', { name: /exportar/i }));
}

/** A ultima chamada a rota de exportacao, ja decomposta em query. */
async function urlDaExportacao(urls: string[]) {
  return waitFor(() => {
    const encontrada = urls.find((url) => url.includes('/inscricoes/exportar'));
    expect(encontrada).toBeDefined();
    return new URL(encontrada!, 'http://localhost');
  });
}

describe('botao de exportar inscricoes', () => {
  it('leva os filtros ativos da tela, nao o edital inteiro', async () => {
    filtros.disciplina = BANCO.id;
    filtros.turno = 'MATUTINO';
    filtros.busca = 'maria';

    const usuario = userEvent.setup();
    const urls = stubFetch();
    render();

    await exportar(usuario);
    const chamada = await urlDaExportacao(urls);

    expect(chamada.searchParams.get('editalId')).toBe(EDITAL.id);
    expect(chamada.searchParams.get('disciplinaId')).toBe(BANCO.id);
    expect(chamada.searchParams.get('turno')).toBe('MATUTINO');
    expect(chamada.searchParams.get('busca')).toBe('maria');
    // A ordenacao acompanha: a planilha sai na mesma ordem que foi conferida.
    expect(chamada.searchParams.get('ordenarPor')).toBe('media');
    expect(chamada.searchParams.get('direcao')).toBe('desc');
  });

  /** Sem paginacao: a rota devolve o recorte inteiro, nao a pagina visivel. */
  it('nao envia pagina nem limite', async () => {
    const usuario = userEvent.setup();
    const urls = stubFetch();
    render();

    await exportar(usuario);
    const chamada = await urlDaExportacao(urls);

    expect(chamada.searchParams.has('pagina')).toBe(false);
    expect(chamada.searchParams.has('limite')).toBe(false);
  });

  it('entrega o arquivo e confirma quantas linhas sairam', async () => {
    const usuario = userEvent.setup();
    stubFetch({ exportacao: () => planilha('42') });
    render();

    await exportar(usuario);

    await waitFor(() => expect(cliques).toBe(1));
    expect(sucesso).toHaveBeenCalledWith('Planilha baixada', '42 inscrições exportadas.');
    // O blob e liberado — uma planilha grande retida vaza a memoria da aba.
    expect(revogados).toEqual(['blob:planilha']);
  });

  it('nao escreve "1 inscrições"', async () => {
    const usuario = userEvent.setup();
    stubFetch({ exportacao: () => planilha('1') });
    render();

    await exportar(usuario);

    await waitFor(() =>
      expect(sucesso).toHaveBeenCalledWith('Planilha baixada', '1 inscrição exportada.'),
    );
  });

  /**
   * Sem o cabecalho — um proxy que o descarte, por exemplo — a tela confirma o
   * download sem INVENTAR uma contagem. Numero errado aqui e pior que nenhum.
   */
  it('confirma o download mesmo sem a contagem no cabecalho', async () => {
    const usuario = userEvent.setup();
    stubFetch({ exportacao: () => planilha(null) });
    render();

    await exportar(usuario);

    await waitFor(() =>
      expect(sucesso).toHaveBeenCalledWith('Planilha baixada', 'A exportação foi concluída.'),
    );
  });

  /**
   * 409 e o caso real desta rota: acima do teto de linhas o backend RECUSA em
   * vez de truncar. A mensagem dele diz o que fazer, entao fica na tela.
   */
  it('mostra o teto de linhas na tela, e nao baixa nada', async () => {
    const usuario = userEvent.setup();
    stubFetch({
      exportacao: () =>
        json(
          {
            statusCode: 409,
            erro: 'Conflict',
            mensagem: 'A exportação está limitada a 5000 linhas. Refine os filtros.',
            caminho: '/inscricoes/exportar',
            timestamp: '2026-10-22T00:00:00.000Z',
          },
          409,
        ),
    });
    render();

    await exportar(usuario);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/limitada a 5000 linhas/i);
    expect(cliques).toBe(0);
    expect(sucesso).not.toHaveBeenCalled();
  });

  /** Planilha de zero linhas nao serve a ninguem — o botao nem se oferece. */
  it('fica desabilitado quando o recorte nao tem candidatos', async () => {
    const usuario = userEvent.setup();
    stubFetch({ inscricoes: [] });
    render();

    await waitFor(() => expect(botaoExportar()).toBeDisabled());
    await usuario.click(botaoExportar());
    expect(cliques).toBe(0);
  });
});
