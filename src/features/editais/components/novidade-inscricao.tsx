'use client';

import { useSessao } from '@/providers/sessao-provider';
import { useEditaisAbertos } from '../hooks/use-editais-abertos';
import { ChamadaDeInscricao } from './chamada-de-inscricao';

/**
 * Destaque de inscricao em edital no painel inicial.
 *
 * Duas condicoes, e as duas sao de exibicao — nao de seguranca. A tela publica
 * de inscricao e aberta a qualquer um por decisao de dominio; o que se decide
 * aqui e apenas a quem vale a pena ANUNCIAR:
 *
 *  - so para ALUNO. Professor nao se candidata a monitor, e um destaque de
 *    "inscreva-se" no painel de quem conduz o processo seletivo seria ruido —
 *    pior, sugeriria uma acao que nao e dele;
 *  - so quando ha edital aberto, com o recorte vindo do servidor.
 *
 * Nao renderiza nada enquanto a consulta corre: um esqueleto que some na
 * maioria das visitas (o caso comum e nao haver edital aberto) faria o painel
 * pular a cada carregamento.
 */
export function NovidadeInscricao() {
  const { ehAluno } = useSessao();
  const { proximo } = useEditaisAbertos();

  if (!ehAluno || !proximo) return null;

  return <ChamadaDeInscricao edital={proximo} />;
}
