import 'server-only';

import { apiPublica } from '@/lib/api/servidor';
import { FUSO_PADRAO } from '@/lib/datas/fuso';
import type { ConfiguracaoInstituicao } from '@/types/dominio';

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
 */
export async function buscarConfiguracao(): Promise<ConfiguracaoInstituicao> {
  try {
    return await apiPublica.get<ConfiguracaoInstituicao>('/configuracao', {
      next: { revalidate: 3600, tags: ['configuracao'] },
    });
  } catch {
    /**
     * Fallback conservador: sem a configuracao, a aplicacao inteira ficaria
     * inutilizavel por causa de um endpoint auxiliar. Os valores repetem os
     * defaults do backend (TIMEZONE_INSTITUICAO e as constantes de D-15).
     *
     * O risco aceito e conhecido: se a instituicao mudar o fuso e este fallback
     * for usado, agendamentos podem ser recusados. Por isso a excecao e apenas
     * absorvida aqui, e nao em toda chamada.
     */
    return {
      fusoHorario: FUSO_PADRAO,
      agendamento: {
        duracaoMinimaMinutos: 15,
        duracaoMaximaMinutos: 240,
        antecedenciaMinimaMinutos: 0,
        cancelamentoAntecedenciaMinutos: 0,
      },
    };
  }
}
