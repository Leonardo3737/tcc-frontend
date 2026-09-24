import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { PainelGamificacao } from '@/features/gamificacao/components/painel-gamificacao';

export const metadata: Metadata = { title: 'Ranking' };

/**
 * Ranking.
 *
 * A descricao do cabecalho diz o RECORTE (todas as monitorias); o detalhamento
 * de como se pontua ficou no cartao "Como os pontos funcionam", ao lado da
 * lista — onde a pergunta de fato aparece.
 */
export default function PaginaRanking() {
  return (
    <>
      <CabecalhoPagina
        titulo="Ranking"
        descricao="Quem mais participou das monitorias, somando todas as disciplinas."
      />

      <PainelGamificacao />
    </>
  );
}
