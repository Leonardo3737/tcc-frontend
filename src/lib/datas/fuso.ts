import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Datas e fuso horario.
 *
 * A ARMADILHA DE INTEGRACAO MAIS PROVAVEL DESTE PROJETO mora aqui.
 *
 * O backend guarda atendimentos em TIMESTAMPTZ (instante absoluto), mas a
 * disponibilidade do monitor e declarada em hora LOCAL da instituicao
 * ("terca, 14h"). Ao agendar, o PostgreSQL converte o instante para o fuso da
 * instituicao (AT TIME ZONE) e verifica se ele cabe na faixa declarada.
 *
 * Se o frontend montar o instante a partir do fuso do NAVEGADOR, um usuario em
 * outro fuso recebe "horario fora da disponibilidade" sem entender o motivo.
 * Por isso o fuso vem de GET /api/configuracao e todas as conversoes passam por
 * estas funcoes — nunca por `new Date(...)` solto num componente.
 */

/**
 * Usado apenas como ultimo recurso, antes de a configuracao chegar do servidor.
 * O valor real vem sempre de GET /api/configuracao.
 */
export const FUSO_PADRAO = 'America/Sao_Paulo';

const NOMES_DIA_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

export function nomeDoDiaSemana(dia: number): string {
  return NOMES_DIA_SEMANA[dia] ?? '';
}

/** Converte um instante absoluto para o fuso da instituicao. */
export function noFuso(instante: string | Date, fuso: string): TZDate {
  const data = typeof instante === 'string' ? new Date(instante) : instante;
  return new TZDate(data, fuso);
}

/**
 * Monta um instante ISO a partir de data e hora LOCAIS da instituicao.
 *
 * E o caminho correto para transformar o que o usuario digitou em um formulario
 * ("2026-09-01", "14:00") no `inicio`/`fim` que o backend espera. Note que o
 * fuso do navegador nao participa da conta em momento nenhum.
 */
export function instanteDeDataHoraLocal(data: string, hora: string, fuso: string): string | null {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);

  if (
    ano === undefined ||
    mes === undefined ||
    dia === undefined ||
    horas === undefined ||
    minutos === undefined ||
    Number.isNaN(ano) ||
    Number.isNaN(mes) ||
    Number.isNaN(dia) ||
    Number.isNaN(horas) ||
    Number.isNaN(minutos)
  ) {
    return null;
  }

  const local = new TZDate(ano, mes - 1, dia, horas, minutos, 0, 0, fuso);

  if (Number.isNaN(local.getTime())) return null;

  return new Date(local.getTime()).toISOString();
}

// ---------------------------------------------------------------------------
// Formatacao para exibicao — sempre no fuso da instituicao
// ---------------------------------------------------------------------------

export function formatarDataHora(instante: string | Date, fuso: string): string {
  return format(noFuso(instante, fuso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatarData(instante: string | Date, fuso: string): string {
  return format(noFuso(instante, fuso), 'dd/MM/yyyy', { locale: ptBR });
}

export function formatarHora(instante: string | Date, fuso: string): string {
  return format(noFuso(instante, fuso), 'HH:mm', { locale: ptBR });
}

/** "terça-feira, 01/09 às 14:00" — cabecalho de item de agenda. */
export function formatarDataHoraExtensa(instante: string | Date, fuso: string): string {
  return format(noFuso(instante, fuso), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR });
}

/** "14:00 – 16:00" a partir do intervalo do atendimento. */
export function formatarIntervalo(inicio: string | Date, fim: string | Date, fuso: string): string {
  return `${formatarHora(inicio, fuso)} – ${formatarHora(fim, fuso)}`;
}

/** "14:00" a partir do "14:00:00" que o backend devolve em disponibilidades. */
export function formatarHoraSimples(hora: string): string {
  return hora.slice(0, 5);
}

/** Data de vigencia ("2026-08-01"), que o backend trata como date puro. */
export function formatarDataSimples(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

/**
 * Duracao acumulada, a partir de MINUTOS.
 *
 * O backend manda minutos como unidade canonica justamente porque hora decimal
 * nao representa 1h20 sem dizima — e "21,08 h" nao e um numero que alguem leia
 * como tempo trabalhado. Aqui ele vira "21 h 05", que e como se preenche um
 * relatorio de carga horaria.
 */
export function formatarDuracaoEmMinutos(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '0 h';

  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);

  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;

  return `${horas} h ${String(resto).padStart(2, '0')}`;
}
