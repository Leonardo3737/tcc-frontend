import { Suspense } from 'react';
import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { SkeletonLista } from '@/components/ui/skeleton';
import { SkeletonCartaoMonitoria } from '@/features/monitorias/components/cartao-monitoria';
import { PainelMonitorias } from '@/features/monitorias/components/painel-monitorias';

export const metadata: Metadata = { title: 'Monitorias' };

export default function PaginaMonitorias() {
  return (
    <>
      <CabecalhoPagina
        titulo="Monitorias"
        descricao="As monitorias em que você participa e o catálogo de ofertas."
      />

      {/* O painel lê filtros da URL com useSearchParams. */}
      <Suspense fallback={<SkeletonLista itens={3} item={SkeletonCartaoMonitoria} />}>
        <PainelMonitorias />
      </Suspense>
    </>
  );
}
