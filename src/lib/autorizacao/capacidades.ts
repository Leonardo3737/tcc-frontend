import {
  PapelMonitoria,
  PerfilUsuario,
  StatusAtendimento,
  StatusInscricao,
  StatusMonitoria,
} from '@/types/dominio';
import type { Atendimento, Inscricao, Material, Monitoria, Usuario } from '@/types/dominio';

/**
 * ESPELHO DAS REGRAS DE AUTORIZACAO DO BACKEND.
 *
 * ------------------------------------------------------------------
 * ISTO E UX, NAO SEGURANCA.
 * ------------------------------------------------------------------
 * A autorizacao real acontece no NestJS: guards globais (JwtAuthGuard,
 * PerfilGuard), o ParticipacaoGuard contextual e as constraints do PostgreSQL
 * continuam valendo mesmo que este arquivo inteiro seja adulterado no navegador.
 * O objetivo aqui e nao oferecer ao usuario uma acao que ele receberia 403 ao
 * tentar.
 *
 * Consequencia pratica: se um 403 chegar na tela, e sintoma de divergencia entre
 * este arquivo e o backend — vale investigar, nao esconder.
 *
 * Por que tudo em um modulo so: as regras do dominio sao contextuais (dependem
 * do papel do usuario NAQUELA monitoria). Espalhadas em ifs pelos componentes,
 * uma mudanca de regra viraria uma cacada. Aqui, e uma linha.
 */

// ---------------------------------------------------------------------------
// Perfil global (espelha o PerfilGuard)
// ---------------------------------------------------------------------------

/**
 * Um usuario pode acumular ALUNO e PROFESSOR (D-12 em aberto no backend, o
 * schema permite). Por isso a checagem e sempre "inclui", nunca "e igual a".
 */
export function temPerfil(usuario: Usuario | null, ...perfis: PerfilUsuario[]): boolean {
  if (!usuario) return false;
  return perfis.some((perfil) => usuario.perfis.includes(perfil));
}

export const ehAluno = (usuario: Usuario | null) => temPerfil(usuario, PerfilUsuario.ALUNO);
export const ehProfessor = (usuario: Usuario | null) => temPerfil(usuario, PerfilUsuario.PROFESSOR);

// ---------------------------------------------------------------------------
// Contexto de monitoria (espelha o ParticipacaoGuard)
// ---------------------------------------------------------------------------

export interface ContextoMonitoria {
  meuPapel: PapelMonitoria | null;
  souResponsavel: boolean;
  status: StatusMonitoria;
  meuParticipanteId: string | null;
}

export function contextoDaMonitoria(monitoria: Monitoria): ContextoMonitoria {
  return {
    meuPapel: monitoria.meuPapel ?? null,
    souResponsavel: monitoria.souResponsavel ?? false,
    status: monitoria.status,
    meuParticipanteId: monitoria.meuParticipanteId ?? null,
  };
}

export interface Capacidades {
  verMonitoria: boolean;
  administrarMonitoria: boolean;
  habilitarMonitor: boolean;
  inscreverMonitorado: boolean;
  declararDisponibilidade: boolean;
  agendarAtendimento: boolean;
  inscreverEmSessao: boolean;
  publicarMaterial: boolean;
  verIndicadores: boolean;
  verDesempenhoMonitores: boolean;
  sairDaMonitoria: boolean;
}

/**
 * Traduz o contexto em booleanos nomeados.
 *
 * Mapa das politicas do decorator @ExigeParticipacao do backend:
 *  - PERMITIDO -> professor responsavel passa (leitura, materiais);
 *  - EXIGIDO   -> so ele passa (habilitar participante, desempenho por monitor);
 *  - NEGADO    -> ele NAO passa (disponibilidade, agendar atendimento).
 *
 * O caso NEGADO e o mais facil de errar na UI: o professor administra a
 * monitoria, mas nao TEM agenda — nao existe vinculo dele que ocupe horario.
 */
export function capacidades(contexto: ContextoMonitoria): Capacidades {
  const ativa = contexto.status === StatusMonitoria.ATIVA;
  const aberta =
    contexto.status !== StatusMonitoria.ENCERRADA && contexto.status !== StatusMonitoria.CANCELADA;

  const monitor = contexto.meuPapel === PapelMonitoria.MONITOR;
  const monitorado = contexto.meuPapel === PapelMonitoria.MONITORADO;
  const participa = monitor || monitorado;
  const responsavel = contexto.souResponsavel;

  return {
    // RN07 — leitura do conteudo da monitoria
    verMonitoria: participa || responsavel,

    administrarMonitoria: responsavel,

    // RN01 — habilitar monitor: professorResponsavel EXIGIDO
    habilitarMonitor: responsavel && aberta,
    inscreverMonitorado: responsavel && aberta,

    // professorResponsavel NEGADO: o professor nao tem agenda de monitor
    declararDisponibilidade: monitor && aberta,
    agendarAtendimento: participa && ativa,

    inscreverEmSessao: monitorado && ativa,

    // RN08 — publicam professor responsavel e MONITOR; MONITORADO nao
    publicarMaterial: (monitor || responsavel) && aberta,

    verIndicadores: participa || responsavel,
    verDesempenhoMonitores: responsavel,

    sairDaMonitoria: participa,
  };
}

// ---------------------------------------------------------------------------
// Predicados por recurso
//
// Regras que dependem do ITEM, nao so do contexto. No backend elas vivem no
// service (o guard nao alcanca propriedade), e aqui seguem a mesma divisao.
// ---------------------------------------------------------------------------

/** Um monitor nao edita o material publicado por outro monitor. */
export function podeEditarMaterial(
  material: Material,
  usuario: Usuario | null,
  contexto: ContextoMonitoria,
): boolean {
  if (material.removidoEm) return false;
  if (contexto.souResponsavel) return true;
  return Boolean(usuario && material.autorUsuarioId === usuario.id);
}

/** Realizar, cancelar e reagendar: monitor DAQUELA sessao ou o responsavel. */
export function podeGerirAtendimento(
  atendimento: Atendimento,
  contexto: ContextoMonitoria,
): boolean {
  if (atendimento.status !== StatusAtendimento.AGENDADO) return false;
  if (contexto.souResponsavel) return true;

  return (
    contexto.meuPapel === PapelMonitoria.MONITOR &&
    contexto.meuParticipanteId === atendimento.monitorParticipanteId
  );
}

/**
 * RN05 + RN06 — avaliar exige REALIZADO e presenca confirmada.
 *
 * O backend ja devolve `podeAvaliar` calculado na propria inscricao do
 * requisitante; preferimos esse valor sempre que ele vier. O calculo local
 * existe so como defesa para respostas antigas em cache.
 */
export function podeAvaliar(atendimento: Atendimento, inscricao: Inscricao | undefined): boolean {
  if (!inscricao?.souEu) return false;
  if (typeof inscricao.podeAvaliar === 'boolean') return inscricao.podeAvaliar;

  return (
    atendimento.status === StatusAtendimento.REALIZADO &&
    inscricao.status === StatusInscricao.PRESENTE &&
    !inscricao.jaAvaliei
  );
}

/** A inscricao do proprio usuario dentro de um atendimento, se houver. */
export function minhaInscricao(atendimento: Atendimento): Inscricao | undefined {
  return atendimento.inscricoes?.find((inscricao) => inscricao.souEu);
}
