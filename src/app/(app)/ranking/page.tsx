import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { PainelGamificacao } from '@/features/gamificacao/components/painel-gamificacao';

export const metadata: Metadata = { title: 'Ranking' };

export default function PaginaRanking() {
  return (
    <>
      <CabecalhoPagina
        titulo="Ranking"
        descricao="Pontuação por atendimentos realizados, presença e avaliações recebidas."
      />

      <PainelGamificacao />
    </>
  );
}
