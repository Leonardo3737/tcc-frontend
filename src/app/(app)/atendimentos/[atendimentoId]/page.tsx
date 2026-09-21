import type { Metadata } from 'next';

import { DetalheAtendimento } from '@/features/atendimentos/components/detalhe-atendimento';

export const metadata: Metadata = { title: 'Atendimento' };

export default async function PaginaDetalheAtendimento({
  params,
}: {
  params: Promise<{ atendimentoId: string }>;
}) {
  const { atendimentoId } = await params;
  return <DetalheAtendimento atendimentoId={atendimentoId} />;
}
