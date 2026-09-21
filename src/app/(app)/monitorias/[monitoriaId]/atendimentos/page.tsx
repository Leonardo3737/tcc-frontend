import { Suspense } from 'react';

import { SkeletonLista } from '@/components/ui/skeleton';
import { PainelAtendimentosMonitoria } from '@/features/atendimentos/components/painel-atendimentos-monitoria';

export default function PaginaAtendimentosMonitoria() {
  // O painel lê filtros da URL com useSearchParams.
  return (
    <Suspense fallback={<SkeletonLista itens={3} />}>
      <PainelAtendimentosMonitoria />
    </Suspense>
  );
}
