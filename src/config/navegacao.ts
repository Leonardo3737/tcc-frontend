import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import { rotas } from './rotas';
import { PerfilUsuario } from '@/types/dominio';

/**
 * Itens do menu principal.
 *
 * Cada item declara os perfis que o enxergam, em vez de o componente do menu
 * decidir com ifs. `perfis` ausente = visivel para qualquer autenticado.
 *
 * IMPORTANTE: um usuario pode acumular ALUNO e PROFESSOR (o schema do backend
 * permite; D-12 segue em aberto). Por isso o menu e a UNIAO das secoes dos dois
 * perfis, e nao um seletor de "modo" — obrigar a pessoa a alternar contexto
 * seria inventar uma separacao que o dominio nao tem.
 */
export interface ItemNavegacao {
  rotulo: string;
  href: string;
  icone: LucideIcon;
  perfis?: PerfilUsuario[];
  /** Marca o item como ativo tambem nas sub-rotas (ex.: /monitorias/:id). */
  casaPrefixo?: boolean;
}

export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  {
    rotulo: 'Início',
    href: rotas.inicio,
    icone: LayoutDashboard,
  },
  {
    rotulo: 'Monitorias',
    href: rotas.monitorias,
    icone: GraduationCap,
    casaPrefixo: true,
  },
  {
    rotulo: 'Meus atendimentos',
    href: rotas.atendimentos,
    icone: CalendarDays,
    casaPrefixo: true,
  },
  {
    rotulo: 'Disciplinas',
    href: rotas.disciplinas,
    icone: BookOpen,
    // Só PROFESSOR cria e edita o catálogo (backend: @Perfis(PROFESSOR)).
    perfis: [PerfilUsuario.PROFESSOR],
  },
  {
    rotulo: 'Ranking',
    href: rotas.ranking,
    icone: Trophy,
  },
];

export function itensVisiveis(perfis: PerfilUsuario[]): ItemNavegacao[] {
  return ITENS_NAVEGACAO.filter(
    (item) => !item.perfis || item.perfis.some((perfil) => perfis.includes(perfil)),
  );
}

/** Item ativo: casa exato ou por prefixo, conforme a declaracao do item. */
export function estaAtivo(item: ItemNavegacao, caminhoAtual: string): boolean {
  if (item.casaPrefixo) {
    return caminhoAtual === item.href || caminhoAtual.startsWith(`${item.href}/`);
  }

  return caminhoAtual === item.href;
}
