import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { BotaoRelatorioMonitoria } from '@/features/monitorias/components/botao-relatorio';
import { PainelIndicadoresMonitoria } from '@/features/analytics/components/painel-indicadores-monitoria';
import { capacidades } from '@/lib/autorizacao/capacidades';
import { formatarDuracaoEmMinutos } from '@/lib/datas/fuso';
import { PapelMonitoria, PerfilUsuario, StatusMonitoria, type Monitoria } from '@/types/dominio';
import { monitoriaTeste, renderizar, usuarioTeste } from './utilitarios';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/monitorias/monitoria-1',
}));

afterEach(() => vi.unstubAllGlobals());

function json(corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Carga horaria.
 *
 * O backend manda MINUTOS como unidade canonica porque hora decimal nao
 * representa 1h20 sem dizima — "21,08 h" nao e um numero que alguem leia como
 * tempo trabalhado.
 */
describe('formato da carga horaria', () => {
  it('traduz minutos em horas e minutos', () => {
    expect(formatarDuracaoEmMinutos(80)).toBe('1 h 20');
    expect(formatarDuracaoEmMinutos(1265)).toBe('21 h 05');
  });

  it('omite a parte vazia em vez de escrever "0"', () => {
    expect(formatarDuracaoEmMinutos(120)).toBe('2 h');
    expect(formatarDuracaoEmMinutos(45)).toBe('45 min');
  });

  it('monitor sem atendimento realizado mostra zero, nao vazio', () => {
    expect(formatarDuracaoEmMinutos(0)).toBe('0 h');
  });
});

describe('carga horaria nos indicadores', () => {
  const MONITORIA = monitoriaTeste({ souResponsavel: true, status: StatusMonitoria.ATIVA });

  function stub(cargaHorariaMinutos: number) {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (String(url).includes('/monitores')) {
          return Promise.resolve(
            json([
              {
                participanteId: 'v-1',
                usuarioId: 'u-1',
                nome: 'Ana Martins',
                atendimentosRealizados: 19,
                atendimentosCancelados: 1,
                atendimentosAgendados: 2,
                alunosAtendidos: 21,
                cargaHorariaMinutos,
                cargaHorariaHoras: Math.round((cargaHorariaMinutos / 60) * 100) / 100,
                totalAvaliacoes: 11,
                mediaAvaliacoes: 4.8,
                disponibilidadesAtivas: 6,
              },
            ]),
          );
        }

        return Promise.resolve(
          json({
            monitoriaId: MONITORIA.id,
            disciplina: 'MAT101 - Cálculo I',
            periodo: '2026/2',
            status: 'ATIVA',
            atendimentos: { total: 22, porStatus: { REALIZADO: 19 } },
            monitoresAtivos: 1,
            monitoradosAtivos: 10,
            alunosAtendidos: 21,
            taxaParticipacao: 0.9,
            ausencias: 2,
            totalAvaliacoes: 11,
            mediaAvaliacoes: 4.8,
            materiaisPublicados: 3,
          }),
        );
      }),
    );
  }

  it('exibe a carga horaria de cada monitor em horas e minutos', async () => {
    stub(1265);

    renderizar(<PainelIndicadoresMonitoria />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
      monitoria: MONITORIA,
    });

    // Aparece na tabela (desktop) e no cartão (mobile) — ambos no jsdom.
    expect((await screen.findAllByText('21 h 05')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/carga horária/i).length).toBeGreaterThan(0);
  });

  /** Zero atendimentos realizados é "0 h", não um traço: a soma existe e é zero. */
  it('mostra zero para monitor que ainda nao realizou atendimento', async () => {
    stub(0);

    renderizar(<PainelIndicadoresMonitoria />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
      monitoria: MONITORIA,
    });

    expect((await screen.findAllByText('0 h')).length).toBeGreaterThan(0);
  });
});

/**
 * Relatorio final em .docx.
 *
 * A rota exige `{ papeis: [MONITOR], professorResponsavel: 'NEGADO' }`, e a
 * tela espelha isso: o documento e PESSOAL do monitor, nao um relatorio do
 * professor.
 */
describe('botao do relatorio', () => {
  function contexto(extras: Partial<Monitoria>) {
    return monitoriaTeste(extras);
  }

  it('aparece para o MONITOR, apontando para a rota protegida', () => {
    renderizar(<BotaoRelatorioMonitoria />, {
      usuario: usuarioTeste([PerfilUsuario.ALUNO]),
      monitoria: contexto({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-1' }),
    });

    const link = screen.getByRole('link', { name: /baixar relatório/i });
    expect(link).toHaveAttribute('href', '/api/backend/monitorias/monitoria-1/relatorio');
  });

  /**
   * Sem `download`: o nome do arquivo vem do `Content-Disposition` do
   * servidor, montado com disciplina, periodo e matricula. O atributo faria o
   * navegador renomear para o ultimo segmento da URL ("relatorio").
   */
  it('deixa o nome do arquivo para o servidor', () => {
    renderizar(<BotaoRelatorioMonitoria />, {
      usuario: usuarioTeste([PerfilUsuario.ALUNO]),
      monitoria: contexto({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-1' }),
    });

    expect(screen.getByRole('link', { name: /baixar relatório/i })).not.toHaveAttribute(
      'download',
    );
  });

  it('nao aparece para o MONITORADO', () => {
    const { container } = renderizar(<BotaoRelatorioMonitoria />, {
      usuario: usuarioTeste([PerfilUsuario.ALUNO]),
      monitoria: contexto({ meuPapel: PapelMonitoria.MONITORADO, meuParticipanteId: 'v-2' }),
    });

    expect(container).toBeEmptyDOMElement();
  });

  /** O professor responsável é NEGADO na rota — a tela não pode oferecer. */
  it('nao aparece para o professor responsavel', () => {
    const { container } = renderizar(<BotaoRelatorioMonitoria />, {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR]),
      monitoria: contexto({ souResponsavel: true, meuPapel: null }),
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('a capacidade espelha a regra da rota', () => {
    const comoMonitor = capacidades({
      meuPapel: PapelMonitoria.MONITOR,
      souResponsavel: false,
      status: StatusMonitoria.ATIVA,
      meuParticipanteId: 'v-1',
    });

    const comoResponsavel = capacidades({
      meuPapel: null,
      souResponsavel: true,
      status: StatusMonitoria.ATIVA,
      meuParticipanteId: null,
    });

    expect(comoMonitor.baixarRelatorioDaMonitoria).toBe(true);
    expect(comoResponsavel.baixarRelatorioDaMonitoria).toBe(false);
  });

  /**
   * O relatorio FINAL e justamente o que se baixa quando a monitoria termina:
   * encerrar nao pode tirar o acesso a ele.
   */
  it('continua disponivel com a monitoria encerrada', () => {
    const encerrada = capacidades({
      meuPapel: PapelMonitoria.MONITOR,
      souResponsavel: false,
      status: StatusMonitoria.ENCERRADA,
      meuParticipanteId: 'v-1',
    });

    expect(encerrada.baixarRelatorioDaMonitoria).toBe(true);
    // Enquanto declarar disponibilidade, que é ação de monitoria viva, cessa.
    expect(encerrada.declararDisponibilidade).toBe(false);
  });
});
