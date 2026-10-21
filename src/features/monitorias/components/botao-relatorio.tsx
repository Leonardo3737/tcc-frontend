'use client';

import { FileText } from 'lucide-react';

import { classesBotao } from '@/components/ui/button';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { urlDoRelatorio } from '../api/monitorias.service';

/**
 * Download do relatorio final da monitoria (.docx).
 *
 * So aparece para o MONITOR, espelhando a rota — que exige
 * `{ papeis: [MONITOR], professorResponsavel: 'NEGADO' }`. O professor
 * responsavel e negado de proposito: o relatorio e documento PESSOAL do
 * monitor, que o professor assina como orientador; com varios monitores,
 * "o relatorio do professor" nem seria definido.
 *
 * Como em toda a aplicacao, esconder o botao e UX — quem autoriza e o backend,
 * que devolve 403 a quem nao for monitor com vinculo ativo (AD-F02).
 *
 * E um `<a>` comum, e isso importa: o corpo da resposta e binario, e passar
 * por `apiCliente` (que interpreta JSON) corromperia o arquivo.
 */
export function BotaoRelatorioMonitoria() {
  const { monitoria, capacidades } = useContextoMonitoria();

  if (!capacidades.baixarRelatorioDaMonitoria) return null;

  return (
    <a
      href={urlDoRelatorio(monitoria.id)}
      className={classesBotao('secundaria', 'md')}
      title="O documento vem com seus atendimentos e sua carga horária já preenchidos."
    >
      <FileText className="mr-2 h-4 w-4" aria-hidden />
      Baixar relatório
    </a>
  );
}
