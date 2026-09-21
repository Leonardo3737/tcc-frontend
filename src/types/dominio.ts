/**
 * Espelho dos contratos do backend (backend/src/common/enums e os *-resposta.dto.ts).
 *
 * Escrito a mao, e nao gerado do OpenAPI, por uma razao pratica: o backend usa
 * `RespostaPaginada<T>` generica, que o Swagger do Nest so descreve via allOf
 * composto por decorator. O gerador produz tipos utilizaveis, mas menos legiveis
 * do que estes — e legibilidade importa num codigo que sera defendido em banca.
 * O `/docs-json` continua sendo a referencia para conferir divergencias.
 *
 * REGRA CRITICA DE INTEGRACAO
 * ---------------------------
 * `alunoId` / `professorId` sao o **id do USUARIO** (as tabelas `alunos` e
 * `professores` tem `usuario_id` como PK). Ja `participanteId` e o id do
 * **VINCULO** em `monitoria_participantes`. Sao coisas diferentes e trocar uma
 * pela outra e o erro de integracao mais provavel deste projeto.
 */

// ---------------------------------------------------------------------------
// Enums — valores fechados, iguais aos do backend
// ---------------------------------------------------------------------------

export const PerfilUsuario = {
  ALUNO: 'ALUNO',
  PROFESSOR: 'PROFESSOR',
} as const;
export type PerfilUsuario = (typeof PerfilUsuario)[keyof typeof PerfilUsuario];

/**
 * MONITOR e MONITORADO NAO sao perfis de usuario: sao papeis que um ALUNO assume
 * DENTRO de uma monitoria especifica. O mesmo aluno pode ser MONITOR em Calculo I
 * e MONITORADO em Banco de Dados. Ver docs/analise-e-arquitetura-frontend.md §2.
 */
export const PapelMonitoria = {
  MONITOR: 'MONITOR',
  MONITORADO: 'MONITORADO',
} as const;
export type PapelMonitoria = (typeof PapelMonitoria)[keyof typeof PapelMonitoria];

