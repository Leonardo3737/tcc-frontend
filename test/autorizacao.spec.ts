import { describe, expect, it } from 'vitest';

import {
  capacidades,
  contextoDaMonitoria,
  ehAluno,
  ehProfessor,
  minhaInscricao,
  podeAvaliar,
  podeEditarMaterial,
  podeGerirAtendimento,
  temPerfil,
} from '@/lib/autorizacao/capacidades';
import {
  ModalidadeAtendimento,
  OrigemAtendimento,
  PapelMonitoria,
  PerfilUsuario,
  StatusAtendimento,
  StatusInscricao,
  StatusMonitoria,
  type Atendimento,
  type Material,
  type Monitoria,
  type Usuario,
} from '@/types/dominio';

/**
 * O modulo de autorizacao e o espelho das regras do backend, e e a peca do
 * frontend com maior risco de divergir em silencio: um erro aqui nao quebra a
 * tela, apenas oferece uma acao que o servidor vai recusar com 403.
 *
 * Por isso ele e o alvo mais denso de teste do projeto.
 */

function usuario(perfis: PerfilUsuario[], id = 'u1'): Usuario {
  return {
    id,
    nome: 'Fulano',
    email: 'fulano@ufx.edu.br',
    ativo: true,
    perfis,
    criadoEm: '2026-01-01T00:00:00.000Z',
  };
}

function monitoria(extras: Partial<Monitoria> = {}): Monitoria {
  return {
    id: 'm1',
    ano: 2026,
    semestre: 2,
    periodo: '2026/2',
    descricao: null,
    status: StatusMonitoria.ATIVA,
    dataInicio: null,
    dataFim: null,
    ...extras,
  };
}

describe('perfil global', () => {
  it('aceita quem tem QUALQUER um dos perfis exigidos', () => {
    const dois = usuario([PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR]);

    expect(temPerfil(dois, PerfilUsuario.PROFESSOR)).toBe(true);
    expect(temPerfil(dois, PerfilUsuario.ALUNO)).toBe(true);
  });

  it('trata o acumulo de perfis (D-12): a mesma pessoa e aluno E professor', () => {
    const dois = usuario([PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR]);

    expect(ehAluno(dois)).toBe(true);
    expect(ehProfessor(dois)).toBe(true);
  });

  it('nega quando nao ha sessao', () => {
    expect(temPerfil(null, PerfilUsuario.ALUNO)).toBe(false);
    expect(ehProfessor(null)).toBe(false);
  });
});

