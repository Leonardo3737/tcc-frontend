import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FaixaDeDisciplinas } from '@/features/editais/components/faixa-de-disciplinas';
import type { ResumoPorDisciplina } from '@/types/dominio';
import { renderizar } from './utilitarios';

/**
 * Faixa de disciplinas com edital grande.
 *
 * O caso que motivou a busca e real: um edital com 84 disciplinas e 400
 * candidaturas. Quebrada em varias linhas, a faixa tomava a tela inteira e
 * empurrava a lista de candidatos para fora da dobra.
 */

function linha(indice: number, extras: Partial<ResumoPorDisciplina> = {}): ResumoPorDisciplina {
  const numero = String(indice).padStart(3, '0');

  return {
    disciplina: { id: `d-${numero}`, codigo: `SEED-D${numero}`, nome: `Disciplina ${numero}` },
    totalInscricoes: 3,
    comMedia: 3,
    semMedia: 0,
    melhorMedia: 8.5,
    monitoriaCadastrada: false,
    monitoriaId: null,
    monitoresHabilitados: 0,
    ...extras,
  };
}

/** 84 disciplinas, como no edital que motivou a mudanca. */
const MUITAS = Array.from({ length: 84 }, (_, indice) => linha(indice + 1));

const POUCAS = [
  linha(1, { disciplina: { id: 'd-cal', codigo: 'MAT101', nome: 'Cálculo I' } }),
  linha(2, { disciplina: { id: 'd-ban', codigo: 'BAN001', nome: 'Banco de Dados' } }),
  linha(3, { disciplina: { id: 'd-alg', codigo: 'ALG001', nome: 'Algoritmos' } }),
];

function montar(
  resumo: ResumoPorDisciplina[],
  { disciplinaId = '', aoEscolher = vi.fn() }: { disciplinaId?: string; aoEscolher?: () => void } = {},
) {
  renderizar(
    <FaixaDeDisciplinas
      resumo={resumo}
      carregando={false}
      erro={false}
      disciplinaId={disciplinaId}
      totalGeral={resumo.reduce((soma, item) => soma + item.totalInscricoes, 0)}
      aoEscolher={aoEscolher}
    />,
  );

  return screen.getByRole('radiogroup', { name: /disciplina/i });
}

function campoDeBusca() {
  return screen.queryByRole('searchbox', { name: /buscar disciplina/i });
}

/** Códigos dos cartões visíveis, fora o "Todas". */
function codigosVisiveis(faixa: HTMLElement) {
  return within(faixa)
    .getAllByRole('radio')
    .map((cartao) => cartao.textContent ?? '')
    .filter((texto) => !texto.startsWith('Todas'));
}

describe('busca dentro da faixa', () => {
  /** Com meia dúzia de cartões, procurar é olhar — o campo seria ruído. */
  it('nao aparece em edital pequeno', () => {
    montar(POUCAS);
    expect(campoDeBusca()).toBeNull();
  });

  it('aparece quando a faixa fica grande', () => {
    montar(MUITAS);
    expect(campoDeBusca()).not.toBeNull();
  });

  it('filtra por nome e por codigo', async () => {
    const usuario = userEvent.setup();
    const faixa = montar([...MUITAS, ...POUCAS]);

    await usuario.type(campoDeBusca()!, 'banco');
    expect(codigosVisiveis(faixa).join(' ')).toMatch(/BAN001/);
    expect(codigosVisiveis(faixa)).toHaveLength(1);

    await usuario.clear(campoDeBusca()!);
    await usuario.type(campoDeBusca()!, 'MAT101');
    expect(codigosVisiveis(faixa)).toHaveLength(1);
    expect(codigosVisiveis(faixa).join(' ')).toMatch(/MAT101/);
  });

  /** Ninguém digita "Cálculo" com o acento. */
  it('ignora acento e caixa', async () => {
    const usuario = userEvent.setup();
    const faixa = montar([...MUITAS, ...POUCAS]);

    await usuario.type(campoDeBusca()!, 'calculo');
    expect(codigosVisiveis(faixa).join(' ')).toMatch(/MAT101/);
  });

  /**
   * O recorte ativo precisa continuar visivel: sem o cartao, a listagem
   * abaixo apareceria encurtada sem nada na tela dizendo por que.
   */
  it('nao esconde a disciplina selecionada que nao casa com o termo', async () => {
    const usuario = userEvent.setup();
    const faixa = montar([...MUITAS, ...POUCAS], { disciplinaId: 'd-ban' });

    await usuario.type(campoDeBusca()!, 'calculo');

    const visiveis = codigosVisiveis(faixa).join(' ');
    expect(visiveis).toMatch(/MAT101/);
    expect(visiveis).toMatch(/BAN001/);

    const selecionado = within(faixa).getAllByRole('radio').find((c) => c.getAttribute('aria-checked') === 'true');
    expect(selecionado?.textContent).toMatch(/BAN001/);
  });

  it('"Todas" permanece durante a busca, como volta ao panorama', async () => {
    const usuario = userEvent.setup();
    const faixa = montar(MUITAS);

    await usuario.type(campoDeBusca()!, 'Disciplina 007');
    expect(within(faixa).getByRole('radio', { name: /^Todas/ })).toBeInTheDocument();
  });

  it('diz o que o termo alcancou, e quando nao alcancou nada', async () => {
    const usuario = userEvent.setup();
    montar(MUITAS);

    await usuario.type(campoDeBusca()!, 'Disciplina 00');
    expect(screen.getByText(/9 de 84 disciplinas correspondem/i)).toBeInTheDocument();

    await usuario.clear(campoDeBusca()!);
    await usuario.type(campoDeBusca()!, 'zzzz');
    expect(screen.getByText(/nenhuma disciplina corresponde/i)).toBeInTheDocument();
  });

  /** Sem busca, a nota de rodapé explica o que a faixa é. */
  it('volta a nota de rodape quando a busca esvazia', async () => {
    const usuario = userEvent.setup();
    montar(MUITAS);

    await usuario.type(campoDeBusca()!, 'zzzz');
    await usuario.clear(campoDeBusca()!);

    expect(
      screen.getByText(/apenas disciplinas que receberam candidatura/i),
    ).toBeInTheDocument();
  });

  it('escolher um cartao filtrado avisa o pai com o id certo', async () => {
    const usuario = userEvent.setup();
    const aoEscolher = vi.fn();
    const faixa = montar([...MUITAS, ...POUCAS], { aoEscolher });

    await usuario.type(campoDeBusca()!, 'banco');
    await usuario.click(within(faixa).getByRole('radio', { name: /BAN001/ }));

    expect(aoEscolher).toHaveBeenCalledWith('d-ban');
  });
});

describe('faixa em uma linha so', () => {
  /**
   * A regressao a evitar: `flex-wrap` de volta faz 84 cartoes ocuparem a tela
   * inteira e empurrarem a lista de candidatos para fora da dobra.
   */
  it('nao quebra em varias linhas, e rola na horizontal', () => {
    const faixa = montar(MUITAS);

    expect(faixa.className).toContain('overflow-x-auto');
    expect(faixa.className).not.toContain('flex-wrap');
  });

  it('mostra todas as disciplinas quando nao ha busca', () => {
    const faixa = montar(MUITAS);
    expect(codigosVisiveis(faixa)).toHaveLength(84);
  });
});
