'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Sheet,
  FileX2,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { CampoBusca } from '@/components/comum/campo-busca';
import { Paginacao } from '@/components/comum/paginacao';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, classesBotao } from '@/components/ui/button';
import { Select } from '@/components/ui/campo';
import { Card, CardConteudo } from '@/components/ui/card';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import {
  Tabela,
  TabelaCabecalho,
  TabelaCabecalhoCelula,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
} from '@/components/ui/tabela';
import { toast } from '@/components/ui/toast';
import { FiltroDeCurso } from '@/features/cursos/components/seletor-de-cursos';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { mensagemDeErro } from '@/lib/api/erros';
import { formatarDataHora } from '@/lib/datas/fuso';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';
import { useSessao } from '@/providers/sessao-provider';
import { Turno, type Edital, type InscricaoEdital } from '@/types/dominio';
import {
  aprovarInscricao,
  exportarInscricoes,
  listarInscricoes,
  resumoPorDisciplina,
  urlDoBoletim,
  type CampoOrdenacaoInscricao,
  type DirecaoOrdenacao,
} from '../api/inscricoes.service';
import type { SituacaoEdital } from '../situacao';
import { FaixaDeDisciplinas } from './faixa-de-disciplinas';

const ROTULO_TURNO: Record<Turno, string> = {
  [Turno.MATUTINO]: 'Matutino',
  [Turno.VESPERTINO]: 'Vespertino',
  [Turno.NOTURNO]: 'Noturno',
};

const CAMPOS_ORDENAVEIS: Array<{ campo: CampoOrdenacaoInscricao; rotulo: string }> = [
  { campo: 'media', rotulo: 'Média' },
  { campo: 'n1', rotulo: 'N1' },
  { campo: 'n2', rotulo: 'N2' },
  { campo: 'nome', rotulo: 'Nome' },
  { campo: 'matricula', rotulo: 'Matrícula' },
  { campo: 'criadoEm', rotulo: 'Inscrição' },
];

/** `numeric` do backend chega como número; ausente é NULO, nunca zero. */
function nota(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(2).replace('.', ',');
}

/**
 * Candidaturas do edital.
 *
 * Ordenacao, filtros e paginacao sao TODOS do servidor. Carregar tudo para
 * ordenar no navegador quebraria na segunda pagina — o "maior" pode estar na
 * proxima — e e exatamente o que o backend oferece pronto, com NULLS LAST para
 * que "sem nota" nunca seja lido como "nota baixa".
 */