describe('capacidades por papel na monitoria', () => {
  it('MONITOR declara disponibilidade, agenda e publica material', () => {
    const c = capacidades(
      contextoDaMonitoria(monitoria({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v1' })),
    );

    expect(c.declararDisponibilidade).toBe(true);
    expect(c.agendarAtendimento).toBe(true);
    expect(c.publicarMaterial).toBe(true);
    expect(c.administrarMonitoria).toBe(false);
    expect(c.habilitarMonitor).toBe(false);
  });

  it('MONITORADO agenda e se inscreve, mas NAO publica material (RN08)', () => {
    const c = capacidades(
      contextoDaMonitoria(
        monitoria({ meuPapel: PapelMonitoria.MONITORADO, meuParticipanteId: 'v2' }),
      ),
    );

    expect(c.agendarAtendimento).toBe(true);
    expect(c.inscreverEmSessao).toBe(true);
    expect(c.publicarMaterial).toBe(false);
    expect(c.declararDisponibilidade).toBe(false);
  });

  /**
   * O caso mais facil de errar na UI: professorResponsavel = 'NEGADO' no backend
   * para disponibilidade e agendamento. Ele administra, mas nao TEM agenda.
   */
  it('professor responsavel administra, mas NAO declara disponibilidade nem agenda', () => {
    const c = capacidades(contextoDaMonitoria(monitoria({ souResponsavel: true })));

    expect(c.administrarMonitoria).toBe(true);
    expect(c.habilitarMonitor).toBe(true);
    expect(c.publicarMaterial).toBe(true);
    expect(c.declararDisponibilidade).toBe(false);
    expect(c.agendarAtendimento).toBe(false);
  });

  it('quem nao participa nem responde pela monitoria nao ve nada', () => {
    const c = capacidades(contextoDaMonitoria(monitoria()));

    expect(c.verMonitoria).toBe(false);
    expect(c.verIndicadores).toBe(false);
    expect(c.agendarAtendimento).toBe(false);
  });
});

describe('capacidades por status da monitoria', () => {
  it('agendar exige monitoria ATIVA — PLANEJADA nao basta', () => {
    const planejada = capacidades(
      contextoDaMonitoria(
        monitoria({ status: StatusMonitoria.PLANEJADA, meuPapel: PapelMonitoria.MONITOR }),
      ),
    );

    expect(planejada.agendarAtendimento).toBe(false);
    // Declarar horário já é permitido antes de ativar.
    expect(planejada.declararDisponibilidade).toBe(true);
  });

  it.each([StatusMonitoria.ENCERRADA, StatusMonitoria.CANCELADA])(
    'monitoria %s nao aceita mais escrita, mas continua legivel (RN10)',
    (status) => {
      const c = capacidades(
        contextoDaMonitoria(monitoria({ status, meuPapel: PapelMonitoria.MONITOR })),
      );

      expect(c.verMonitoria).toBe(true);
      expect(c.declararDisponibilidade).toBe(false);
      expect(c.publicarMaterial).toBe(false);
      expect(c.agendarAtendimento).toBe(false);
    },
  );
});

describe('propriedade do recurso', () => {
  function material(extras: Partial<Material> = {}): Material {
    return {
      id: 'mat1',
      monitoriaId: 'm1',
      titulo: 'Lista',
      descricao: null,
      tipo: 'LINK',
      url: 'https://exemplo.test/a.pdf',
      autorUsuarioId: 'autor',
      publicadoEm: '2026-01-01T00:00:00.000Z',
      removidoEm: null,
      ...extras,
    };
  }

  it('um monitor NAO edita o material publicado por outro monitor', () => {
    const contexto = contextoDaMonitoria(
      monitoria({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v1' }),
    );

    expect(podeEditarMaterial(material(), usuario([PerfilUsuario.ALUNO], 'outro'), contexto)).toBe(
      false,
    );
  });

  it('o autor edita o proprio material', () => {
    const contexto = contextoDaMonitoria(monitoria({ meuPapel: PapelMonitoria.MONITOR }));

    expect(podeEditarMaterial(material(), usuario([PerfilUsuario.ALUNO], 'autor'), contexto)).toBe(
      true,
    );
  });

  it('o professor responsavel edita qualquer material da monitoria', () => {
    const contexto = contextoDaMonitoria(monitoria({ souResponsavel: true }));

    expect(
      podeEditarMaterial(material(), usuario([PerfilUsuario.PROFESSOR], 'prof'), contexto),
    ).toBe(true);
  });

  it('material removido nao e editavel por ninguem', () => {
    const contexto = contextoDaMonitoria(monitoria({ souResponsavel: true }));

    expect(
      podeEditarMaterial(
        material({ removidoEm: '2026-02-01T00:00:00.000Z' }),
        usuario([PerfilUsuario.PROFESSOR], 'prof'),
        contexto,
      ),
    ).toBe(false);
  });
});

describe('gestao do atendimento', () => {
  function atendimento(extras: Partial<Atendimento> = {}): Atendimento {
    return {
      id: 'a1',
      monitoriaId: 'm1',
      monitorParticipanteId: 'v-monitor',
      inicio: '2026-09-20T17:00:00.000Z',
      fim: '2026-09-20T18:00:00.000Z',
      vagas: 3,
      vagasOcupadas: 1,
      modalidade: ModalidadeAtendimento.REMOTO,
      local: null,
      assunto: 'Limites',
      status: StatusAtendimento.AGENDADO,
      origem: OrigemAtendimento.OFERTA_MONITOR,
      motivoCancelamento: null,
      aceitaInscricao: true,
      ...extras,
    };
  }

  it('o monitor DAQUELA sessao pode gerir', () => {
    const contexto = contextoDaMonitoria(
      monitoria({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-monitor' }),
    );

    expect(podeGerirAtendimento(atendimento(), contexto)).toBe(true);
  });

  it('OUTRO monitor da mesma monitoria nao pode gerir a sessao alheia', () => {
    const contexto = contextoDaMonitoria(
      monitoria({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-outro' }),
    );

    expect(podeGerirAtendimento(atendimento(), contexto)).toBe(false);
  });

  it('atendimento nao AGENDADO nao aceita mais gestao', () => {
    const contexto = contextoDaMonitoria(monitoria({ souResponsavel: true }));

    expect(
      podeGerirAtendimento(atendimento({ status: StatusAtendimento.REALIZADO }), contexto),
    ).toBe(false);
  });
});

describe('avaliacao (RN05 + RN06)', () => {
  const base: Atendimento = {
    id: 'a1',
    monitoriaId: 'm1',
    monitorParticipanteId: 'v-monitor',
    inicio: '2026-09-20T17:00:00.000Z',
    fim: '2026-09-20T18:00:00.000Z',
    vagas: 1,
    vagasOcupadas: 1,
    modalidade: ModalidadeAtendimento.PRESENCIAL,
    local: null,
    assunto: 'Limites',
    status: StatusAtendimento.REALIZADO,
    origem: OrigemAtendimento.SOLICITACAO_ALUNO,
    motivoCancelamento: null,
    aceitaInscricao: false,
  };

  it('prefere o `podeAvaliar` calculado pelo servidor', () => {
    const inscricao = {
      id: 'i1',
      participanteId: 'v1',
      status: StatusInscricao.PRESENTE,
      inscritoEm: '2026-09-01T00:00:00.000Z',
      souEu: true,
      jaAvaliei: false,
      podeAvaliar: false, // servidor diz que não pode
    };

    // Mesmo com status PRESENTE e atendimento REALIZADO, a decisão do servidor manda.
    expect(podeAvaliar(base, inscricao)).toBe(false);
  });

  it('cai no calculo local quando o servidor nao mandou a flag', () => {
    const presente = {
      id: 'i1',
      participanteId: 'v1',
      status: StatusInscricao.PRESENTE,
      inscritoEm: '2026-09-01T00:00:00.000Z',
      souEu: true,
      jaAvaliei: false,
    };

    expect(podeAvaliar(base, presente)).toBe(true);
  });

  it('quem faltou (AUSENTE) nao avalia', () => {
    const ausente = {
      id: 'i1',
      participanteId: 'v1',
      status: StatusInscricao.AUSENTE,
      inscritoEm: '2026-09-01T00:00:00.000Z',
      souEu: true,
      jaAvaliei: false,
    };

    expect(podeAvaliar(base, ausente)).toBe(false);
  });

  it('atendimento cancelado nao e avaliavel', () => {
    const inscricao = {
      id: 'i1',
      participanteId: 'v1',
      status: StatusInscricao.PRESENTE,
      inscritoEm: '2026-09-01T00:00:00.000Z',
      souEu: true,
      jaAvaliei: false,
    };

    expect(podeAvaliar({ ...base, status: StatusAtendimento.CANCELADO }, inscricao)).toBe(false);
  });

  it('inscricao de OUTRA pessoa nunca habilita avaliacao (RN05)', () => {
    const deOutro = {
      id: 'i2',
      participanteId: 'v9',
      status: StatusInscricao.PRESENTE,
      inscritoEm: '2026-09-01T00:00:00.000Z',
      podeAvaliar: true, // o backend nunca marcaria isto sem souEu
    };

    expect(podeAvaliar(base, deOutro)).toBe(false);
  });

  it('minhaInscricao encontra apenas a inscricao marcada com souEu', () => {
    const atendimento: Atendimento = {
      ...base,
      inscricoes: [
        { id: 'i1', participanteId: 'v9', status: StatusInscricao.PRESENTE, inscritoEm: 'x' },
        {
          id: 'i2',
          participanteId: 'v1',
          status: StatusInscricao.PRESENTE,
          inscritoEm: 'x',
          souEu: true,
        },
      ],
    };

    expect(minhaInscricao(atendimento)?.id).toBe('i2');
  });
});
