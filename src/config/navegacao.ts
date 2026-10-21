import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScrollText,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { PerfilUsuario } from '@/types/dominio';
import { rotas } from './rotas';

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
  grupo: GrupoNavegacao;
}

/**
 * Grupos do menu, na ordem em que aparecem.
 *
 * Separar "o meu dia a dia" de "o que eu administro" deixa o menu escaneavel
 * mesmo quando a pessoa acumula ALUNO e PROFESSOR — e um grupo sem itens
 * visiveis simplesmente nao e renderizado.
 */
export const GRUPOS_NAVEGACAO = [
  { chave: 'rotina', rotulo: null },
  { chave: 'gestao', rotulo: 'Gestão' },
  { chave: 'comunidade', rotulo: 'Comunidade' },
] as const;

export type GrupoNavegacao = (typeof GRUPOS_NAVEGACAO)[number]['chave'];

export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  {
    rotulo: 'Início',
    href: rotas.inicio,
    icone: LayoutDashboard,
    grupo: 'rotina',
  },
  {
    rotulo: 'Monitorias',
    href: rotas.monitorias,
    icone: GraduationCap,
    casaPrefixo: true,
    grupo: 'rotina',
  },
  {
    rotulo: 'Meus atendimentos',
    href: rotas.atendimentos,
    icone: CalendarDays,
    casaPrefixo: true,
    grupo: 'rotina',
  },
  {
    rotulo: 'Editais de monitoria',
    href: rotas.editais,
    icone: ScrollText,
    // Gerenciar edital e consultar candidaturas sao restritos a PROFESSOR no
    // backend (@Perfis(PROFESSOR) em /editais e em /inscricoes). A inscricao em
    // si e publica, mas ela nao vive no menu: quem se candidata nao tem conta.
    perfis: [PerfilUsuario.PROFESSOR],
    casaPrefixo: true,
    grupo: 'gestao',
  },
  {
    rotulo: 'Cursos',
    href: rotas.cursos,
    icone: Library,
    // Só PROFESSOR cria e edita o catálogo (backend: @Perfis(PROFESSOR)).
    perfis: [PerfilUsuario.PROFESSOR],
    grupo: 'gestao',
  },
  {
    rotulo: 'Disciplinas',
    href: rotas.disciplinas,
    icone: BookOpen,
    // Só PROFESSOR cria e edita o catálogo (backend: @Perfis(PROFESSOR)).
    perfis: [PerfilUsuario.PROFESSOR],
    grupo: 'gestao',
  },
  {
    rotulo: 'Pessoas',
    href: rotas.pessoas,
    icone: Users,
    // Nao ha auto-cadastro: so PROFESSOR cria contas (POST /alunos e
    // POST /professores) e lista alunos (GET /alunos).
    perfis: [PerfilUsuario.PROFESSOR],
    casaPrefixo: true,
    grupo: 'gestao',
  },
  {
    rotulo: 'Ranking',
    href: rotas.ranking,
    icone: Trophy,
    grupo: 'comunidade',
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
