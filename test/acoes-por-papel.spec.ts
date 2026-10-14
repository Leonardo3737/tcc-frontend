import { describe, expect, it } from 'vitest';

import {
  contextoDaMonitoria,
  podeCriarMonitoria,
  podeDesistirDaInscricao,
  podeGerirAtendimento,
  podeParticiparDaMonitoria,
  podeRegistrarRealizacao,
  podeSeInscreverEmAtendimento,
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
  type Inscricao,
  type Monitoria,
  type Usuario,
} from '@/types/dominio';

/**
 * Botoes por papel — o espelho das regras que o backend aplica no SERVICE
 * (onde o guard nao alcanca): `exigirMonitorOuProfessor` para realizar,
 * cancelar e reagendar; `exigirPapel(MONITORADO)` para inscrever e desistir.
 */

function usuario(perfis: PerfilUsuario[]): Usuario {
  return {
    id: 'u1',
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

function inscricao(extras: Partial<Inscricao> = {}): Inscricao {
  return {
    id: 'i1',
    participanteId: 'v-monitorado',
    status: StatusInscricao.INSCRITO,
    inscritoEm: '2026-09-01T12:00:00.000Z',
    souEu: true,
    ...extras,
  };
}

function atendimento(extras: Partial<Atendimento> = {}): Atendimento {
  return {
    id: 'a1',
    monitoriaId: 'm1',
    monitorParticipanteId: 'v-monitor',
    inicio: '2026-09-20T17:00:00.000Z',
    fim: '2026-09-20T18:00:00.000Z',
    vagas: 3,
    vagasOcupadas: 1,
    modalidade: ModalidadeAtendimento.PRESENCIAL,
    local: 'Sala B12',
    assunto: 'Limites',
    status: StatusAtendimento.AGENDADO,
    origem: OrigemAtendimento.OFERTA_MONITOR,
    motivoCancelamento: null,
    aceitaInscricao: true,
    inscricoes: [],
    ...extras,
  };
}

const MONITOR_DA_SESSAO = contextoDaMonitoria(
  monitoria({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-monitor' }),
);
const OUTRO_MONITOR = contextoDaMonitoria(
  monitoria({ meuPapel: PapelMonitoria.MONITOR, meuParticipanteId: 'v-outro' }),
);
const MONITORADO = contextoDaMonitoria(
  monitoria({ meuPapel: PapelMonitoria.MONITORADO, meuParticipanteId: 'v-monitorado' }),
);
const PROFESSOR_RESPONSAVEL = contextoDaMonitoria(monitoria({ souResponsavel: true }));

describe('cancelar e reagendar', () => {
  it('monitor da sessao e professor responsavel podem', () => {
    expect(podeGerirAtendimento(atendimento(), MONITOR_DA_SESSAO)).toBe(true);
    expect(podeGerirAtendimento(atendimento(), PROFESSOR_RESPONSAVEL)).toBe(true);
  });

  it('monitorado NAO pode, nem quando foi ele quem solicitou a sessao', () => {
    const solicitada = atendimento({
      origem: OrigemAtendimento.SOLICITACAO_ALUNO,
      vagas: 1,
      inscricoes: [inscricao()],
    });

    expect(podeGerirAtendimento(solicitada, MONITORADO)).toBe(false);
    // O caminho dele e desistir — e isso, sim, ele pode.
    expect(podeDesistirDaInscricao(solicitada)).toBe(true);
  });

  it('outro monitor da mesma monitoria nao gere a sessao alheia', () => {
    expect(podeGerirAtendimento(atendimento(), OUTRO_MONITOR)).toBe(false);
  });
});

describe('registrar realizacao', () => {
  const agoraDepois = new Date('2026-09-20T17:30:00.000Z');
  const agoraAntes = new Date('2026-09-20T16:00:00.000Z');

  it('so quem gere e so depois do inicio', () => {
    expect(podeRegistrarRealizacao(atendimento(), MONITOR_DA_SESSAO, agoraDepois)).toBe(true);
    expect(podeRegistrarRealizacao(atendimento(), MONITOR_DA_SESSAO, agoraAntes)).toBe(false);
    expect(podeRegistrarRealizacao(atendimento(), MONITORADO, agoraDepois)).toBe(false);
  });
});

describe('inscrever-se e desistir', () => {
  it('so MONITORADO se inscreve — monitor e professor nao', () => {
    expect(podeSeInscreverEmAtendimento(atendimento(), MONITORADO)).toBe(true);
    expect(podeSeInscreverEmAtendimento(atendimento(), MONITOR_DA_SESSAO)).toBe(false);
    expect(podeSeInscreverEmAtendimento(atendimento(), OUTRO_MONITOR)).toBe(false);
    expect(podeSeInscreverEmAtendimento(atendimento(), PROFESSOR_RESPONSAVEL)).toBe(false);
  });

  it('respeita aceitaInscricao do servidor (lotado ou ja iniciado)', () => {
    expect(podeSeInscreverEmAtendimento(atendimento({ aceitaInscricao: false }), MONITORADO)).toBe(
      false,
    );
  });

  it('quem ja esta inscrito nao se inscreve de novo; quem desistiu pode voltar', () => {
    expect(
      podeSeInscreverEmAtendimento(atendimento({ inscricoes: [inscricao()] }), MONITORADO),
    ).toBe(false);
    expect(
      podeSeInscreverEmAtendimento(
        atendimento({ inscricoes: [inscricao({ status: StatusInscricao.CANCELADA })] }),
        MONITORADO,
      ),
    ).toBe(true);
  });

  it('desistir exige inscricao ativa e atendimento AGENDADO', () => {
    expect(podeDesistirDaInscricao(atendimento({ inscricoes: [inscricao()] }))).toBe(true);
    expect(podeDesistirDaInscricao(atendimento())).toBe(false);
    expect(
      podeDesistirDaInscricao(
        atendimento({ status: StatusAtendimento.REALIZADO, inscricoes: [inscricao()] }),
      ),
    ).toBe(false);
  });
});

describe('monitoria', () => {
  it('participar: aluno sem vinculo, em monitoria aberta', () => {
    const naoParticipa = contextoDaMonitoria(monitoria());
    expect(podeParticiparDaMonitoria(usuario([PerfilUsuario.ALUNO]), naoParticipa)).toBe(true);
    expect(podeParticiparDaMonitoria(usuario([PerfilUsuario.PROFESSOR]), naoParticipa)).toBe(false);
    expect(podeParticiparDaMonitoria(usuario([PerfilUsuario.ALUNO]), MONITORADO)).toBe(false);
    expect(
      podeParticiparDaMonitoria(
        usuario([PerfilUsuario.ALUNO]),
        contextoDaMonitoria(monitoria({ status: StatusMonitoria.ENCERRADA })),
      ),
    ).toBe(false);
    // PLANEJADA aceita participantes (so nao aceita agendamento).
    expect(
      podeParticiparDaMonitoria(
        usuario([PerfilUsuario.ALUNO]),
        contextoDaMonitoria(monitoria({ status: StatusMonitoria.PLANEJADA })),
      ),
    ).toBe(true);
  });

  it('criar monitoria: so PROFESSOR', () => {
    expect(podeCriarMonitoria(usuario([PerfilUsuario.PROFESSOR]))).toBe(true);
    expect(podeCriarMonitoria(usuario([PerfilUsuario.ALUNO]))).toBe(false);
  });
});
