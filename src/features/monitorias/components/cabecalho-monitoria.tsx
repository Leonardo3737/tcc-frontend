'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BadgePapel, BadgeResponsavel, BadgeStatusMonitoria } from '@/components/ui/badge';
import { SeloDisciplina } from '@/components/comum/selo-disciplina';
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <SeloDisciplina
            codigo={disciplina?.codigo}
            nome={disciplina?.nome}
            tamanho="lg"
            className="hidden sm:inline-flex"
          />

          <div className="min-w-0 space-y-1.5">
            <p className="text-xs text-texto-suave">
              <span className="font-semibold">{disciplina?.codigo ?? '—'}</span> ·{' '}
              {monitoria.periodo}
              {monitoria.professor && <> · {monitoria.professor.nome}</>}
              {monitoria.dataInicio && monitoria.dataFim && (
                <>
                  {' '}
                  · {formatarDataSimples(monitoria.dataInicio)} a{' '}
                  {formatarDataSimples(monitoria.dataFim)}
                </>
              )}
            </p>

            <h1 className="font-titulo text-[1.375rem] font-semibold leading-7 tracking-tight text-texto sm:text-titulo-pagina">
              {disciplina?.nome ?? 'Monitoria'}
            </h1>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <BadgeStatusMonitoria status={monitoria.status} />

              {/*
                O papel é do usuário NESTA monitoria. A mesma pessoa carrega outro
                papel na monitoria ao lado — por isso ele aparece aqui, no contexto,
                e nunca junto do perfil da conta.
              */}
              {contexto.meuPapel && <BadgePapel papel={contexto.meuPapel} />}
              {contexto.souResponsavel && <BadgeResponsavel />}
            </div>
          </div>
        </div>

        <AcoesStatusMonitoria />
      </div>

      <nav aria-label="Seções da monitoria">
        <ul className="rolagem-discreta flex gap-1 overflow-x-auto border-b border-borda">
          {abas.map((aba) => {
            const ativa = aba.exato ? caminho === aba.href : caminho.startsWith(aba.href);

            return (
              <li key={aba.href}>
                <Link
                  href={aba.href}
                  aria-current={ativa ? 'page' : undefined}
                  className={cn(
                    'alvo-toque -mb-px block shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors duration-150',
                    ativa
                      ? 'border-primaria text-texto'
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
