import { format } from 'date-fns';

import { instanteDeDataHoraLocal, noFuso } from './fuso';

/**
 * Expansao de uma sessao semanal em ocorrencias concretas.
 *
 * NAO soma `7 * 86_400_000` ao instante. Isso parece equivalente e nao e: numa
 * virada de horario de verao a semana tem 167 ou 169 horas, e a soma em
 * milissegundos deslocaria a sessao em uma hora — jogando-a para fora da faixa
 * de disponibilidade declarada, que e expressa em hora LOCAL. O backend
 * recusaria com "fora da disponibilidade" e ninguem entenderia o motivo.
 *
 * O caminho correto e o mesmo do resto do projeto (AD-F04): voltar para a
 * data/hora local da instituicao, andar em DIAS DE CALENDARIO, e remontar o
 * instante. O Brasil nao usa horario de verao hoje, mas a regra ja mudou duas
 * vezes e o custo de fazer certo aqui e uma funcao.
 */
export interface Ocorrencia {
  inicio: string;
  fim: string;
}

/** Soma dias a uma data "yyyy-MM-dd" sem passar por fuso nenhum. */
function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const deslocado = new Date(Date.UTC(ano!, mes! - 1, dia! + dias));

  const a = deslocado.getUTCFullYear();
  const m = String(deslocado.getUTCMonth() + 1).padStart(2, '0');
  const d = String(deslocado.getUTCDate()).padStart(2, '0');

  return `${a}-${m}-${d}`;
}

/**
 * `repeticoes` conta a sessao original: 1 devolve so ela, 8 devolve oito
 * semanas. Ocorrencias que nao puderem ser remontadas sao descartadas em
 * silencio — na pratica so aconteceria com entrada invalida, que o formulario
 * ja barra antes.
 *
 * A sessao precisa comecar e terminar no mesmo dia local, que e o que o backend
 * exige de qualquer forma (a validacao de janela compara `::date` dos dois).
 */
export function ocorrenciasSemanais(
  inicio: string,
  fim: string,
  repeticoes: number,
  fuso: string,
): Ocorrencia[] {
  const inicioLocal = noFuso(inicio, fuso);
  const fimLocal = noFuso(fim, fuso);

  const dataBase = format(inicioLocal, 'yyyy-MM-dd');
  const horaInicio = format(inicioLocal, 'HH:mm');
  const horaFim = format(fimLocal, 'HH:mm');

  const ocorrencias: Ocorrencia[] = [];

  for (let semana = 0; semana < repeticoes; semana += 1) {
    const data = somarDias(dataBase, semana * 7);

    const inicioDaSemana = instanteDeDataHoraLocal(data, horaInicio, fuso);
    const fimDaSemana = instanteDeDataHoraLocal(data, horaFim, fuso);

    if (inicioDaSemana && fimDaSemana) {
      ocorrencias.push({ inicio: inicioDaSemana, fim: fimDaSemana });
    }
  }

  return ocorrencias;
}