export function ListaInscricoes({
  edital,
  situacao,
}: {
  edital: Edital;
  situacao: SituacaoEdital;
}) {
  const { fuso } = useSessao();
  const { obter, obterNumero, definir, pendente } = useFiltrosUrl();
  const [detalhe, setDetalhe] = useState<InscricaoEdital | null>(null);
  const [erroAprovacao, setErroAprovacao] = useState<string | null>(null);
  const [erroExportacao, setErroExportacao] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const busca = obter('busca');
  const cursoId = obter('curso');
  const disciplinaId = obter('disciplina');
  const turno = obter('turno');
  const ordenarPor = (obter('ordem', 'media') || 'media') as CampoOrdenacaoInscricao;
  const direcao = (obter('dir', 'desc') || 'desc') as DirecaoOrdenacao;
  const pagina = obterNumero('pagina', 1);

  const filtro = {
    editalId: edital.id,
    busca: busca || undefined,
    cursoId: cursoId || undefined,
    disciplinaId: disciplinaId || undefined,
    turno: (turno || undefined) as Turno | undefined,
    ordenarPor,
    direcao,
    pagina,
    limite: 20,
  };

  const consulta = useQuery({
    queryKey: chaves.inscricoes.lista(filtro),
    queryFn: () => listarInscricoes(filtro),
  });

  /**
   * Panorama por disciplina. Recebe os MESMOS filtros da lista (menos pagina e
   * ordenacao): sem isso o numero do cartao nao bateria com o conteudo logo
   * abaixo dele.
   */
  const filtroResumo = {
    editalId: edital.id,
    busca: busca || undefined,
    cursoId: cursoId || undefined,
    turno: (turno || undefined) as Turno | undefined,
  };

  const resumo = useQuery({
    queryKey: chaves.inscricoes.resumo(filtroResumo),
    queryFn: () => resumoPorDisciplina(filtroResumo),
  });

  /**
   * MAIOR MEDIA DA DISCIPLINA do candidato — nao do edital inteiro.
   *
   * A selecao de monitor acontece por disciplina: um edital com sete
   * disciplinas tem sete aprovados. Marcar so a maior media geral apontava uma
   * pessoa e deixava as outras seis sem destaque nenhum. O resumo ja traz
   * `melhorMedia` por disciplina, entao a correcao sai de graca — e some a
   * consulta separada que existia para isso.
   *
   * Nao se usa a primeira linha da TABELA: ela depende do filtro, da ordenacao
   * escolhida e da pagina. "Quem esta no topo da tela" nao e "quem tem a maior
   * media da disciplina".
   */
  const melhorPorDisciplina = new Map(
    (resumo.data ?? []).map((linha) => [linha.disciplina.id, linha.melhorMedia]),
  );

  const ehPrimeiroColocado = (inscricao: InscricaoEdital) => {
    if (situacao !== 'ENCERRADO') return false;

    const melhor = melhorPorDisciplina.get(inscricao.disciplina.id) ?? null;

    return (
      melhor !== null &&
      // Media ausente nunca e primeiro lugar: falta de nota nao e nota baixa.
      inscricao.media !== null &&
      // Empate na maior media marca TODOS os empatados, nao so um.
      inscricao.media === melhor
    );
  };

  /**
   * Aprovacao da candidatura.
   *
   * O toast relata o que DE FATO aconteceu, e nao um texto fixo: a operacao
   * tem tres passos de "encontrar ou criar", e dizer "conta criada, senha
   * enviada" quando a conta ja existia faria o monitor esperar um e-mail que
   * nunca sai.
   */
  const aprovar = useMutation({
    mutationFn: aprovarInscricao,

    onSuccess: (resultado) => {
      /**
       * Invalida tambem monitorias: a aprovacao cria uma, e a lista lateral de
       * "suas monitorias" passaria a divergir do que acabou de acontecer.
       */
      void queryClient.invalidateQueries({ queryKey: chaves.inscricoes.raiz });
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.raiz });

      const sobreMonitoria = resultado.monitoria.criada
        ? 'Monitoria criada'
        : 'Monitor acrescentado à monitoria que já existia';

      const sobreConta = resultado.monitor.contaCriada
        ? ' A conta foi criada e a senha provisória foi enviada por e-mail.'
        : ' A conta já existia e foi reaproveitada — nenhuma credencial foi enviada.';

      toast.sucesso(`${resultado.monitor.nome} é monitor`, sobreMonitoria + '.' + sobreConta);
      setDetalhe(null);
      setErroAprovacao(null);
    },

    /**
     * A operacao NAO e atomica, por decisao do backend: pode parar entre criar
     * a monitoria e habilitar o monitor. Como ela e repetivel, a mensagem fica
     * no dialogo (que segue aberto) em vez de virar um toast que some — o
     * caminho para resolver e tentar de novo ali mesmo.
     */
    onError: (erro) => setErroAprovacao(mensagemDeErro(erro)),
  });

  /**
   * Exportacao em planilha.
   *
   * O arquivo e binario e esta rota tem erro de dominio (409 acima do teto de
   * linhas), entao passa por `exportarInscricoes` — que le o blob — e nao por
   * um link, que mostraria JSON cru no lugar do download.
   */
  const exportar = useMutation({
    mutationFn: () =>
      exportarInscricoes({
        editalId: edital.id,
        busca: busca || undefined,
        cursoId: cursoId || undefined,
        disciplinaId: disciplinaId || undefined,
        turno: (turno || undefined) as Turno | undefined,
        ordenarPor,
        direcao,
      }),

    onSuccess: ({ total }) => {
      setErroExportacao(null);
      toast.sucesso(
        'Planilha baixada',
        total === null
          ? 'A exportação foi concluída.'
          : total === 1
            ? '1 inscrição exportada.'
            : `${total} inscrições exportadas.`,
      );
    },

    onError: (erro) => setErroExportacao(mensagemDeErro(erro)),
  });

  const semCandidaturas = consulta.isSuccess && consulta.data.meta.total === 0;
  const temFiltro = Boolean(busca || cursoId || disciplinaId || turno);

  const limpar = () =>
    definir({
      busca: undefined,
      curso: undefined,
      disciplina: undefined,
      turno: undefined,
      pagina: undefined,
    });

  /** Trocar filtro ou ordenação reinicia a página: a 3 do recorte anterior raramente existe. */
  const filtrar = (novos: Record<string, string | number | undefined>) =>
    definir({ ...novos, pagina: undefined });

  const alternarOrdem = (campo: CampoOrdenacaoInscricao) => {
    const mesma = ordenarPor === campo;
    filtrar({ ordem: campo, dir: mesma && direcao === 'desc' ? 'asc' : 'desc' });
  };

  return (
    <div className="space-y-4">
      <FaixaDeDisciplinas
        resumo={resumo.data ?? []}
        carregando={resumo.isPending}
        erro={resumo.isError}
        disciplinaId={disciplinaId}
        totalGeral={(resumo.data ?? []).reduce((soma, linha) => soma + linha.totalInscricoes, 0)}
        aoEscolher={(nova) => filtrar({ disciplina: nova })}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <CampoBusca
          valorInicial={busca}
          aoBuscar={(termo) => filtrar({ busca: termo })}
          placeholder="Buscar por nome, matrícula ou e-mail…"
          rotulo="Buscar candidatos"
          carregando={pendente || consulta.isFetching}
          className="flex-1"
        />

        {/*
          Trocar o curso limpa a disciplina: a anterior pode não pertencer ao
          curso novo, e o par incoerente devolveria lista vazia sem explicar
          por quê.
        */}
        <FiltroDeCurso
          className="shrink-0 lg:w-52"
          valor={cursoId}
          aoMudar={(novo) => filtrar({ curso: novo, disciplina: undefined })}
        />

        <Select
          label="Turno"
          className="shrink-0 lg:w-40 [&>label]:sr-only"
          value={turno}
          onChange={(evento) => filtrar({ turno: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Todos os turnos' },
            ...Object.values(Turno).map((item) => ({
              valor: item,
              rotulo: ROTULO_TURNO[item],
            })),
          ]}
        />

        {temFiltro && (
          <Button variante="fantasma" tamanho="sm" className="shrink-0" onClick={limpar}>
            Limpar filtros
          </Button>
        )}

        {/*
          A exportação leva os filtros ATIVOS, não o edital inteiro: a planilha
          precisa conter exatamente o que está na tela. Entregar à reunião uma
          lista diferente da que foi conferida é pior do que não exportar.
        */}
        <Button
          variante="secundaria"
          onClick={() => exportar.mutate()}
          carregando={exportar.isPending}
          disabled={exportar.isPending || semCandidaturas}
          className="shrink-0 lg:ml-auto"
          iconeEsquerda={<Sheet className="h-4 w-4" aria-hidden />}
        >
          {exportar.isPending ? 'Gerando…' : 'Exportar'}
        </Button>
      </div>

      {/*
        O erro da exportação fica NA TELA, não num toast: o caso real é o teto
        de linhas (409), e a mensagem diz o que fazer — filtrar para reduzir o
        recorte. Um aviso que some não deixaria ler isso.
      */}
      {erroExportacao && (
        <Alert tom="erro" titulo="Não foi possível exportar">
          {erroExportacao}
        </Alert>
      )}

      {/* Ordenação em botões no mobile: os cabeçalhos da tabela não existem lá. */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <span className="text-xs text-texto-suave">Ordenar por</span>
        {CAMPOS_ORDENAVEIS.map(({ campo, rotulo }) => (
          <BotaoOrdem
            key={campo}
            rotulo={rotulo}
            ativo={ordenarPor === campo}
            direcao={direcao}
            aoClicar={() => alternarOrdem(campo)}
          />
        ))}
      </div>

      {consulta.isPending && <SkeletonLista itens={5} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<Users className="h-8 w-8" aria-hidden />}
          titulo={temFiltro ? 'Nenhuma candidatura encontrada' : 'Nenhuma inscrição ainda'}
          descricao={
            temFiltro
              ? 'Nada corresponde aos filtros aplicados.'
              : situacao === 'ABERTO'
                ? 'As inscrições estão abertas. As candidaturas aparecem aqui assim que chegarem.'
                : 'Este edital não recebeu candidaturas.'
          }
          acao={
            temFiltro && (
              <Button variante="secundaria" onClick={limpar}>
                Limpar filtros
              </Button>
            )
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <Card>
          <div className="hidden overflow-x-auto md:block">
            <Tabela>
              <TabelaCabecalho>
                <TabelaLinha>
                  <ColunaOrdenavel
                    rotulo="Candidato"
                    campo="nome"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <TabelaCabecalhoCelula>Curso · Disciplina</TabelaCabecalhoCelula>
                  <TabelaCabecalhoCelula>Turno</TabelaCabecalhoCelula>
                  <ColunaOrdenavel
                    rotulo="N1"
                    campo="n1"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <ColunaOrdenavel
                    rotulo="N2"
                    campo="n2"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <ColunaOrdenavel
                    rotulo="Média"
                    campo="media"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <TabelaCabecalhoCelula className="text-right">Ações</TabelaCabecalhoCelula>
                </TabelaLinha>
              </TabelaCabecalho>

              <TabelaCorpo>
                {consulta.data.dados.map((inscricao) => (
                  <TabelaLinha
                    key={inscricao.id}
                    className={cn(ehPrimeiroColocado(inscricao) && 'bg-sucesso-suave/40')}
                  >
                    <TabelaCelula>
                      <span className="flex items-center gap-2">
                        {ehPrimeiroColocado(inscricao) && (
                          <Trophy
                            className="h-4 w-4 shrink-0 text-acento-forte"
                            aria-label="Maior média da disciplina"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-texto">
                            {inscricao.nomeCompleto}
                          </span>
                          <span className="block truncate text-xs text-texto-suave">
                            {inscricao.matricula} · {inscricao.email}
                          </span>
                        </span>
                      </span>
                    </TabelaCelula>

                    <TabelaCelula>
                      <span className="block text-sm text-texto">{inscricao.disciplina.nome}</span>
                      <span className="block text-xs text-texto-suave">
                        {inscricao.curso.nome}
                      </span>
                    </TabelaCelula>

                    <TabelaCelula className="text-sm">
                      {ROTULO_TURNO[inscricao.turno]}
                    </TabelaCelula>
                    <TabelaCelula className="tabular-nums">{nota(inscricao.n1)}</TabelaCelula>
                    <TabelaCelula className="tabular-nums">{nota(inscricao.n2)}</TabelaCelula>
                    <TabelaCelula className="font-semibold tabular-nums">
                      {nota(inscricao.media)}
                    </TabelaCelula>

                    <TabelaCelula className="text-right">
                      <Button
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => setDetalhe(inscricao)}
                      >
                        Detalhes
                      </Button>
                    </TabelaCelula>
                  </TabelaLinha>
                ))}
              </TabelaCorpo>
            </Tabela>
          </div>

          {/* Cartões no mobile: 7 colunas não cabem em 375px. */}
          <div className="divide-y divide-borda md:hidden">
            {consulta.data.dados.map((inscricao) => (
              <div key={inscricao.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-texto">
                      {ehPrimeiroColocado(inscricao) && (
                        <Trophy
                          className="h-3.5 w-3.5 shrink-0 text-acento-forte"
                          aria-label="Maior média da disciplina"
                        />
                      )}
                      <span className="truncate">{inscricao.nomeCompleto}</span>
                    </p>
                    <p className="truncate text-xs text-texto-suave">{inscricao.matricula}</p>
                  </div>

                  <Badge tom="neutro">{nota(inscricao.media)}</Badge>
                </div>

                <p className="text-xs text-texto-suave">
                  {inscricao.disciplina.nome} · {ROTULO_TURNO[inscricao.turno]}
                </p>

                <Button
                  variante="secundaria"
                  tamanho="sm"
                  className="w-full"
                  onClick={() => setDetalhe(inscricao)}
                >
                  Detalhes
                </Button>
              </div>
            ))}
          </div>

          <CardConteudo className="pt-0">
            <Paginacao
              meta={consulta.data.meta}
              aoMudarPagina={(nova) => definir({ pagina: nova })}
              desabilitado={consulta.isFetching}
            />
          </CardConteudo>
        </Card>
      )}

      <DialogoInscricao
        inscricao={detalhe}
        fuso={fuso}
        situacao={situacao}
        aoFechar={() => {
          setDetalhe(null);
          setErroAprovacao(null);
        }}
        aoAprovar={() => detalhe && aprovar.mutate(detalhe.id)}
        aprovando={aprovar.isPending}
        erroAprovacao={erroAprovacao}
      />

    </div>
  );
}

// ---------------------------------------------------------------------------

function ColunaOrdenavel({
  rotulo,
  campo,
  atual,
  direcao,
  aoOrdenar,
}: {
  rotulo: string;
  campo: CampoOrdenacaoInscricao;
  atual: CampoOrdenacaoInscricao;
  direcao: DirecaoOrdenacao;
  aoOrdenar: (campo: CampoOrdenacaoInscricao) => void;
}) {
  const ativo = atual === campo;

  return (
    <TabelaCabecalhoCelula
      // `aria-sort` é o que anuncia a ordenação ativa a leitores de tela; o
      // ícone sozinho só comunica a quem enxerga.
      aria-sort={ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => aoOrdenar(campo)}
        className={cn(
          'inline-flex items-center gap-1 rounded transition-colors hover:text-texto',
          ativo && 'font-semibold text-texto',
        )}
      >
        {rotulo}
        {ativo &&
          (direcao === 'asc' ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          ))}
      </button>
    </TabelaCabecalhoCelula>
  );
}

function BotaoOrdem({
  rotulo,
  ativo,
  direcao,
  aoClicar,
}: {
  rotulo: string;
  ativo: boolean;
  direcao: DirecaoOrdenacao;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
        ativo
          ? 'border-primaria bg-primaria-suave font-semibold text-primaria'
          : 'border-borda-forte text-texto-suave',
      )}
    >
      {rotulo}
      {ativo &&
        (direcao === 'asc' ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        ))}
    </button>
  );
}

