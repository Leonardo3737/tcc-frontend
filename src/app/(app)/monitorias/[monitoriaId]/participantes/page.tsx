import { Suspense } from 'react';

import { SkeletonLista } from '@/components/ui/skeleton';
import { PainelParticipantes } from '@/features/monitorias/components/painel-participantes';

export default function PaginaParticipantes() {
  // O painel lê filtros da URL com useSearchParams.
  return (
    <Suspense fallback={<SkeletonLista itens={3} />}>
      <PainelParticipantes />
    </Suspense>
  );
}
