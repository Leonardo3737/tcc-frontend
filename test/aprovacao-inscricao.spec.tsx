import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ListaInscricoes } from '@/features/editais/components/lista-inscricoes';
import { PerfilUsuario, type Edital } from '@/types/dominio';
import { renderizar, usuarioTeste } from './utilitarios';

/**
 * `vi.hoisted` porque `vi.mock` e icado para o topo do modulo: um `const`
 * comum aqui seria lido antes de existir.
 */
const { sucesso } = vi.hoisted(() => ({ sucesso: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/editais',
}));

vi.mock('@/hooks/use-filtros-url', () => ({
  useFiltrosUrl: () => ({
    obter: (_chave: string, padrao = '') => padrao,
    obterNumero: (_chave: string, padrao = 1) => padrao,
    definir: vi.fn(),
    pendente: false,
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  toast: { sucesso, erro: vi.fn(), info: vi.fn() },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  sucesso.mockClear();
});

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

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pagina(dados: unknown[]) {
  return json({ dados, meta: { total: dados.length, pagina: 1, limite: 20, totalPaginas: 1 } });
}

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

function stubFetch({
  resumo = RESUMO,
  inscricoes = [CANDIDATO],
  aprovacao,
}: {
  resumo?: unknown[];
  inscricoes?: unknown[];
  aprovacao?: () => Response;
} = {}) {
  const chamadas: Array<{ url: string; metodo: string }> = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      chamadas.push({ url: String(url), metodo: init?.method ?? 'GET' });

      if (String(url).includes('/aprovar')) {
        return Promise.resolve(aprovacao ? aprovacao() : json({}, 201));
      }
      if (String(url).includes('/inscricoes/resumo')) return Promise.resolve(json(resumo));
      if (String(url).includes('/inscricoes')) return Promise.resolve(pagina(inscricoes));

      return Promise.resolve(pagina([]));
    }),
  );

  return chamadas;
}

function respostaDeAprovacao({
  monitoriaCriada,
  contaCriada,
}: {
  monitoriaCriada: boolean;
  contaCriada: boolean;
}) {
  return json(
    {
      inscricaoId: CANDIDATO.id,
      monitoria: {
        id: 'mon-1',
        disciplinaId: BANCO.id,
        ano: 2026,
        semestre: 2,
        criada: monitoriaCriada,
      },
      monitor: {
        usuarioId: 'u-1',
        nome: CANDIDATO.nomeCompleto,
        email: CANDIDATO.email,
        participanteId: 'v-1',
        contaCriada,
      },
    },
    201,
  );
}

async function abrirDetalhe(usuario: ReturnType<typeof userEvent.setup>) {
  const tabela = within(await screen.findByRole('table'));
  await usuario.click(tabela.getAllByRole('button', { name: /detalhes/i })[0]!);
  return within(await screen.findByRole('dialog'));
}

/**
 * Aprovacao da candidatura.
 *
 * Substitui o antigo atalho de "cadastrar aluno": a aprovacao nao cria so a
 * conta — ela cria (ou reaproveita) a monitoria e habilita o monitor, em uma
 * operacao so, sem o professor redigitar nada.
 */
