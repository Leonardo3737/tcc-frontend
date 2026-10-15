import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { noFuso } from './fuso';

/**
 * Datas relativas ("hoje, 14:00", "amanha", "qui, 25/09", "em 2 h").
 *
 * "Hoje" e "amanha" sao datas de CALENDARIO no fuso da instituicao — nao "nas
 * proximas 24 horas" nem o dia do navegador. Um atendimento as 00:30 de
 * Sao Paulo visto por alguem em Manaus as 23:40 local e "amanha", porque e
 * amanha na instituicao, que e onde a agenda vive (AD-F04).
 *
 * Funcoes puras, com `agora` explicito: testaveis sem relogio falso e sem
 * depender de quando o componente renderizou.
 */

/** "2026-09-25" do instante, no fuso dado. */
export function chaveDia(instante: string | Date, fuso: string): string {
  return format(noFuso(instante, fuso), 'yyyy-MM-dd');
}

/** Diferenca em dias de calendario entre duas chaves "yyyy-MM-dd". */
function diasEntreChaves(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  const utcDe = Date.UTC(a1!, m1! - 1, d1!);
  const utcAte = Date.UTC(a2!, m2! - 1, d2!);
  return Math.round((utcAte - utcDe) / 86_400_000);
}

/** Quantos dias de calendario (no fuso) separam `agora` de `instante`. */
export function diasDeCalendario(instante: string | Date, agora: Date, fuso: string): number {
  return diasEntreChaves(chaveDia(agora, fuso), chaveDia(instante, fuso));
}

/**
 * "em 45 min", "em 2 h", "ha 20 min", "agora".
 * So faz sentido para distancias curtas; acima de 12 h a data diz mais.
 */
export function distanciaCurta(instante: string | Date, agora: Date): string | null {
  const alvo = typeof instante === 'string' ? new Date(instante) : instante;
  const minutos = Math.round((alvo.getTime() - agora.getTime()) / 60_000);
  const absoluto = Math.abs(minutos);

  if (absoluto > 12 * 60) return null;
  if (absoluto < 1) return 'agora';

  const texto = absoluto < 60 ? `${absoluto} min` : `${Math.round(absoluto / 60)} h`;
  return minutos > 0 ? `em ${texto}` : `há ${texto}`;
}

/**
 * Dia abreviado. Lista propria porque o formato curto do date-fns em pt-BR
 * escreve "sab", sem acento.
 */
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

export function diaSemanaCurto(instante: string | Date, fuso: string): string {
  return DIAS_CURTOS[noFuso(instante, fuso).getDay()] ?? '';
}

export interface OpcoesDataRelativa {
  /** Inclui o horario ("hoje, 14:00"). Padrao: true. */
  comHora?: boolean;
}

/**
 * Descricao curta e relativa de um instante.
 *
 *  - mesmo dia:          "hoje, 14:00"
 *  - vizinhos:           "amanhã, 09:30" / "ontem, 16:00"
 *  - proximos 6 dias:    "qui, 25/09, 14:00"
 *  - mesmo ano:          "25/09, 14:00"
 *  - outro ano:          "25/09/2025"
 */
export function descreverDataRelativa(
  instante: string | Date,
  agora: Date,
  fuso: string,
  { comHora = true }: OpcoesDataRelativa = {},
): string {
  const dias = diasDeCalendario(instante, agora, fuso);
  const local = noFuso(instante, fuso);
  const hora = format(local, 'HH:mm');
  const complemento = comHora ? `, ${hora}` : '';

  if (dias === 0) return `hoje${complemento}`;
  if (dias === 1) return `amanhã${complemento}`;
  if (dias === -1) return `ontem${complemento}`;

  if (dias > 1 && dias < 7) {
    return `${diaSemanaCurto(instante, fuso)}, ${format(local, 'dd/MM')}${complemento}`;
  }

  const mesmoAno = format(local, 'yyyy') === format(noFuso(agora, fuso), 'yyyy');
  if (!mesmoAno) return format(local, 'dd/MM/yyyy');

  return `${format(local, 'dd/MM')}${complemento}`;
}

/**
 * Cabecalho de grupo da agenda: "Hoje", "Amanhã", "Quinta, 25 de setembro".
 * O ano so aparece quando nao e o corrente.
 */
export function rotuloDia(instante: string | Date, agora: Date, fuso: string): string {
  const dias = diasDeCalendario(instante, agora, fuso);

  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  if (dias === -1) return 'Ontem';

  const local = noFuso(instante, fuso);
  const mesmoAno = format(local, 'yyyy') === format(noFuso(agora, fuso), 'yyyy');
  const texto = format(local, mesmoAno ? "EEEE, d 'de' MMMM" : "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  // "quinta-feira, 25 de setembro" -> "Quinta, 25 de setembro"
  const semFeira = texto.replace('-feira', '');
  return semFeira.charAt(0).toUpperCase() + semFeira.slice(1);
}

export interface GrupoDoDia<T> {
  /** "2026-10-15", no fuso da instituicao. */
  chave: string;
  itens: T[];
}

/**
 * Agrupa por dia de CALENDARIO no fuso da instituicao, preservando a ordem
 * recebida.
 *
 * A ordem vem do servidor (`ordenarPor=inicio`, asc ou desc) e e mantida tanto
 * entre os dias quanto dentro de cada dia: reordenar aqui so a pagina atual
 * produziria uma ordem falsa (AD-F08). Agrupar por `toDateString()` do
 * navegador colocaria um atendimento das 22h de Sao Paulo no dia seguinte para
 * quem esta em outro fuso.
 */
export function agruparPorDia<T extends { inicio: string }>(
  itens: T[],
  fuso: string,
): GrupoDoDia<T>[] {
  const grupos: GrupoDoDia<T>[] = [];
  const porChave = new Map<string, GrupoDoDia<T>>();

  for (const item of itens) {
    const chave = chaveDia(item.inicio, fuso);
    let grupo = porChave.get(chave);

    if (!grupo) {
      grupo = { chave, itens: [] };
      porChave.set(chave, grupo);
      grupos.push(grupo);
    }

    grupo.itens.push(item);
  }

  return grupos;
}

/** "qua, 15/10" — complemento de cabecalho quando o rotulo e relativo ("Hoje"). */
export function dataCurta(instante: string | Date, fuso: string): string {
  return `${diaSemanaCurto(instante, fuso)}, ${format(noFuso(instante, fuso), 'dd/MM')}`;
}
