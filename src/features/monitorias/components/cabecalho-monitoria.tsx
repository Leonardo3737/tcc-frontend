'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarRange, User } from 'lucide-react';

import { Badge, BadgePapel, BadgeStatusMonitoria } from '@/components/ui/badge';
import { AcoesStatusMonitoria } from './acoes-status-monitoria';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { rotas } from '@/config/rotas';
import { cn } from '@/lib/utils';
import { formatarDataSimples } from '@/lib/datas/fuso';

/**
 * Cabecalho + abas da monitoria.
 *
 * As abas sao NAVEGACAO REAL (links do App Router), nao um componente de tabs
 * com estado: cada aba precisa ter URL propria, para poder ser compartilhada,
 * recarregada e alcancada pelo botao "voltar".
 *
 * Quais abas aparecem depende das capacidades — que vem do papel do usuario
 * NESTA monitoria, resolvido uma vez no layout.
 */
export function CabecalhoMonitoria() {
  const { monitoria, capacidades, contexto } = useContextoMonitoria();
  const caminho = usePathname();

  const disciplina = monitoria.disciplina;

  const abas = [
    { rotulo: 'Visão geral', href: rotas.monitoria(monitoria.id), exato: true, visivel: true },
    {
      rotulo: 'Participantes',
      href: rotas.monitoriaParticipantes(monitoria.id),
      visivel: capacidades.verMonitoria,
    },
    {
      rotulo: 'Atendimentos',
      href: rotas.monitoriaAtendimentos(monitoria.id),
      visivel: capacidades.verMonitoria,
    },
    {
      // Só quem é MONITOR aqui tem agenda. O professor administra, mas não atende.
      rotulo: 'Disponibilidade',
      href: rotas.monitoriaDisponibilidades(monitoria.id),
      visivel: capacidades.verMonitoria,
    },
    {
      rotulo: 'Materiais',
      href: rotas.monitoriaMateriais(monitoria.id),
      visivel: capacidades.verMonitoria,
    },
    {
      rotulo: 'Indicadores',
      href: rotas.monitoriaIndicadores(monitoria.id),
      visivel: capacidades.verIndicadores,
    },
  ].filter((aba) => aba.visivel);

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="font-mono text-xs text-texto-suave">{disciplina?.codigo ?? '—'}</p>

          <h1 className="text-xl font-semibold text-texto sm:text-2xl">
            {disciplina?.nome ?? 'Monitoria'}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden />
              {monitoria.periodo}
            </span>

            {monitoria.professor && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" aria-hidden />
                {monitoria.professor.nome}
              </span>
            )}

            {monitoria.dataInicio && monitoria.dataFim && (
              <span>
                {formatarDataSimples(monitoria.dataInicio)} a{' '}
                {formatarDataSimples(monitoria.dataFim)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <BadgeStatusMonitoria status={monitoria.status} />

            {/*
              O papel é do usuário NESTA monitoria. A mesma pessoa carrega outro
              papel na monitoria ao lado — por isso ele aparece aqui, no contexto,
              e nunca junto do perfil da conta.
            */}
            {contexto.meuPapel && <BadgePapel papel={contexto.meuPapel} />}
            {contexto.souResponsavel && <Badge tom="primaria">Professor responsável</Badge>}
          </div>
        </div>

        <AcoesStatusMonitoria />
      </div>

      <nav aria-label="Seções da monitoria">
        <ul className="flex gap-1 overflow-x-auto border-b border-borda [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {abas.map((aba) => {
            const ativa = aba.exato ? caminho === aba.href : caminho.startsWith(aba.href);

            return (
              <li key={aba.href}>
                <Link
                  href={aba.href}
                  aria-current={ativa ? 'page' : undefined}
                  className={cn(
                    'alvo-toque block shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    ativa
                      ? 'border-primaria text-primaria'
                      : 'border-transparent text-texto-suave hover:text-texto',
                  )}
                >
                  {aba.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
