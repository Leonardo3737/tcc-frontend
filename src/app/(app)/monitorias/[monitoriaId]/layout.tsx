import type { Metadata } from 'next';

import { MonitoriaProvider } from '@/providers/monitoria-provider';
import { CabecalhoMonitoria } from '@/features/monitorias/components/cabecalho-monitoria';
import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { obterMonitoriaOuFalhar } from '@/features/monitorias/api/monitorias.servidor';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ monitoriaId: string }>;
}): Promise<Metadata> {
  const { monitoria } = await obterMonitoriaOuFalhar((await params).monitoriaId);

  return {
    title: monitoria?.disciplina
      ? `${monitoria.disciplina.codigo} · ${monitoria.periodo}`
      : 'Monitoria',
  };
}

/**
 * Layout de contexto da monitoria.
 *
 * É AQUI que o conceito central do domínio vira código: uma única chamada a
 * `GET /monitorias/:id` traz `meuPapel`, `souResponsavel` e `meuParticipanteId`,
 * e todas as abas herdam esse contexto. Sem isso, cada aba repetiria a mesma
 * requisição só para descobrir o que o usuário pode fazer ali.
 *
 * O papel é do usuário NESTA monitoria — na próxima ele pode ser outro.
 */
export default async function LayoutMonitoria({
  params,
  children,
}: {
  params: Promise<{ monitoriaId: string }>;
  children: React.ReactNode;
}) {
  const { monitoriaId } = await params;
  const { monitoria, erroDeAcesso } = await obterMonitoriaOuFalhar(monitoriaId);

  if (erroDeAcesso || !monitoria) {
    return (
      <SemAcesso
        titulo="Você não participa desta monitoria"
        descricao="O acervo, os atendimentos e os participantes só são visíveis para quem participa ou para o professor responsável (RN07)."
      />
    );
  }

  return (
    <MonitoriaProvider monitoria={monitoria}>
      <CabecalhoMonitoria />
      {children}
    </MonitoriaProvider>
  );
}
