import 'server-only';

import { apiPublica } from '@/lib/api/servidor';
import type { ConfiguracaoInstituicao } from '@/types/dominio';
import { CONFIGURACAO_PADRAO, normalizarConfiguracao } from '../normalizar';

/**
 * Parametros operacionais da instituicao (GET /api/configuracao — rota publica).
 *
 * Buscar isto do servidor evita duplicar dois valores que ja existem no backend:
 *  - o FUSO usado para validar atendimento contra a disponibilidade semanal;
 *  - os LIMITES de duracao e antecedencia do agendamento.
 *
 * Hardcodear qualquer um dos dois cria a divergencia silenciosa classica: o
 * formulario aceita, o backend recusa, e a mensagem nao explica o motivo.
 */

/**
 * Cacheado por 1 hora: sao parametros de configuracao do servidor, que so mudam
 * em deploy. Sem isso, toda navegacao pagaria uma requisicao extra.
 *
 * A contrapartida do cache e o que motivou `normalizarConfiguracao`: um campo
 * novo no backend leva ate uma hora para aparecer, e nesse meio-tempo a
 * resposta servida tem a forma ANTIGA. Para antecipar isso num deploy, basta
 * revalidar a tag `configuracao`.
 */
export async function buscarConfiguracao(): Promise<ConfiguracaoInstituicao> {
  try {
    const resposta = await apiPublica.get<unknown>('/configuracao', {
      next: { revalidate: 3600, tags: ['configuracao'] },
    });

    return normalizarConfiguracao(resposta);
  } catch {
    /**
     * Sem a configuracao, a aplicacao inteira ficaria inutilizavel por causa de
     * um endpoint auxiliar.
     *
     * O risco aceito e conhecido: se a instituicao mudar o fuso e este fallback
     * for usado, agendamentos podem ser recusados. Por isso a excecao e apenas
     * absorvida aqui, e nao em toda chamada.
     */
    return CONFIGURACAO_PADRAO;
  }
}