/**
 * Detalhe da candidatura, com o boletim e o atalho de cadastro.
 *
 * O PDF e baixado pela rota PROTEGIDA (`/inscricoes/:id/boletim`), atraves do
 * proxy: o cookie httpOnly acompanha e o backend confere o perfil. Nao existe
 * URL publica para o documento, e esta tela nao cria uma.
 */
function DialogoInscricao({
  inscricao,
  fuso,
  situacao,
  aoFechar,
  aoAprovar,
  aprovando,
  erroAprovacao,
}: {
  inscricao: InscricaoEdital | null;
  fuso: string;
  situacao: SituacaoEdital;
  aoFechar: () => void;
  aoAprovar: () => void;
  aprovando: boolean;
  erroAprovacao: string | null;
}) {
  if (!inscricao) return null;

  const jaTemConta = inscricao.alunoCadastrado !== null;

  return (
    <Dialog open onOpenChange={(estado) => !estado && aoFechar()}>
      <DialogConteudo titulo={inscricao.nomeCompleto} descricao={inscricao.email}>
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Dado rotulo="Matrícula" valor={inscricao.matricula} />
            <Dado rotulo="Turno" valor={ROTULO_TURNO[inscricao.turno]} />
            <Dado rotulo="Curso" valor={inscricao.curso.nome} />
            <Dado rotulo="Disciplina" valor={inscricao.disciplina.nome} />
            <Dado rotulo="Professor responsável" valor={inscricao.professor.nome ?? '—'} />
            <Dado rotulo="Inscrição" valor={formatarDataHora(inscricao.criadoEm, fuso)} />
            <Dado rotulo="N1" valor={nota(inscricao.n1)} />
            <Dado rotulo="N2" valor={nota(inscricao.n2)} />
            <Dado rotulo="Média final" valor={nota(inscricao.media)} />
          </dl>

          {inscricao.boletim ? (
            <a
              href={urlDoBoletim(inscricao.id)}
              className={classesBotao('secundaria', 'md', 'w-full')}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Baixar boletim
            </a>
          ) : (
            <p className="flex items-center gap-2 rounded-md bg-fundo-suave px-3 py-2 text-sm text-texto-suave">
              <FileX2 className="h-4 w-4 shrink-0" aria-hidden />
              Esta candidatura não tem boletim anexado.
            </p>
          )}

          {erroAprovacao && (
            <Alert tom="erro" titulo="Não foi possível aprovar">
              {erroAprovacao}
            </Alert>
          )}

          {/*
            Aprovar NÃO é privilégio do primeiro colocado.
            
            Uma disciplina pode ter mais de uma vaga, e o backend reaproveita a
            monitoria ao aprovar o segundo. Oferecer o botão só a quem tem a
            maior média impediria o caso normal — o troféu continua apontando o
            melhor, como orientação, não como trava.
          */}
          <div className="space-y-2 rounded-lg border border-borda bg-fundo-suave/60 p-3">
            <p className="text-sm text-texto">
              Aprovar cria a monitoria de <strong>{inscricao.disciplina.nome}</strong> (ou
              reaproveita a que já existe neste semestre) e habilita{' '}
              <strong>{inscricao.nomeCompleto}</strong> como monitor.
            </p>

            {/*
              Quem fica como responsável é quem clica — a RN01 exige que quem
              habilita seja o responsável pela monitoria. O professor indicado
              na candidatura é indicação, não atribuição.
            */}
            {inscricao.professor.nome
              ?
              <p className="text-xs text-texto-suave">
                {inscricao.professor.nome} fica como professor responsável pela monitoria.
              </p>
              : <></>}

            <p className="text-xs text-texto-suave">
              {jaTemConta
                ? 'Esta matrícula já tem conta na plataforma — nenhuma credencial será enviada.'
                : 'A conta do candidato será criada e a senha provisória vai para o e-mail dele.'}
            </p>

            {/*
              O backend não exige edital encerrado, e não inventamos a regra —
              mas aprovar com inscrição em andamento é decisão que merece ser
              dita em voz alta.
            */}
            {situacao === 'ABERTO' && (
              <p className="text-xs text-alerta">
                As inscrições ainda estão abertas: outros candidatos podem se inscrever.
              </p>
            )}

            <Button
              className="w-full"
              carregando={aprovando}
              disabled={aprovando}
              onClick={aoAprovar}
              iconeEsquerda={<UserCheck className="h-4 w-4" aria-hidden />}
            >
              {aprovando ? 'Aprovando…' : 'Aprovar candidatura'}
            </Button>
          </div>
        </div>
      </DialogConteudo>
    </Dialog>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="font-medium text-texto">{valor}</dd>
    </div>
  );
}
