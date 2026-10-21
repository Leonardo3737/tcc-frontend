'use client';

import { AlertTriangle, CheckCircle2, Trophy } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ResumoPorDisciplina } from '@/types/dominio';

/**
 * Panorama do edital por disciplina, que tambem e o seletor.
 *
 * A selecao de monitor acontece POR DISCIPLINA — um edital com sete
 * disciplinas tem sete aprovados, nao um. Por isso a disciplina e o eixo
 * principal desta tela, e nao mais um filtro entre outros.
 *
 * Cada cartao e um botao que liga `?disciplina=`; "Todas" limpa. A lista
 * abaixo nao muda de natureza — continua com busca, ordenacao e paginacao do
 * servidor —, o cartao so define um recorte que ja existia.
 *
 * Por que cartoes e nao abas: abas nao cabem quando o edital tem dez
 * disciplinas, e escondem justamente o que este endpoint existe para mostrar —
 * onde ha poucos candidatos, onde ninguem tem nota. Aqui o panorama fica
 * visivel o tempo todo.
 */
export function FaixaDeDisciplinas({
  resumo,
  carregando,
  erro,
  disciplinaId,
  totalGeral,
  aoEscolher,
}: {
  resumo: ResumoPorDisciplina[];
  carregando: boolean;
  erro: boolean;
  /** Vazio = "Todas". */
  disciplinaId: string;
  /** Total do recorte atual, para o cartão "Todas". Vem do `meta` da listagem. */
  totalGeral: number;
  aoEscolher: (disciplinaId: string) => void;
}) {
  if (carregando) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy aria-label="Carregando disciplinas">
        {[0, 1, 2, 3].map((indice) => (
          <Skeleton key={indice} className="h-[5.5rem] w-44 shrink-0" />
        ))}
      </div>
    );
  }

  /**
   * Sem o panorama a tela nao quebra: a lista plana continua inteira, com os
   * filtros de sempre. Por isso a faixa simplesmente nao aparece, em vez de
   * exibir um erro que nao impede nada.
   */
  if (erro || resumo.length === 0) return null;

  /**
   * Ordem alfabetica por codigo, estavel.
   *
   * Reordenar no cliente e correto AQUI, e so aqui: o resumo nao e paginado —
   * ele e limitado pelo catalogo de disciplinas, nao pelo numero de
   * candidatos. Na listagem de candidatos a ordenacao continua sendo do
   * servidor, porque ali o "maior" pode estar na proxima pagina.
   */
  const ordenado = [...resumo].sort((a, b) =>
    a.disciplina.codigo.localeCompare(b.disciplina.codigo, 'pt-BR'),
  );

  return (
    <div>
      <h3 className='font-semibold text-[1.2rem] mb-2'>Disciplinas</h3>
      {/*
        `group` de rádio: são opções mutuamente exclusivas de um mesmo recorte,
        não botões soltos. É isso que faz o leitor de tela anunciar "2 de 5".
      */}
      <div
        role="radiogroup"
        aria-label="Filtrar candidaturas por disciplina"
        className="flex gap-3 overflow-x-auto pb-1 rolagem-discreta sm:flex-wrap sm:overflow-visible"
      >
        <Cartao
          titulo="Todas"
          selecionado={disciplinaId === ''}
          aoEscolher={() => aoEscolher('')}
        >
          <p className="text-sm text-texto-suave">
            {totalGeral === 1 ? '1 candidatura' : `${totalGeral} candidaturas`}
          </p>
          <p className="text-xs text-texto-suave">
            {ordenado.length === 1 ? '1 disciplina' : `${ordenado.length} disciplinas`}
          </p>
        </Cartao>

        {ordenado.map((linha) => (
          <Cartao
            key={linha.disciplina.id}
            titulo={linha.disciplina.codigo}
            subtitulo={linha.disciplina.nome}
            selecionado={disciplinaId === linha.disciplina.id}
            aoEscolher={() => aoEscolher(linha.disciplina.id)}
          >
            <p className="text-sm text-texto-suave">
              {linha.totalInscricoes === 1 ? '1 candidatura' : `${linha.totalInscricoes} candidaturas`}
            </p>

            {/*
              A melhor média é o número que a banca procura. Nula quando
              ninguém tem nota — e aí não há o que ranquear, não "média zero".
            */}
            {linha.melhorMedia === null ? (
              <p className="text-xs text-texto-suave">Nenhuma média calculada</p>
            ) : (
              <p className="flex items-center gap-1 text-xs font-semibold text-acento-forte">
                <Trophy className="h-3 w-3 shrink-0" aria-hidden />
                melhor {linha.melhorMedia.toFixed(2).replace('.', ',')}
              </p>
            )}

            {/*
              "7 candidaturas" com 2 sem nota é uma leitura muito diferente de
              "7 candidaturas". Só aparece quando há o que avisar.
            */}
            {linha.semMedia > 0 && (
              <p className="flex items-center gap-1 text-xs text-texto-suave">
                <AlertTriangle className="h-3 w-3 shrink-0 text-alerta" aria-hidden />
                {linha.semMedia === 1 ? '1 sem nota' : `${linha.semMedia} sem nota`}
              </p>
            )}

            <EstadoDaAprovacao linha={linha} />
          </Cartao>
        ))}
      </div>

      {/*
        O edital não declara as disciplinas que oferece, então esta faixa é o
        que CHEGOU, não o que foi ofertado. Dizer isso evita a leitura de que
        uma disciplina ausente não faz parte do edital.
      */}
      <p className="mt-2 text-xs text-texto-suave">
        Apenas disciplinas que receberam candidatura aparecem aqui.
      </p>
    </div>
  );
}

