import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { Pode, PodePorPerfil } from '@/components/autorizacao/pode';
import { CartaoMonitoria } from '@/features/monitorias/components/cartao-monitoria';
import { renderizar, monitoriaTeste, usuarioTeste } from './utilitarios';
import { PapelMonitoria, PerfilUsuario, StatusMonitoria } from '@/types/dominio';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

/**
 * O CONCEITO CENTRAL DO DOMINIO, verificado.
 *
 * MONITOR e MONITORADO nao sao tipos de usuario: sao papeis que um ALUNO assume
 * DENTRO de uma monitoria especifica. O mesmo aluno pode ser MONITOR em Calculo
 * e MONITORADO em Banco de Dados — e a UI precisa refletir isso, nao apenas o
 * backend.
 *
 * Se algum destes testes falhar, o frontend voltou a tratar papel como atributo
 * da pessoa.
 */
describe('papel e contextual, nao global', () => {
  it('o MESMO usuario tem capacidades diferentes em monitorias diferentes', () => {
    const aluno = usuarioTeste([PerfilUsuario.ALUNO]);

    const { unmount } = renderizar(
      <Pode capacidade="declararDisponibilidade">
        <span>declara horário</span>
      </Pode>,
      {
        usuario: aluno,
        monitoria: monitoriaTeste({
          meuPapel: PapelMonitoria.MONITOR,
          meuParticipanteId: 'v1',
        }),
      },
    );

    // Como MONITOR nesta monitoria, ele declara disponibilidade.
    expect(screen.getByText('declara horário')).toBeInTheDocument();
    unmount();

    renderizar(
      <Pode capacidade="declararDisponibilidade">
        <span>declara horário</span>
      </Pode>,
      {
        usuario: aluno, // MESMA pessoa
        monitoria: monitoriaTeste({
          id: 'monitoria-2',
          meuPapel: PapelMonitoria.MONITORADO,
          meuParticipanteId: 'v2',
        }),
      },
    );

    // Como MONITORADO em outra monitoria, não declara.
    expect(screen.queryByText('declara horário')).not.toBeInTheDocument();
  });

  it('o perfil da conta nunca contem MONITOR nem MONITORADO', () => {
    const aluno = usuarioTeste([PerfilUsuario.ALUNO]);

    // Só existem dois perfis de identidade; papel não entra aqui.
    expect(aluno.perfis).toEqual([PerfilUsuario.ALUNO]);
    expect(aluno.perfis).not.toContain('MONITOR' as never);
  });

  it('o cartao mostra o papel DAQUELA monitoria', () => {
    renderizar(
      <CartaoMonitoria
        monitoria={monitoriaTeste({ meuPapel: PapelMonitoria.MONITOR })}
      />,
      { usuario: usuarioTeste([PerfilUsuario.ALUNO]) },
    );

    expect(screen.getByText('Monitor')).toBeInTheDocument();
  });

  it('o cartao nao mostra papel quando o usuario nao participa', () => {
    renderizar(<CartaoMonitoria monitoria={monitoriaTeste()} />, {
      usuario: usuarioTeste([PerfilUsuario.ALUNO]),
    });

    expect(screen.queryByText('Monitor')).not.toBeInTheDocument();
    expect(screen.queryByText('Monitorado')).not.toBeInTheDocument();
  });
});

describe('professor responsavel', () => {
  /**
   * professorResponsavel: 'NEGADO' no backend para disponibilidade e
   * agendamento. Ele administra a monitoria, mas nao TEM agenda — nao existe
   * vinculo dele que ocupe horario.
   */
  it('administra, mas nao declara disponibilidade nem agenda', () => {
    const contexto = {
      usuario: usuarioTeste([PerfilUsuario.PROFESSOR], { id: 'prof' }),
      monitoria: monitoriaTeste({ souResponsavel: true }),
    };

    const { unmount } = renderizar(
      <>
        <Pode capacidade="habilitarMonitor">
          <span>habilita monitor</span>
        </Pode>
        <Pode capacidade="declararDisponibilidade">
          <span>declara horário</span>
        </Pode>
        <Pode capacidade="agendarAtendimento">
          <span>agenda</span>
        </Pode>
      </>,
      contexto,
    );

    expect(screen.getByText('habilita monitor')).toBeInTheDocument();
    expect(screen.queryByText('declara horário')).not.toBeInTheDocument();
    expect(screen.queryByText('agenda')).not.toBeInTheDocument();

    unmount();
  });
});

describe('guard por perfil global', () => {
  it('esconde a area de professor para o aluno', () => {
    renderizar(
      <PodePorPerfil perfis={[PerfilUsuario.PROFESSOR]}>
        <span>catálogo de disciplinas</span>
      </PodePorPerfil>,
      { usuario: usuarioTeste([PerfilUsuario.ALUNO]) },
    );

    expect(screen.queryByText('catálogo de disciplinas')).not.toBeInTheDocument();
  });

  it('quem acumula os dois perfis (D-12) ve as duas areas', () => {
    renderizar(
      <>
        <PodePorPerfil perfis={[PerfilUsuario.PROFESSOR]}>
          <span>área do professor</span>
        </PodePorPerfil>
        <PodePorPerfil perfis={[PerfilUsuario.ALUNO]}>
          <span>área do aluno</span>
        </PodePorPerfil>
      </>,
      { usuario: usuarioTeste([PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR]) },
    );

    expect(screen.getByText('área do professor')).toBeInTheDocument();
    expect(screen.getByText('área do aluno')).toBeInTheDocument();
  });

  it('renderiza o fallback quando o perfil nao basta', () => {
    renderizar(
      <PodePorPerfil perfis={[PerfilUsuario.PROFESSOR]} fallback={<span>sem acesso</span>}>
        <span>restrito</span>
      </PodePorPerfil>,
      { usuario: usuarioTeste([PerfilUsuario.ALUNO]) },
    );

    expect(screen.getByText('sem acesso')).toBeInTheDocument();
  });
});

describe('status da monitoria fecha a escrita, nao a leitura (RN10)', () => {
  it.each([StatusMonitoria.ENCERRADA, StatusMonitoria.CANCELADA])(
    'monitoria %s continua legivel para quem participou',
    (status) => {
      renderizar(
        <>
          <Pode capacidade="verMonitoria">
            <span>consulta o histórico</span>
          </Pode>
          <Pode capacidade="publicarMaterial">
            <span>publica material</span>
          </Pode>
        </>,
        {
          usuario: usuarioTeste([PerfilUsuario.ALUNO]),
          monitoria: monitoriaTeste({ status, meuPapel: PapelMonitoria.MONITOR }),
        },
      );

      expect(screen.getByText('consulta o histórico')).toBeInTheDocument();
      expect(screen.queryByText('publica material')).not.toBeInTheDocument();
    },
  );
});
