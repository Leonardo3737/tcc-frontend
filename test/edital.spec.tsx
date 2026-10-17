import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FormularioInscricao } from '@/features/editais/components/formulario-inscricao';
import { NovidadeInscricao } from '@/features/editais/components/novidade-inscricao';
import {
  esquemaInscricao,
  problemaNoBoletim,
} from '@/features/editais/schemas/inscricao.schema';
import { hojeNaInstituicao, situacaoDoEdital } from '@/features/editais/situacao';
import { itensVisiveis } from '@/config/navegacao';
import { PerfilUsuario, Turno, type Edital, type EditalPublico } from '@/types/dominio';
import { renderizar, usuarioTeste } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/inscricao',
}));

afterEach(() => vi.unstubAllGlobals());

const EDITAL: EditalPublico = {
  id: 'ed-1',
  inicioInscricoes: '2026-11-10',
  fimInscricoes: '2026-11-25',
  link: 'https://ufx.edu.br/editais/2026-2.pdf',
  ano: 2026,
  semestre: 2,
};

const CURSO = { id: '11111111-1111-4111-8111-111111111111', codigo: 'ENG001', nome: 'Engenharia' };
const OUTRO_CURSO = {
  id: '33333333-3333-4333-8333-333333333333',
  codigo: 'SIS001',
  nome: 'Sistemas',
};
const DISCIPLINA = {
  id: '22222222-2222-4222-8222-222222222222',
  codigo: 'BD1',
  nome: 'Banco de Dados',
};
const PROFESSOR = {
  usuarioId: '44444444-4444-4444-8444-444444444444',
  nome: 'Carlos Lima',
  departamento: 'Computação',
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pagina(dados: unknown[]) {
  return json({ dados, meta: { total: dados.length, pagina: 1, limite: 100, totalPaginas: 1 } });
}

function pdf(nome = 'boletim.pdf', bytes = 1024) {
  return new File([new Uint8Array(bytes)], nome, { type: 'application/pdf' });
}

/**
 * Escolhe uma opcao esperando ela EXISTIR.
 *
 * O `<select>` e renderizado antes da resposta da API, com "Carregando…" como
 * unica opcao — procurar o campo nao basta, e preciso esperar o conteudo dele.
 */
async function escolher(
  usuario: ReturnType<typeof userEvent.setup>,
  rotulo: RegExp,
  valor: string,
) {
  const campo = await screen.findByLabelText(rotulo);
  await waitFor(() =>
    expect(campo.querySelector(`option[value="${valor}"]`)).not.toBeNull(),
  );
  await usuario.selectOptions(campo, valor);
  return campo;
}

/** Guarda as chamadas para afirmar URL, método e corpo. */
function stubFetch(aoInscrever: () => Response = () => json({}, 201)) {
  const chamadas: Array<{ url: string; init: RequestInit | undefined }> = [];

  const espiao = vi.fn((url: string, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    const texto = String(url);

    if (texto.includes('/cursos')) return Promise.resolve(pagina([{ ...CURSO, ativo: true }]));
    if (texto.includes('/disciplinas')) {
      return Promise.resolve(pagina([{ ...DISCIPLINA, ativa: true, cursos: [CURSO] }]));
    }
    if (texto.includes('/professores/publicos')) return Promise.resolve(pagina([PROFESSOR]));
    if (texto.includes('/inscricoes')) return Promise.resolve(aoInscrever());

    return Promise.resolve(pagina([]));
  });

  vi.stubGlobal('fetch', espiao);
  return chamadas;
}

// ---------------------------------------------------------------------------

/**
 * Situacao do edital.
 *
 * A palavra final sobre "aberto" e do SERVIDOR (`aceitandoInscricoes`). O
 * cliente so distingue os dois casos FECHADOS, que o backend nao separa.
 */
describe('situacao do edital', () => {
  const base: Edital = {
    id: 'ed-1',
    inicioInscricoes: '2026-11-10',
    fimInscricoes: '2026-11-25',
    link: 'https://x.test/e.pdf',
    ano: 2026,
    semestre: 2,
    ativo: true,
    aceitandoInscricoes: false,
    criadoEm: '2026-10-01T00:00:00.000Z',
  };

  it('respeita o campo derivado do servidor em vez de recalcular', () => {
    // Mesmo com "hoje" fora do período, quem manda é o servidor.
    expect(situacaoDoEdital({ ...base, aceitandoInscricoes: true }, '2030-01-01')).toBe('ABERTO');
  });

  it('separa "ainda nao abriu" de "ja encerrou"', () => {
    expect(situacaoDoEdital(base, '2026-11-01')).toBe('NAO_INICIADO');
    expect(situacaoDoEdital(base, '2026-12-01')).toBe('ENCERRADO');
  });

  it('edital excluido nunca aparece como aberto', () => {
    expect(situacaoDoEdital({ ...base, ativo: false, aceitandoInscricoes: true }, '2026-11-15')).toBe(
      'EXCLUIDO',
    );
  });

  it('calcula hoje no fuso da instituicao, nao no do navegador', () => {
    expect(hojeNaInstituicao('America/Sao_Paulo')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

/**
 * Nota em branco e AUSENTE, nunca zero.
 *
 * `Number('')` e 0, e seguir esse caminho faria o candidato aparecer para a
 * banca com uma nota que ninguem lhe atribuiu — e com media calculada em cima
 * dela.
 */
describe('notas da inscricao', () => {
  const base = {
    nomeCompleto: 'Maria Oliveira',
    matricula: '2021001234',
    email: 'maria@ufx.edu.br',
    cursoId: CURSO.id,
    disciplinaId: DISCIPLINA.id,
    professorId: PROFESSOR.usuarioId,
    turno: Turno.MATUTINO,
  };

  it('campo vazio vira ausente, nao zero', () => {
    const resultado = esquemaInscricao.parse({ ...base, n1: '', n2: '' });

    expect(resultado.n1).toBeUndefined();
    expect(resultado.n2).toBeUndefined();
  });

  it('aceita decimal e recusa fora de 0 a 10', () => {
    expect(esquemaInscricao.parse({ ...base, n1: '8.5' }).n1).toBe(8.5);
    expect(esquemaInscricao.safeParse({ ...base, n1: '10' }).success).toBe(true);
    expect(esquemaInscricao.safeParse({ ...base, n1: '0' }).success).toBe(true);
    expect(esquemaInscricao.safeParse({ ...base, n1: '10.5' }).success).toBe(false);
    expect(esquemaInscricao.safeParse({ ...base, n1: '-1' }).success).toBe(false);
  });

  it('recusa mais de 2 casas decimais, como o backend', () => {
    expect(esquemaInscricao.safeParse({ ...base, n1: '8.55' }).success).toBe(true);
    expect(esquemaInscricao.safeParse({ ...base, n1: '8.555' }).success).toBe(false);
  });

  it('nao existe campo de media: ela e calculada pelo banco', () => {
    expect(Object.keys(esquemaInscricao.shape)).not.toContain('media');
  });
});

describe('validacao do boletim', () => {
  it('exige um arquivo', () => {
    expect(problemaNoBoletim(null)).toMatch(/anexe/i);
  });

  it('recusa o que nao e PDF', () => {
    const imagem = new File(['x'], 'boletim.png', { type: 'image/png' });
    expect(problemaNoBoletim(imagem)).toMatch(/PDF/);
  });

  it('recusa acima de 5 MB, o limite do backend', () => {
    const grande = pdf('grande.pdf', 6 * 1024 * 1024);
    expect(problemaNoBoletim(grande)).toMatch(/5 MB/);
  });

  it('aceita um PDF dentro do limite', () => {
    expect(problemaNoBoletim(pdf())).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('formulario publico de inscricao', () => {
  async function preencher(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.type(screen.getByLabelText(/nome completo/i), 'Maria Oliveira dos Santos');
    await usuario.type(screen.getByLabelText(/matr[ií]cula/i), '2021001234');
    await usuario.type(screen.getByLabelText(/^e-mail/i), 'Maria@ufx.edu.br');
    await escolher(usuario, /^curso/i, CURSO.id);
    await escolher(usuario, /^disciplina/i, DISCIPLINA.id);
    await escolher(usuario, /professor respons/i, PROFESSOR.usuarioId);
    await usuario.selectOptions(screen.getByLabelText(/^turno/i), Turno.MATUTINO);
  }

  it('envia multipart com o PDF e sem media', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubFetch(() =>
      json(
        {
          id: 'insc-1',
          editalId: EDITAL.id,
          nomeCompleto: 'Maria Oliveira dos Santos',
          criadoEm: '2026-11-12T14:03:00.000Z',
          emailConfirmacaoEnviado: true,
        },
        201,
      ),
    );

    renderizar(<FormularioInscricao editais={[EDITAL]} />);

    await preencher(usuario);
    await usuario.type(screen.getByLabelText(/nota n1/i), '8.5');
    await usuario.upload(screen.getByLabelText(/boletim/i), pdf());
    await usuario.click(screen.getByRole('button', { name: /enviar inscri/i }));

    await waitFor(() => expect(screen.getByText(/inscrição registrada/i)).toBeInTheDocument());

    const envio = chamadas.find((c) => c.url.includes('/inscricoes'))!;
    expect(envio.url).toBe(`/api/backend/editais/${EDITAL.id}/inscricoes`);
    expect(envio.init?.method).toBe('POST');

    const corpo = envio.init?.body as FormData;
    expect(corpo).toBeInstanceOf(FormData);
    expect(corpo.get('email')).toBe('maria@ufx.edu.br');
    expect(corpo.get('n1')).toBe('8.5');
    // N2 em branco não vai no corpo: ausente não é zero.
    expect(corpo.get('n2')).toBeNull();
    // A média é do banco; mandá-la devolveria 400.
    expect(corpo.get('media')).toBeNull();
    expect(corpo.get('boletim')).toBeInstanceOf(File);

    /**
     * Sem `Content-Type` definido por nós: o navegador precisa escrever o
     * cabeçalho com o `boundary` do multipart.
     */
    const cabecalhos = envio.init?.headers as Record<string, string>;
    expect(cabecalhos['Content-Type']).toBeUndefined();
  });

  it('nao envia sem o boletim e explica o motivo', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubFetch();

    renderizar(<FormularioInscricao editais={[EDITAL]} />);

    await preencher(usuario);
    await usuario.click(screen.getByRole('button', { name: /enviar inscri/i }));

    expect(await screen.findByText(/anexe o pdf/i)).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.includes('/inscricoes'))).toBe(false);
  });

  it('limpa a disciplina ao trocar de curso', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const texto = String(url);
        if (texto.includes('/cursos')) {
          return Promise.resolve(
            pagina([
              { ...CURSO, ativo: true },
              { ...OUTRO_CURSO, ativo: true },
            ]),
          );
        }
        if (texto.includes('/disciplinas')) {
          return Promise.resolve(pagina([{ ...DISCIPLINA, ativa: true, cursos: [CURSO] }]));
        }
        if (texto.includes('/professores/publicos')) return Promise.resolve(pagina([PROFESSOR]));
        return Promise.resolve(pagina([]));
      }),
    );

    renderizar(<FormularioInscricao editais={[EDITAL]} />);

    await escolher(usuario, /^curso/i, CURSO.id);
    const disciplina = await escolher(usuario, /^disciplina/i, DISCIPLINA.id);
    expect(disciplina).toHaveValue(DISCIPLINA.id);

    // Trocar o curso não pode deixar a disciplina antiga presa no formulário.
    await escolher(usuario, /^curso/i, OUTRO_CURSO.id);
    await waitFor(() => expect(screen.getByLabelText(/^disciplina/i)).toHaveValue(''));
  });

  it('pede disciplinas apenas do curso escolhido', async () => {
    const usuario = userEvent.setup();
    const chamadas = stubFetch();

    renderizar(<FormularioInscricao editais={[EDITAL]} />);
    await escolher(usuario, /^curso/i, CURSO.id);

    await waitFor(() =>
      expect(chamadas.some((c) => c.url.includes(`cursoId=${CURSO.id}`))).toBe(true),
    );
  });

  /**
   * A inscricao esta gravada nos dois casos. Dizer "confira sua caixa de
   * entrada" quando o e-mail nao saiu seria mentir para o candidato.
   */
  it('nao promete e-mail que a API nao confirmou', async () => {
    const usuario = userEvent.setup();
    stubFetch(() =>
      json(
        {
          id: 'insc-2',
          editalId: EDITAL.id,
          nomeCompleto: 'Maria Oliveira dos Santos',
          criadoEm: '2026-11-12T14:03:00.000Z',
          emailConfirmacaoEnviado: false,
        },
        201,
      ),
    );

    renderizar(<FormularioInscricao editais={[EDITAL]} />);

    await preencher(usuario);
    await usuario.upload(screen.getByLabelText(/boletim/i), pdf());
    await usuario.click(screen.getByRole('button', { name: /enviar inscri/i }));

    expect(await screen.findByText(/inscrição registrada/i)).toBeInTheDocument();
    expect(screen.getByText(/não conseguimos enviar o e-mail/i)).toBeInTheDocument();
    expect(screen.queryByText(/confira a caixa de spam/i)).not.toBeInTheDocument();
  });

  /** Depois do sucesso o formulário deixa de existir: não há o que reenviar. */
  it('substitui o formulario pela confirmacao, impedindo reenvio', async () => {
    const usuario = userEvent.setup();
    stubFetch(() =>
      json(
        {
          id: 'insc-3',
          editalId: EDITAL.id,
          nomeCompleto: 'Maria Oliveira dos Santos',
          criadoEm: '2026-11-12T14:03:00.000Z',
          emailConfirmacaoEnviado: true,
        },
        201,
      ),
    );

    renderizar(<FormularioInscricao editais={[EDITAL]} />);

    await preencher(usuario);
    await usuario.upload(screen.getByLabelText(/boletim/i), pdf());
    await usuario.click(screen.getByRole('button', { name: /enviar inscri/i }));

    await waitFor(() => expect(screen.getByText(/inscrição registrada/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /enviar inscri/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('divulgacao da novidade', () => {
  it('o dashboard anuncia so para aluno', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(pagina([EDITAL]))));

    renderizar(<NovidadeInscricao />, { usuario: usuarioTeste([PerfilUsuario.ALUNO]) });
    expect(await screen.findByText(/inscrições abertas para monitoria/i)).toBeInTheDocument();
  });

  it('professor nao ve o destaque: ele conduz o processo, nao se candidata', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(pagina([EDITAL]))));

    const { container } = renderizar(<NovidadeInscricao />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
    });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('sem edital aberto, nada e anunciado', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(pagina([]))));

    const { container } = renderizar(<NovidadeInscricao />, {
      usuario: usuarioTeste([PerfilUsuario.ALUNO]),
    });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('"Editais de monitoria" aparece no menu so para professor', () => {
    const rotulos = (perfis: PerfilUsuario[]) => itensVisiveis(perfis).map((item) => item.rotulo);

    expect(rotulos([PerfilUsuario.PROFESSOR])).toContain('Editais de monitoria');
    expect(rotulos([PerfilUsuario.ALUNO])).not.toContain('Editais de monitoria');
  });
});
