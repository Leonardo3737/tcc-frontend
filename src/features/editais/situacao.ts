import { format } from 'date-fns';

import { noFuso } from '@/lib/datas/fuso';
import type { Edital } from '@/types/dominio';

/**
 * Por que o edital nao esta aceitando inscricao.
 *
 * ATENCAO ao limite desta funcao: quem decide se o edital esta ABERTO e o
 * backend, no campo derivado `aceitandoInscricoes`, avaliado no fuso da
 * instituicao. Nada aqui refaz essa conta — refazer significaria comparar
 * datas no fuso do navegador e produzir um botao habilitado em um dia em que a
 * API recusa.
 *
 * O que esta funcao faz e apenas ROTULAR o caso fechado: "ainda nao comecou" e
 * "ja terminou" sao coisas diferentes para quem le a tela, e o backend nao
 * distingue as duas. A comparacao e de strings 'AAAA-MM-DD', em que a ordem
 * lexicografica e a cronologica — mesmo criterio que o backend usa.
 */
export type SituacaoEdital = 'ABERTO' | 'NAO_INICIADO' | 'ENCERRADO' | 'EXCLUIDO';

/** Data de hoje no fuso da INSTITUICAO, no formato que o backend devolve. */
export function hojeNaInstituicao(fuso: string): string {
  return format(noFuso(new Date(), fuso), 'yyyy-MM-dd');
}

export function situacaoDoEdital(edital: Edital, hoje: string): SituacaoEdital {
  if (!edital.ativo) return 'EXCLUIDO';

  // A palavra final sobre "aberto" e do servidor, sempre.
  if (edital.aceitandoInscricoes) return 'ABERTO';

  return hoje < edital.inicioInscricoes ? 'NAO_INICIADO' : 'ENCERRADO';
}

export const ROTULO_SITUACAO: Record<SituacaoEdital, string> = {
  ABERTO: 'Inscrições abertas',
  NAO_INICIADO: 'Inscrições ainda não abriram',
  ENCERRADO: 'Inscrições encerradas',
  EXCLUIDO: 'Edital excluído',
};

export const TOM_SITUACAO: Record<SituacaoEdital, 'sucesso' | 'alerta' | 'neutro'> = {
  ABERTO: 'sucesso',
  NAO_INICIADO: 'alerta',
  ENCERRADO: 'neutro',
  EXCLUIDO: 'neutro',
};

/** "10/11/2026" a partir da data de calendario do backend, sem passar por fuso. */
export function formatarDataDeCalendario(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}