/**
 * Em que pe esta a aprovacao daquela disciplina.
 *
 * Tres estados, e o do meio e o que importa: `monitoriaId` preenchido com zero
 * monitores e uma aprovacao que parou no meio — a operacao nao e atomica, e
 * pode ter criado a monitoria sem chegar a habilitar o candidato. Marcar isso
 * como "resolvido" esconderia exatamente o caso que precisa de atencao, e
 * aprovar de novo a mesma candidatura conclui o passo que faltou.
 */
function EstadoDaAprovacao({ linha }: { linha: ResumoPorDisciplina }) {
  if (linha.monitoriaCadastrada) {
    return (
      <p className="flex items-center gap-1 text-xs font-semibold text-sucesso">
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
        {linha.monitoresHabilitados === 1
          ? '1 monitor habilitado'
          : `${linha.monitoresHabilitados} monitores habilitados`}
      </p>
    );
  }

  if (linha.monitoriaId !== null) {
    return (
      <p className="flex items-center gap-1 text-xs font-semibold text-alerta">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
        Monitoria sem monitor
      </p>
    );
  }

  return null;
}

function Cartao({
  titulo,
  subtitulo,
  selecionado,
  aoEscolher,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  selecionado: boolean;
  aoEscolher: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      onClick={aoEscolher}
      className={cn(
        'w-44 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaria focus-visible:ring-offset-2',
        selecionado
          ? 'border-primaria bg-primaria-suave'
          : 'border-borda bg-superficie hover:border-primaria/50 hover:bg-fundo-suave',
      )}
    >
      <span
        className={cn(
          'block truncate font-mono text-xs font-semibold',
          selecionado ? 'text-primaria' : 'text-texto',
        )}
      >
        {titulo}
      </span>

      {/* O nome completo no `title`: o código sozinho não diz nada a quem não o decora. */}
      <span className="block truncate text-sm font-medium text-texto" title={subtitulo}>
        {subtitulo ?? ' '}
      </span>

      <span className="mt-1 block space-y-0.5">{children}</span>
    </button>
  );
}
