import 'server-only';

import { notFound } from 'next/navigation';

import { apiServidor } from '@/lib/api/servidor';
import { ApiError } from '@/lib/api/erros';
import type { Monitoria } from '@/types/dominio';

/**
 * Leitura da monitoria no SERVIDOR, para o layout de contexto.
 *
 * Buscar aqui (e nao no cliente) evita o flash de "carregando" no cabecalho a
 * cada troca de aba, e permite decidir 404 / sem acesso antes de renderizar.
 */
export async function obterMonitoriaOuFalhar(
  monitoriaId: string,
): Promise<
  { monitoria: Monitoria; erroDeAcesso: false } | { monitoria: null; erroDeAcesso: true }
> {
  try {
    const monitoria = await apiServidor.get<Monitoria>(`/monitorias/${monitoriaId}`, {
      cache: 'no-store',
    });

    return { monitoria, erroDeAcesso: false };
  } catch (erro) {
    if (erro instanceof ApiError) {
      if (erro.ehNaoEncontrado) notFound();

      /**
       * 403 nao vira notFound: o recurso existe, o usuario e que nao participa.
       * Dizer "nao encontrado" seria mentira e atrapalharia quem tenta entender
       * por que perdeu o acesso (um vinculo encerrado, por exemplo).
       */
      if (erro.ehProibido) return { monitoria: null, erroDeAcesso: true };
    }

    throw erro;
  }
}
