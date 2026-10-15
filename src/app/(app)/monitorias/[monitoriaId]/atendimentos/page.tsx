import { Suspense } from 'react';

import { PainelAtendimentosMonitoria } from '@/features/atendimentos/components/painel-atendimentos-monitoria';
import { SkeletonAgendaPorDia } from '@/features/atendimentos/components/agenda-por-dia';

export default function PaginaAtendimentosMonitoria() {
  // O painel lê filtros da URL com useSearchParams.
  return (
    <Suspense fallback={<SkeletonAgendaPorDia />}>
      <PainelAtendimentosMonitoria />
    </Suspense>
  );
}