describe('aprovar candidatura', () => {
  it('oferece aprovar, nao cadastrar aluno', async () => {
    const usuario = userEvent.setup();
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });
    const dialogo = await abrirDetalhe(usuario);

    expect(dialogo.getByRole('button', { name: /aprovar candidatura/i })).toBeInTheDocument();
    expect(dialogo.queryByRole('button', { name: /cadastrar como aluno/i })).not.toBeInTheDocument();
  });

  /**
   * Uma disciplina pode ter mais de uma vaga, e o backend reaproveita a
   * monitoria ao aprovar o segundo. Restringir ao primeiro colocado impediria
   * o caso normal.
   */
  it('e oferecida mesmo a quem nao tem a maior media', async () => {
    const usuario = userEvent.setup();
    const segundo = { ...CANDIDATO, id: 'insc-2', nomeCompleto: 'Bruno Lima', media: 6 };
    stubFetch({ inscricoes: [CANDIDATO, segundo] });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });

    const tabela = within(await screen.findByRole('table'));
    await usuario.click(tabela.getAllByRole('button', { name: /detalhes/i })[1]!);

    const dialogo = within(await screen.findByRole('dialog'));
    // O nome aparece no título e no corpo do diálogo; basta confirmar que é ele.
    expect(dialogo.getAllByText(/Bruno Lima/).length).toBeGreaterThan(0);
    expect(dialogo.getByRole('button', { name: /aprovar candidatura/i })).toBeInTheDocument();
  });

  it('envia POST sem corpo: tudo vem da inscricao', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubFetch({
      aprovacao: () => respostaDeAprovacao({ monitoriaCriada: true, contaCriada: true }),
    });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });
    const dialogo = await abrirDetalhe(usuario);
    await usuario.click(dialogo.getByRole('button', { name: /aprovar candidatura/i }));

    await waitFor(() =>
      expect(chamadas.some((c) => c.url.includes(`/inscricoes/${CANDIDATO.id}/aprovar`))).toBe(
        true,
      ),
    );
    expect(chamadas.find((c) => c.url.includes('/aprovar'))!.metodo).toBe('POST');
  });

  /**
   * O texto do aviso relata o que DE FATO aconteceu. Dizer "senha enviada"
   * quando a conta ja existia faria o monitor esperar um e-mail que nao sai.
   */
  it('nao promete e-mail quando a conta foi reaproveitada', async () => {
    const usuario = userEvent.setup();
    stubFetch({
      aprovacao: () => respostaDeAprovacao({ monitoriaCriada: false, contaCriada: false }),
    });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });
    const dialogo = await abrirDetalhe(usuario);
    await usuario.click(dialogo.getByRole('button', { name: /aprovar candidatura/i }));

    await waitFor(() => expect(sucesso).toHaveBeenCalled());
    const [, descricao] = sucesso.mock.calls[0]!;

    expect(descricao).toMatch(/reaproveitada/i);
    expect(descricao).not.toMatch(/senha/i);
    // E diz que a monitoria já existia, em vez de afirmar que foi criada.
    expect(descricao).toMatch(/já existia/i);
  });

  it('avisa da senha quando a conta nasceu agora', async () => {
    const usuario = userEvent.setup();
    stubFetch({
      aprovacao: () => respostaDeAprovacao({ monitoriaCriada: true, contaCriada: true }),
    });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });
    const dialogo = await abrirDetalhe(usuario);
    await usuario.click(dialogo.getByRole('button', { name: /aprovar candidatura/i }));

    await waitFor(() => expect(sucesso).toHaveBeenCalled());
    const [, descricao] = sucesso.mock.calls[0]!;

    expect(descricao).toMatch(/senha provisória foi enviada/i);
    expect(descricao).toMatch(/monitoria criada/i);
  });

  /**
   * A operacao nao e atomica e e repetivel: o erro fica no dialogo, que segue
   * aberto, porque o caminho para resolver e tentar de novo ali mesmo.
   */
  it('mantem o dialogo aberto e mostra o erro do backend', async () => {
    const usuario = userEvent.setup();
    const mensagem = 'Este aluno ja e monitor nesta monitoria (RN09).';

    stubFetch({
      aprovacao: () =>
        json(
          {
            statusCode: 409,
            erro: 'Conflict',
            mensagem,
            caminho: '/api/inscricoes/insc-1/aprovar',
            timestamp: '2026-10-20T12:00:00.000Z',
          },
          409,
        ),
    });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });
    const dialogo = await abrirDetalhe(usuario);
    await usuario.click(dialogo.getByRole('button', { name: /aprovar candidatura/i }));

    expect(await screen.findByText(mensagem)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(sucesso).not.toHaveBeenCalled();
  });

  it('diz que a conta sera criada, ou que ja existe', async () => {
    const usuario = userEvent.setup();
    stubFetch({
      inscricoes: [{ ...CANDIDATO, alunoCadastrado: { usuarioId: 'u-9', cursoId: 'c-1' } }],
    });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });
    const dialogo = await abrirDetalhe(usuario);

    expect(dialogo.getByText(/já tem conta/i)).toBeInTheDocument();
    expect(dialogo.queryByText(/senha provisória vai para o e-mail/i)).not.toBeInTheDocument();
  });

  /**
   * O backend nao exige edital encerrado — nao inventamos a regra, mas aprovar
   * com inscricao em andamento merece ser dito.
   */
  it('avisa quando as inscricoes ainda estao abertas', async () => {
    const usuario = userEvent.setup();
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ABERTO" />, { usuario: PROFESSOR });
    const dialogo = await abrirDetalhe(usuario);

    expect(dialogo.getByText(/inscrições ainda estão abertas/i)).toBeInTheDocument();
    // Mas o botão continua disponível: é decisão do professor, não bloqueio.
    expect(dialogo.getByRole('button', { name: /aprovar candidatura/i })).toBeEnabled();
  });
});

/**
 * Estado da aprovacao no cartao da disciplina.
 *
 * Monitoria sem monitor e aprovacao pela metade — a operacao nao e atomica e
 * pode parar entre os dois passos. Marcar como resolvido esconderia o caso.
 */
describe('estado da disciplina no cartao', () => {
  function resumoCom(extras: Record<string, unknown>) {
    return [{ ...RESUMO[0], ...extras }];
  }

  it('marca a disciplina resolvida com o numero de monitores', async () => {
    stubFetch({
      resumo: resumoCom({ monitoriaCadastrada: true, monitoriaId: 'm-1', monitoresHabilitados: 2 }),
    });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });

    expect(await screen.findByRole('radio', { name: /2 monitores habilitados/i })).toBeInTheDocument();
  });

  it('sinaliza monitoria aberta sem monitor', async () => {
    stubFetch({
      resumo: resumoCom({ monitoriaCadastrada: false, monitoriaId: 'm-1', monitoresHabilitados: 0 }),
    });

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });

    expect(await screen.findByRole('radio', { name: /monitoria sem monitor/i })).toBeInTheDocument();
  });

  it('sem monitoria ainda, nao afirma nada', async () => {
    stubFetch();

    renderizar(<ListaInscricoes edital={EDITAL} situacao="ENCERRADO" />, { usuario: PROFESSOR });

    await screen.findByRole('radio', { name: /BAN001/ });
    expect(screen.queryByText(/monitor habilitado|monitoria sem monitor/i)).not.toBeInTheDocument();
  });
});
