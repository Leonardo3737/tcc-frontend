import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type { Material } from '@/types/dominio';

/**
 * Acervo da monitoria.
 *
 * LIMITACAO CONHECIDA DA API: nao existe upload de arquivo. Todo material e um
 * LINK (`tipo = LINK` + `url` http/https). As colunas `arquivo_*` e o valor
 * `ARQUIVO` existem no schema do banco, mas nenhum endpoint os produz e nao ha
 * StorageService no backend. A UI, portanto, NAO oferece upload — oferecer e
 * falhar seria pior do que a ausencia declarada.
 *
 * Materiais vivem sob a MONITORIA, nao sob a disciplina: e o que torna RN07
 * (so participantes acessam) verificavel, porque participacao so existe no
 * contexto de uma monitoria.
 */

export interface FiltroMateriais {
  incluirRemovidos?: boolean;
  pagina?: number;
  limite?: number;
}

export function listarMateriais(
  monitoriaId: string,
  filtro: FiltroMateriais = {},
): Promise<RespostaPaginada<Material>> {
  return apiCliente.get<RespostaPaginada<Material>>(`/monitorias/${monitoriaId}/materiais`, {
    query: { ...filtro },
  });
}

export interface DadosMaterial {
  titulo: string;
  descricao?: string;
  /** Somente http/https — o backend recusa `javascript:` e `data:` (risco de XSS). */
  url: string;
}

export function publicarMaterial(
  monitoriaId: string,
  dados: DadosMaterial,
): Promise<Material> {
  return apiCliente.post<Material>(`/monitorias/${monitoriaId}/materiais`, dados);
}

export function atualizarMaterial(
  monitoriaId: string,
  materialId: string,
  dados: Partial<DadosMaterial>,
): Promise<Material> {
  return apiCliente.patch<Material>(`/monitorias/${monitoriaId}/materiais/${materialId}`, dados);
}

/**
 * Remoção lógica (RN10): o material sai das listagens, mas o registro permanece
 * com data e autor da remoção. Não existe DELETE.
 */
export function removerMaterial(monitoriaId: string, materialId: string): Promise<Material> {
  return apiCliente.post<Material>(`/monitorias/${monitoriaId}/materiais/${materialId}/remover`);
}
