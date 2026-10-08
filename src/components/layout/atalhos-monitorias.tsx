'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ICONE_PAPEL } from '@/components/ui/badge';
import { rotas } from '@/config/rotas';
import { listarMinhasMonitorias } from '@/features/monitorias/api/monitorias.service';
import { classesCorDisciplina } from '@/lib/cores/disciplina';
import { ROTULO_PAPEL } from '@/lib/dominio/rotulos';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';

/**
 * 8, e nao 6, tambem por um motivo tecnico: com o mesmo filtro, a chave de
 * cache seria a mesma do painel inicial. A sidebar hidrata antes da pagina; se
 * os dados chegassem nesse intervalo, o painel hidrataria com numeros que o
 * servidor nao renderizou (erro de hidratacao). Chaves distintas isolam as duas.
 */
const LIMITE = 8;

/**
 * Atalhos para as monitorias da pessoa, na sidebar.
 *
 * E o que a pessoa mais abre depois do inicio — e e aqui que o papel
 * contextual fica visivel o tempo todo: cada linha mostra a cor da disciplina e
 * o icone do papel NAQUELA monitoria (monitor numa, monitorado noutra).
 *
 * Usa `GET /monitorias/minhas`, que ja traz `meuPapel` e `souResponsavel` e
 * filtra PLANEJADA + ATIVA — historico nao e atalho.
 */
export function AtalhosMonitorias({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();

  const consulta = useQuery({
    queryKey: chaves.monitorias.minhas({ limite: LIMITE }),
    queryFn: () => listarMinhasMonitorias({ limite: LIMITE }),
  });

  const monitorias = consulta.data?.dados ?? [];
  const total = consulta.data?.meta.total ?? 0;

  return (
    <section aria-labelledby="titulo-atalhos-monitorias" className="space-y-1">
      <div className="flex items-baseline justify-between px-3 pb-1">
        <h2
          id="titulo-atalhos-monitorias"
          className="text-xs font-semibold uppercase tracking-[0.08em] text-white/60"
        >
          Suas monitorias
        </h2>
        {total > LIMITE && (
          <Link
            href={rotas.monitorias}
            onClick={aoNavegar}
            className="rounded text-xs font-semibold text-white/80 hover:text-white focus-visible:ring-white focus-visible:ring-offset-primaria-forte"
          >
            Ver todas ({total})
          </Link>
        )}
      </div>

      {consulta.isPending && (
        <ul aria-busy aria-label="Carregando monitorias" className="space-y-1 px-3">
          {[0, 1, 2].map((indice) => (
            <li key={indice} className="flex h-9 items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
              <span className="h-3 flex-1 animate-pulse rounded bg-white/10" />
            </li>
          ))}
        </ul>
      )}

      {consulta.isError && (
        <p className="px-3 text-xs text-white/70">Não foi possível carregar suas monitorias.</p>
      )}

      {consulta.isSuccess && monitorias.length === 0 && (
        <p className="px-3 text-xs leading-5 text-white/70">
          Nenhuma monitoria em andamento.{' '}
          <Link
            href={`${rotas.monitorias}?aba=explorar`}
            onClick={aoNavegar}
            className="rounded font-semibold text-white underline underline-offset-2 focus-visible:ring-white focus-visible:ring-offset-primaria-forte"
          >
            Ver as abertas
          </Link>
        </p>
      )}

      {monitorias.length > 0 && (
        <ul className="space-y-0.5">
          {monitorias.map((monitoria) => {
            const href = rotas.monitoria(monitoria.id);
            const ativa = caminho === href || caminho.startsWith(`${href}/`);
            const cores = classesCorDisciplina(monitoria.disciplina?.codigo);
            const IconePapel = monitoria.meuPapel
              ? ICONE_PAPEL[monitoria.meuPapel]
              : monitoria.souResponsavel
                ? ICONE_PAPEL.responsavel
                : null;
            const rotuloPapel = monitoria.meuPapel
              ? ROTULO_PAPEL[monitoria.meuPapel]
              : monitoria.souResponsavel
                ? 'Professor responsável'
                : null;

            return (
              <li key={monitoria.id}>
                <Link
                  href={href}
                  onClick={aoNavegar}
                  aria-current={ativa ? 'page' : undefined}
                  className={cn(
                    'alvo-toque flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150',
                    'focus-visible:ring-white focus-visible:ring-offset-primaria-forte',
                    ativa
                      ? 'bg-white/[0.12] font-semibold text-white'
                      : 'text-white/80 hover:bg-white/[0.07] hover:text-white',
                  )}
                >
                  {/* Cor da disciplina: ajuda a achar sem ler; o nome ao lado identifica. */}
                  <span
                    aria-hidden
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-white/30',
                      cores.solido,
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {monitoria.disciplina?.nome ?? 'Monitoria'}
                  </span>
                  {IconePapel && rotuloPapel && (
                    <span title={rotuloPapel} className="shrink-0 text-white/60">
                      <IconePapel className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">{rotuloPapel}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
