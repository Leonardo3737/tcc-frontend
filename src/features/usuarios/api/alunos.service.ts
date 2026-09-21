import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type { Usuario } from '@/types/dominio';

/**
 * Busca de alunos — restrita a PROFESSOR.
 *
 * Existe para o fluxo da RN01: o professor precisa LOCALIZAR alguem para
 * habilitar como monitor. `semVinculoAtivoNaMonitoria` remove da lista quem ja
 * participa, evitando um 409 de RN09 que era previsivel.
 */
export interface FiltroAlunos {
  busca?: string;
  semVinculoAtivoNaMonitoria?: string;
  pagina?: number;
  limite?: number;
}

export function listarAlunos(filtro: FiltroAlunos): Promise<RespostaPaginada<Usuario>> {
  return apiCliente.get<RespostaPaginada<Usuario>>('/alunos', { query: { ...filtro } });
}
