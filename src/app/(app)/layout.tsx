import { AppShell } from '@/components/layout/app-shell';
import { SessaoProvider } from '@/providers/sessao-provider';
import { exigirSessao } from '@/lib/auth/sessao';
import { buscarConfiguracao } from '@/features/configuracao/api/configuracao.service';
import { TelaServidorIndisponivel } from '@/components/comum/servidor-indisponivel';
import { ehServidorIndisponivel } from '@/lib/api/erros';

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
function carregar() {
  return Promise.all([exigirSessao(), buscarConfiguracao()]);
}

export default async function LayoutAutenticado({ children }: { children: React.ReactNode }) {
  let dados: Awaited<ReturnType<typeof carregar>>;

  try {
    dados = await carregar();
  } catch (erro) {
    /**
     * API desligada por inatividade (ou ainda acordando): em vez de deixar a
     * excecao subir ate a tela generica do Next ("Application error"), mostra a
     * explicacao com recarga automatica. A decisao e tomada AQUI, no servidor,
     * porque em producao o navegador nao recebe a causa do erro.
     *
     * Qualquer outro erro — inclusive o `redirect()` de sessao ausente, que
     * tambem chega como excecao — segue o caminho normal.
     */
    if (ehServidorIndisponivel(erro)) return <TelaServidorIndisponivel />;
    throw erro;
  }

  const [usuario, configuracao] = dados;

  return (
    <SessaoProvider usuario={usuario} configuracao={configuracao}>
      <AppShell>{children}</AppShell>
    </SessaoProvider>
  );
}