export const StatusMonitoria = {
  PLANEJADA: 'PLANEJADA',
  ATIVA: 'ATIVA',
  ENCERRADA: 'ENCERRADA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusMonitoria = (typeof StatusMonitoria)[keyof typeof StatusMonitoria];

export const StatusParticipacao = {
  ATIVO: 'ATIVO',
  ENCERRADO: 'ENCERRADO',
} as const;
export type StatusParticipacao = (typeof StatusParticipacao)[keyof typeof StatusParticipacao];

export const StatusAtendimento = {
  AGENDADO: 'AGENDADO',
  REALIZADO: 'REALIZADO',
  CANCELADO: 'CANCELADO',
} as const;
export type StatusAtendimento = (typeof StatusAtendimento)[keyof typeof StatusAtendimento];

export const StatusInscricao = {
  INSCRITO: 'INSCRITO',
  PRESENTE: 'PRESENTE',
  AUSENTE: 'AUSENTE',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusInscricao = (typeof StatusInscricao)[keyof typeof StatusInscricao];

export const OrigemAtendimento = {
  SOLICITACAO_ALUNO: 'SOLICITACAO_ALUNO',
  OFERTA_MONITOR: 'OFERTA_MONITOR',
} as const;
export type OrigemAtendimento = (typeof OrigemAtendimento)[keyof typeof OrigemAtendimento];

export const ModalidadeAtendimento = {
  PRESENCIAL: 'PRESENCIAL',
  REMOTO: 'REMOTO',
} as const;
export type ModalidadeAtendimento =
  (typeof ModalidadeAtendimento)[keyof typeof ModalidadeAtendimento];

/** ARQUIVO existe no schema do banco, mas nenhum endpoint o produz: nao ha upload. */
export const TipoMaterial = {
  LINK: 'LINK',
  ARQUIVO: 'ARQUIVO',
} as const;
export type TipoMaterial = (typeof TipoMaterial)[keyof typeof TipoMaterial];

export const TipoPontuacao = {
  ATENDIMENTO_REALIZADO: 'ATENDIMENTO_REALIZADO',
  PARTICIPACAO_ATENDIMENTO: 'PARTICIPACAO_ATENDIMENTO',
  AVALIACAO_RECEBIDA: 'AVALIACAO_RECEBIDA',
} as const;
export type TipoPontuacao = (typeof TipoPontuacao)[keyof typeof TipoPontuacao];

/** 0 = domingo ... 6 = sabado (compativel com Date.getDay() e EXTRACT(DOW)). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export interface DadosAluno {
  matricula: string;
  curso: string | null;
}

export interface DadosProfessor {
  identificacaoFuncional: string | null;
  departamento: string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  /** Derivado da existencia de linha em alunos/professores. Pode conter os dois. */
  perfis: PerfilUsuario[];
  aluno?: DadosAluno;
  professor?: DadosProfessor;
  criadoEm: string;
}

export interface RespostaLogin {
  tokenDeAcesso: string;
  tipoToken: string;
  /** @deprecated string de configuracao ("8h"). Use expiraEmSegundos. */
  expiraEm: string;
  expiraEmSegundos: number;
  expiraEmIso: string;
  usuario: Usuario;
}

// ---------------------------------------------------------------------------
// Configuracao da instituicao (GET /api/configuracao — publico)
// ---------------------------------------------------------------------------

export interface LimitesAgendamento {
  duracaoMinimaMinutos: number;
  duracaoMaximaMinutos: number;
  antecedenciaMinimaMinutos: number;
  cancelamentoAntecedenciaMinutos: number;
}

export interface ConfiguracaoInstituicao {
  /** Fuso em que as disponibilidades sao interpretadas pelo backend. */
  fusoHorario: string;
  agendamento: LimitesAgendamento;
}

// ---------------------------------------------------------------------------
// Disciplinas e monitorias
// ---------------------------------------------------------------------------

export interface Disciplina {
  id: string;
  codigo: string;
  nome: string;
  ativa: boolean;
}

export interface ResumoDisciplina {
  id: string;
  codigo: string;
  nome: string;
}

export interface ResumoProfessor {
  id: string;
  nome: string;
}

export interface Monitoria {
  id: string;
  disciplina?: ResumoDisciplina;
  professor?: ResumoProfessor;
  ano: number;
  semestre: number;
  periodo: string;
  descricao: string | null;
  status: StatusMonitoria;
  dataInicio: string | null;
  dataFim: string | null;
  /** Papel do usuario autenticado NESTA monitoria. null = nao participa. */
  meuPapel?: PapelMonitoria | null;
  souResponsavel?: boolean;
  /** Id do VINCULO do usuario nesta monitoria. Evita varrer /participantes. */
  meuParticipanteId?: string | null;
}

export interface Participante {
  /** Id do VINCULO, nao do aluno. */
  id: string;
  monitoriaId: string;
  /** Id do USUARIO do aluno. */
  alunoId: string;
  nomeAluno?: string;
  matricula?: string;
  papel: PapelMonitoria;
  status: StatusParticipacao;
  ingressouEm: string;
  encerradoEm: string | null;
}

// ---------------------------------------------------------------------------
// Disponibilidades
// ---------------------------------------------------------------------------

export interface Disponibilidade {
  id: string;
  participanteId: string;
  monitoriaId: string;
  diaSemana: DiaSemana;
  diaSemanaNome: string;
  /** "HH:MM:SS" na resposta; o envio aceita "HH:MM". */
  horaInicio: string;
  horaFim: string;
  ativa: boolean;
  nomeMonitor?: string;
}

// ---------------------------------------------------------------------------
// Atendimentos
// ---------------------------------------------------------------------------

export interface Inscricao {
  id: string;
  participanteId: string;
  nomeAluno?: string;
  status: StatusInscricao;
  inscritoEm: string;
  /** Presentes APENAS na inscricao do proprio requisitante (preserva o anonimato). */
  souEu?: boolean;
  jaAvaliei?: boolean;
  podeAvaliar?: boolean;
}

export interface EventoHistorico {
  statusAnterior: StatusAtendimento | null;
  statusNovo: StatusAtendimento;
  motivo: string | null;
  alteradoPorUsuarioId: string;
  alteradoPorNome?: string;
  criadoEm: string;
}

export interface ResumoMonitoriaDoAtendimento {
  id: string;
  periodo: string;
  codigoDisciplina: string;
  nomeDisciplina: string;
}

export interface Atendimento {
  id: string;
  monitoriaId: string;
  monitoria?: ResumoMonitoriaDoAtendimento;
  monitorParticipanteId: string;
  nomeMonitor?: string;
  inicio: string;
  fim: string;
  vagas: number;
  vagasOcupadas: number;
  modalidade: ModalidadeAtendimento;
  local: string | null;
  assunto: string;
  status: StatusAtendimento;
  origem: OrigemAtendimento;
  motivoCancelamento: string | null;
  /** Calculado no relogio do SERVIDOR. Nao recalcular no cliente. */
  aceitaInscricao: boolean;
  inscricoes?: Inscricao[];
  historico?: EventoHistorico[];
}

// ---------------------------------------------------------------------------
// Avaliacoes, materiais, gamificacao, analytics
// ---------------------------------------------------------------------------

export interface Avaliacao {
  id: string;
  atendimentoParticipanteId: string;
  atendimentoId?: string;
  nota: number;
  comentario: string | null;
  criadoEm: string;
}

export interface ResumoAvaliacoes {
  total: number;
  media: number | null;
  avaliacoes: Avaliacao[];
}

export interface Material {
  id: string;
  monitoriaId: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoMaterial;
  url: string | null;
  autorUsuarioId: string;
  autorNome?: string;
  publicadoEm: string;
  removidoEm: string | null;
}

export interface PosicaoRanking {
  posicao: number;
  usuarioId: string;
  nome: string;
  pontos: number;
  eventos: number;
}

export interface EventoPontuacao {
  tipo: TipoPontuacao;
  pontos: number;
  monitoriaId: string;
  referenciaId: string;
  criadoEm: string;
}

export interface ResumoPontuacao {
  usuarioId: string;
  total: number;
  porTipo: Record<string, number>;
  ultimosEventos: EventoPontuacao[];
}

export interface ContagemPorStatus {
  total: number;
  porStatus: Record<string, number>;
}

export interface IndicadoresPlataforma {
  monitorias: ContagemPorStatus;
  atendimentos: ContagemPorStatus;
  alunosAtendidos: number;
  monitoresAtivos: number;
  monitoradosAtivos: number;
  totalAvaliacoes: number;
  mediaAvaliacoes: number | null;
  pontosDistribuidos: number;
}

export interface IndicadoresMonitoria {
  monitoriaId: string;
  disciplina: string;
  periodo: string;
  status: string;
  atendimentos: ContagemPorStatus;
  monitoresAtivos: number;
  monitoradosAtivos: number;
  alunosAtendidos: number;
  taxaParticipacao: number;
  ausencias: number;
  totalAvaliacoes: number;
  mediaAvaliacoes: number | null;
  materiaisPublicados: number;
}

export interface AtividadeMonitor {
  participanteId: string;
  usuarioId: string;
  nome: string;
  atendimentosRealizados: number;
  atendimentosCancelados: number;
  atendimentosAgendados: number;
  alunosAtendidos: number;
  totalAvaliacoes: number;
  mediaAvaliacoes: number | null;
  disponibilidadesAtivas: number;
}
