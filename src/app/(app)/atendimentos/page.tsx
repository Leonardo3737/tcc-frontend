import { Suspense } from 'react';
import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { SkeletonLista } from '@/components/ui/skeleton';
import { SkeletonCartaoAtendimento } from '@/features/atendimentos/components/cartao-atendimento';
import { PainelMeusAtendimentos } from '@/features/atendimentos/components/painel-meus-atendimentos';

export const metadata: Metadata = { title: 'Meus atendimentos' };

export default function PaginaMeusAtendimentos() {
  return (
    <>
      <CabecalhoPagina
        titulo="Meus atendimentos"
        descricao="Sua agenda como monitor ou monitorado, em todas as monitorias."
      />

      {/* O painel lê filtros da URL com useSearchParams. */}
      <Suspense fallback={<SkeletonLista itens={3} item={SkeletonCartaoAtendimento} />}>
        <PainelMeusAtendimentos />
      </Suspense>
    </>
  );
}
