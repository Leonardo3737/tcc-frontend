import { AppShell } from '@/components/layout/app-shell';
import { SessaoProvider } from '@/providers/sessao-provider';
import { exigirSessao } from '@/lib/auth/sessao';
import { buscarConfiguracao } from '@/features/configuracao/api/configuracao.service';

/**
 * Layout da area autenticada.
 *
 * Aqui a sessao e CONFIRMADA de verdade: `exigirSessao` chama
 * `GET /usuarios/eu`, e o backend recarrega o usuario do banco a cada
 * requisicao. O middleware so viu que existia um cookie — ele nao valida token
 * nem sabe se a conta foi desativada.
 *
 * As duas buscas correm em paralelo: a configuracao nao depende da sessao, e
 * encadea-las adicionaria uma ida ao servidor em toda navegacao.
 */
export default async function LayoutAutenticado({ children }: { children: React.ReactNode }) {
  const [usuario, configuracao] = await Promise.all([exigirSessao(), buscarConfiguracao()]);

  return (
    <SessaoProvider usuario={usuario} configuracao={configuracao}>
      <AppShell>{children}</AppShell>
    </SessaoProvider>
  );
}
