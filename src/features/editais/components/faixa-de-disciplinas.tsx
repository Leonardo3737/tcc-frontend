'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trophy } from 'lucide-react';

import { CampoBusca } from '@/components/comum/campo-busca';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ResumoPorDisciplina } from '@/types/dominio';

/**
 * A partir de quantas disciplinas a busca aparece.
 *
 * Com meia duzia de cartoes, procurar e olhar: um campo de busca ali so
 * acrescentaria um controle a uma tela que ja resolve. O campo surge quando a
 * faixa deixa de caber de uma vez na tela.
 */
const MINIMO_PARA_BUSCAR = 8;

/** Compara ignorando acento e caixa — ninguem digita "Cálculo" com o acento. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

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
 * Por que cartoes e nao abas: a aba mostra so o rotulo, e esconde justamente
 * o que este endpoint existe para dizer — onde ha poucos candidatos, onde
 * ninguem tem nota, onde a monitoria ficou sem monitor. O cartao carrega esses
 * numeros, entao o panorama fica visivel sem clicar em nada.
 *
 * A faixa e UMA linha com rolagem horizontal, nunca quebrada em varias. Um
 * edital real chegou a 84 disciplinas: quebrada, a faixa tomava a tela inteira
 * e empurrava a lista de candidatos — o trabalho de verdade — para fora da
 * dobra. Em uma linha ela custa altura fixa, seja o edital de 3 ou de 300
 * disciplinas, e procurar uma especifica e trabalho da busca, nao do olho.
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
  const [termo, setTermo] = useState('');
  const faixa = useRef<HTMLDivElement>(null);

  /**
   * Traz o cartao selecionado para a vista.
   *
   * Em uma linha so, a disciplina escolhida pode estar a dezenas de cartoes
   * da borda. Chegando por URL (`?disciplina=`) ela ficaria fora da tela, e a
   * listagem abaixo pareceria sem recorte nenhum — o oposto do que acontece.
   */
  useEffect(() => {
    const alvo = faixa.current?.querySelector('[aria-checked="true"]');
    alvo?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [disciplinaId, termo]);

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

  const procurado = normalizar(termo.trim());

  /**
   * O cartao SELECIONADO nunca e filtrado para fora.
   *
   * Sem isso, digitar algo que nao case com a disciplina escolhida tiraria o
   * unico indicador visivel do recorte, e a listagem abaixo apareceria
   * encurtada sem nada na tela explicando por que.
   */
  const visiveis = procurado
    ? ordenado.filter(
        (linha) =>
          linha.disciplina.id === disciplinaId ||
          normalizar(linha.disciplina.codigo).includes(procurado) ||
          normalizar(linha.disciplina.nome).includes(procurado),
      )
    : ordenado;

  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-[1.2rem] font-semibold">Disciplinas</h3>

        {ordenado.length >= MINIMO_PARA_BUSCAR && (
          <CampoBusca
            valorInicial={termo}
            aoBuscar={setTermo}
            /*
              Sem espera: o debounce de `CampoBusca` existe para nao gastar o
              rate limit do backend a cada tecla. Aqui o resumo inteiro ja
              esta em memoria, e atrasar so faria o filtro parecer travado.
            */
            atrasoMs={0}
            placeholder="Busque a disciplina…"
            rotulo="Buscar disciplina"
            className="sm:w-72"
          />
        )}
      </div>

      {/*
        UMA linha, com rolagem horizontal — nunca quebrando em varias.

        Com 84 disciplinas a faixa quebrada ocupava a tela inteira e empurrava
        a lista de candidatos, que e o trabalho de verdade, para fora da
        dobra. Em uma linha o panorama custa altura fixa, independente do
        tamanho do edital, e quem procura uma disciplina especifica usa a
        busca em vez de varrer a parede com os olhos.

        `group` de radio: sao opcoes mutuamente exclusivas de um mesmo
        recorte, nao botoes soltos. E isso que faz o leitor de tela anunciar
        "2 de 5".
      */}
      <div
        ref={faixa}
        role="radiogroup"
        aria-label="Filtrar candidaturas por disciplina"
        className="flex gap-3 overflow-x-auto pb-2 rolagem-faixa"
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

        {visiveis.map((linha) => (
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
        Duas coisas diferentes, e a busca tem precedencia: quem acabou de
        digitar precisa saber o que o termo alcancou, nao reler a nota de
        rodape.

        A nota fixa existe porque o edital nao declara as disciplinas que
        oferece — esta faixa e o que CHEGOU, nao o que foi ofertado. Dizer
        isso evita a leitura de que uma disciplina ausente nao faz parte do
        edital.
      */}
      <p className="mt-1 text-xs text-texto-suave" aria-live="polite">
        {procurado
          ? visiveis.length === 0
            ? `Nenhuma disciplina corresponde a “${termo.trim()}”.`
            : `${visiveis.length} de ${ordenado.length} disciplinas correspondem a “${termo.trim()}”.`
          : 'Apenas disciplinas que receberam candidatura aparecem aqui.'}
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
